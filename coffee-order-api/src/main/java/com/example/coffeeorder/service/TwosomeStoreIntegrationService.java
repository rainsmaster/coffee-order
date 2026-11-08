package com.example.coffeeorder.service;

import com.example.coffeeorder.client.TwosomeStoreApiClient;
import com.example.coffeeorder.client.TwosomeStoreSessionContext;
import com.example.coffeeorder.dto.TwosomeCaptchaResponse;
import com.example.coffeeorder.dto.TwosomeCartAddRequest;
import com.example.coffeeorder.dto.TwosomeCartAddResponse;
import com.example.coffeeorder.dto.TwosomeCartItemRequest;
import com.example.coffeeorder.dto.TwosomeCartItemResponse;
import com.example.coffeeorder.dto.TwosomeCartItemResult;
import com.example.coffeeorder.dto.TwosomeCartQtyAdjustRequest;
import com.example.coffeeorder.dto.TwosomeLoginRequest;
import com.example.coffeeorder.dto.TwosomeLoginResponse;
import com.example.coffeeorder.dto.TwosomeMenuResponse.TwosomeMenuItem;
import com.example.coffeeorder.dto.TwosomeSessionResponse;
import com.example.coffeeorder.dto.TwosomeStoreInfoResponse;
import com.example.coffeeorder.entity.TwosomeMenu;
import com.example.coffeeorder.exception.TwosomeStoreException;
import com.example.coffeeorder.exception.TwosomeStoreSessionExpiredException;
import com.example.coffeeorder.repository.TwosomeMenuRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.annotation.PostConstruct;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 투썸 연동 세션 관리 및 오케스트레이션 서비스.
 *
 * 세션은 memberId 기반 다중 세션으로 관리한다.
 * - 관리자 세션: 고정 key "active" (Redis 영속화로 재시작 복구, 메뉴 배치/자동재로그인/keep-alive 사용)
 * - 대표 세션: key "rep:{memberId}" (대표 개인 투썸 계정 로그인, 인메모리만)
 * - 캡차 발급 시 만든 pending 컨텍스트: UUID key, 5분 만료
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TwosomeStoreIntegrationService {

    private final TwosomeStoreApiClient twosomeStoreApiClient;
    private final TwosomeMenuRepository twosomeMenuRepository;
    private final com.example.coffeeorder.repository.OrderRepository orderRepository;
    private final ObjectMapper objectMapper;
    private final TwosomeSessionRedisStore sessionRedisStore;
    private final TwosomeHealthService healthService;
    private final org.springframework.data.redis.core.StringRedisTemplate stringRedisTemplate;

    // 매장 정보 상수 (CJENM커머스부문점)
    private static final String STORE_CD = "1102115";
    private static final double STORE_LAT = 37.46898099524646;
    private static final double STORE_LONGI = 126.9873731107454;
    private static final String BRND_CD = "39";

    private static final Duration SESSION_IDLE_TIMEOUT = Duration.ofMinutes(30);
    private static final Duration PENDING_TIMEOUT = Duration.ofMinutes(5);
    private static final long CART_ADD_INTERVAL_MS = 300;

    private static final String ACTIVE_KEY = "active";
    /** 투썸 세션에 매장이 바인딩되지 않았을 때 상세 페이지가 돌려주는 스크립트 알림 문구 */
    private static final String NO_STORE_ALERT = "주문가능한 매장이 없습니다";
    private static final String REP_KEY_PREFIX = "rep:";
    private static final String CAPTCHA_DATA_URI_PREFIX = "data:image/png;base64,";

    private enum SessionStatus {
        NONE, ACTIVE, EXPIRED
    }

    /** 컨텍스트 ID -> 세션 레코드 (pending 컨텍스트 + active 세션 공용, active는 memberId 기반 key) */
    private final Map<String, StoreSession> sessionStore = new ConcurrentHashMap<>();

    /** 세션 상태 전이 동시 실행 방지 */
    private final Object sessionLock = new Object();

    // ==================== 시작 시 Redis 세션 복구 (관리자 세션) ====================

    /**
     * 애플리케이션 시작 시 Redis에 저장된 ACTIVE 세션이 있으면 인메모리로 복구한다.
     * 쿠키 만료 자체는 투썸 서버의 30분 유휴 규칙이 지배하므로,
     * 복구된 세션도 첫 실사용에서 401이면 기존 만료 흐름(EXPIRED + Redis 삭제)으로 처리한다.
     */
    @PostConstruct
    void restoreSessionFromRedis() {
        sessionRedisStore.load().ifPresentOrElse(stored -> {
            StoreSession session = new StoreSession(new TwosomeStoreSessionContext());
            session.getContext().getCookieJar().putAll(stored.cookieJar());
            session.setStoreNm(stored.storeNm());
            session.promoteToActive();
            session.markAsRestored();
            synchronized (sessionLock) {
                sessionStore.put(ACTIVE_KEY, session);
            }
            healthService.record(TwosomeHealthEventType.SESSION_RESTORED, true,
                    "loginId=" + stored.loginId() + ", storeNm=" + stored.storeNm());
            log.info("Restored twosome session from redis (loginId={}, storeNm={}, loggedInAt={})",
                    stored.loginId(), stored.storeNm(), stored.loggedInAt());
            // 매장 바인딩은 투썸 서버의 세션 상태라 복구 쿠키만으로는 유지되지 않는다.
            // 복구 직후 매장을 다시 설정해 첫 실사용 실패(주문가능한 매장이 없습니다)를 방지한다.
            try {
                String storeNm = setStoreInfo(session);
                session.setStoreNm(storeNm);
                log.info("Re-bound twosome store on session restore: {}", storeNm);
            } catch (Exception e) {
                log.warn("Failed to re-bind store on session restore: {}", e.getMessage());
            }
        }, () -> log.info("No stored twosome session in redis"));
    }

    // ==================== 캡차 / 로그인 ====================

    /**
     * 캡차 발급: 새 세션 컨텍스트를 pending으로 보관하고 캡차 이미지를 반환한다.
     * 관리자/대표 로그인 공통 (로그인 시 승격 대상 key만 다름)
     */
    public TwosomeCaptchaResponse issueCaptcha() {
        String contextId = UUID.randomUUID().toString();
        StoreSession session = new StoreSession(new TwosomeStoreSessionContext(), true);

        synchronized (sessionLock) {
            purgeExpiredPendingSessions();
            sessionStore.put(contextId, session);
        }

        byte[] image = twosomeStoreApiClient.fetchCaptchaImage(session.getContext());
        String imageBase64 = CAPTCHA_DATA_URI_PREFIX + Base64.getEncoder().encodeToString(image);
        log.info("Issued twosome captcha context: {}", contextId);
        return new TwosomeCaptchaResponse(contextId, imageBase64);
    }

    /**
     * 로그인: pending 컨텍스트로 로그인 처리 후 성공 시 ACTIVE 세션으로 승격한다.
     */
    public TwosomeLoginResponse login(TwosomeLoginRequest request) {
        return doLogin(ACTIVE_KEY, request, true);
    }

    /**
     * 대표 로그인: 성공 시 해당 대표의 개인 세션("rep:{memberId}")으로 승격한다.
     * Redis 영속화는 관리자 세션 전용이므로 대표 세션은 인메모리만 유지한다.
     */
    public TwosomeLoginResponse loginForRep(Long memberId, TwosomeLoginRequest request) {
        return doLogin(repKey(memberId), request, false);
    }

    private TwosomeLoginResponse doLogin(String sessionKey, TwosomeLoginRequest request, boolean persistToRedis) {
        StoreSession session;
        synchronized (sessionLock) {
            session = sessionStore.get(request.getContextId());
            if (session == null || session.isPendingExpired()) {
                return new TwosomeLoginResponse("FAILED", "캡차가 만료되었습니다. 캡차를 새로 발급받아주세요.", null);
            }
        }

        try {
            twosomeStoreApiClient.login(session.getContext(),
                    request.getLoginId(), request.getLoginPwd(), request.getAnswerCd());
        } catch (TwosomeStoreException e) {
            log.warn("Twosome login failed: rstCd={}, message={}", e.getRstCd(), e.getMessage());
            return new TwosomeLoginResponse("FAILED", e.getMessage(), e.getRstCd());
        }

        // 로그인 성공: 같은 key의 기존 세션 정리 후 승격 (다른 대표 세션은 유지)
        synchronized (sessionLock) {
            sessionStore.remove(sessionKey);
            sessionStore.remove(request.getContextId());
            session.promoteToActive();
            sessionStore.put(sessionKey, session);
        }

        // 매장 설정 (실패필수는 아님 - 로그인 자체는 성공)
        try {
            String storeNm = setStoreInfo(session);
            session.setStoreNm(storeNm);
        } catch (TwosomeStoreException e) {
            log.warn("Failed to set store info after login (ignored): {}", e.getMessage());
        }

        if (persistToRedis) {
            // Redis에 관리자 ACTIVE 세션 영속화 (재시작 후 복구용)
            sessionRedisStore.save(new TwosomeSessionRedisStore.StoredSession(
                    new LinkedHashMap<>(session.getContext().getCookieJar()),
                    session.getStoreNm(),
                    request.getLoginId(),
                    LocalDateTime.now()));
        }

        log.info("Twosome session activated (key={}, storeNm={})", sessionKey, session.getStoreNm());
        return new TwosomeLoginResponse("SUCCESS",
                "로그인되었습니다. 새 로그인으로 인해 투썸하트 앱이 로그아웃될 수 있으니, 필요하면 앱에서 다시 로그인해주세요.",
                "000");
    }

    // ==================== 세션 상태 / 로그아웃 ====================

    public TwosomeSessionResponse getSessionStatus() {
        return getSessionStatus(ACTIVE_KEY);
    }

    /**
     * 지정 key 세션 상태 조회 (관리자 "active" / 대표 "rep:{memberId}")
     */
    public TwosomeSessionResponse getSessionStatus(String sessionKey) {
        StoreSession session = sessionStore.get(sessionKey);
        if (session == null || session.isPending()) {
            return new TwosomeSessionResponse("NONE", null, null, null, null);
        }

        synchronized (sessionLock) {
            if (session.getStatus() == SessionStatus.EXPIRED || session.isIdleExpired()) {
                session.setStatus(SessionStatus.EXPIRED);
                return new TwosomeSessionResponse("EXPIRED", session.getStoreNm(),
                        session.getLastUsedAt(), 0L, session.getSource());
            }
            return new TwosomeSessionResponse("ACTIVE", session.getStoreNm(),
                    session.getLastUsedAt(), session.getRemainingMinutes(), session.getSource());
        }
    }

    public void logout() {
        logout(ACTIVE_KEY);
    }

    /**
     * 지정 key 세션 로그아웃. 관리자 세션은 Redis에서도 삭제한다.
     */
    public void logout(String sessionKey) {
        StoreSession session;
        synchronized (sessionLock) {
            session = sessionStore.remove(sessionKey);
        }
        if (ACTIVE_KEY.equals(sessionKey)) {
            sessionRedisStore.delete();
        }
        if (session != null) {
            twosomeStoreApiClient.logout(session.getContext());
        }
        log.info("Twosome session logged out (key={})", sessionKey);
    }

    /**
     * KEEP-ALIVE용 경량 호출: ACTIVE 세션이면 매장 설정 호출로 서버 세션의
     * 30분 유휴 슬라이딩 타이머를 리셋한다.
     *
     * @return ACTIVE 세션을 터치했으면 true, 세션 없음/만료 예외 시 false/예외
     */
    public boolean keepAliveSession() {
        StoreSession session = sessionStore.get(ACTIVE_KEY);
        if (session == null) {
            return false;
        }
        synchronized (sessionLock) {
            if (session.getStatus() == SessionStatus.EXPIRED || session.isIdleExpired()) {
                session.setStatus(SessionStatus.EXPIRED);
                throw new TwosomeStoreSessionExpiredException(
                        "투썸 세션이 만료되었습니다. 다시 로그인해주세요.");
            }
        }
        try {
            setStoreInfo(session);
        } catch (TwosomeStoreSessionExpiredException e) {
            expire(ACTIVE_KEY, session);
            throw e;
        }
        log.debug("Twosome keep-alive touched session");
        return true;
    }

    /**
     * 모든 대표 세션("rep:" 키)의 슬라이딩 타이머 리셋 (keep-alive 스케줄러용).
     * 개별 세션의 실패/만료는 조용히 스킵한다.
     *
     * @return 터치한 대표 세션 수
     */
    public int keepAliveRepSessions() {
        int touched = 0;
        for (Map.Entry<String, StoreSession> entry : sessionStore.entrySet()) {
            if (!entry.getKey().startsWith(REP_KEY_PREFIX)) {
                continue;
            }
            StoreSession session = entry.getValue();
            if (session.isPending()) {
                continue;
            }
            synchronized (sessionLock) {
                if (session.getStatus() == SessionStatus.EXPIRED || session.isIdleExpired()) {
                    session.setStatus(SessionStatus.EXPIRED);
                    continue;
                }
            }
            try {
                setStoreInfo(session);
                touched++;
            } catch (Exception e) {
                log.debug("Rep keep-alive skipped (key={}): {}", entry.getKey(), e.getMessage());
            }
        }
        return touched;
    }

    // ==================== 메뉴 새로고침 ====================

    /** 메뉴 리프레시 diff 리포트 Redis 키 (TTL 48시간, 관리자 페이지 표시용) */
    public static final String MENU_REFRESH_DIFF_KEY = "twosome:menu-refresh:diff";
    private static final java.time.Duration MENU_REFRESH_DIFF_TTL = java.time.Duration.ofHours(48);

    /**
     * ACTIVE 세션으로 매장 메뉴를 조회해 twosome_menu 테이블을 upsert하고,
     * 직전 데이터와의 diff(신규/가격변동/목록 사라짐/품절)를 리포트한다.
     *
     * @return 저장된 메뉴 수
     */
    public int refreshStoreMenus() {
        try {
            StoreSession session = requireActiveSession();

            List<TwosomeMenuItem> items;
            try {
                String storeNm = setStoreInfo(session);
                session.setStoreNm(storeNm);
                items = twosomeStoreApiClient.fetchStoreMenus(session.getContext(), STORE_CD)
                        .getFetchResultListSet();
            } catch (TwosomeStoreSessionExpiredException e) {
                expire(ACTIVE_KEY, session);
                throw e;
            }

            if (items == null || items.isEmpty()) {
                throw new TwosomeStoreException("매장 메뉴를 가져오지 못했습니다.");
            }

            // 실행 직전 스냅샷 (diff 비교용)
            Map<String, TwosomeMenu> beforeByMenuCd = new HashMap<>();
            for (TwosomeMenu menu : twosomeMenuRepository.findByDelYnOrderByMidNmAscSortOrdAsc("N")) {
                beforeByMenuCd.put(menu.getMenuCd(), menu);
            }

            int savedCount = upsertStoreMenus(items, beforeByMenuCd);
            session.touch();

            // 사라짐 분기: 주문 이력 없음 → 소프트삭제(정리), 이력 있음 → 시즌종료(보존)
            List<TwosomeMenu> toClean = new ArrayList<>();
            List<String> cleaned = new ArrayList<>();
            List<String> seasonEnded = new ArrayList<>();
            Set<String> fetchedCds = new HashSet<>();
            for (TwosomeMenuItem item : items) {
                if (item.getMenuCd() != null && !item.getMenuCd().isBlank()) {
                    fetchedCds.add(item.getMenuCd());
                }
            }
            for (TwosomeMenu prev : beforeByMenuCd.values()) {
                if (fetchedCds.contains(prev.getMenuCd())) {
                    continue;
                }
                if (orderRepository.existsByTwosomeMenuId(prev.getId())) {
                    seasonEnded.add(prev.getMenuCd() + " " + prev.getMenuNm());
                } else {
                    prev.setDelYn("Y");
                    toClean.add(prev);
                    cleaned.add(prev.getMenuCd() + " " + prev.getMenuNm());
                }
            }
            if (!toClean.isEmpty()) {
                twosomeMenuRepository.saveAll(toClean);
            }

            ObjectNode diff = buildMenuRefreshDiff(beforeByMenuCd, items, savedCount, cleaned, seasonEnded);
            saveMenuRefreshDiff(diff);

            healthService.record(TwosomeHealthEventType.MENU_SYNC_SUCCESS, true, diffSummary(diff));
            log.info("Refreshed twosome store menus: {} items | {}", savedCount, diffSummary(diff));
            return savedCount;
        } catch (TwosomeStoreException e) {
            healthService.record(TwosomeHealthEventType.MENU_SYNC_FAIL, false, e.getMessage());
            throw e;
        }
    }

    /** 최근 메뉴 리프레시 diff 리포트 조회 (없으면 null) */
    public String getMenuRefreshDiff() {
        try {
            return stringRedisTemplate.opsForValue().get(MENU_REFRESH_DIFF_KEY);
        } catch (Exception e) {
            log.warn("Failed to load menu refresh diff (ignored): {}", e.getMessage());
            return null;
        }
    }

    private void saveMenuRefreshDiff(ObjectNode diff) {
        try {
            stringRedisTemplate.opsForValue().set(MENU_REFRESH_DIFF_KEY, diff.toString(), MENU_REFRESH_DIFF_TTL);
        } catch (Exception e) {
            log.warn("Failed to save menu refresh diff (ignored): {}", e.getMessage());
        }
    }

    /** diff JSON에서 헬스 이벤트용 한 줄 요약 */
    private static String diffSummary(ObjectNode diff) {
        return "저장 " + diff.path("savedCount").asInt() + "건 | 신규 " + diff.path("addedCount").asInt()
                + ", 가격변동 " + diff.path("priceChangedCount").asInt()
                + ", 정리 " + diff.path("cleanedCount").asInt()
                + ", 시즌종료(이력보존) " + diff.path("seasonEndedCount").asInt()
                + ", 품절 " + diff.path("soldOutCount").asInt();
    }

    private ObjectNode buildMenuRefreshDiff(Map<String, TwosomeMenu> before, List<TwosomeMenuItem> items,
                                            int savedCount, List<String> cleaned, List<String> seasonEnded) {
        ObjectNode diff = objectMapper.createObjectNode();
        diff.put("executedAt", LocalDateTime.now().toString());
        diff.put("success", true);
        diff.put("savedCount", savedCount);

        Set<String> fetched = new HashSet<>();
        ArrayNode added = objectMapper.createArrayNode();
        ArrayNode priceChanged = objectMapper.createArrayNode();
        ArrayNode soldOut = objectMapper.createArrayNode();
        int soldOutCount = 0;

        for (TwosomeMenuItem item : items) {
            if (item.getMenuCd() == null || item.getMenuCd().isBlank() || !fetched.add(item.getMenuCd())) {
                continue;
            }
            Integer newPrice = parseSaleAmt(item.getSaleAmt());
            TwosomeMenu prev = before.get(item.getMenuCd());
            if (prev == null) {
                added.add(item.getMenuCd() + " " + item.getMenuNm());
            } else if (!java.util.Objects.equals(prev.getSaleAmt(), newPrice)) {
                ObjectNode change = objectMapper.createObjectNode();
                change.put("menuCd", item.getMenuCd());
                change.put("menuNm", item.getMenuNm());
                change.put("oldPrice", prev.getSaleAmt() != null ? prev.getSaleAmt() : -1);
                change.put("newPrice", newPrice != null ? newPrice : -1);
                priceChanged.add(change);
            }
            // 품절(판매가능수량 0) — 반영 컬럼은 saleAmt/salesPsblQty로 저장하고 명세는 리포트에 포함
            if (item.getSalesPsblQty() != null && item.getSalesPsblQty() == 0) {
                soldOutCount++;
                soldOut.add(item.getMenuCd() + " " + item.getMenuNm());
            }
        }

        ArrayNode cleanedArr = objectMapper.createArrayNode();
        cleaned.forEach(cleanedArr::add);
        ArrayNode seasonArr = objectMapper.createArrayNode();
        seasonEnded.forEach(seasonArr::add);

        diff.put("addedCount", added.size());
        diff.set("added", added);
        diff.put("priceChangedCount", priceChanged.size());
        diff.set("priceChanged", priceChanged);
        diff.put("cleanedCount", cleanedArr.size());
        diff.set("cleaned", cleanedArr);
        diff.put("seasonEndedCount", seasonArr.size());
        diff.set("seasonEnded", seasonArr);
        diff.put("soldOutCount", soldOutCount);
        diff.set("soldOut", soldOut);
        return diff;
    }

    /** SALE_AMT 파싱: "6,300" → 6300. 빈값/0(가격 미산정) → null */
    private static Integer parseSaleAmt(String saleAmt) {
        if (saleAmt == null || saleAmt.isBlank()) {
            return null;
        }
        try {
            int parsed = Integer.parseInt(saleAmt.replace(",", "").trim());
            return parsed > 0 ? parsed : null;
        } catch (NumberFormatException e) {
            return null;
        }
    }

    // ==================== 장바구니 일괄 담기 ====================

    /**
     * ACTIVE 세션으로 항목별 순차 장바구니 담기 (항목당 0.3초 간격). 관리자 세션 사용.
     */
    public TwosomeCartAddResponse addItemsToCart(TwosomeCartAddRequest request) {
        return addItemsToCart(ACTIVE_KEY, request);
    }

    /**
     * 지정 세션으로 항목별 순차 장바구니 담기 (관리자/대표 공통)
     */
    public TwosomeCartAddResponse addItemsToCart(String sessionKey, TwosomeCartAddRequest request) {
        try {
            TwosomeCartAddResponse response = doAddItemsToCart(sessionKey, request);
            healthService.record(TwosomeHealthEventType.CART_ADD_SUCCESS, true,
                    "[" + ownerLabel(sessionKey) + "] 전체 " + response.getTotal()
                            + "건 중 성공 " + response.getSuccess() + "건");
            return response;
        } catch (TwosomeStoreException e) {
            healthService.record(TwosomeHealthEventType.CART_ADD_FAIL, false,
                    "[" + ownerLabel(sessionKey) + "] " + e.getMessage());
            throw e;
        }
    }

    private TwosomeCartAddResponse doAddItemsToCart(String sessionKey, TwosomeCartAddRequest request) {
        if (request.getItems() == null || request.getItems().isEmpty()) {
            throw new TwosomeStoreException("담을 항목이 없습니다.");
        }

        StoreSession session = requireSessionByKey(sessionKey, "투썸 로그인이 필요합니다.");
        setStoreInfo(session);

        List<TwosomeCartItemResult> results = new ArrayList<>();
        int successCount = 0;

        List<TwosomeCartItemRequest> items = request.getItems();
        for (int i = 0; i < items.size(); i++) {
            TwosomeCartItemRequest item = items.get(i);
            TwosomeMenu menu = (item.getMenuCd() != null)
                    ? twosomeMenuRepository.findByMenuCd(item.getMenuCd()).orElse(null)
                    : null;
            String menuNm = (menu != null) ? menu.getMenuNm() : null;

            try {
                String cartInfoJson = buildCartInfoJson(item, menu);
                TwosomeStoreApiClient.CartAddResult cartResult =
                        twosomeStoreApiClient.addToCart(session.getContext(), cartInfoJson);

                if (cartResult.success()) {
                    successCount++;
                    results.add(new TwosomeCartItemResult(menuNm, item.getMenuCd(), true, "담기 완료"));
                } else {
                    String message = (cartResult.resultMsg() != null && !cartResult.resultMsg().isBlank())
                            ? cartResult.resultMsg()
                            : "장바구니 담기 실패 (resultCd=" + cartResult.resultCd() + ")";
                    results.add(new TwosomeCartItemResult(menuNm, item.getMenuCd(), false, message));
                }
            } catch (TwosomeStoreSessionExpiredException e) {
                expire(sessionKey, session);
                results.add(new TwosomeCartItemResult(menuNm, item.getMenuCd(), false, "세션이 만료되었습니다."));
                for (int j = i + 1; j < items.size(); j++) {
                    results.add(new TwosomeCartItemResult(null, items.get(j).getMenuCd(), false, "세션 만료로 건너뜀"));
                }
                break;
            } catch (TwosomeStoreException e) {
                results.add(new TwosomeCartItemResult(menuNm, item.getMenuCd(), false, e.getMessage()));
            }

            if (i < items.size() - 1) {
                sleepBetweenCartAdds();
            }
        }

        session.touch();
        int failedCount = results.size() - successCount;
        return new TwosomeCartAddResponse(results.size(), successCount, failedCount, results);
    }

    // ==================== 장바구니 조회 / 수정 / 삭제 ====================

    /**
     * ACTIVE 세션으로 투썸 장바구니 목록 조회.
     * 응답 필드명은 실측 불가로 복수 후보에서 추출한다 (MENU_CD/MENU_NM/CART_NO 등).
     */
    public List<TwosomeCartItemResponse> getCartItems() {
        return getCartItems(ACTIVE_KEY);
    }

    /**
     * 지정 세션으로 투썸 장바구니 목록 조회 (관리자/대표 공통)
     */
    public List<TwosomeCartItemResponse> getCartItems(String sessionKey) {
        StoreSession session = requireSessionByKey(sessionKey, "투썸 로그인이 필요합니다.");

        JsonNode body;
        try {
            body = twosomeStoreApiClient.fetchCartList(session.getContext(), STORE_CD);
        } catch (TwosomeStoreSessionExpiredException e) {
            expire(sessionKey, session);
            throw e;
        }
        session.touch();

        JsonNode items = body.path("cartStoreMenuList");
        List<TwosomeCartItemResponse> result = new ArrayList<>();
        if (items.isArray()) {
            for (JsonNode item : items) {
                result.add(parseCartItem(item));
            }
        }
        return result;
    }

    /**
     * 옵션 그룹 의존성 조회 (menuOptListAjax 프록시, 읽기 전용).
     * 선택한 옵션 기준 미선택 그룹의 가능 선택지 배열을 반환한다.
     */
    public JsonNode getAvailableOptions(String sessionKey, String menuCd,
                                        List<String> opts, List<String> groupOptCds) {
        StoreSession session = requireSessionByKey(sessionKey, "투썸 로그인이 필요합니다.");
        try {
            JsonNode body = twosomeStoreApiClient.fetchAvailableOptions(
                    session.getContext(), menuCd, opts, groupOptCds);
            session.touch();
            return body.path("fetchResultListSet");
        } catch (TwosomeStoreSessionExpiredException e) {
            expire(sessionKey, session);
            throw e;
        }
    }

    /**
     * 장바구니 항목의 퍼스널 옵션(커스텀) 명세 조회 (읽기 전용, 관리자/대표 공통)
     */
    public JsonNode getCartCustomList(String sessionKey, String cartNo, String cartDtlNo) {
        StoreSession session = requireSessionByKey(sessionKey, "투썸 로그인이 필요합니다.");
        try {
            JsonNode body = twosomeStoreApiClient.fetchMenuCustomList(
                    session.getContext(), cartNo, cartDtlNo);
            session.touch();
            return body.path("fetchResultListSet");
        } catch (TwosomeStoreSessionExpiredException e) {
            expire(sessionKey, session);
            throw e;
        }
    }

    /**
     * 장바구니 항목 1건 삭제
     */
    public void removeCartItem(String cartNo, String cartDtlNo) {
        removeCartItem(ACTIVE_KEY, cartNo, cartDtlNo);
    }

    /**
     * 지정 세션의 장바구니 항목 1건 삭제 (관리자/대표 공통)
     */
    public void removeCartItem(String sessionKey, String cartNo, String cartDtlNo) {
        StoreSession session = requireSessionByKey(sessionKey, "투썸 로그인이 필요합니다.");
        try {
            boolean deleted = twosomeStoreApiClient.deleteCartItem(session.getContext(), cartNo, cartDtlNo);
            if (!deleted) {
                throw new TwosomeStoreException("장바구니 항목 삭제를 투썸 서버가 거부했습니다.");
            }
            session.touch();
            healthService.record(TwosomeHealthEventType.CART_ADD_SUCCESS, true,
                    "[" + ownerLabel(sessionKey) + "] 장바구니 항목 삭제 (cartNo=" + cartNo + ")");
        } catch (TwosomeStoreSessionExpiredException e) {
            expire(sessionKey, session);
            healthService.record(TwosomeHealthEventType.CART_ADD_FAIL, false,
                    "[" + ownerLabel(sessionKey) + "] " + e.getMessage());
            throw e;
        } catch (TwosomeStoreException e) {
            healthService.record(TwosomeHealthEventType.CART_ADD_FAIL, false,
                    "[" + ownerLabel(sessionKey) + "] " + e.getMessage());
            throw e;
        }
    }

    /**
     * 장바구니 전체 비우기. 항목당 0.3초 간격 순차 삭제.
     *
     * @return 삭제한 항목 수
     */
    public int clearCart() {
        return clearCart(ACTIVE_KEY);
    }

    /**
     * 지정 세션의 장바구니 전체 비우기. 항목당 0.3초 간격 순차 삭제.
     */
    public int clearCart(String sessionKey) {
        List<TwosomeCartItemResponse> items = getCartItems(sessionKey);
        int deleted = 0;
        for (int i = 0; i < items.size(); i++) {
            TwosomeCartItemResponse item = items.get(i);
            removeCartItem(sessionKey, item.getCartNo(), item.getCartDtlNo());
            deleted++;
            if (i < items.size() - 1) {
                sleepBetweenCartAdds();
            }
        }
        healthService.record(TwosomeHealthEventType.CART_ADD_SUCCESS, true,
                "[" + ownerLabel(sessionKey) + "] 장바구니 전체 비우기 (" + deleted + "건 삭제)");
        return deleted;
    }

    /**
     * 장바구니 항목 수량 조정. 투썸에 수량 변경 API가 없으므로 삭제 + 재담기로 처리.
     * midCd는 장바구니 항목에 없을 수 있어 로컬 메뉴 테이블에서 보완한다.
     */
    public void adjustCartItemQty(String cartNo, TwosomeCartQtyAdjustRequest request) {
        adjustCartItemQty(ACTIVE_KEY, cartNo, request);
    }

    /**
     * 지정 세션의 장바구니 항목 수량 조정. 투썸에 수량 변경 API가 없으므로 삭제 + 재담기로 처리.
     * opts(MENU_OPT_VAL)가 있으면 변형 코드를 다시 조회해 재담기한다.
     */
    public void adjustCartItemQty(String sessionKey, String cartNo, TwosomeCartQtyAdjustRequest request) {
        if (request.getQty() == null || request.getQty() < 1) {
            throw new TwosomeStoreException("수량은 1 이상이어야 합니다.");
        }
        if (request.getMenuCd() == null || request.getMenuCd().isBlank()) {
            throw new TwosomeStoreException("메뉴 코드가 올바르지 않습니다.");
        }

        // 재담기에 필요한 코드 준비 (로컬 메뉴 테이블에서 보완)
        String midCd = twosomeMenuRepository.findByMenuCd(request.getMenuCd())
                .map(TwosomeMenu::getMidCd)
                .orElse(null);

        // 삭제 후 재담기 (삭제 실패 시 재담기하지 않음)
        removeCartItem(sessionKey, cartNo, request.getCartDtlNo());

        StoreSession session = requireSessionByKey(sessionKey, "투썸 로그인이 필요합니다.");
        try {
            // opts가 있으면 변형 코드 다시 조회 (MENU_CD=변형, UP_MENU_CD=기본)
            String addMenuCd = request.getMenuCd();
            String upMenuCd = request.getMenuCd();
            if (request.getOpts() != null && !request.getOpts().isEmpty()) {
                JsonNode variant = twosomeStoreApiClient.resolveVariantMenu(
                        session.getContext(), request.getMenuCd(), STORE_CD, request.getOpts());
                String variantMenuCd = textOf(variant, "MENU_CD");
                if (variantMenuCd == null || variantMenuCd.isBlank()) {
                    throw new TwosomeStoreException("변형 메뉴 코드를 조회하지 못했습니다.");
                }
                addMenuCd = variantMenuCd;
            }

            Map<String, Object> cartInfo = new LinkedHashMap<>();
            cartInfo.put("CART_GBCD", "10");
            cartInfo.put("MENU_CD", addMenuCd);
            cartInfo.put("UP_MENU_CD", upMenuCd);
            cartInfo.put("BRND_CD", BRND_CD);
            cartInfo.put("STORE_CD", STORE_CD);
            cartInfo.put("CATG_ID", "");
            cartInfo.put("SET_MENU_YN", "N");
            cartInfo.put("ORD_CNT", String.valueOf(request.getQty()));
            cartInfo.put("MID_CD", midCd != null ? midCd : "");
            cartInfo.put("cartCstmInfo", request.getCstmInfo() != null ? request.getCstmInfo() : List.of());

            String cartInfoJson = objectMapper.writeValueAsString(cartInfo);
            TwosomeStoreApiClient.CartAddResult cartResult =
                    twosomeStoreApiClient.addToCart(session.getContext(), cartInfoJson);
            if (!cartResult.success()) {
                String message = (cartResult.resultMsg() != null && !cartResult.resultMsg().isBlank())
                        ? cartResult.resultMsg()
                        : "수량 조정 재담기 실패 (resultCd=" + cartResult.resultCd() + ")";
                throw new TwosomeStoreException(message);
            }
            session.touch();
            healthService.record(TwosomeHealthEventType.CART_ADD_SUCCESS, true,
                    "[" + ownerLabel(sessionKey) + "] 장바구니 수량 조정 (menuCd=" + request.getMenuCd()
                            + ", qty=" + request.getQty() + ")");
        } catch (TwosomeStoreSessionExpiredException e) {
            expire(sessionKey, session);
            healthService.record(TwosomeHealthEventType.CART_ADD_FAIL, false,
                    "[" + ownerLabel(sessionKey) + "] " + e.getMessage());
            throw e;
        } catch (TwosomeStoreException e) {
            healthService.record(TwosomeHealthEventType.CART_ADD_FAIL, false,
                    "[" + ownerLabel(sessionKey) + "] " + e.getMessage());
            throw e;
        } catch (JsonProcessingException e) {
            TwosomeStoreException wrapped = new TwosomeStoreException("수량 조정 요청을 만들지 못했습니다.", e);
            healthService.record(TwosomeHealthEventType.CART_ADD_FAIL, false, wrapped.getMessage());
            throw wrapped;
        }
    }

    /**
     * 장바구니 목록 항목 파싱. 필드명 실측 불가로 복수 후보에서 추출한다.
     */
    private TwosomeCartItemResponse parseCartItem(JsonNode item) {
        TwosomeCartItemResponse response = new TwosomeCartItemResponse();
        response.setCartNo(firstText(item, "CART_NO", "cartNo"));
        response.setCartDtlNo(firstText(item, "CART_DTL_NO", "cartDtlNo"));
        response.setMenuCd(firstText(item, "MENU_CD", "menuCd"));
        response.setUpMenuCd(firstText(item, "UP_MENU_CD", "upMenuCd"));
        response.setMidCd(firstText(item, "MID_CD", "midCd"));
        response.setMenuNm(firstText(item, "MENU_NM", "MENU_NM1", "menuNm", "MENU_NM2"));
        response.setQty(firstInt(item, 0, "ORD_CNT", "CART_CNT", "ORD_QTY", "qty"));
        response.setPrice(firstInt(item, null, "SALE_AMT", "SALE_PRC", "FINAL_PRC", "MENU_PRC", "PRC", "price"));
        // 재담기용 옵션 조합 (예: "010H,020R,040A,051E")
        response.setMenuOptVal(firstText(item, "MENU_OPT_VAL", "menuOptVal"));
        // 표시용 옵션 문자열 (예: "아이스 | 라지 | 블랙그라운드 | 일회용컵")
        response.setOptNm(firstText(item, "OPT_NM", "optNm"));
        response.setOrdAbleYn(firstText(item, "IS_ORD_ABLE_YN", "isOrdAbleYn", "ordAbleYn"));
        response.setOrdStopYn(firstText(item, "ORD_STOP_YN", "ordStopYn"));
        response.setNotSaleMsg(firstText(item, "NOT_SALE_MSG", "notSaleMsg"));
        response.setDepositAmt(firstInt(item, null, "DEPOSIT_AMT", "depositAmt"));
        response.setIndvCupYn(firstText(item, "INDVCUP_YN", "indvCupYn"));
        // 퍼스널 옵션(커스텀) 총계 — 0보다 크면 '퍼스널 옵션' 펼치기 노출
        response.setCstmAmt(firstInt(item, 0, "CSTM_AMT", "cstmAmt"));
        response.setCstmCnt(firstInt(item, 0, "CSTM_CNT", "cstmCnt"));
        return response;
    }

    private static String textOf(JsonNode node, String fieldName) {
        JsonNode value = node.get(fieldName);
        return (value != null && value.isTextual()) ? value.asText() : null;
    }

    private static String firstText(JsonNode node, String... fieldNames) {
        for (String fieldName : fieldNames) {
            JsonNode value = node.get(fieldName);
            if (value == null || value.isNull() || value.isContainerNode()) {
                continue;
            }
            if (!value.asText().isBlank()) {
                return value.asText();
            }
        }
        return null;
    }

    private static int firstInt(JsonNode node, Integer defaultValue, String... fieldNames) {
        for (String fieldName : fieldNames) {
            JsonNode value = node.get(fieldName);
            if (value != null && value.isNumber()) {
                return value.asInt();
            }
            if (value != null && value.isTextual()) {
                try {
                    return Integer.parseInt(value.asText().trim());
                } catch (NumberFormatException ignored) {
                    // 다음 후보 필드 시도
                }
            }
        }
        return defaultValue != null ? defaultValue : 0;
    }

    // ==================== 메뉴 상세 옵션 / 변형 코드 ====================

    /**
     * 메뉴 상세 페이지 HTML 조회 (옵션 그룹 파싱용). 지정 세션 사용.
     */
    public String fetchMenuDetailHtml(String sessionKey, String menuCd, String midCd) {
        StoreSession session = requireSessionByKey(sessionKey, "투썸 로그인이 필요합니다.");
        try {
            String html = twosomeStoreApiClient.fetchMenuDetailHtml(session.getContext(), menuCd, midCd);
            if (html != null && html.contains(NO_STORE_ALERT)) {
                // 세션 쿠키는 유효한데 투썸 서버 측 매장 바인딩이 사라진 경우 (재시작/세션 교체 등)
                log.info("Twosome store binding lost, re-setting store (sessionKey={}, menuCd={})", sessionKey, menuCd);
                setStoreInfo(session);
                html = twosomeStoreApiClient.fetchMenuDetailHtml(session.getContext(), menuCd, midCd);
            }
            session.touch();
            return html;
        } catch (TwosomeStoreSessionExpiredException e) {
            expire(sessionKey, session);
            throw e;
        }
    }

    /**
     * 퍼스널 옵션(커스텀) 패널 HTML 조회. 지정 세션 사용 (읽기 전용).
     *
     * @param variantMenuCd 변형 메뉴 코드 (getNewMenuInfoAjax 결과)
     * @return 커스텀 패널 HTML 조각 (커스텀 없는 메뉴는 빈 문자열)
     */
    public String getMenuCustomOptionsHtml(String sessionKey, String variantMenuCd) {
        StoreSession session = requireSessionByKey(sessionKey, "투썸 로그인이 필요합니다.");
        try {
            String html = twosomeStoreApiClient.fetchMenuCustomOptionsHtml(
                    session.getContext(), variantMenuCd, STORE_CD, "Y");
            session.touch();
            return html;
        } catch (TwosomeStoreSessionExpiredException e) {
            expire(sessionKey, session);
            throw e;
        }
    }

    /**
     * 선택 옵션 조합으로 변형 메뉴 코드 조회. 지정 세션 사용.
     */
    public JsonNode resolveVariantMenu(String sessionKey, String menuCd, List<String> opts) {
        StoreSession session = requireSessionByKey(sessionKey, "투썸 로그인이 필요합니다.");
        try {
            JsonNode variant = twosomeStoreApiClient.resolveVariantMenu(
                    session.getContext(), menuCd, STORE_CD, opts);
            session.touch();
            return variant;
        } catch (TwosomeStoreSessionExpiredException e) {
            expire(sessionKey, session);
            throw e;
        }
    }

    /**
     * 옵션 조회에 사용할 세션 key 결정: 지정 대표(memberId) 세션이 ACTIVE면 대표, 아니면 관리자 세션.
     * 둘 다 없으면 TwosomeStoreSessionExpiredException("투썸 로그인이 필요합니다.")
     */
    public String resolveOptionSessionKey(Long repMemberId) {
        if (repMemberId != null
                && "ACTIVE".equals(getSessionStatus(repKey(repMemberId)).getStatus())) {
            return repKey(repMemberId);
        }
        requireActiveSession();
        return ACTIVE_KEY;
    }

    // ==================== 매장 상세 (1시간 인메모리 캐시, 세션 불필요) ====================

    private static final Duration STORE_DETAIL_CACHE_TTL = Duration.ofMinutes(5);

    private volatile TwosomeStoreInfoResponse cachedStoreInfo;
    private volatile LocalDateTime cachedStoreInfoAt;

    /**
     * 매장 상세 정보 조회. 1시간 인메모리 캐시.
     * ACTIVE 관리자 세션이 있으면 그 컨텍스트로, 없으면 익명 컨텍스트로 호출한다.
     * 예외 발생 시 캐시가 있으면 캐시를 반환하고, 없으면 예외를 전파한다.
     */
    public synchronized TwosomeStoreInfoResponse getStoreInfo() {
        if (cachedStoreInfo != null && cachedStoreInfoAt != null
                && Duration.between(cachedStoreInfoAt, LocalDateTime.now())
                        .compareTo(STORE_DETAIL_CACHE_TTL) < 0) {
            return cachedStoreInfo;
        }
        try {
            JsonNode storeList = twosomeStoreApiClient.fetchStoreDetailInfo(
                    obtainStoreInfoContext(), STORE_CD, STORE_LAT, STORE_LONGI);
            TwosomeStoreInfoResponse storeInfo = parseStoreInfo(storeList);
            cachedStoreInfo = storeInfo;
            cachedStoreInfoAt = LocalDateTime.now();
            log.info("Fetched twosome store detail: {} (ordTime={})", storeInfo.getStoreNm(), storeInfo.getOrdTime());
            return storeInfo;
        } catch (TwosomeStoreException e) {
            if (cachedStoreInfo != null) {
                log.warn("Store detail fetch failed, returning cached value: {}", e.getMessage());
                return cachedStoreInfo;
            }
            throw e;
        }
    }

    /** ACTIVE 관리자 세션의 컨텍스트, 없으면 익명 컨텍스트 (storeDetailInfo는 세션 불필요) */
    private TwosomeStoreSessionContext obtainStoreInfoContext() {
        StoreSession admin = sessionStore.get(ACTIVE_KEY);
        if (admin != null && !admin.isPending()
                && admin.getStatus() != SessionStatus.EXPIRED && !admin.isIdleExpired()) {
            return admin.getContext();
        }
        return new TwosomeStoreSessionContext();
    }

    private TwosomeStoreInfoResponse parseStoreInfo(JsonNode storeList) {
        JsonNode store = (storeList != null && storeList.isArray() && !storeList.isEmpty())
                ? storeList.get(0)
                : null;
        if (store == null) {
            throw new TwosomeStoreException("매장 상세 응답이 비어 있습니다.");
        }
        TwosomeStoreInfoResponse response = new TwosomeStoreInfoResponse();
        response.setStoreNm(textOf(store, "STORE_NM"));
        response.setOrdTime(textOf(store, "ORD_TIME"));
        response.setOvertimeOrderYn(textOf(store, "OVERTIME_ORDER_YN"));
        response.setEasmPrvtYn(textOf(store, "EASM_PRVT_YN"));
        response.setFacilities(parseStoreFacilities(textOf(store, "OPT_CD_JSON")));
        return response;
    }

    /** OPT_CD_JSON: "[{\"CD\":\"01\",\"NM\":\"투썸오더\",\"REF\":\"twosomeorder\"},...]" */
    private List<TwosomeStoreInfoResponse.Facility> parseStoreFacilities(String optCdJson) {
        List<TwosomeStoreInfoResponse.Facility> facilities = new ArrayList<>();
        if (optCdJson == null || optCdJson.isBlank()) {
            return facilities;
        }
        try {
            JsonNode array = objectMapper.readTree(optCdJson);
            if (array.isArray()) {
                for (JsonNode node : array) {
                    facilities.add(new TwosomeStoreInfoResponse.Facility(
                            textOf(node, "CD"), textOf(node, "NM"), textOf(node, "REF")));
                }
            }
        } catch (JsonProcessingException e) {
            log.warn("Failed to parse OPT_CD_JSON (ignored): {}", e.getMessage());
        }
        return facilities;
    }

    // ==================== 낮은 수준 헬퍼 ====================

    /**
     * 관리자 ACTIVE 세션 확인. 유휴 30분 경과 시 EXPIRED 처리 후 예외.
     */
    private StoreSession requireActiveSession() {
        return requireSessionByKey(ACTIVE_KEY, "투썸 로그인이 필요합니다.");
    }

    /**
     * 지정 key 세션 확인. 세션 없으면 notLoggedInMessage, 유휴 30분 경과 시 EXPIRED 처리 후 예외.
     */
    private StoreSession requireSessionByKey(String sessionKey, String notLoggedInMessage) {
        StoreSession session = sessionStore.get(sessionKey);
        if (session == null || session.isPending()) {
            throw new TwosomeStoreSessionExpiredException(notLoggedInMessage);
        }
        synchronized (sessionLock) {
            if (session.getStatus() == SessionStatus.EXPIRED || session.isIdleExpired()) {
                session.setStatus(SessionStatus.EXPIRED);
                throw new TwosomeStoreSessionExpiredException(
                        "투썸 세션이 만료되었습니다. 다시 로그인해주세요.");
            }
        }
        return session;
    }

    private static String repKey(Long memberId) {
        return REP_KEY_PREFIX + memberId;
    }

    /** 대표 세션 key ("rep:{memberId}") — 컨트롤러/다른 서비스에서 대표 세션 조작 시 사용 */
    public static String repSessionKey(Long memberId) {
        return REP_KEY_PREFIX + memberId;
    }

    /** 헬스 이벤트용 세션 소유자 표기 */
    private static String ownerLabel(String sessionKey) {
        return ACTIVE_KEY.equals(sessionKey) ? "관리자" : "대표";
    }

    private String setStoreInfo(StoreSession session) {
        String storeNm = twosomeStoreApiClient.setStoreInfo(
                session.getContext(), STORE_CD, STORE_LAT, STORE_LONGI);
        session.touch();
        return storeNm;
    }

    private void expire(String sessionKey, StoreSession session) {
        synchronized (sessionLock) {
            session.setStatus(SessionStatus.EXPIRED);
        }
        if (ACTIVE_KEY.equals(sessionKey)) {
            sessionRedisStore.delete();
        }
        log.info("Twosome session expired (key={})", sessionKey);
    }

    private void purgeExpiredPendingSessions() {
        sessionStore.entrySet().removeIf(entry ->
                entry.getValue().isPending() && entry.getValue().isPendingExpired());
    }

    private String buildCartInfoJson(TwosomeCartItemRequest item, TwosomeMenu menu) {
        // 변형 코드(옵션 조합 결과)가 있으면 MENU_CD=변형, UP_MENU_CD=기본 코드
        String menuCd = (item.getVariantMenuCd() != null && !item.getVariantMenuCd().isBlank())
                ? item.getVariantMenuCd()
                : item.getMenuCd();
        String upMenuCd = (item.getUpMenuCd() != null && !item.getUpMenuCd().isBlank())
                ? item.getUpMenuCd()
                : item.getMenuCd();
        String midCd = (item.getMidCd() != null && !item.getMidCd().isBlank())
                ? item.getMidCd()
                : (menu != null ? menu.getMidCd() : null);
        if (menuCd == null || menuCd.isBlank() || midCd == null || midCd.isBlank()) {
            throw new TwosomeStoreException("메뉴 코드/중분류 코드가 올바르지 않습니다.");
        }
        int qty = (item.getQty() != null && item.getQty() > 0) ? item.getQty() : 1;

        Map<String, Object> cartInfo = new LinkedHashMap<>();
        cartInfo.put("CART_GBCD", "10");
        cartInfo.put("MENU_CD", menuCd);
        cartInfo.put("UP_MENU_CD", upMenuCd);
        cartInfo.put("BRND_CD", BRND_CD);
        cartInfo.put("STORE_CD", STORE_CD);
        cartInfo.put("CATG_ID", "");
        cartInfo.put("SET_MENU_YN", "N");
        cartInfo.put("ORD_CNT", String.valueOf(qty));
        cartInfo.put("MID_CD", midCd);
        cartInfo.put("cartCstmInfo", item.getCstmInfo() != null ? item.getCstmInfo() : List.of());

        try {
            return objectMapper.writeValueAsString(cartInfo);
        } catch (JsonProcessingException e) {
            throw new TwosomeStoreException("장바구니 요청을 만들지 못했습니다.", e);
        }
    }

    private void sleepBetweenCartAdds() {
        try {
            Thread.sleep(CART_ADD_INTERVAL_MS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    /**
     * 매장 메뉴 upsert: menuCd 기준으로 없으면 신규, 있으면 매장 정보로 갱신.
     * 매장 목록에서 사라진 기존 항목은 이번에 del_yn 처리하지 않고 diff 리포트의 '사라짐'으로만 기록한다.
     */
    private int upsertStoreMenus(List<TwosomeMenuItem> items, Map<String, TwosomeMenu> existingByMenuCd) {
        Set<String> fetchedMenuCds = new HashSet<>();
        List<TwosomeMenu> toSave = new ArrayList<>();
        LocalDateTime now = LocalDateTime.now();

        for (TwosomeMenuItem item : items) {
            if (item.getMenuCd() == null || item.getMenuCd().isBlank()) {
                continue;
            }
            // 매장 응답에는 같은 메뉴가 중분류별로 중복 수록되므로 첫 번째 것만 처리
            if (!fetchedMenuCds.add(item.getMenuCd())) {
                continue;
            }

            TwosomeMenu menu = existingByMenuCd.get(item.getMenuCd());
            if (menu == null) {
                menu = new TwosomeMenu();
                menu.setMenuCd(item.getMenuCd());
                menu.setDelYn("N");
                menu.setCreatedDate(now);
            }
            menu.setMenuNm(item.getMenuNm());
            menu.setEnMenuNm(item.getEnMenuNm());
            menu.setGrtCd(item.getGrtCd());
            menu.setGrtNm(item.getGrtNm());
            menu.setMidCd(item.getMidCd());
            menu.setMidNm(item.getMidNm());
            menu.setMenuImg(item.getMenuImg());
            menu.setMenuImg01(item.getMenuImg01());
            menu.setMenuImg02(item.getMenuImg02());
            menu.setMenuImg03(item.getMenuImg03());
            menu.setBadgCd(item.getBadgCd());
            menu.setBadgNm(item.getBadgNm());
            menu.setSaleAmt(parseSaleAmt(item.getSaleAmt())); // 0(가격 미산정)은 null
            menu.setSalesPsblQty(item.getSalesPsblQty());     // -1=무제한 그대로
            menu.setDefaultMenuCd(item.getDefaultMenuCd());
            menu.setUseFrDt(item.getUseFrDt());
            menu.setSortOrd(item.getSortOrd());
            menu.setDmDisplayNo(item.getDmDisplayNo());
            menu.setDelYn("N");
            menu.setOptionData(null); // 메뉴 갱신 시 상세 옵션 캐시 무효화
            toSave.add(menu);
        }

        twosomeMenuRepository.saveAll(toSave);
        return fetchedMenuCds.size();
    }

    // ==================== 세션 레코드 ====================

    @Getter
    private static class StoreSession {

        private final TwosomeStoreSessionContext context;
        private final LocalDateTime createdAt;
        /** pending(캡차 발급) 컨텍스트 여부. 로그인 성공 시 false로 전환 */
        private boolean pending;
        private volatile SessionStatus status;
        private volatile LocalDateTime lastUsedAt;
        private volatile String source = "FRESH";
        @Setter
        private volatile String storeNm;

        StoreSession(TwosomeStoreSessionContext context) {
            this(context, false);
        }

        StoreSession(TwosomeStoreSessionContext context, boolean pending) {
            this.context = context;
            this.createdAt = LocalDateTime.now();
            this.pending = pending;
            this.status = SessionStatus.NONE;
        }

        /** pending 컨텍스트 5분 만료 여부 */
        boolean isPendingExpired() {
            return Duration.between(createdAt, LocalDateTime.now()).compareTo(PENDING_TIMEOUT) >= 0;
        }

        /** ACTIVE 세션 유휴 30분 만료 여부 (슬라이딩) */
        boolean isIdleExpired() {
            return lastUsedAt != null
                    && Duration.between(lastUsedAt, LocalDateTime.now()).compareTo(SESSION_IDLE_TIMEOUT) >= 0;
        }

        long getRemainingMinutes() {
            if (lastUsedAt == null) {
                return SESSION_IDLE_TIMEOUT.toMinutes();
            }
            long elapsed = Duration.between(lastUsedAt, LocalDateTime.now()).toMinutes();
            return Math.max(0, SESSION_IDLE_TIMEOUT.toMinutes() - elapsed);
        }

        void promoteToActive() {
            this.pending = false;
            this.status = SessionStatus.ACTIVE;
            touch();
        }

        void markAsRestored() {
            this.source = "RESTORED";
        }

        void touch() {
            this.lastUsedAt = LocalDateTime.now();
        }

        void setStatus(SessionStatus status) {
            this.status = status;
        }
    }
}
