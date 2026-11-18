package com.example.coffeeorder.service;

import com.example.coffeeorder.dto.*;
import com.example.coffeeorder.entity.*;
import com.example.coffeeorder.repository.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.function.Supplier;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TwosomePaymentObservationServiceTest {

    private static final long REP_ID = 42L;
    private static final String SESSION_KEY = "rep:42";

    @Mock private TwosomeStoreIntegrationService integrationService;
    @Mock private TwosomePaymentOrderPersistenceService persistenceService;
    @Mock private PaymentAttemptRepository attemptRepository;
    @Mock private CartSnapshotRepository snapshotRepository;
    @Mock private ExternalOrderRepository externalOrderRepository;
    @Mock private ExternalOrderItemRepository itemRepository;
    @Mock private PaymentAttemptOrderRepository attemptOrderRepository;
    @Mock private DistributedLockService lockService;
    @Mock private StringRedisTemplate redisTemplate;
    @Mock private ValueOperations<String, String> valueOperations;

    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();
    private TwosomePaymentObservationService service;
    private PaymentAttempt activeAttempt;
    private CartSnapshot currentSnapshot;

    @BeforeEach
    void setUp() {
        service = new TwosomePaymentObservationService(integrationService,
                new TwosomeOrderHistoryParser(), new TwosomeCartOrderMatcher(), persistenceService,
                attemptRepository, snapshotRepository, externalOrderRepository, itemRepository,
                attemptOrderRepository, lockService, redisTemplate, objectMapper);
        lenient().when(lockService.tryWithLock(anyString(), any(), any(), any())).thenAnswer(invocation -> {
            Supplier<?> action = invocation.getArgument(3);
            return Optional.of(action.get());
        });
        lenient().when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        lenient().when(valueOperations.setIfAbsent(anyString(), anyString(), any())).thenReturn(true);
        lenient().when(attemptRepository.findFirstByRepMemberIdAndActiveKeyIsNotNullOrderByIdDesc(REP_ID))
                .thenAnswer(invocation -> activeAttempt != null && activeAttempt.getActiveKey() != null
                        ? Optional.of(activeAttempt) : Optional.empty());
        lenient().when(attemptRepository.save(any(PaymentAttempt.class))).thenAnswer(invocation -> {
            PaymentAttempt saved = invocation.getArgument(0);
            if (saved.getId() == null) saved.setId(1L);
            activeAttempt = saved;
            return saved;
        });
        lenient().when(snapshotRepository.findTopByAttemptIdOrderByVersionDesc(anyLong()))
                .thenAnswer(invocation -> Optional.ofNullable(currentSnapshot));
        lenient().when(itemRepository.findByExternalOrderIdOrderByIdAsc(anyLong())).thenReturn(List.of());
        lenient().when(externalOrderRepository.findTop20ByRepMemberIdOrderByOrderedAtDesc(REP_ID))
                .thenReturn(List.of());
        lenient().when(persistenceService.captureBaseline(any(), anyList(), anyString(), anyString(), anyString()))
                .thenAnswer(invocation -> {
                    PaymentAttempt attempt = invocation.getArgument(0);
                    attempt.setBaselineCaptured(true);
                    attempt.setStatus("WATCHING");
                    attempt.setBaselineOrderNosJson(objectMapper.writeValueAsString(invocation.getArgument(1)));
                    currentSnapshot = snapshot(1, invocation.getArgument(2), invocation.getArgument(4));
                    return currentSnapshot;
                });
        lenient().doAnswer(invocation -> {
            PaymentAttempt attempt = invocation.getArgument(0);
            attempt.setStatus("HOLD");
            attempt.setHoldReason(invocation.getArgument(1));
            return null;
        }).when(persistenceService).hold(any(), anyString());
    }

    @Test
    void capturesBaselineOnlyWhenCartIsStable() throws Exception {
        List<TwosomeCartItemResponse> cart = List.of(cartItem("A", 1));
        when(integrationService.getCartItems(SESSION_KEY)).thenReturn(cart, cart);
        when(integrationService.getCartCustomList(eq(SESSION_KEY), anyString(), anyString()))
                .thenReturn(objectMapper.createArrayNode());
        when(integrationService.getOrderHistory(eq(SESSION_KEY), anyString(), anyString(), eq(1)))
                .thenReturn(history(summary("OLD", "60", "수령완료")));

        RepTwosomeOrderView result = service.startObservation(REP_ID, List.of(101L, 102L));

        assertThat(result.status()).isEqualTo("WATCHING");
        assertThat(activeAttempt.isBaselineCaptured()).isTrue();
        assertThat(activeAttempt.getBaselineOrderNosJson()).contains("OLD");
        assertThat(currentSnapshot.getItemsJson()).contains("A");
        verify(persistenceService).registerLocalOrders(activeAttempt, List.of(101L, 102L));
        verify(integrationService, times(3)).getCartItems(SESSION_KEY);
    }

    @Test
    void linksExactlyOneOrderWhenCartDeltaMatches() throws Exception {
        activeAttempt = activeAttempt("[]");
        currentSnapshot = snapshot(1, "before-raw", objectMapper.writeValueAsString(List.of(snapshotEntry("A", 1))));
        when(integrationService.getCartItems(SESSION_KEY)).thenReturn(List.of());
        when(integrationService.getOrderHistory(eq(SESSION_KEY), anyString(), anyString(), eq(1)))
                .thenReturn(history(summary("NEW", "30", "주문접수")));
        when(integrationService.getOrderDetailHtml(SESSION_KEY, "NEW"))
                .thenReturn(detailHtml("NEW", "A", "30"));
        when(integrationService.getOrderCustomList(SESSION_KEY, "NEW", "1"))
                .thenReturn(emptyCustomOptions());
        ExternalOrder linked = externalOrder("NEW", "30");
        when(externalOrderRepository.findByRepMemberIdAndOrdNo(REP_ID, "NEW"))
                .thenReturn(Optional.empty(), Optional.of(linked));
        when(persistenceService.link(any(), any(), any(), anyString(), eq(1))).thenAnswer(invocation -> {
            activeAttempt.setStatus("LINKED");
            activeAttempt.setActiveKey(null);
            return linked;
        });

        RepTwosomeOrderView result = service.refresh(REP_ID);

        assertThat(result.status()).isEqualTo("LINKED");
        verify(persistenceService).link(eq(activeAttempt), argThat(detail ->
                detail.simpleOrderNo().equals("907") && detail.currentStep().equals("주문접수")),
                eq(currentSnapshot), anyString(), eq(1));
        verify(persistenceService, never()).hold(any(), anyString());
    }

    @Test
    void holdsMultipleNewOrdersWithoutFetchingDetails() {
        activeAttempt = activeAttempt("[]");
        currentSnapshot = snapshot(1, "before-raw", "[]");
        when(integrationService.getCartItems(SESSION_KEY)).thenReturn(List.of());
        when(integrationService.getOrderHistory(eq(SESSION_KEY), anyString(), anyString(), eq(1)))
                .thenReturn(history(summary("NEW-1", "30", "주문접수"), summary("NEW-2", "30", "주문접수")));

        RepTwosomeOrderView result = service.refresh(REP_ID);

        assertThat(result.status()).isEqualTo("HOLD");
        assertThat(activeAttempt.getHoldReason()).contains("분할 결제");
        verify(persistenceService).hold(eq(activeAttempt), contains("2건"));
        verify(integrationService, never()).getOrderDetailHtml(anyString(), anyString());
        verify(persistenceService, never()).link(any(), any(), any(), anyString(), anyInt());
    }

    @Test
    void holdsMismatchedOrderInsteadOfInferringPaymentFromEmptyCart() throws Exception {
        activeAttempt = activeAttempt("[]");
        currentSnapshot = snapshot(1, "before-raw", objectMapper.writeValueAsString(List.of(snapshotEntry("A", 1))));
        when(integrationService.getCartItems(SESSION_KEY)).thenReturn(List.of());
        when(integrationService.getOrderHistory(eq(SESSION_KEY), anyString(), anyString(), eq(1)))
                .thenReturn(history(summary("NEW", "30", "주문접수")));
        when(integrationService.getOrderDetailHtml(SESSION_KEY, "NEW"))
                .thenReturn(detailHtml("NEW", "B", "30"));
        when(integrationService.getOrderCustomList(SESSION_KEY, "NEW", "1"))
                .thenReturn(emptyCustomOptions());

        RepTwosomeOrderView result = service.refresh(REP_ID);

        assertThat(result.status()).isEqualTo("HOLD");
        assertThat(activeAttempt.getHoldReason()).contains("다릅니다");
        verify(persistenceService, never()).link(any(), any(), any(), anyString(), anyInt());
    }

    @Test
    void updatesLinkedOrderToCanceledWithoutUsingDisplayedAmountAsPaymentProof() {
        ExternalOrder existing = externalOrder("NEW", "30");
        existing.setId(9L);
        existing.setFinalPaymentAmount(5300);
        activeAttempt = null;
        when(externalOrderRepository.findTop20ByRepMemberIdOrderByOrderedAtDesc(REP_ID))
                .thenReturn(List.of(existing));
        when(integrationService.getOrderHistory(eq(SESSION_KEY), anyString(), anyString(), eq(1)))
                .thenReturn(history(summary("NEW", "80", "취소완료")));
        when(integrationService.getOrderDetailHtml(SESSION_KEY, "NEW"))
                .thenReturn(detailHtml("NEW", "A", "80"));
        when(integrationService.getOrderCustomList(SESSION_KEY, "NEW", "1"))
                .thenReturn(emptyCustomOptions());
        when(persistenceService.saveDetail(eq(REP_ID), any())).thenAnswer(invocation -> {
            existing.setStatusCode("80");
            existing.setStatusName("취소완료");
            return existing;
        });

        RepTwosomeOrderView result = service.refresh(REP_ID);

        assertThat(result.status()).isEqualTo("UPDATED");
        verify(persistenceService).saveDetail(eq(REP_ID), argThat(detail ->
                detail.summary().statusCode().equals("80") && detail.finalPaymentAmount().equals(5300)));
        verify(persistenceService, never()).saveReceipt(any(), any());
    }

    @Test
    void linksAgainstEarlierSnapshotWhenOrderHistoryAppearsAfterCartChanges() throws Exception {
        activeAttempt = activeAttempt("[]");
        currentSnapshot = snapshot(1, "before-raw", objectMapper.writeValueAsString(List.of(snapshotEntry("A", 1))));
        CartSnapshot original = currentSnapshot;
        List<CartSnapshot> snapshots = new ArrayList<>(List.of(original));
        when(snapshotRepository.findTop50ByAttemptIdOrderByVersionDesc(activeAttempt.getId()))
                .thenAnswer(invocation -> snapshots);
        when(integrationService.getCartItems(SESSION_KEY)).thenReturn(List.of());
        when(integrationService.getOrderHistory(eq(SESSION_KEY), anyString(), anyString(), eq(1)))
                .thenReturn(history(), history(), history(summary("NEW", "30", "주문접수")));
        doAnswer(invocation -> {
            currentSnapshot = snapshot(invocation.getArgument(1), invocation.getArgument(2), invocation.getArgument(4));
            snapshots.add(0, currentSnapshot);
            return currentSnapshot;
        }).when(persistenceService).appendSnapshot(any(), anyInt(), anyString(), anyString(), anyString());
        when(integrationService.getOrderDetailHtml(SESSION_KEY, "NEW"))
                .thenReturn(detailHtml("NEW", "A", "30"));
        when(integrationService.getOrderCustomList(SESSION_KEY, "NEW", "1"))
                .thenReturn(emptyCustomOptions());
        ExternalOrder linked = externalOrder("NEW", "30");
        when(externalOrderRepository.findByRepMemberIdAndOrdNo(REP_ID, "NEW"))
                .thenReturn(Optional.empty(), Optional.of(linked));
        when(persistenceService.link(any(), any(), any(), anyString(), eq(1))).thenAnswer(invocation -> {
            activeAttempt.setStatus("LINKED");
            activeAttempt.setActiveKey(null);
            return linked;
        });

        assertThat(service.refresh(REP_ID).status()).isEqualTo("WATCHING");
        RepTwosomeOrderView result = service.refresh(REP_ID);

        assertThat(result.status()).isEqualTo("LINKED");
        verify(persistenceService).link(eq(activeAttempt), any(), eq(original), anyString(), eq(1));
    }

    @Test
    void expiresHoldThatHasNotBeenResolvedForThirtyMinutes() {
        activeAttempt = activeAttempt("[]");
        activeAttempt.setStatus("HOLD");
        activeAttempt.setCreatedAt(LocalDateTime.now().minusHours(1));
        activeAttempt.setUpdatedAt(LocalDateTime.now().minusMinutes(31));

        RepTwosomeOrderView result = service.refresh(REP_ID);

        assertThat(result.status()).isEqualTo("EXPIRED");
        assertThat(activeAttempt.getActiveKey()).isNull();
        verify(persistenceService).expire(eq(activeAttempt), contains("30분"));
        verify(integrationService, never()).getCartItems(anyString());
    }

    private PaymentAttempt activeAttempt(String baselineJson) {
        PaymentAttempt attempt = new PaymentAttempt();
        attempt.setId(1L);
        attempt.setRepMemberId(REP_ID);
        attempt.setStoreCd("1102115");
        attempt.setStatus("WATCHING");
        attempt.setBaselineCaptured(true);
        attempt.setBaselineOrderNosJson(baselineJson);
        attempt.setActiveKey(SESSION_KEY);
        attempt.setCreatedAt(LocalDateTime.now());
        return attempt;
    }

    private static CartSnapshot snapshot(int version, String rawHash, String itemsJson) {
        CartSnapshot snapshot = new CartSnapshot();
        snapshot.setId((long) version);
        snapshot.setAttemptId(1L);
        snapshot.setVersion(version);
        snapshot.setRawHash(rawHash);
        snapshot.setItemsHash("items-hash");
        snapshot.setItemsJson(itemsJson);
        return snapshot;
    }

    private static TwosomeCartSnapshotEntry snapshotEntry(String menuCd, int quantity) {
        return new TwosomeCartSnapshotEntry("cart", "1",
                new TwosomeOrderHistory.Item("1", menuCd, "메뉴", null, quantity,
                        5000, 5000, List.of()));
    }

    private static TwosomeCartItemResponse cartItem(String menuCd, int quantity) {
        TwosomeCartItemResponse item = new TwosomeCartItemResponse();
        item.setCartNo("cart");
        item.setCartDtlNo("1");
        item.setMenuCd(menuCd);
        item.setMenuNm("메뉴");
        item.setQty(quantity);
        item.setPrice(5000);
        item.setCstmAmt(0);
        item.setCstmCnt(0);
        return item;
    }

    private static TwosomeOrderHistory.Summary summary(String ordNo, String statusCode, String statusName) {
        return new TwosomeOrderHistory.Summary(ordNo, "CJENM커머스부문점", statusCode, statusName,
                LocalDateTime.of(2026, 11, 12, 9, 40), null, "10", "메뉴", null);
    }

    private JsonNode history(TwosomeOrderHistory.Summary... summaries) {
        ObjectNode root = objectMapper.createObjectNode();
        root.put("queryCode", 1000);
        ArrayNode rows = root.putArray("fetchResultListSet");
        for (TwosomeOrderHistory.Summary summary : summaries) {
            ObjectNode row = rows.addObject();
            row.put("ORD_NO", summary.ordNo());
            row.put("STORE_NM", summary.storeNm());
            row.put("ORD_STAT_GBCD", summary.statusCode());
            row.put("ORD_STAT_GBNM", summary.statusName());
            row.put("ORD_DTIME", "2026-11-12(목) 09:40");
            row.put("ORD_GBCD", "10");
        }
        return root;
    }

    private JsonNode emptyCustomOptions() {
        ObjectNode root = objectMapper.createObjectNode();
        root.put("queryCode", 1000);
        root.putArray("fetchResultListSet");
        return root;
    }

    private static String detailHtml(String ordNo, String menuCd, String statusCode) {
        String steps = "80".equals(statusCode) ? "" :
                "<div class='step ended'><span class='step_text'>결제완료</span></div>"
                        + "<div class='step now'><span class='step_text'>주문접수</span></div>";
        return "<input type='hidden' id='simpOrdNo' value='907'>"
                + "<div class='progress_group'>" + steps + "</div>"
                + "<div class='product_list'><div class='list_item'><div class='list_item_header'>"
                + "<input type='hidden' id='menuCd_" + ordNo + "1' value='" + menuCd + "'>"
                + "<input type='hidden' id='menuOrdCnt_" + ordNo + "1' value='1'>"
                + "<div class='name'><em>메뉴</em></div></div>"
                + "<div>상품금액 5,300원 수량/주문금액 1개 / 5,300원</div></div></div>"
                + "<div class='item'><span class='label'>최종 결제금액</span><em>5,300 원</em></div>"
                + "<script>var ordStatGbcdChk = \"" + statusCode + "\";</script>";
    }

    private static ExternalOrder externalOrder(String ordNo, String statusCode) {
        ExternalOrder order = new ExternalOrder();
        order.setId(99L);
        order.setRepMemberId(REP_ID);
        order.setOrdNo(ordNo);
        order.setStatusCode(statusCode);
        order.setStoreCd("1102115");
        order.setLastCheckedAt(LocalDateTime.now());
        return order;
    }
}
