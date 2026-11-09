package com.example.coffeeorder.service;

import com.example.coffeeorder.client.TwosomeOcrClient;
import com.example.coffeeorder.dto.TwosomeAutoReloginResult;
import com.example.coffeeorder.dto.TwosomeCaptchaResponse;
import com.example.coffeeorder.dto.TwosomeLoginRequest;
import com.example.coffeeorder.dto.TwosomeLoginResponse;
import com.example.coffeeorder.exception.AuthException;
import com.example.coffeeorder.exception.TwosomeStoreException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Base64;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicBoolean;

@Slf4j
@Service
@RequiredArgsConstructor
public class TwosomeAutoReloginService {

    private static final int MAX_ATTEMPTS = 4;
    private static final String ACTIVE_KEY = "active";
    private static final String REP_KEY_PREFIX = "rep:";
    private static final String CAPTCHA_WRONG_ANSWER_RST_CD = "5557";
    private static final String CAPTCHA_DATA_URI_PREFIX = "data:image/png;base64,";

    private final TwosomeStoreIntegrationService integrationService;
    private final TwosomeOcrClient ocrClient;
    private final TwosomeHealthService healthService;
    private final RepAuthService repAuthService;
    private final TwosomeAutoReloginGuard autoReloginGuard;

    @Value("${twosome.admin.id}")
    private String adminId;

    @Value("${twosome.admin.pw}")
    private String adminPw;

    @Value("${twosome.auto-relogin.request-interval-ms:2000}")
    private long requestIntervalMs;

    private final AtomicBoolean running = new AtomicBoolean(false);

    public TwosomeAutoReloginResult autoLogin() {
        return autoLogin(ACTIVE_KEY, adminId, adminPw);
    }

    public TwosomeAutoReloginResult autoLoginForRep(Long memberId) {
        String sessionKey = TwosomeStoreIntegrationService.repSessionKey(memberId);
        Optional<String> blocked = autoReloginGuard.blockedReason(sessionKey);
        if (blocked.isPresent()) {
            return blockedResult(blocked.get());
        }

        try {
            RepAuthService.TwosomeCredentials credentials =
                    repAuthService.requireTwosomeCredentialsForAutoLogin(memberId);
            return autoLogin(sessionKey, credentials.twosomeId(), credentials.twosomePw());
        } catch (AuthException | IllegalStateException e) {
            String reason = "저장된 투썸 계정을 사용할 수 없어 자동 재로그인을 중단합니다. 수동 로그인으로 계정을 확인해주세요.";
            autoReloginGuard.block(sessionKey, reason);
            healthService.record(TwosomeHealthEventType.AUTO_RELOGIN_FAIL, false,
                    "[대표 memberId=" + memberId + "] " + reason);
            return new TwosomeAutoReloginResult(false, 0, reason);
        }
    }

    private TwosomeAutoReloginResult autoLogin(String sessionKey, String loginId, String loginPw) {
        Optional<String> blocked = autoReloginGuard.blockedReason(sessionKey);
        if (blocked.isPresent()) {
            return blockedResult(blocked.get());
        }
        if (loginId == null || loginId.isBlank() || loginPw == null || loginPw.isBlank()) {
            String reason = "저장된 투썸 계정 정보가 없어 자동 재로그인을 중단합니다.";
            autoReloginGuard.block(sessionKey, reason);
            healthService.record(TwosomeHealthEventType.AUTO_RELOGIN_FAIL, false,
                    "[" + sessionKey + "] " + reason);
            return new TwosomeAutoReloginResult(false, 0, reason);
        }
        if (!running.compareAndSet(false, true)) {
            throw new TwosomeStoreException("자동 로그인이 이미 진행 중입니다. 잠시 후 다시 시도해주세요.");
        }
        try {
            return doAutoLogin(sessionKey, loginId, loginPw);
        } catch (TwosomeStoreException e) {
            String message = e.getMessage();
            if (message != null && (message.contains("HTTP 401") || message.contains("HTTP 403"))) {
                String reason = "투썸이 인증을 거부했습니다. 계정 확인과 수동 로그인 전까지 자동 재시도를 중단합니다.";
                autoReloginGuard.block(sessionKey, reason);
                healthService.record(TwosomeHealthEventType.AUTO_RELOGIN_FAIL, false,
                        "[" + sessionKey + "] " + reason);
                return new TwosomeAutoReloginResult(false, 0, reason);
            }
            healthService.record(TwosomeHealthEventType.AUTO_RELOGIN_FAIL, false,
                    truncate("[" + sessionKey + "] " + message));
            throw e;
        } finally {
            running.set(false);
        }
    }

    private TwosomeAutoReloginResult doAutoLogin(String sessionKey, String loginId, String loginPw) {
        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            TwosomeCaptchaResponse captcha = integrationService.issueCaptcha();
            byte[] image = decodeCaptchaImage(captcha.getImageBase64());

            String digits = ocrClient.recognizeCaptcha(image);
            if (digits == null) {
                log.warn("Twosome auto login OCR failed (key={}, attempt={})", sessionKey, attempt);
                sleepBetweenRequests();
                continue;
            }

            sleepBetweenRequests();

            TwosomeLoginResponse loginResponse = login(sessionKey,
                    new TwosomeLoginRequest(captcha.getContextId(), loginId, loginPw, digits));

            if ("SUCCESS".equals(loginResponse.getStatus())) {
                autoReloginGuard.clear(sessionKey);
                log.info("Twosome auto login succeeded (key={}, attempt={})", sessionKey, attempt);
                healthService.record(TwosomeHealthEventType.AUTO_RELOGIN_SUCCESS, true,
                        "[" + sessionKey + "] " + attempt + "회 시도 만에 성공");
                return new TwosomeAutoReloginResult(true, attempt, loginResponse.getMessage());
            }

            if (CAPTCHA_WRONG_ANSWER_RST_CD.equals(loginResponse.getRstCd())) {
                log.warn("Twosome auto login wrong captcha (key={}, attempt={})", sessionKey, attempt);
                sleepBetweenRequests();
                continue;
            }

            if (loginResponse.getRstCd() != null && !loginResponse.getRstCd().isBlank()) {
                String reason = "투썸이 로그인을 거부했습니다(rstCd=" + loginResponse.getRstCd()
                        + "). 계정 확인과 수동 로그인 전까지 자동 재시도를 중단합니다.";
                autoReloginGuard.block(sessionKey, reason);
                healthService.record(TwosomeHealthEventType.AUTO_RELOGIN_FAIL, false,
                        "[" + sessionKey + "] " + reason);
                log.warn("Twosome auto login blocked after rejection (key={}, rstCd={})",
                        sessionKey, loginResponse.getRstCd());
                return new TwosomeAutoReloginResult(false, attempt, reason);
            }

            throw new TwosomeStoreException("자동 로그인 중 일시적 오류가 발생했습니다. 다음 주기에 재시도합니다. "
                    + loginResponse.getMessage());
        }

        healthService.record(TwosomeHealthEventType.AUTO_RELOGIN_FAIL, false,
                "[" + sessionKey + "] " + MAX_ATTEMPTS + "회 시도 모두 실패 (캡차 인식 실패)");
        return new TwosomeAutoReloginResult(false, MAX_ATTEMPTS,
                "캡차 인식에 계속 실패했습니다. (" + MAX_ATTEMPTS + "회 시도)");
    }

    private TwosomeLoginResponse login(String sessionKey, TwosomeLoginRequest request) {
        if (ACTIVE_KEY.equals(sessionKey)) {
            return integrationService.login(request);
        }
        Long memberId = Long.valueOf(sessionKey.substring(REP_KEY_PREFIX.length()));
        return integrationService.loginForRep(memberId, request);
    }

    private TwosomeAutoReloginResult blockedResult(String reason) {
        log.info("Twosome auto login skipped because it is blocked: {}", reason);
        return new TwosomeAutoReloginResult(false, 0, reason);
    }

    private byte[] decodeCaptchaImage(String imageBase64) {
        if (imageBase64 == null || !imageBase64.startsWith(CAPTCHA_DATA_URI_PREFIX)) {
            throw new TwosomeStoreException("캡차 이미지 형식이 올바르지 않습니다.");
        }
        return Base64.getDecoder().decode(imageBase64.substring(CAPTCHA_DATA_URI_PREFIX.length()));
    }

    private void sleepBetweenRequests() {
        try {
            Thread.sleep(requestIntervalMs);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new TwosomeStoreException("자동 로그인이 중단되었습니다.", e);
        }
    }

    private static String truncate(String message) {
        if (message == null) {
            return null;
        }
        return message.length() <= 2000 ? message : message.substring(0, 2000);
    }
}
