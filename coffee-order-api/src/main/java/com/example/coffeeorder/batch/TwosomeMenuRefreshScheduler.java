package com.example.coffeeorder.batch;

import com.example.coffeeorder.service.DistributedLockService;
import com.example.coffeeorder.service.TwosomeStoreIntegrationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 매장 기준 메뉴 새로고침 배치.
 *
 * 매일 오전 8시 30분(매장 ORD_TIME 07:30~20:50 기준 오픈 직후)에
 * 관리자 세션으로 매장 메뉴 목록을 조회해 twosome_menu를 갱신하고 diff 리포트를 남긴다.
 * DistributedLockService의 twosome:sync:lock으로 중복 실행을 방지한다.
 *
 * twosome.menu-refresh.enabled=true 일 때만 등록된다 (기본 true).
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "twosome.menu-refresh", name = "enabled", havingValue = "true")
public class TwosomeMenuRefreshScheduler {

    private final TwosomeStoreIntegrationService integrationService;
    private final DistributedLockService lockService;

    @org.springframework.beans.factory.annotation.Value("${twosome.menu-refresh.prewarm-limit:10}")
    private int prewarmLimit;

    @Scheduled(cron = "${twosome.menu-refresh.cron:0 30 8 * * *}", zone = "Asia/Seoul")
    public void refreshStoreMenus() {
        log.info("=== Twosome Store Menu Refresh Job Started ===");
        if (!lockService.tryAcquireSyncLock()) {
            log.warn("=== Twosome Store Menu Refresh Skipped (another sync in progress) ===");
            return;
        }
        try {
            int savedCount = integrationService.refreshStoreMenus();
            int prewarmedCount = integrationService.prewarmMenuOptions(prewarmLimit);
            log.info("=== Twosome Store Menu Refresh Completed. saved={}, prewarmed={} ===", savedCount, prewarmedCount);
        } catch (Exception e) {
            log.error("=== Twosome Store Menu Refresh Failed ===", e);
        } finally {
            lockService.releaseSyncLock();
        }
    }
}
