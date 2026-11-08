package com.example.coffeeorder.batch;

import com.example.coffeeorder.dto.TwosomeAutoReloginResult;
import com.example.coffeeorder.exception.TwosomeStoreException;
import com.example.coffeeorder.exception.TwosomeStoreSessionExpiredException;
import com.example.coffeeorder.service.TwosomeAutoReloginService;
import com.example.coffeeorder.service.TwosomeHealthEventType;
import com.example.coffeeorder.service.TwosomeHealthService;
import com.example.coffeeorder.service.TwosomeStoreIntegrationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 투썸 세션 KEEP-ALIVE 스케줄러.
 *
 * 관리자 세션과 대표 세션("rep:{memberId}")의 30분 유휴 슬라이딩 타이머를
 * 경량 인증 호출(매장 설정)로 리셋한다.
 * 관리자 세션 호출 실패/만료 감지 시 자동 재로그인을 트리거한다.
 * 대표 세션은 개별 실패/만료를 조용히 스킵한다.
 *
 * twosome.keepalive.enabled=true 일 때만 등록된다 (기본 false).
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "twosome.keepalive", name = "enabled", havingValue = "true")
public class TwosomeSessionKeepAliveScheduler {

    private final TwosomeStoreIntegrationService integrationService;
    private final TwosomeAutoReloginService autoReloginService;
    private final TwosomeHealthService healthService;

    @Scheduled(fixedDelayString = "${twosome.keepalive.interval:900000}", initialDelayString = "${twosome.keepalive.interval:900000}")
    public void keepAlive() {
        boolean adminTouched = keepAdminAlive();
        int repTouched = integrationService.keepAliveRepSessions();

        if (adminTouched || repTouched > 0) {
            log.info("Twosome keep-alive touched sessions: 관리자 {} + 대표 {}",
                    adminTouched ? 1 : 0, repTouched);
        }
    }

    /** 관리자 세션 keep-alive. 만료 감지 시 자동 재로그인 트리거. */
    private boolean keepAdminAlive() {
        boolean touched;
        try {
            touched = integrationService.keepAliveSession();
        } catch (TwosomeStoreSessionExpiredException e) {
            healthService.record(TwosomeHealthEventType.KEEPALIVE_FAIL, false, e.getMessage());
            log.warn("Twosome keep-alive detected expired session, triggering auto relogin: {}", e.getMessage());
            triggerAutoRelogin();
            return false;
        } catch (TwosomeStoreException e) {
            healthService.record(TwosomeHealthEventType.KEEPALIVE_FAIL, false, e.getMessage());
            log.warn("Twosome keep-alive failed (ignored): {}", e.getMessage());
            return false;
        } catch (Exception e) {
            healthService.record(TwosomeHealthEventType.KEEPALIVE_FAIL, false,
                    e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName());
            log.error("Twosome keep-alive failed with unexpected error (ignored)", e);
            return false;
        }

        if (touched) {
            healthService.record(TwosomeHealthEventType.KEEPALIVE_SUCCESS, true, "세션 슬라이딩 타이머 리셋");
        }
        return touched;
    }

    private void triggerAutoRelogin() {
        try {
            TwosomeAutoReloginResult result = autoReloginService.autoLogin();
            // 재로그인 결과는 TwosomeAutoReloginService가 AUTO_RELOGIN_SUCCESS/FAIL로 기록한다
            if (result.isSuccess()) {
                log.info("Twosome auto relogin succeeded after keep-alive failure (attempts={})", result.getAttempts());
            } else {
                log.error("Twosome auto relogin failed after keep-alive failure: {}", result.getMessage());
            }
        } catch (Exception e) {
            log.error("Twosome auto relogin triggered by keep-alive failed: {}", e.getMessage());
        }
    }
}
