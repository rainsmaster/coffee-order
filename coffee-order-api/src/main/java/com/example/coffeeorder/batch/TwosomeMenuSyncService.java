package com.example.coffeeorder.batch;

import com.example.coffeeorder.client.TwosomeApiClient;
import com.example.coffeeorder.dto.SyncProgress;
import com.example.coffeeorder.dto.TwosomeMenuResponse;
import com.example.coffeeorder.dto.TwosomeMenuResponse.TwosomeMenuItem;
import com.example.coffeeorder.dto.TwosomeSizeOptionResponse;
import com.example.coffeeorder.entity.TwosomeMenu;
import com.example.coffeeorder.entity.TwosomeMenuOption;
import com.example.coffeeorder.exception.SyncInProgressException;
import com.example.coffeeorder.repository.TwosomeMenuRepository;
import com.example.coffeeorder.repository.TwosomeMenuOptionRepository;
import com.example.coffeeorder.service.DistributedLockService;
import com.example.coffeeorder.service.ImageDownloadService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

@Slf4j
@Service
@RequiredArgsConstructor
public class TwosomeMenuSyncService {

    private final TwosomeApiClient twosomeApiClient;
    private final TwosomeMenuRepository twosomeMenuRepository;
    private final TwosomeMenuOptionRepository twosomeMenuOptionRepository;
    private final ImageDownloadService imageDownloadService;
    private final DistributedLockService distributedLockService;

    // 병렬 처리 스레드 수
    private static final int THREAD_POOL_SIZE = 10;

    /**
     * 전체 동기화 수행 (메뉴 + 이미지 + 옵션)
     * Redis 분산 락으로 동시 실행 방지
     */
    @Transactional
    public SyncResult syncAll() {
        log.info("Starting full Twosome menu sync (menus + images + options)...");

        // 1. 분산 락 획득 시도
        if (!distributedLockService.tryAcquireSyncLock()) {
            log.warn("Sync is already in progress by another process");
            throw new SyncInProgressException("동기화가 이미 진행 중입니다. 잠시 후 다시 시도해주세요.");
        }

        SyncResult result = new SyncResult();
        SyncProgress progress = SyncProgress.started();
        long startTime = System.currentTimeMillis();

        try {
            // 진행 상태 저장
            distributedLockService.saveSyncProgress(progress);

            // 1단계: 메뉴 리스트 동기화
            log.info("[1/4] Syncing menu list...");
            progress.updateStep(SyncProgress.Step.MENU_SYNC, 0, 1);
            distributedLockService.saveSyncProgress(progress);

            List<TwosomeMenu> syncedMenus = syncMenusInternal(result);

            if (syncedMenus.isEmpty()) {
                log.warn("No menus synced, aborting further sync steps");
                progress.setStatus(SyncProgress.Status.FAILED);
                progress.setErrorMessage("메뉴를 가져오지 못했습니다.");
                distributedLockService.saveSyncProgress(progress);
                return result;
            }

            progress.updateStep(SyncProgress.Step.MENU_SYNC, 1, 1);
            distributedLockService.saveSyncProgress(progress);

            // 2단계: 이미지 다운로드 (병렬)
            log.info("[2/4] Downloading images for {} menus...", syncedMenus.size());
            syncImages(syncedMenus, result, progress);

            // 3단계: 기존 옵션 삭제
            log.info("[3/4] Clearing existing options...");
            progress.updateStep(SyncProgress.Step.OPTION_CLEAR, 0, 1);
            distributedLockService.saveSyncProgress(progress);

            twosomeMenuOptionRepository.deleteAllOptions();

            progress.updateStep(SyncProgress.Step.OPTION_CLEAR, 1, 1);
            distributedLockService.saveSyncProgress(progress);

            // 4단계: 온도/사이즈 옵션 동기화 (병렬)
            log.info("[4/4] Syncing temperature and size options...");
            syncOptions(syncedMenus, result, progress);

            long elapsedTime = System.currentTimeMillis() - startTime;
            result.setElapsedTimeMs(elapsedTime);

            // 완료 상태 업데이트
            progress.setStatus(SyncProgress.Status.COMPLETED);
            progress.setOverallProgress(100);
            progress.setCurrentStepName("동기화 완료");
            progress.setCompletedAt(LocalDateTime.now());
            progress.setElapsedTimeMs(elapsedTime);
            progress.setMenuCount(result.getMenuCount());
            progress.setInsertedCount(result.getInsertedCount());
            progress.setUpdatedCount(result.getUpdatedCount());
            progress.setImageCount(result.getImageCount());
            progress.setOptionCount(result.getOptionCount());
            distributedLockService.saveSyncProgress(progress);

            log.info("Full sync completed in {}ms. Menus: {} (new: {}, updated: {}), Images: {}, Options: {}",
                    elapsedTime, result.getMenuCount(), result.getInsertedCount(), result.getUpdatedCount(),
                    result.getImageCount(), result.getOptionCount());

            return result;

        } catch (SyncInProgressException e) {
            throw e;
        } catch (Exception e) {
            log.error("Sync failed with error", e);
            progress.setStatus(SyncProgress.Status.FAILED);
            progress.setErrorMessage(e.getMessage());
            distributedLockService.saveSyncProgress(progress);
            throw new RuntimeException("동기화 중 오류가 발생했습니다: " + e.getMessage(), e);
        } finally {
            // 락 해제
            distributedLockService.releaseSyncLock();
        }
    }

    /**
     * 메뉴만 동기화 (기존 기능)
     */
    @Transactional
    public int syncMenus() {
        log.info("Starting Twosome menu sync...");
        SyncResult result = new SyncResult();
        List<TwosomeMenu> syncedMenus = syncMenusInternal(result);
        return syncedMenus.size();
    }

    /**
     * 현재 동기화 진행 상태 조회
     */
    public SyncProgress getSyncProgress() {
        return distributedLockService.getSyncProgress();
    }

    /**
     * 동기화 진행 중인지 확인
     */
    public boolean isSyncInProgress() {
        return distributedLockService.isSyncInProgress();
    }

    /**
     * 메뉴 리스트 동기화 내부 로직
     */
    private List<TwosomeMenu> syncMenusInternal(SyncResult result) {
        TwosomeMenuResponse response = twosomeApiClient.fetchMenuList();

        if (response == null || response.getFetchResultListSet() == null) {
            log.warn("No menu data received from Twosome API");
            return new ArrayList<>();
        }

        List<TwosomeMenuItem> menuItems = response.getFetchResultListSet();
        List<TwosomeMenu> syncedMenus = new ArrayList<>();

        for (TwosomeMenuItem item : menuItems) {
            Optional<TwosomeMenu> existingMenu = twosomeMenuRepository.findByMenuCd(item.getMenuCd());

            TwosomeMenu menu;
            if (existingMenu.isPresent()) {
                menu = existingMenu.get();
                updateMenuFromItem(menu, item);
                result.incrementUpdated();
            } else {
                menu = createMenuFromItem(item);
                result.incrementInserted();
            }

            menu = twosomeMenuRepository.save(menu);
            syncedMenus.add(menu);
        }

        result.setMenuCount(syncedMenus.size());
        log.info("Menu sync completed. Inserted: {}, Updated: {}, Total: {}",
                result.getInsertedCount(), result.getUpdatedCount(), syncedMenus.size());

        return syncedMenus;
    }

    /**
     * 이미지 다운로드 (병렬 처리)
     */
    private void syncImages(List<TwosomeMenu> menus, SyncResult result, SyncProgress progress) {
        ExecutorService executor = Executors.newFixedThreadPool(THREAD_POOL_SIZE);
        AtomicInteger downloadCount = new AtomicInteger(0);
        AtomicInteger processedCount = new AtomicInteger(0);
        int totalCount = menus.size();

        List<CompletableFuture<Void>> futures = new ArrayList<>();

        for (TwosomeMenu menu : menus) {
            CompletableFuture<Void> future = CompletableFuture.runAsync(() -> {
                try {
                    // 이미지 URL 선택 (menuImg02가 276x276 사이즈)
                    String imageUrl = menu.getMenuImg02() != null ? menu.getMenuImg02() : menu.getMenuImg();

                    if (imageUrl != null && !imageUrl.isBlank()) {
                        String localPath = imageDownloadService.downloadAndSaveImage(menu.getMenuCd(), imageUrl);
                        if (localPath != null) {
                            menu.setLocalImgPath(localPath);
                            downloadCount.incrementAndGet();
                        }
                    }

                    int processed = processedCount.incrementAndGet();

                    // 10개마다 진행 상태 업데이트 (너무 자주 업데이트하면 Redis 부하)
                    if (processed % 10 == 0 || processed == totalCount) {
                        progress.updateStep(SyncProgress.Step.IMAGE_DOWNLOAD, processed, totalCount);
                        distributedLockService.saveSyncProgress(progress);
                        log.info("Image download progress: {}/{}", processed, totalCount);
                    }
                } catch (Exception e) {
                    log.error("Error downloading image for menu {}: {}", menu.getMenuCd(), e.getMessage());
                }
            }, executor);

            futures.add(future);
        }

        // 모든 다운로드 완료 대기
        CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();
        executor.shutdown();

        // 로컬 경로 업데이트된 메뉴들 저장
        twosomeMenuRepository.saveAll(menus);

        result.setImageCount(downloadCount.get());
        log.info("Image download completed. Downloaded: {}/{}", downloadCount.get(), menus.size());
    }

    /**
     * 온도/사이즈 옵션 동기화 (병렬 처리)
     */
    private void syncOptions(List<TwosomeMenu> menus, SyncResult result, SyncProgress progress) {
        ExecutorService executor = Executors.newFixedThreadPool(THREAD_POOL_SIZE);
        AtomicInteger optionCount = new AtomicInteger(0);
        AtomicInteger processedCount = new AtomicInteger(0);
        int totalCount = menus.size();

        List<CompletableFuture<List<TwosomeMenuOption>>> futures = new ArrayList<>();

        for (TwosomeMenu menu : menus) {
            CompletableFuture<List<TwosomeMenuOption>> future = CompletableFuture.supplyAsync(() -> {
                List<TwosomeMenuOption> options = new ArrayList<>();

                try {
                    // 1. 온도 옵션 조회
                    List<String> ondoOptions = twosomeApiClient.fetchTemperatureOptions(menu.getMenuCd());

                    if (ondoOptions.isEmpty()) {
                        log.debug("No temperature options found for menu {}", menu.getMenuCd());
                        return options;
                    }

                    // 2. 각 온도별 사이즈 옵션 조회
                    for (String ondoOpt : ondoOptions) {
                        List<TwosomeSizeOptionResponse> sizeOptions =
                                twosomeApiClient.fetchSizeOptions(menu.getMenuCd(), ondoOpt);

                        for (TwosomeSizeOptionResponse sizeOpt : sizeOptions) {
                            TwosomeMenuOption option = new TwosomeMenuOption();
                            option.setMenuCd(menu.getMenuCd());
                            option.setOndoOptCd(ondoOpt);
                            option.setOndoOptNm(TwosomeApiClient.getTemperatureName(ondoOpt));
                            option.setSizeOptCd(sizeOpt.getSizeOptCd());
                            option.setSizeOptNm(sizeOpt.getSizeOptNm());
                            option.setSizeOptGrpCd(sizeOpt.getSizeOptGrpCd());
                            option.setOpts(sizeOpt.getOpts());
                            option.setDelYn("N");

                            options.add(option);
                        }
                    }

                    int processed = processedCount.incrementAndGet();

                    // 10개마다 진행 상태 업데이트
                    if (processed % 10 == 0 || processed == totalCount) {
                        progress.updateStep(SyncProgress.Step.OPTION_SYNC, processed, totalCount);
                        distributedLockService.saveSyncProgress(progress);
                        log.info("Option sync progress: {}/{}", processed, totalCount);
                    }

                } catch (Exception e) {
                    log.error("Error syncing options for menu {}: {}", menu.getMenuCd(), e.getMessage());
                }

                return options;
            }, executor);

            futures.add(future);
        }

        // 모든 옵션 수집
        List<TwosomeMenuOption> allOptions = new ArrayList<>();
        for (CompletableFuture<List<TwosomeMenuOption>> future : futures) {
            try {
                List<TwosomeMenuOption> options = future.get(5, TimeUnit.MINUTES);
                allOptions.addAll(options);
            } catch (Exception e) {
                log.error("Error collecting options: {}", e.getMessage());
            }
        }

        executor.shutdown();

        // 배치로 저장
        if (!allOptions.isEmpty()) {
            twosomeMenuOptionRepository.saveAll(allOptions);
        }

        result.setOptionCount(allOptions.size());
        log.info("Option sync completed. Total options: {}", allOptions.size());
    }

    private TwosomeMenu createMenuFromItem(TwosomeMenuItem item) {
        TwosomeMenu menu = new TwosomeMenu();
        menu.setMenuCd(item.getMenuCd());
        updateMenuFromItem(menu, item);
        return menu;
    }

    private void updateMenuFromItem(TwosomeMenu menu, TwosomeMenuItem item) {
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
        menu.setSortOrd(item.getSortOrd());
        menu.setDmDisplayNo(item.getDmDisplayNo());
        menu.setDelYn("N");
    }

    /**
     * 동기화 결과 DTO
     */
    public static class SyncResult {
        private int menuCount = 0;
        private int insertedCount = 0;
        private int updatedCount = 0;
        private int imageCount = 0;
        private int optionCount = 0;
        private long elapsedTimeMs = 0;

        public int getMenuCount() { return menuCount; }
        public void setMenuCount(int menuCount) { this.menuCount = menuCount; }

        public int getInsertedCount() { return insertedCount; }
        public void incrementInserted() { this.insertedCount++; }

        public int getUpdatedCount() { return updatedCount; }
        public void incrementUpdated() { this.updatedCount++; }

        public int getImageCount() { return imageCount; }
        public void setImageCount(int imageCount) { this.imageCount = imageCount; }

        public int getOptionCount() { return optionCount; }
        public void setOptionCount(int optionCount) { this.optionCount = optionCount; }

        public long getElapsedTimeMs() { return elapsedTimeMs; }
        public void setElapsedTimeMs(long elapsedTimeMs) { this.elapsedTimeMs = elapsedTimeMs; }
    }
}
