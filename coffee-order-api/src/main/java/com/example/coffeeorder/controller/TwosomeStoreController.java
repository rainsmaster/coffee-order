package com.example.coffeeorder.controller;

import com.example.coffeeorder.dto.TwosomeAutoReloginResult;
import com.example.coffeeorder.dto.TwosomeCaptchaResponse;
import com.example.coffeeorder.dto.TwosomeCartAddRequest;
import com.example.coffeeorder.dto.TwosomeCartAddResponse;
import com.example.coffeeorder.dto.TwosomeCartItemResponse;
import com.example.coffeeorder.dto.TwosomeCartQtyAdjustRequest;
import com.example.coffeeorder.dto.TwosomeHealthResponse;
import com.example.coffeeorder.dto.TwosomeLoginRequest;
import com.example.coffeeorder.dto.TwosomeLoginResponse;
import com.example.coffeeorder.dto.TwosomeMenuCustomOptionsRequest;
import com.example.coffeeorder.dto.TwosomeMenuOptionsResponse;
import com.example.coffeeorder.dto.TwosomeSessionResponse;
import com.example.coffeeorder.dto.TwosomeStoreInfoResponse;
import com.example.coffeeorder.dto.TwosomeVariantResolveRequest;
import com.example.coffeeorder.dto.TwosomeVariantResolveResponse;
import com.example.coffeeorder.exception.TwosomeStoreException;
import com.example.coffeeorder.exception.TwosomeStoreSessionExpiredException;
import com.example.coffeeorder.service.RepAuthService;
import com.example.coffeeorder.service.TwosomeAutoReloginService;
import com.example.coffeeorder.service.TwosomeHealthService;
import com.example.coffeeorder.service.TwosomeMenuOptionService;
import com.example.coffeeorder.service.TwosomeStoreIntegrationService;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 관리자 계정 연동과 메뉴 옵션 API.
 * 대표별 실제 장바구니 요청은 RepController가 담당한다.
 */
@Slf4j
@RestController
@RequestMapping("/api/twosome")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:3000")
public class TwosomeStoreController {

    private final TwosomeStoreIntegrationService twosomeStoreIntegrationService;
    private final TwosomeAutoReloginService twosomeAutoReloginService;
    private final TwosomeHealthService twosomeHealthService;
    private final TwosomeMenuOptionService twosomeMenuOptionService;
    private final RepAuthService repAuthService;

    // 캡차 발급 (pending 컨텍스트 생성)
    @PostMapping("/auth/captcha")
    public ResponseEntity<TwosomeCaptchaResponse> issueCaptcha() {
        return ResponseEntity.ok(twosomeStoreIntegrationService.issueCaptcha());
    }

    // 로그인 (pending 컨텍스트를 ACTIVE 세션으로 승격)
    @PostMapping("/auth/login")
    public ResponseEntity<TwosomeLoginResponse> login(@RequestBody TwosomeLoginRequest request) {
        return ResponseEntity.ok(twosomeStoreIntegrationService.login(request));
    }

    // 자동 재로그인 (캡차 OCR + 관리자 자격증명, 수동 트리거)
    @PostMapping("/auth/auto-login")
    public ResponseEntity<TwosomeAutoReloginResult> autoLogin() {
        return ResponseEntity.ok(twosomeAutoReloginService.autoLogin());
    }

    // 세션 상태 조회
    @GetMapping("/session")
    public ResponseEntity<TwosomeSessionResponse> getSession() {
        return ResponseEntity.ok(twosomeStoreIntegrationService.getSessionStatus());
    }

    // 연동 상태 패널 (세션 + 유형별 지표 + 최근 이벤트)
    @GetMapping("/health")
    public ResponseEntity<TwosomeHealthResponse> getHealth() {
        TwosomeSessionResponse session = twosomeStoreIntegrationService.getSessionStatus();
        TwosomeHealthResponse.SessionHealth sessionHealth = new TwosomeHealthResponse.SessionHealth(
                session.getStatus(),
                session.getStoreNm(),
                session.getLastUsedAt(),
                session.getRemainingMinutes(),
                session.getSource(),
                "ACTIVE".equals(session.getStatus()) ? session.getLastUsedAt() : null);
        return ResponseEntity.ok(new TwosomeHealthResponse(
                sessionHealth,
                twosomeHealthService.getIndicators(),
                twosomeHealthService.getRecentEvents()));
    }

    // 로그아웃 (선택)
    @PostMapping("/auth/logout")
    public ResponseEntity<Map<String, Object>> logout() {
        twosomeStoreIntegrationService.logout();
        Map<String, Object> result = new HashMap<>();
        result.put("status", "SUCCESS");
        result.put("message", "로그아웃되었습니다.");
        return ResponseEntity.ok(result);
    }

    // 매장 메뉴로 메뉴 DB 새로고침
    @PostMapping("/menu/refresh")
    public ResponseEntity<Map<String, Object>> refreshMenus() {
        int updatedCount = twosomeStoreIntegrationService.refreshStoreMenus();
        Map<String, Object> result = new HashMap<>();
        result.put("updatedCount", updatedCount);
        result.put("message", String.format("매장 메뉴 %d건으로 교체했습니다.", updatedCount));
        return ResponseEntity.ok(result);
    }

    // 최근 메뉴 새로고침 diff 리포트 조회 (관리자 페이지 표시용, 없으면 null)
    @GetMapping("/menu-refresh/diff")
    public ResponseEntity<String> getMenuRefreshDiff() {
        String diff = twosomeStoreIntegrationService.getMenuRefreshDiff();
        if (diff == null) {
            return ResponseEntity.ok("{}");
        }
        return ResponseEntity.ok(diff);
    }

    // 팀 주문 항목을 투썸 장바구니에 일괄 담기
    @PostMapping("/cart/add")
    public ResponseEntity<TwosomeCartAddResponse> addToCart(@RequestBody TwosomeCartAddRequest request) {
        return ResponseEntity.ok(twosomeStoreIntegrationService.addItemsToCart(request));
    }

    // ==================== 메뉴 옵션 (관리자/대표 공통) ====================

    /**
     * 메뉴 옵션 그룹 조회 (상세 페이지 파싱 + 캐시).
     * X-Rep-Token이 유효하고 대표 투썸 세션이 ACTIVE면 대표 세션, 아니면 관리자 세션 사용.
     */
    @GetMapping("/menus/{menuCd}/options")
    public ResponseEntity<TwosomeMenuOptionsResponse> getMenuOptions(
            @RequestHeader(value = "X-Rep-Token", required = false) String repToken,
            @PathVariable String menuCd) {
        Long repMemberId = repAuthService.resolveMemberIdIfValid(repToken).orElse(null);
        String sessionKey = twosomeStoreIntegrationService.resolveOptionSessionKey(repMemberId);
        return ResponseEntity.ok(twosomeMenuOptionService.getMenuOptions(sessionKey, menuCd));
    }

    /**
     * 옵션 그룹 의존성 조회 (menuOptListAjax 프록시, 읽기 전용).
     * 선택한 옵션 기준 미선택 그룹의 가능 선택지 배열 [{OPT_GRP_CD, OPTS, OPT_CD, USE_YN}] 반환.
     * 관리자 세션 없으면 대표 세션(X-Rep-Token)으로 폴리백.
     */
    @PostMapping("/menus/available-options")
    public ResponseEntity<JsonNode> getAvailableOptions(
            @RequestHeader(value = "X-Rep-Token", required = false) String repToken,
            @RequestBody TwosomeMenuCustomOptionsRequest request) {
        Long repMemberId = repAuthService.resolveMemberIdIfValid(repToken).orElse(null);
        String sessionKey = twosomeStoreIntegrationService.resolveOptionSessionKey(repMemberId);
        return ResponseEntity.ok(twosomeStoreIntegrationService.getAvailableOptions(
                sessionKey, request.getMenuCd(),
                request.getOpts() != null ? request.getOpts() : List.of(),
                request.getGroupOptCds() != null ? request.getGroupOptCds() : List.of()));
    }

    /**
     * 투썸 퍼스널 옵션(커스텀) 목록 조회 (tsTsoMenuCustomListAjax 프록시, 읽기 전용).
     * 변형 메뉴 코드 기준 커스텀 패널 HTML 조각을 반환한다 (커스텀 없으면 빈 문자열).
     * 관리자 세션 없으면 대표 세션(X-Rep-Token)으로 폴리백.
     */
    @PostMapping("/menus/custom-options")
    public ResponseEntity<JsonNode> getMenuCustomOptions(
            @RequestHeader(value = "X-Rep-Token", required = false) String repToken,
            @RequestBody TwosomeMenuCustomOptionsRequest request) {
        Long repMemberId = repAuthService.resolveMemberIdIfValid(repToken).orElse(null);
        String sessionKey = twosomeStoreIntegrationService.resolveOptionSessionKey(repMemberId);
        return ResponseEntity.ok(twosomeMenuOptionService.getMenuCustomOptions(
                sessionKey, request.getMenuCd()));
    }

    /**
     * 선택 옵션 조합의 변형 메뉴 코드 조회 (예상 가격 포함)
     */
    @PostMapping("/menus/resolve-variant")
    public ResponseEntity<TwosomeVariantResolveResponse> resolveVariant(
            @RequestHeader(value = "X-Rep-Token", required = false) String repToken,
            @RequestBody TwosomeVariantResolveRequest request) {
        Long repMemberId = repAuthService.resolveMemberIdIfValid(repToken).orElse(null);
        String sessionKey = twosomeStoreIntegrationService.resolveOptionSessionKey(repMemberId);
        return ResponseEntity.ok(twosomeMenuOptionService.resolveVariant(sessionKey, request));
    }

    // 매장 상세 정보 (영업시간/시설 태그, 세션 불필요, 1시간 캐시)
    @GetMapping("/store-info")
    public ResponseEntity<TwosomeStoreInfoResponse> getStoreInfo() {
        return ResponseEntity.ok(twosomeStoreIntegrationService.getStoreInfo());
    }

    // 투썸 장바구니 목록 조회
    @GetMapping("/cart")
    public ResponseEntity<List<TwosomeCartItemResponse>> getCartItems() {
        return ResponseEntity.ok(twosomeStoreIntegrationService.getCartItems());
    }

    // 투썸 장바구니 항목 삭제
    @DeleteMapping("/cart/items/{cartNo}")
    public ResponseEntity<Map<String, Object>> removeCartItem(
            @PathVariable String cartNo,
            @RequestParam String cartDtlNo) {
        twosomeStoreIntegrationService.removeCartItem(cartNo, cartDtlNo);
        Map<String, Object> result = new HashMap<>();
        result.put("status", "SUCCESS");
        result.put("message", "장바구니 항목이 삭제되었습니다.");
        return ResponseEntity.ok(result);
    }

    // 투썸 장바구니 항목 수량 조정 (삭제 + 재담기)
    @PutMapping("/cart/items/{cartNo}/qty")
    public ResponseEntity<Map<String, Object>> adjustCartItemQty(
            @PathVariable String cartNo,
            @RequestBody TwosomeCartQtyAdjustRequest request) {
        twosomeStoreIntegrationService.adjustCartItemQty(cartNo, request);
        Map<String, Object> result = new HashMap<>();
        result.put("status", "SUCCESS");
        result.put("message", "수량이 조정되었습니다.");
        return ResponseEntity.ok(result);
    }

    // 투썸 장바구니 전체 비우기
    @PostMapping("/cart/clear")
    public ResponseEntity<Map<String, Object>> clearCart() {
        int deletedCount = twosomeStoreIntegrationService.clearCart();
        Map<String, Object> result = new HashMap<>();
        result.put("status", "SUCCESS");
        result.put("deletedCount", deletedCount);
        result.put("message", String.format("장바구니 %d건이 삭제되었습니다.", deletedCount));
        return ResponseEntity.ok(result);
    }

    // 세션 만료 공통 처리 (401 + JSON)
    @ExceptionHandler(TwosomeStoreSessionExpiredException.class)
    public ResponseEntity<Map<String, Object>> handleSessionExpired(TwosomeStoreSessionExpiredException e) {
        Map<String, Object> body = new HashMap<>();
        body.put("status", "EXPIRED");
        body.put("error", "TWOSOME_SESSION_EXPIRED");
        body.put("message", e.getMessage());
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(body);
    }

    // 일반 연동 오류 (400 + JSON)
    @ExceptionHandler(TwosomeStoreException.class)
    public ResponseEntity<Map<String, Object>> handleStoreError(TwosomeStoreException e) {
        log.warn("Twosome store integration error: {}", e.getMessage());
        Map<String, Object> body = new HashMap<>();
        body.put("status", "FAILED");
        body.put("error", "TWOSOME_INTEGRATION_ERROR");
        body.put("message", e.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }
}
