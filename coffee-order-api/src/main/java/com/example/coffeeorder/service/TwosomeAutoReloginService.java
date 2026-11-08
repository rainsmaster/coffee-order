package com.example.coffeeorder.service;

import com.example.coffeeorder.client.TwosomeOcrClient;
import com.example.coffeeorder.dto.TwosomeAutoReloginResult;
import com.example.coffeeorder.dto.TwosomeCaptchaResponse;
import com.example.coffeeorder.dto.TwosomeLoginRequest;
import com.example.coffeeorder.dto.TwosomeLoginResponse;
import com.example.coffeeorder.exception.TwosomeStoreException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Base64;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * 투썸 자동 재로그인 서비스.
 *
 * 캡차 발급 → OCR 인식 → loginProc 흐름을 관리자 자격증명으로 자동 수행한다.
 * - 최대 4회 시도
 * - OCR이 6자리를 뽑지 못하거나 캡차 오답(rstCd 5557)이면 새 캡차로 재시도
 * - 그 외 로그인 오류(비밀번호 오류 등)는 즉시 중단
 * - 투썸 WAF 레이트리밋 회피를 위해 인증 요청 간 2초 이상 대기
 *
 * 동시 실행(스케줄러 + 수동 트리거)은 스킵한다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TwosomeAutoReloginService {

    private static final int MAX_ATTEMPTS = 4;
    private static final long REQUEST_INTERVAL_MS = 2000L;
    private static final String CAPTCHA_WRONG_ANSWER_RST_CD = "5557";
    private static final String CAPTCHA_DATA_URI_PREFIX = "data:image/png;base64,";

    private final TwosomeStoreIntegrationService integrationService;
    private final TwosomeOcrClient ocrClient;
    private final TwosomeHealthService healthService;

    @Value("${twosome.admin.id}")
    private String adminId;

    @Value("${twosome.admin.pw}")
    private String adminPw;

    private final AtomicBoolean running = new AtomicBoolean(false);

    /**
     * 자동 재로그인을 수행한다.
     *
     * @return 시도 횟수와 성공 여부
     */
    public TwosomeAutoReloginResult autoLogin() {
        if (!running.compareAndSet(false, true)) {
            throw new TwosomeStoreException("자동 로그인이 이미 진행 중입니다. 잠시 후 다시 시도해주세요.");
        }
        try {
            return doAutoLogin();
        } catch (TwosomeStoreException e) {
            healthService.record(TwosomeHealthEventType.AUTO_RELOGIN_FAIL, false,
                    truncate(e.getMessage()));
            throw e;
        } finally {
            running.set(false);
        }
    }

    private TwosomeAutoReloginResult doAutoLogin() {
        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            int currentAttempt = attempt;

            TwosomeCaptchaResponse captcha = integrationService.issueCaptcha();
            byte[] image = decodeCaptchaImage(captcha.getImageBase64());

            String digits = ocrClient.recognizeCaptcha(image);
            if (digits == null) {
                log.warn("Twosome auto login attempt {}: OCR could not recognize captcha, retrying", currentAttempt);
                sleepBetweenRequests();
                continue;
            }

            sleepBetweenRequests();

            TwosomeLoginResponse loginResponse = integrationService.login(
                    new TwosomeLoginRequest(captcha.getContextId(), adminId, adminPw, digits));

            if ("SUCCESS".equals(loginResponse.getStatus())) {
                log.info("Twosome auto login succeeded on attempt {}", currentAttempt);
                healthService.record(TwosomeHealthEventType.AUTO_RELOGIN_SUCCESS, true,
                        currentAttempt + "회 시도 만에 성공");
                return new TwosomeAutoReloginResult(true, currentAttempt, loginResponse.getMessage());
            }

            if (CAPTCHA_WRONG_ANSWER_RST_CD.equals(loginResponse.getRstCd())) {
                log.warn("Twosome auto login attempt {}: wrong captcha answer (rstCd=5557), retrying", currentAttempt);
                sleepBetweenRequests();
                continue;
            }

            log.error("Twosome auto login failed on attempt {}: rstCd={}, message={}",
                    currentAttempt, loginResponse.getRstCd(), loginResponse.getMessage());
            throw new TwosomeStoreException("자동 로그인에 실패했습니다. (시도 "
                    + currentAttempt + "회, rstCd=" + loginResponse.getRstCd()
                    + "): " + loginResponse.getMessage());
        }

        log.error("Twosome auto login failed after {} attempts (OCR recognition failed)", MAX_ATTEMPTS);
        healthService.record(TwosomeHealthEventType.AUTO_RELOGIN_FAIL, false,
                MAX_ATTEMPTS + "회 시도 모두 실패 (캡차 인식 실패)");
        return new TwosomeAutoReloginResult(false, MAX_ATTEMPTS,
                "캡차 인식에 계속 실패했습니다. (" + MAX_ATTEMPTS + "회 시도)");
    }

    private byte[] decodeCaptchaImage(String imageBase64) {
        if (imageBase64 == null || !imageBase64.startsWith(CAPTCHA_DATA_URI_PREFIX)) {
            throw new TwosomeStoreException("캡차 이미지 형식이 올바르지 않습니다.");
        }
        return Base64.getDecoder().decode(imageBase64.substring(CAPTCHA_DATA_URI_PREFIX.length()));
    }

    /**
     * 투썸 인증 요청 간격을 2초 이상 유지 (WAF 레이트리밋 회피)
     */
    private void sleepBetweenRequests() {
        try {
            Thread.sleep(REQUEST_INTERVAL_MS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new TwosomeStoreException("자동 로그인이 중단되었습니다.", e);
        }
    }

    /** 이벤트 메시지 컬럼 길이(2000) 초과 시 잘라낸다 */
    private static String truncate(String message) {
        if (message == null) {
            return null;
        }
        return message.length() <= 2000 ? message : message.substring(0, 2000);
    }
}
