package com.example.coffeeorder.controller;

import com.example.coffeeorder.dto.PinChangeRequest;
import com.example.coffeeorder.dto.PinSetupRequest;
import com.example.coffeeorder.dto.RepLoginRequest;
import com.example.coffeeorder.dto.RepLoginResponse;
import com.example.coffeeorder.dto.RepMeResponse;
import com.example.coffeeorder.dto.RepPublicItem;
import com.example.coffeeorder.dto.RepTwosomeAccountRequest;
import com.example.coffeeorder.dto.TwosomeCartAddRequest;
import com.example.coffeeorder.dto.TwosomeCartAddResponse;
import com.example.coffeeorder.dto.TwosomeCaptchaResponse;
import com.example.coffeeorder.dto.TwosomeCartItemResponse;
import com.example.coffeeorder.dto.TwosomeCartQtyAdjustRequest;
import com.example.coffeeorder.dto.TwosomeLoginRequest;
import com.example.coffeeorder.dto.TwosomeLoginResponse;
import com.example.coffeeorder.dto.TwosomeSessionResponse;
import com.example.coffeeorder.entity.Member;
import com.example.coffeeorder.exception.AuthException;
import com.example.coffeeorder.exception.TwosomeStoreException;
import com.example.coffeeorder.exception.TwosomeStoreSessionExpiredException;
import com.example.coffeeorder.repository.MemberRepository;
import com.example.coffeeorder.service.RepAuthService;
import com.example.coffeeorder.service.TwosomeStoreIntegrationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 팀 대표용 공개 API (로그인/PIN 설정/목록) + 본인 API (X-Rep-Token).
 */
@RestController
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:3000")
public class RepController {

    private final RepAuthService repAuthService;
    private final MemberRepository memberRepository;
    private final TwosomeStoreIntegrationService twosomeStoreIntegrationService;

    // 로그인 화면용 활성 대표 목록 (id+이름+팀명만)
    @GetMapping("/api/reps")
    @Transactional(readOnly = true)
    public ResponseEntity<List<RepPublicItem>> listReps() {
        List<RepPublicItem> reps = memberRepository.findByDelYnOrderByIdAsc("N").stream()
                .map(member -> new RepPublicItem(
                        member.getId(), member.getName(), member.getTeam().getName()))
                .toList();
        return ResponseEntity.ok(reps);
    }

    // 최초 PIN 설정 (1회용 초대코드 필요)
    @PostMapping("/api/rep/pin/setup")
    public ResponseEntity<Map<String, Object>> setupPin(@RequestBody PinSetupRequest request) {
        repAuthService.setupPin(request.getMemberId(), request.getInviteCode(), request.getPin());
        Map<String, Object> result = new HashMap<>();
        result.put("status", "SUCCESS");
        result.put("message", "PIN이 설정되었습니다.");
        return ResponseEntity.ok(result);
    }

    // 대표 로그인. PIN 미설정 시 error=PIN_NOT_SET
    @PostMapping("/api/rep/login")
    public ResponseEntity<RepLoginResponse> login(@RequestBody RepLoginRequest request) {
        RepAuthService.RepLoginResult login = repAuthService.login(request.getMemberId(), request.getPin());
        return ResponseEntity.ok(new RepLoginResponse(
                login.token(), login.name(), login.teamName(), login.teamId()));
    }

    // PIN 변경 (현재 PIN 확인, 성공 시 실패 카운트 초기화)
    @PostMapping("/api/rep/pin/change")
    public ResponseEntity<Map<String, Object>> changePin(
            @RequestHeader(value = "X-Rep-Token", required = false) String token,
            @RequestBody PinChangeRequest request) {
        repAuthService.changePin(token, request.getCurrentPin(), request.getNewPin());
        Map<String, Object> result = new HashMap<>();
        result.put("status", "SUCCESS");
        result.put("message", "PIN이 변경되었습니다.");
        return ResponseEntity.ok(result);
    }

    // 내 정보 (PIN/투썸 비밀번호 제외)
    @GetMapping("/api/rep/me")
    public ResponseEntity<RepMeResponse> me(
            @RequestHeader(value = "X-Rep-Token", required = false) String token) {
        Member member = repAuthService.resolveByToken(token);
        return ResponseEntity.ok(new RepMeResponse(
                member.getId(),
                member.getName(),
                member.getTeam().getId(),
                member.getTeam().getName(),
                member.isPinSet(),
                member.getLastLoginAt(),
                member.getTwosomeId() != null && !member.getTwosomeId().isBlank(),
                member.getTwosomeId()));
    }

    // ==================== 대표 투썸 계정 / 개인 세션 ====================

    /**
     * 투썸 계정 등록 (AES-256-GCM 암호화 저장, 평문 즉시 폐기)
     */
    @PostMapping("/api/rep/twosome/account")
    public ResponseEntity<Map<String, Object>> registerTwosomeAccount(
            @RequestHeader(value = "X-Rep-Token", required = false) String token,
            @RequestBody RepTwosomeAccountRequest request) {
        repAuthService.registerTwosomeAccount(token, request.getTwosomeId(), request.getTwosomePw());
        Map<String, Object> result = new HashMap<>();
        result.put("status", "SUCCESS");
        result.put("message", "투썸 계정이 등록되었습니다.");
        return ResponseEntity.ok(result);
    }

    // 대표 투썸 로그인용 캡차 발급 (수동 입력, OCR 자동화는 관리자 전용)
    @PostMapping("/api/rep/twosome/captcha")
    public ResponseEntity<TwosomeCaptchaResponse> issueTwosomeCaptcha(
            @RequestHeader(value = "X-Rep-Token", required = false) String token) {
        repAuthService.resolveByToken(token);
        return ResponseEntity.ok(twosomeStoreIntegrationService.issueCaptcha());
    }

    /**
     * 대표 투썸 로그인 (통합 폼, 캡차 수동 입력).
     * - 요청에 loginId/loginPwd가 있으면 그 값으로 로그인하고, 성공 시 해당 대표 계정으로 저장
     * - 없으면 기존처럼 저장된 계정으로 로그인 (하위 호환)
     */
    @PostMapping("/api/rep/twosome/login")
    public ResponseEntity<TwosomeLoginResponse> loginTwosome(
            @RequestHeader(value = "X-Rep-Token", required = false) String token,
            @RequestBody TwosomeLoginRequest request) {
        boolean credentialsProvided = request.getLoginId() != null && !request.getLoginId().isBlank()
                && request.getLoginPwd() != null && !request.getLoginPwd().isBlank();
        if (credentialsProvided) {
            Member member = repAuthService.resolveByToken(token);
            TwosomeLoginRequest loginRequest = new TwosomeLoginRequest(
                    request.getContextId(), request.getLoginId(), request.getLoginPwd(), request.getAnswerCd());
            TwosomeLoginResponse response = twosomeStoreIntegrationService.loginForRep(member.getId(), loginRequest);
            if ("SUCCESS".equals(response.getStatus())) {
                // 로그인 성공 시 입력받은 자격증명을 해당 대표 계정으로 저장 (암호화)
                repAuthService.registerTwosomeAccount(token, request.getLoginId(), request.getLoginPwd());
            }
            return ResponseEntity.ok(response);
        }
        RepAuthService.TwosomeCredentials credentials = repAuthService.requireTwosomeCredentials(token);
        TwosomeLoginRequest loginRequest = new TwosomeLoginRequest(
                request.getContextId(), credentials.twosomeId(), credentials.twosomePw(), request.getAnswerCd());
        return ResponseEntity.ok(twosomeStoreIntegrationService.loginForRep(
                credentials.memberId(), loginRequest));
    }

    @PostMapping("/api/rep/twosome/logout")
    public ResponseEntity<Map<String, Object>> logoutTwosome(
            @RequestHeader(value = "X-Rep-Token", required = false) String token) {
        Member member = repAuthService.resolveByToken(token);
        twosomeStoreIntegrationService.logout(TwosomeStoreIntegrationService.repSessionKey(member.getId()));
        Map<String, Object> result = new HashMap<>();
        result.put("status", "SUCCESS");
        result.put("message", "투썸 로그아웃되었습니다.");
        return ResponseEntity.ok(result);
    }

    @GetMapping("/api/rep/twosome/session")
    public ResponseEntity<TwosomeSessionResponse> getTwosomeSession(
            @RequestHeader(value = "X-Rep-Token", required = false) String token) {
        Member member = repAuthService.resolveByToken(token);
        return ResponseEntity.ok(twosomeStoreIntegrationService.getSessionStatus(
                TwosomeStoreIntegrationService.repSessionKey(member.getId())));
    }

    // ==================== 대표 세션 장바구니 ====================

    @PostMapping("/api/rep/twosome/cart/add")
    public ResponseEntity<TwosomeCartAddResponse> addToCart(
            @RequestHeader(value = "X-Rep-Token", required = false) String token,
            @RequestBody TwosomeCartAddRequest request) {
        Member member = repAuthService.resolveByToken(token);
        return ResponseEntity.ok(twosomeStoreIntegrationService.addItemsToCart(
                TwosomeStoreIntegrationService.repSessionKey(member.getId()), request));
    }

    @GetMapping("/api/rep/twosome/cart")
    public ResponseEntity<List<TwosomeCartItemResponse>> getCartItems(
            @RequestHeader(value = "X-Rep-Token", required = false) String token) {
        Member member = repAuthService.resolveByToken(token);
        return ResponseEntity.ok(twosomeStoreIntegrationService.getCartItems(
                TwosomeStoreIntegrationService.repSessionKey(member.getId())));
    }

    @DeleteMapping("/api/rep/twosome/cart/items/{cartNo}")
    public ResponseEntity<Map<String, Object>> removeCartItem(
            @RequestHeader(value = "X-Rep-Token", required = false) String token,
            @PathVariable String cartNo,
            @RequestParam String cartDtlNo) {
        Member member = repAuthService.resolveByToken(token);
        twosomeStoreIntegrationService.removeCartItem(
                TwosomeStoreIntegrationService.repSessionKey(member.getId()), cartNo, cartDtlNo);
        Map<String, Object> result = new HashMap<>();
        result.put("status", "SUCCESS");
        result.put("message", "장바구니 항목이 삭제되었습니다.");
        return ResponseEntity.ok(result);
    }

    @PutMapping("/api/rep/twosome/cart/items/{cartNo}/qty")
    public ResponseEntity<Map<String, Object>> adjustCartItemQty(
            @RequestHeader(value = "X-Rep-Token", required = false) String token,
            @PathVariable String cartNo,
            @RequestBody TwosomeCartQtyAdjustRequest request) {
        Member member = repAuthService.resolveByToken(token);
        twosomeStoreIntegrationService.adjustCartItemQty(
                TwosomeStoreIntegrationService.repSessionKey(member.getId()), cartNo, request);
        Map<String, Object> result = new HashMap<>();
        result.put("status", "SUCCESS");
        result.put("message", "수량이 조정되었습니다.");
        return ResponseEntity.ok(result);
    }

    @PostMapping("/api/rep/twosome/cart/clear")
    public ResponseEntity<Map<String, Object>> clearCart(
            @RequestHeader(value = "X-Rep-Token", required = false) String token) {
        Member member = repAuthService.resolveByToken(token);
        int deletedCount = twosomeStoreIntegrationService.clearCart(
                TwosomeStoreIntegrationService.repSessionKey(member.getId()));
        Map<String, Object> result = new HashMap<>();
        result.put("status", "SUCCESS");
        result.put("deletedCount", deletedCount);
        result.put("message", String.format("장바구니 %d건이 삭제되었습니다.", deletedCount));
        return ResponseEntity.ok(result);
    }

    // 인증 실패 (401). PIN_NOT_SET은 프론트가 PIN 설정 모드로 전환하는 데 사용
    @ExceptionHandler(AuthException.class)
    public ResponseEntity<Map<String, Object>> handleAuth(AuthException e) {
        Map<String, Object> body = new HashMap<>();
        body.put("status", "FAILED");
        body.put("error", e.getErrorCode() != null ? e.getErrorCode() : "AUTH_FAILED");
        body.put("message", e.getMessage());
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(body);
    }

    // 투썸 세션 만료 (401)
    @ExceptionHandler(TwosomeStoreSessionExpiredException.class)
    public ResponseEntity<Map<String, Object>> handleTwosomeSessionExpired(TwosomeStoreSessionExpiredException e) {
        Map<String, Object> body = new HashMap<>();
        body.put("status", "EXPIRED");
        body.put("error", "TWOSOME_SESSION_EXPIRED");
        body.put("message", e.getMessage());
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(body);
    }

    // 투썸 연동 일반 오류 (400)
    @ExceptionHandler(TwosomeStoreException.class)
    public ResponseEntity<Map<String, Object>> handleTwosomeStoreError(TwosomeStoreException e) {
        Map<String, Object> body = new HashMap<>();
        body.put("status", "FAILED");
        body.put("error", "TWOSOME_INTEGRATION_ERROR");
        body.put("message", e.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }
}
