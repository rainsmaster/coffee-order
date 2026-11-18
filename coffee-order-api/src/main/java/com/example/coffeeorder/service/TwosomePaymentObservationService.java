package com.example.coffeeorder.service;

import com.example.coffeeorder.dto.*;
import com.example.coffeeorder.entity.*;
import com.example.coffeeorder.exception.TwosomeStoreException;
import com.example.coffeeorder.exception.TwosomeStoreSessionExpiredException;
import com.example.coffeeorder.repository.*;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.function.Supplier;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class TwosomePaymentObservationService {

    private static final String STORE_CD = "1102115";
    private static final String STORE_NM = "CJENM커머스부문점";
    private static final Duration LOCK_WAIT = Duration.ofSeconds(2);
    private static final Duration LOCK_LEASE = Duration.ZERO;
    private static final Duration REFRESH_INTERVAL = Duration.ofMillis(2500);
    private static final Duration RECEIPT_RETRY_INTERVAL = Duration.ofMinutes(1);
    private static final Duration OBSERVATION_TIMEOUT = Duration.ofHours(24);
    private static final Duration HOLD_TIMEOUT = Duration.ofMinutes(30);

    private final TwosomeStoreIntegrationService integrationService;
    private final TwosomeOrderHistoryParser parser;
    private final TwosomeCartOrderMatcher matcher;
    private final TwosomePaymentOrderPersistenceService persistenceService;
    private final PaymentAttemptRepository attemptRepository;
    private final CartSnapshotRepository snapshotRepository;
    private final ExternalOrderRepository externalOrderRepository;
    private final ExternalOrderItemRepository itemRepository;
    private final PaymentAttemptOrderRepository attemptOrderRepository;
    private final DistributedLockService lockService;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    public RepTwosomeOrderView startObservation(Long repMemberId) {
        return startObservation(repMemberId, List.of());
    }

    public RepTwosomeOrderView startObservation(Long repMemberId, List<Long> orderIds) {
        return executeRemote(repMemberId, () -> lockService.tryWithLock(
                        lockKey(repMemberId), LOCK_WAIT, LOCK_LEASE,
                        () -> startOrRefreshLocked(repMemberId, orderIds))
                .orElseGet(() -> view(repMemberId, "LOCK_BUSY", "다른 확인 작업이 진행 중입니다.", true)));
    }

    public RepTwosomeOrderView resetObservation(Long repMemberId) {
        return executeRemote(repMemberId, () -> lockService.tryWithLock(
                        lockKey(repMemberId), LOCK_WAIT, LOCK_LEASE, () -> {
                            attemptRepository.findFirstByRepMemberIdAndActiveKeyIsNotNullOrderByIdDesc(repMemberId)
                                    .ifPresent(attempt -> expireAttempt(attempt, "현재 장바구니 기준으로 관찰을 다시 시작합니다."));
                            return startOrRefreshLocked(repMemberId, List.of());
                        })
                .orElseGet(() -> view(repMemberId, "LOCK_BUSY", "다른 확인 작업이 진행 중입니다.", true)));
    }

    public RepTwosomeOrderView refresh(Long repMemberId) {
        Boolean allowed = redisTemplate.opsForValue().setIfAbsent(
                throttleKey(repMemberId), "1", REFRESH_INTERVAL);
        if (!Boolean.TRUE.equals(allowed)) {
            return view(repMemberId, "THROTTLED", null, true);
        }
        return executeRemote(repMemberId, () -> lockService.tryWithLock(
                        lockKey(repMemberId), LOCK_WAIT, LOCK_LEASE, () -> refreshLocked(repMemberId))
                .orElseGet(() -> view(repMemberId, "LOCK_BUSY", "다른 확인 작업이 진행 중입니다.", true)));
    }

    public RepTwosomeOrderView getView(Long repMemberId) {
        return view(repMemberId, "IDLE", null, false);
    }

    private RepTwosomeOrderView executeRemote(Long repMemberId,
                                              Supplier<RepTwosomeOrderView> action) {
        try {
            return action.get();
        } catch (TwosomeStoreSessionExpiredException e) {
            throw e;
        } catch (TwosomeStoreException e) {
            log.warn("Payment observation paused (repMemberId={}): {}", repMemberId, e.getMessage());
            return view(repMemberId, "CHECK_UNAVAILABLE",
                    "일시적으로 확인할 수 없습니다. 저장된 스냅숏은 유지하며 다음 조회에서 다시 시도합니다.", false);
        }
    }

    private RepTwosomeOrderView startOrRefreshLocked(Long repMemberId, List<Long> orderIds) {
        Optional<PaymentAttempt> existing = attemptRepository
                .findFirstByRepMemberIdAndActiveKeyIsNotNullOrderByIdDesc(repMemberId);
        if (existing.isPresent() && !expireIfNeeded(existing.get())) {
            persistenceService.registerLocalOrders(existing.get(), orderIds);
            return observeActive(existing.get());
        }
        PaymentAttempt attempt = new PaymentAttempt();
        attempt.setRepMemberId(repMemberId);
        attempt.setStoreCd(STORE_CD);
        attempt.setStatus("BASELINE_PENDING");
        attempt.setBaselineCaptured(false);
        attempt.setActiveKey(TwosomeStoreIntegrationService.repSessionKey(repMemberId));
        attempt = attemptRepository.save(attempt);
        persistenceService.registerLocalOrders(attempt, orderIds);
        return captureBaseline(attempt);
    }

    private RepTwosomeOrderView refreshLocked(Long repMemberId) {
        Optional<PaymentAttempt> active = attemptRepository
                .findFirstByRepMemberIdAndActiveKeyIsNotNullOrderByIdDesc(repMemberId);
        if (active.isPresent()) {
            if (expireIfNeeded(active.get())) {
                return view(repMemberId, "EXPIRED", "오래된 결제 관찰을 종료했습니다. 현재 장바구니로 다시 관찰할 수 있습니다.", false);
            }
            return observeActive(active.get());
        }
        List<ExternalOrder> orders = externalOrderRepository.findTop20ByRepMemberIdOrderByOrderedAtDesc(repMemberId);
        if (orders.stream().noneMatch(this::needsRefresh)) {
            return view(repMemberId, "IDLE", null, false);
        }
        List<TwosomeOrderHistory.Summary> summaries = fetchHistory(repMemberId);
        refreshKnownOrders(repMemberId, summaries, orders);
        return view(repMemberId, "UPDATED", null, false);
    }

    private RepTwosomeOrderView captureBaseline(PaymentAttempt attempt) {
        Long repMemberId = attempt.getRepMemberId();
        String sessionKey = sessionKey(repMemberId);
        List<TwosomeCartItemResponse> rawBefore = integrationService.getCartItems(sessionKey);
        String rawHashBefore = rawHash(rawBefore);
        List<TwosomeOrderHistory.Summary> summaries = fetchHistory(repMemberId);
        List<TwosomeCartItemResponse> rawAfter = integrationService.getCartItems(sessionKey);
        if (!rawHashBefore.equals(rawHash(rawAfter))) {
            throw new TwosomeStoreException("장바구니가 변경 중이라 결제 기준점을 아직 고정하지 않았습니다.");
        }
        List<TwosomeCartSnapshotEntry> entries = captureCartEntries(sessionKey, rawBefore);
        if (!rawHashBefore.equals(rawHash(integrationService.getCartItems(sessionKey)))) {
            throw new TwosomeStoreException("옵션 확인 중 장바구니가 변경되어 결제 기준점을 저장하지 않았습니다.");
        }
        persistenceService.captureBaseline(attempt,
                summaries.stream().map(TwosomeOrderHistory.Summary::ordNo).toList(),
                rawHashBefore, entriesHash(entries), write(entries));
        return view(repMemberId, "WATCHING", "결제 전 장바구니 기준점을 저장했습니다.", false);
    }

    private boolean expireIfNeeded(PaymentAttempt attempt) {
        if (attempt.getCreatedAt() == null) {
            return false;
        }
        boolean held = "HOLD".equals(attempt.getStatus());
        LocalDateTime reference = held && attempt.getUpdatedAt() != null
                ? attempt.getUpdatedAt() : attempt.getCreatedAt();
        Duration timeout = held ? HOLD_TIMEOUT : OBSERVATION_TIMEOUT;
        if (reference.plus(timeout).isAfter(LocalDateTime.now())) {
            return false;
        }
        expireAttempt(attempt, held
                ? "자동 연결 보류 상태가 30분간 해소되지 않아 관찰을 종료했습니다."
                : "결제 관찰 시작 후 24시간이 지나 관찰을 종료했습니다.");
        return true;
    }

    private void expireAttempt(PaymentAttempt attempt, String reason) {
        attempt.setStatus("EXPIRED");
        attempt.setActiveKey(null);
        attempt.setHoldReason(reason);
        persistenceService.expire(attempt, reason);
    }

    private RepTwosomeOrderView observeActive(PaymentAttempt attempt) {
        if (!attempt.isBaselineCaptured()) {
            return captureBaseline(attempt);
        }
        Long repMemberId = attempt.getRepMemberId();
        String sessionKey = sessionKey(repMemberId);
        CartSnapshot before = snapshotRepository.findTopByAttemptIdOrderByVersionDesc(attempt.getId())
                .orElseThrow(() -> new TwosomeStoreException("저장된 장바구니 스냅숏을 찾지 못했습니다."));

        List<TwosomeCartItemResponse> rawCart = integrationService.getCartItems(sessionKey);
        String currentRawHash = rawHash(rawCart);
        List<TwosomeOrderHistory.Summary> summaries = fetchHistory(repMemberId);
        Set<String> baseline = new HashSet<>(read(attempt.getBaselineOrderNosJson(),
                new TypeReference<List<String>>() {
                }, List.of()));
        List<TwosomeOrderHistory.Summary> candidates = candidates(summaries, baseline);

        if (candidates.isEmpty() && !currentRawHash.equals(before.getRawHash())) {
            summaries = fetchHistory(repMemberId);
            candidates = candidates(summaries, baseline);
        }

        if (candidates.size() > 1) {
            hold(attempt, "새 주문 후보가 " + candidates.size() + "건입니다. 분할 결제는 자동 연결하지 않습니다.");
            return view(repMemberId, "HOLD", null, false);
        }
        if (candidates.size() == 1) {
            return linkCandidate(attempt, before, candidates.get(0), rawCart, currentRawHash);
        }

        if (!currentRawHash.equals(before.getRawHash())) {
            List<TwosomeCartSnapshotEntry> entries = captureCartEntries(sessionKey, rawCart);
            persistenceService.appendSnapshot(attempt, before.getVersion() + 1,
                    currentRawHash, entriesHash(entries), write(entries));
        }
        String message = rawCart.isEmpty()
                ? "장바구니가 비어 있어도 결제 완료로 판정하지 않고 주문내역을 계속 확인합니다."
                : "결제 전 장바구니 변경과 새 주문을 확인하고 있습니다.";
        return view(repMemberId, "WATCHING", message, false);
    }

    private RepTwosomeOrderView linkCandidate(PaymentAttempt attempt, CartSnapshot before,
                                              TwosomeOrderHistory.Summary candidate,
                                              List<TwosomeCartItemResponse> rawAfter, String afterRawHash) {
        Long repMemberId = attempt.getRepMemberId();
        String sessionKey = sessionKey(repMemberId);
        if (!STORE_NM.equals(candidate.storeNm())) {
            hold(attempt, "다른 매장의 주문은 자동 연결하지 않습니다: " + candidate.storeNm());
            return view(repMemberId, "HOLD", null, false);
        }
        Optional<ExternalOrder> existing = externalOrderRepository
                .findByRepMemberIdAndOrdNo(repMemberId, candidate.ordNo());
        if (existing.isPresent() && attemptOrderRepository.existsByExternalOrderId(existing.get().getId())) {
            attempt.setStatus("ALREADY_LINKED");
            attempt.setActiveKey(null);
            attempt.setHoldReason("다른 결제 시도에 이미 연결된 주문입니다.");
            attemptRepository.save(attempt);
            return view(repMemberId, "ALREADY_LINKED", null, false);
        }

        TwosomeOrderHistory.Detail detail = loadDetail(repMemberId, candidate, null);
        if (!detail.itemsComplete()) {
            hold(attempt, "주문 항목의 메뉴 코드·수량을 모두 해석하지 못했습니다.");
            return view(repMemberId, "HOLD", null, false);
        }
        List<CartSnapshot> snapshots = new ArrayList<>(
                snapshotRepository.findTop50ByAttemptIdOrderByVersionDesc(attempt.getId()));
        if (snapshots.isEmpty()) {
            snapshots.add(before);
        }
        List<TwosomeCartSnapshotEntry> latestEntries = read(before.getItemsJson(),
                new TypeReference<List<TwosomeCartSnapshotEntry>>() {
                }, List.of());
        List<TwosomeCartSnapshotEntry> afterEntries = afterRawHash.equals(before.getRawHash())
                ? latestEntries : captureCartEntries(sessionKey, rawAfter);
        if (!afterRawHash.equals(rawHash(integrationService.getCartItems(sessionKey)))) {
            throw new TwosomeStoreException("주문 연결 중 장바구니가 변경되어 이번 연결을 저장하지 않았습니다.");
        }
        CartSnapshot matchedSnapshot = null;
        TwosomeCartOrderMatcher.MatchResult lastMatch = null;
        for (CartSnapshot snapshot : snapshots) {
            List<TwosomeCartSnapshotEntry> beforeEntries = snapshot.getVersion() == before.getVersion()
                    ? latestEntries
                    : read(snapshot.getItemsJson(), new TypeReference<List<TwosomeCartSnapshotEntry>>() {
                    }, List.of());
            TwosomeCartOrderMatcher.MatchResult match = matcher.match(
                    beforeEntries, detail.items(), afterEntries);
            if (match.matched()) {
                matchedSnapshot = snapshot;
                break;
            }
            lastMatch = match;
        }
        if (matchedSnapshot == null) {
            hold(attempt, lastMatch != null ? lastMatch.reason() : "비교할 장바구니 스냅숏이 없습니다.");
            return view(repMemberId, "HOLD", null, false);
        }

        try {
            persistenceService.link(attempt, detail, matchedSnapshot, entriesHash(afterEntries), 1);
        } catch (DataIntegrityViolationException e) {
            attempt.setStatus("ALREADY_LINKED");
            attempt.setActiveKey(null);
            attempt.setHoldReason("다른 작업에서 먼저 연결한 주문입니다.");
            attemptRepository.save(attempt);
            return view(repMemberId, "ALREADY_LINKED", null, false);
        }

        String message = "주문번호 " + candidate.ordNo() + "를 자동 연결했습니다.";
        try {
            ExternalOrder linked = externalOrderRepository
                    .findByRepMemberIdAndOrdNo(repMemberId, candidate.ordNo()).orElseThrow();
            refreshReceipt(repMemberId, linked);
        } catch (TwosomeStoreException e) {
            message += " 전자영수증은 다음 조회에서 다시 확인합니다.";
        }
        return view(repMemberId, "LINKED", message, false);
    }

    private void refreshKnownOrders(Long repMemberId, List<TwosomeOrderHistory.Summary> summaries,
                                    List<ExternalOrder> orders) {
        Map<String, TwosomeOrderHistory.Summary> byOrdNo = summaries.stream()
                .collect(Collectors.toMap(TwosomeOrderHistory.Summary::ordNo, value -> value, (a, b) -> a));
        for (ExternalOrder order : orders) {
            if (!needsRefresh(order)) {
                continue;
            }
            TwosomeOrderHistory.Summary summary = byOrdNo.get(order.getOrdNo());
            if (summary == null) {
                continue;
            }
            List<ExternalOrderItem> existingItems = itemRepository.findByExternalOrderIdOrderByIdAsc(order.getId());
            TwosomeOrderHistory.Detail detail = loadDetail(repMemberId, summary, existingItems);
            if (!detail.itemsComplete()) {
                throw new TwosomeStoreException("주문 항목이 불완전해 기존 주문 상태를 덮어쓰지 않았습니다.");
            }
            ExternalOrder saved = persistenceService.saveDetail(repMemberId, detail);
            if (saved.getPaymentApprovalNo() == null) {
                refreshReceipt(repMemberId, saved);
            }
        }
    }

    private TwosomeOrderHistory.Detail loadDetail(Long repMemberId, TwosomeOrderHistory.Summary summary,
                                                  List<ExternalOrderItem> existingItems) {
        String sessionKey = sessionKey(repMemberId);
        TwosomeOrderHistory.Detail parsed = parser.parseDetail(
                integrationService.getOrderDetailHtml(sessionKey, summary.ordNo()), summary);
        Map<String, ExternalOrderItem> existingByLine = existingItems == null ? Map.of()
                : existingItems.stream().collect(Collectors.toMap(ExternalOrderItem::getOrdDtlNo,
                        value -> value, (a, b) -> a));
        List<TwosomeOrderHistory.Item> enriched = new ArrayList<>();
        for (TwosomeOrderHistory.Item item : parsed.items()) {
            ExternalOrderItem existing = existingByLine.get(item.ordDtlNo());
            if (existing != null && existing.getMenuCd().equals(item.menuCd())
                    && existing.getQuantity() == item.quantity()) {
                enriched.add(item.withCustomOptions(read(existing.getCustomOptionsJson(),
                        new TypeReference<List<TwosomeOrderHistory.CustomOption>>() {
                        }, List.of())));
                continue;
            }
            JsonNode customBody = integrationService.getOrderCustomList(sessionKey,
                    summary.ordNo(), item.ordDtlNo());
            enriched.add(item.withCustomOptions(parser.parseCustomOptions(customBody)));
        }
        return new TwosomeOrderHistory.Detail(parsed.summary(), parsed.simpleOrderNo(), parsed.storeAddress(),
                parsed.currentStep(), parsed.steps(), parsed.totalOrderAmount(), parsed.discountAmount(),
                parsed.finalPaymentAmount(), parsed.paymentAmounts(), parsed.posSaleNo(), parsed.receiptNo(),
                parsed.message(), enriched, parsed.itemsComplete());
    }

    private void refreshReceipt(Long repMemberId, ExternalOrder order) {
        if (order.getReceiptNo() == null || order.getReceiptNo().isBlank()
                || order.getPaymentApprovalNo() != null || "80".equals(order.getStatusCode())) {
            return;
        }
        String sessionKey = sessionKey(repMemberId);
        String receiptHtml = integrationService.getReceiptHtml(sessionKey, order.getReceiptNo());
        String custNo = parser.extractReceiptCustNo(receiptHtml);
        JsonNode body = integrationService.getReceiptData(sessionKey, order.getReceiptNo(), custNo);
        TwosomeOrderHistory.Receipt receipt = parser.parseReceipt(order.getReceiptNo(), body);
        if (order.getSimpleOrderNo() != null && receipt.simpleOrderNo() != null
                && !order.getSimpleOrderNo().equals(receipt.simpleOrderNo())) {
            throw new TwosomeStoreException("전자영수증의 주문번호가 주문상세와 일치하지 않습니다.");
        }
        if (receipt.approvalNo() != null && receipt.approvedAt() != null) {
            persistenceService.saveReceipt(order, receipt);
        }
    }

    private List<TwosomeOrderHistory.Summary> fetchHistory(Long repMemberId) {
        LocalDate today = LocalDate.now();
        JsonNode body = integrationService.getOrderHistory(sessionKey(repMemberId),
                today.minusDays(31).format(DateTimeFormatter.BASIC_ISO_DATE),
                today.plusDays(1).format(DateTimeFormatter.BASIC_ISO_DATE), 1);
        return parser.parseList(body);
    }

    private List<TwosomeOrderHistory.Summary> candidates(List<TwosomeOrderHistory.Summary> summaries,
                                                         Set<String> baseline) {
        return summaries.stream()
                .filter(summary -> !baseline.contains(summary.ordNo()))
                .filter(summary -> !"80".equals(summary.statusCode()))
                .toList();
    }

    private List<TwosomeCartSnapshotEntry> captureCartEntries(String sessionKey,
                                                               List<TwosomeCartItemResponse> rawItems) {
        List<TwosomeCartSnapshotEntry> entries = new ArrayList<>();
        Set<String> lineKeys = new HashSet<>();
        for (TwosomeCartItemResponse raw : rawItems) {
            if (raw.getCartNo() == null || raw.getCartDtlNo() == null || raw.getMenuCd() == null
                    || raw.getQty() <= 0 || !lineKeys.add(raw.getCartNo() + ":" + raw.getCartDtlNo())) {
                throw new TwosomeStoreException("장바구니 항목의 식별자·메뉴·수량을 모두 해석하지 못했습니다.");
            }
            JsonNode customBody = integrationService.getCartCustomList(
                    sessionKey, raw.getCartNo(), raw.getCartDtlNo());
            TwosomeOrderHistory.Item item = new TwosomeOrderHistory.Item(
                    raw.getCartDtlNo(), raw.getMenuCd(), raw.getMenuNm(), raw.getOptNm(), raw.getQty(),
                    raw.getPrice(), null, parser.parseCustomOptions(customBody));
            entries.add(new TwosomeCartSnapshotEntry(raw.getCartNo(), raw.getCartDtlNo(), item));
        }
        entries.sort(Comparator.comparing(TwosomeCartSnapshotEntry::cartNo)
                .thenComparing(TwosomeCartSnapshotEntry::cartDtlNo));
        return entries;
    }

    private boolean needsRefresh(ExternalOrder order) {
        if (!"60".equals(order.getStatusCode()) && !"80".equals(order.getStatusCode())) {
            return true;
        }
        return "60".equals(order.getStatusCode()) && order.getReceiptNo() != null
                && order.getPaymentApprovalNo() == null
                && (order.getLastCheckedAt() == null || order.getLastCheckedAt()
                        .isBefore(LocalDateTime.now().minus(RECEIPT_RETRY_INTERVAL)));
    }

    private void hold(PaymentAttempt attempt, String reason) {
        if (!"HOLD".equals(attempt.getStatus()) || !Objects.equals(attempt.getHoldReason(), reason)) {
            persistenceService.hold(attempt, reason);
        }
    }

    private RepTwosomeOrderView view(Long repMemberId, String status, String message, boolean skipped) {
        PaymentAttempt attempt = attemptRepository
                .findFirstByRepMemberIdAndActiveKeyIsNotNullOrderByIdDesc(repMemberId).orElse(null);
        RepTwosomeOrderView.Observation observation = null;
        if (attempt != null) {
            Integer version = snapshotRepository.findTopByAttemptIdOrderByVersionDesc(attempt.getId())
                    .map(CartSnapshot::getVersion).orElse(null);
            observation = new RepTwosomeOrderView.Observation(attempt.getId(), attempt.getStatus(),
                    attempt.getHoldReason(), version, attempt.getCreatedAt(), attempt.getLinkedAt());
        }
        List<RepTwosomeOrderView.Order> orders = externalOrderRepository
                .findTop20ByRepMemberIdOrderByOrderedAtDesc(repMemberId).stream().map(this::toOrderView).toList();
        return new RepTwosomeOrderView(status, message, skipped, LocalDateTime.now(), observation, orders);
    }

    private RepTwosomeOrderView.Order toOrderView(ExternalOrder order) {
        List<RepTwosomeOrderView.Item> items = itemRepository.findByExternalOrderIdOrderByIdAsc(order.getId())
                .stream().map(item -> new RepTwosomeOrderView.Item(item.getOrdDtlNo(), item.getMenuCd(),
                        item.getMenuNm(), item.getOptionNm(), item.getQuantity(), item.getDisplayUnitPrice(),
                        item.getDisplayLineAmount(), read(item.getCustomOptionsJson(),
                                new TypeReference<List<TwosomeOrderHistory.CustomOption>>() {
                                }, List.of()))).toList();
        List<TwosomeOrderHistory.Step> steps = read(order.getStepsJson(),
                new TypeReference<List<TwosomeOrderHistory.Step>>() {
                }, List.of());
        Map<String, Integer> paymentAmounts = read(order.getPaymentAmountsJson(),
                new TypeReference<Map<String, Integer>>() {
                }, Map.of());
        return new RepTwosomeOrderView.Order(order.getId(), order.getOrdNo(), order.getSimpleOrderNo(),
                order.getStoreNm(), order.getStatusCode(), order.getStatusName(), order.getCurrentStep(),
                displayStatus(order), steps, order.getOrderedAt(), order.getPickupAt(),
                order.getTotalOrderAmount(), order.getDiscountAmount(), order.getFinalPaymentAmount(),
                paymentAmounts, order.getPosSaleNo(), order.getReceiptNo() != null,
                order.getPaymentApprovalNo() != null && order.getPaymentApprovedAt() != null
                        && !"80".equals(order.getStatusCode()),
                order.getPaymentApprovedAt(), order.getMessage(), order.getLinkedAt(), order.getLastCheckedAt(), items);
    }

    private String displayStatus(ExternalOrder order) {
        if ("80".equals(order.getStatusCode())) {
            return "취소완료";
        }
        if ("주문접수".equals(order.getCurrentStep())) {
            return "준비중";
        }
        if (order.getCurrentStep() != null) {
            return order.getCurrentStep();
        }
        return order.getStatusName() != null ? order.getStatusName() : "확인 중";
    }

    private String rawHash(List<TwosomeCartItemResponse> items) {
        List<Map<String, Object>> raw = items.stream().map(item -> {
            Map<String, Object> value = new LinkedHashMap<>();
            value.put("cartNo", item.getCartNo());
            value.put("cartDtlNo", item.getCartDtlNo());
            value.put("menuCd", item.getMenuCd());
            value.put("quantity", item.getQty());
            value.put("menuOptVal", item.getMenuOptVal());
            value.put("cstmAmt", item.getCstmAmt());
            value.put("cstmCnt", item.getCstmCnt());
            return value;
        }).sorted(Comparator.comparing(value -> Objects.toString(value.get("cartNo"), "")
                + ":" + Objects.toString(value.get("cartDtlNo"), ""))).toList();
        return sha256(write(raw));
    }

    private String entriesHash(List<TwosomeCartSnapshotEntry> entries) {
        return sha256(write(entries));
    }

    private String write(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("결제 관찰 데이터를 직렬화하지 못했습니다.", e);
        }
    }

    private <T> T read(String json, TypeReference<T> type, T fallback) {
        if (json == null || json.isBlank()) {
            return fallback;
        }
        try {
            return objectMapper.readValue(json, type);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("저장된 결제 관찰 데이터를 해석하지 못했습니다.", e);
        }
    }

    private String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private String sessionKey(Long repMemberId) {
        return TwosomeStoreIntegrationService.repSessionKey(repMemberId);
    }

    private String lockKey(Long repMemberId) {
        return "twosome:payment-observer:lock:" + sessionKey(repMemberId);
    }

    private String throttleKey(Long repMemberId) {
        return "twosome:payment-observer:refresh:" + sessionKey(repMemberId);
    }
}
