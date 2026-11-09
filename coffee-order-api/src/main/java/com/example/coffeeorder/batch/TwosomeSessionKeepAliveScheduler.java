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

@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "twosome.keepalive", name = "enabled", havingValue = "true")
public class TwosomeSessionKeepAliveScheduler {

    private final TwosomeStoreIntegrationService integrationService;
    private final TwosomeAutoReloginService autoReloginService;
    private final TwosomeHealthService healthService;

    @Scheduled(fixedDelayString = "${twosome.keepalive.interval:600000}",
            initialDelayString = "${twosome.keepalive.interval:600000}")
    public void keepAlive() {
        boolean adminTouched = keepAdminAlive();
        int repTouched = keepRepSessionsAlive();

        if (adminTouched || repTouched > 0) {
            log.info("Twosome keep-alive touched sessions: 관리자 {} + 대표 {}",
                    adminTouched ? 1 : 0, repTouched);
        }
    }

    private boolean keepAdminAlive() {
        try {
            boolean touched = integrationService.keepAliveSession();
            if (touched) {
                healthService.record(TwosomeHealthEventType.KEEPALIVE_SUCCESS, true, "세션 슬라이딩 타이머 리셋");
            }
            return touched;
        } catch (TwosomeStoreSessionExpiredException e) {
            healthService.record(TwosomeHealthEventType.KEEPALIVE_FAIL, false, e.getMessage());
            log.warn("Twosome keep-alive detected expired admin session, triggering auto relogin");
            triggerAutoRelogin();
            return false;
        } catch (TwosomeStoreException e) {
            healthService.record(TwosomeHealthEventType.KEEPALIVE_FAIL, false, e.getMessage());
            log.warn("Twosome admin keep-alive failed (ignored): {}", e.getMessage());
            return false;
        } catch (Exception e) {
            healthService.record(TwosomeHealthEventType.KEEPALIVE_FAIL, false,
                    e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName());
            log.error("Twosome admin keep-alive failed with unexpected error (ignored)", e);
            return false;
        }
    }

    private int keepRepSessionsAlive() {
        int touched = 0;
        for (Long memberId : integrationService.getRepSessionMemberIds()) {
            try {
                if (integrationService.keepAliveRepSession(memberId)) {
                    touched++;
                }
            } catch (TwosomeStoreSessionExpiredException e) {
                healthService.record(TwosomeHealthEventType.KEEPALIVE_FAIL, false,
                        "[대표 memberId=" + memberId + "] " + e.getMessage());
                triggerRepAutoRelogin(memberId);
            } catch (TwosomeStoreException e) {
                log.warn("Twosome rep keep-alive failed temporarily (memberId={}): {}",
                        memberId, e.getMessage());
            } catch (Exception e) {
                log.error("Twosome rep keep-alive failed unexpectedly (memberId={}, ignored)", memberId, e);
            }
        }
        return touched;
    }

    private void triggerAutoRelogin() {
        try {
            TwosomeAutoReloginResult result = autoReloginService.autoLogin();
            if (result.isSuccess()) {
                log.info("Twosome admin auto relogin succeeded (attempts={})", result.getAttempts());
            } else {
                logAutoReloginFailure("admin", result);
            }
        } catch (Exception e) {
            log.error("Twosome admin auto relogin failed: {}", e.getMessage());
        }
    }

    private void triggerRepAutoRelogin(Long memberId) {
        try {
            TwosomeAutoReloginResult result = autoReloginService.autoLoginForRep(memberId);
            if (result.isSuccess()) {
                log.info("Twosome rep auto relogin succeeded (memberId={}, attempts={})",
                        memberId, result.getAttempts());
            } else {
                logAutoReloginFailure("rep:" + memberId, result);
            }
        } catch (Exception e) {
            log.error("Twosome rep auto relogin failed (memberId={}): {}", memberId, e.getMessage());
        }
    }

    private void logAutoReloginFailure(String owner, TwosomeAutoReloginResult result) {
        if (result.getAttempts() == 0) {
            log.info("Twosome auto relogin skipped (owner={}): {}", owner, result.getMessage());
        } else {
            log.warn("Twosome auto relogin failed (owner={}): {}", owner, result.getMessage());
        }
    }
}
