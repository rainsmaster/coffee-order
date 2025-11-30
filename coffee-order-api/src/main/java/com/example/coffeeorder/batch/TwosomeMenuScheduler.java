package com.example.coffeeorder.batch;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

@Slf4j
@Component
@RequiredArgsConstructor
public class TwosomeMenuScheduler {

    private final TwosomeMenuSyncService twosomeMenuSyncService;

    /**
     * 매일 새벽 3시에 투썸 메뉴 전체 동기화 실행 (메뉴 + 이미지 + 옵션)
     * cron: 초 분 시 일 월 요일
     */
    @Scheduled(cron = "0 0 3 * * *", zone = "Asia/Seoul")
    public void syncTwosomeMenus() {
        String startTime = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
        log.info("=== Twosome Menu Full Sync Job Started at {} ===", startTime);

        try {
            TwosomeMenuSyncService.SyncResult result = twosomeMenuSyncService.syncAll();
            log.info("=== Twosome Menu Full Sync Job Completed. Menus: {}, Images: {}, Options: {}, Time: {}ms ===",
                    result.getMenuCount(), result.getImageCount(), result.getOptionCount(), result.getElapsedTimeMs());
        } catch (Exception e) {
            log.error("=== Twosome Menu Full Sync Job Failed ===", e);
        }
    }
}