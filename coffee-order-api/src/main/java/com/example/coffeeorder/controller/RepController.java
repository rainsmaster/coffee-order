package com.example.coffeeorder.controller;

import com.example.coffeeorder.dto.PinChangeRequest;
import com.example.coffeeorder.dto.RepRegisterRequest;
import com.example.coffeeorder.dto.RepLoginRequest;
import com.example.coffeeorder.dto.RepLoginResponse;
import com.example.coffeeorder.dto.RepMeResponse;
import com.example.coffeeorder.dto.RepPublicItem;
import com.example.coffeeorder.dto.RepTwosomeAccountRequest;
import com.example.coffeeorder.dto.TwosomeCartAddRequest;
import com.example.coffeeorder.dto.TwosomeCartAddResponse;
import com.example.coffeeorder.dto.TwosomeCartCustomItemResponse;
import com.example.coffeeorder.dto.TwosomeCartCustomListRequest;
import com.fasterxml.jackson.databind.JsonNode;
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

    // 로그인 화면용 활성 대표 목록 (부서별 필터와 세션 상태)
    @GetMapping("/api/reps")
    @Transactional(readOnly = true)
    public ResponseEntity<List<RepPublicItem>> listReps(
            @RequestParam(required = false) Long departmentId) {
        List<Member> members = departmentId != null
                ? memberRepository.findByTeam_Department_IdAndDelYnOrderByIdAsc(departmentId, "N")
                : memberRepository.findByDelYnOrderByIdAsc("N");
        List<RepPublicItem> reps = members.stream().map(this::toPublicItem).toList();
        return ResponseEntity.ok(reps);
    }

    @PostMapping("/api/rep/register")
    public ResponseEntity<RepLoginResponse> registerRep(@RequestBody RepRegisterRequest request) {
        RepAuthService.RepLoginResult result = repAuthService.registerRep(request.getTeamId(), request.getPin());
        return ResponseEntity.ok(new RepLoginResponse(
                result.token(), result.name(), result.teamName(), result.teamId()));
    }

    private RepPublicItem toPublicItem(Member member) {
        String status = twosomeStoreIntegrationService.getSessionStatus(
                TwosomeStoreIntegrationService.repSessionKey(member.getId())).getStatus();
        String reason = switch (status) {
            case "ACTIVE" -> "사용 가능";
            case "EXPIRED" -> "세션 만료 · 다시 로그인 필요";
            default -> "로그인 필요";
        };
        return new RepPublicItem(
                member.getId(), member.getName(), member.getTeam().getDepartment().getId(),
                member.getTeam().getDepartment().getName(), status, reason);
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

    // 대표 투썸 로그인용 캡차 발급 (수동 입력, 세션 만료 시 OCR 자동 재로그인)
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
        Long memberId = resolveTargetMemberId(token, request.getTargetRepMemberId());
        requireActiveSession(memberId);
        return ResponseEntity.ok(twosomeStoreIntegrationService.addItemsToCart(
                TwosomeStoreIntegrationService.repSessionKey(memberId), request));
    }

    @PostMapping("/api/rep/twosome/cart/custom-list")
    public ResponseEntity<List<TwosomeCartCustomItemResponse>> getCartCustomList(
            @RequestBody TwosomeCartCustomListRequest request) {
        Long memberId = resolveTargetMemberId(null, request.getTargetRepMemberId());
        requireActiveSession(memberId);
        JsonNode list = twosomeStoreIntegrationService.getCartCustomList(
                TwosomeStoreIntegrationService.repSessionKey(memberId),
                request.getCartNo(), request.getCartDtlNo());
        List<TwosomeCartCustomItemResponse> result = new java.util.ArrayList<>();
        if (list.isArray()) {
            for (JsonNode node : list) {
                result.add(new TwosomeCartCustomItemResponse(
                        textOf(node, "CSTM_NM"), firstInt(node, "PRICE"),
                        firstInt(node, "CSTM_ORD_CNT"), textOf(node, "CSTM_SEL_ID"),
                        textOf(node, "CSTM_GRP_CD"), textOf(node, "TYPE_ADD_CD"),
                        textOf(node, "CSTM_ADD_CD"), textOf(node, "TYPE_CHG_CD"),
                        textOf(node, "CSTM_CHG_CD")));
            }
        }
        return ResponseEntity.ok(result);
    }

    private static String textOf(JsonNode node, String fieldName) {
        JsonNode value = node.get(fieldName);
        return value != null && value.isTextual() ? value.asText() : null;
    }

    private static Integer firstInt(JsonNode node, String fieldName) {
        JsonNode value = node.get(fieldName);
        return value != null && value.isNumber() ? value.asInt() : null;
    }

    @GetMapping("/api/rep/twosome/cart")
    public ResponseEntity<List<TwosomeCartItemResponse>> getCartItems(
            @RequestHeader(value = "X-Rep-Token", required = false) String token,
            @RequestParam(required = false) Long targetRepMemberId) {
        Long memberId = resolveTargetMemberId(token, targetRepMemberId);
        requireActiveSession(memberId);
        return ResponseEntity.ok(twosomeStoreIntegrationService.getCartItems(
                TwosomeStoreIntegrationService.repSessionKey(memberId)));
    }

    @DeleteMapping("/api/rep/twosome/cart/items/{cartNo}")
    public ResponseEntity<Map<String, Object>> removeCartItem(
            @RequestHeader(value = "X-Rep-Token", required = false) String token,
            @PathVariable String cartNo,
            @RequestParam String cartDtlNo,
            @RequestParam(required = false) Long targetRepMemberId) {
        Long memberId = resolveTargetMemberId(token, targetRepMemberId);
        requireActiveSession(memberId);
        twosomeStoreIntegrationService.removeCartItem(
                TwosomeStoreIntegrationService.repSessionKey(memberId), cartNo, cartDtlNo);
        Map<String, Object> result = new HashMap<>();
        result.put("status", "SUCCESS");
        result.put("message", "장바구니 항목이 삭제되었습니다.");
        return ResponseEntity.ok(result);
    }

    @PutMapping("/api/rep/twosome/cart/items/{cartNo}/qty")
    public ResponseEntity<Map<String, Object>> adjustCartItemQty(
            @RequestHeader(value = "X-Rep-Token", required = false) String token,
            @PathVariable String cartNo,
            @RequestBody TwosomeCartQtyAdjustRequest request,
            @RequestParam(required = false) Long targetRepMemberId) {
        Long memberId = resolveTargetMemberId(token, targetRepMemberId);
        requireActiveSession(memberId);
        twosomeStoreIntegrationService.adjustCartItemQty(
                TwosomeStoreIntegrationService.repSessionKey(memberId), cartNo, request);
        Map<String, Object> result = new HashMap<>();
        result.put("status", "SUCCESS");
        result.put("message", "수량이 조정되었습니다.");
        return ResponseEntity.ok(result);
    }

    @PostMapping("/api/rep/twosome/cart/clear")
    public ResponseEntity<Map<String, Object>> clearCart(
            @RequestHeader(value = "X-Rep-Token", required = false) String token,
            @RequestParam(required = false) Long targetRepMemberId) {
        Long memberId = resolveTargetMemberId(token, targetRepMemberId);
        requireActiveSession(memberId);
        int deletedCount = twosomeStoreIntegrationService.clearCart(
                TwosomeStoreIntegrationService.repSessionKey(memberId));
        Map<String, Object> result = new HashMap<>();
        result.put("status", "SUCCESS");
        result.put("deletedCount", deletedCount);
        result.put("message", String.format("장바구니 %d건이 삭제되었습니다.", deletedCount));
        return ResponseEntity.ok(result);
    }

    private Long resolveTargetMemberId(String token, Long targetRepMemberId) {
        if (targetRepMemberId != null) {
            return repAuthService.requireActiveMember(targetRepMemberId).getId();
        }
        return repAuthService.resolveByToken(token).getId();
    }

    private void requireActiveSession(Long memberId) {
        String status = twosomeStoreIntegrationService.getSessionStatus(
                TwosomeStoreIntegrationService.repSessionKey(memberId)).getStatus();
        if (!"ACTIVE".equals(status)) {
            throw new AuthException("TARGET_REP_SESSION_REQUIRED", "선택한 대표의 투썸 로그인이 필요합니다.");
        }
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
