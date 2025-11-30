package com.example.coffeeorder.controller;

import com.example.coffeeorder.batch.TwosomeMenuSyncService;
import com.example.coffeeorder.dto.SyncProgress;
import com.example.coffeeorder.entity.TwosomeMenu;
import com.example.coffeeorder.entity.TwosomeMenuOption;
import com.example.coffeeorder.exception.SyncInProgressException;
import com.example.coffeeorder.repository.TwosomeMenuOptionRepository;
import com.example.coffeeorder.service.TwosomeMenuService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/twosome-menus")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:3000")
public class TwosomeMenuController {

    private final TwosomeMenuService twosomeMenuService;
    private final TwosomeMenuSyncService twosomeMenuSyncService;
    private final TwosomeMenuOptionRepository twosomeMenuOptionRepository;

    // 전체 메뉴 조회 (중분류별 그룹화)
    @GetMapping
    public ResponseEntity<Map<String, List<TwosomeMenu>>> getAllMenus() {
        List<TwosomeMenu> menus = twosomeMenuService.findAllActive();

        // 중분류(midNm)별로 그룹화
        Map<String, List<TwosomeMenu>> groupedMenus = menus.stream()
                .collect(Collectors.groupingBy(TwosomeMenu::getMidNm));

        return ResponseEntity.ok(groupedMenus);
    }

    // ID로 조회
    @GetMapping("/{id}")
    public ResponseEntity<TwosomeMenu> getMenuById(@PathVariable Long id) {
        return twosomeMenuService.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // 메뉴코드로 조회
    @GetMapping("/code/{menuCd}")
    public ResponseEntity<TwosomeMenu> getMenuByCode(@PathVariable String menuCd) {
        return twosomeMenuService.findByMenuCd(menuCd)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // 중분류명으로 조회
    @GetMapping("/category/{midNm}")
    public ResponseEntity<List<TwosomeMenu>> getMenusByCategory(@PathVariable String midNm) {
        List<TwosomeMenu> menus = twosomeMenuService.findByMidNm(midNm);
        return ResponseEntity.ok(menus);
    }

    // 메뉴 옵션 조회 (온도/사이즈)
    @GetMapping("/options/{menuCd}")
    public ResponseEntity<Map<String, Object>> getMenuOptions(@PathVariable String menuCd) {
        List<TwosomeMenuOption> options = twosomeMenuOptionRepository.findByMenuCdAndDelYn(menuCd, "N");

        if (options.isEmpty()) {
            return ResponseEntity.ok(Collections.emptyMap());
        }

        // 온도별로 그룹화
        Map<String, List<Map<String, String>>> temperatureOptions = new LinkedHashMap<>();

        for (TwosomeMenuOption opt : options) {
            String ondoKey = opt.getOndoOptCd();
            String ondoNm = opt.getOndoOptNm();

            temperatureOptions.computeIfAbsent(ondoKey, k -> new ArrayList<>());

            Map<String, String> sizeOption = new HashMap<>();
            sizeOption.put("sizeOptCd", opt.getSizeOptCd());
            sizeOption.put("sizeOptNm", opt.getSizeOptNm());
            sizeOption.put("opts", opt.getOpts());

            temperatureOptions.get(ondoKey).add(sizeOption);
        }

        // 응답 구조 생성
        List<Map<String, Object>> temperatures = new ArrayList<>();
        for (Map.Entry<String, List<Map<String, String>>> entry : temperatureOptions.entrySet()) {
            Map<String, Object> temp = new HashMap<>();
            temp.put("ondoOptCd", entry.getKey());
            temp.put("ondoOptNm", options.stream()
                    .filter(o -> o.getOndoOptCd().equals(entry.getKey()))
                    .findFirst()
                    .map(TwosomeMenuOption::getOndoOptNm)
                    .orElse(""));
            temp.put("sizes", entry.getValue());
            temperatures.add(temp);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("menuCd", menuCd);
        result.put("temperatures", temperatures);

        return ResponseEntity.ok(result);
    }

    // 메뉴 생성
    @PostMapping
    public ResponseEntity<TwosomeMenu> createMenu(@RequestBody TwosomeMenu menu) {
        TwosomeMenu savedMenu = twosomeMenuService.save(menu);
        return ResponseEntity.status(HttpStatus.CREATED).body(savedMenu);
    }

    // 일괄 저장 (동기화용)
    @PostMapping("/bulk")
    public ResponseEntity<List<TwosomeMenu>> saveAllMenus(@RequestBody List<TwosomeMenu> menus) {
        List<TwosomeMenu> savedMenus = twosomeMenuService.saveAll(menus);
        return ResponseEntity.status(HttpStatus.CREATED).body(savedMenus);
    }

    // 메뉴 수정
    @PutMapping("/{id}")
    public ResponseEntity<TwosomeMenu> updateMenu(@PathVariable Long id, @RequestBody TwosomeMenu menu) {
        return twosomeMenuService.findById(id)
                .map(existingMenu -> {
                    existingMenu.setMenuNm(menu.getMenuNm());
                    existingMenu.setEnMenuNm(menu.getEnMenuNm());
                    existingMenu.setGrtCd(menu.getGrtCd());
                    existingMenu.setGrtNm(menu.getGrtNm());
                    existingMenu.setMidCd(menu.getMidCd());
                    existingMenu.setMidNm(menu.getMidNm());
                    existingMenu.setMenuImg(menu.getMenuImg());
                    existingMenu.setMenuImg01(menu.getMenuImg01());
                    existingMenu.setMenuImg02(menu.getMenuImg02());
                    existingMenu.setMenuImg03(menu.getMenuImg03());
                    existingMenu.setBadgCd(menu.getBadgCd());
                    existingMenu.setBadgNm(menu.getBadgNm());
                    existingMenu.setSortOrd(menu.getSortOrd());
                    existingMenu.setDmDisplayNo(menu.getDmDisplayNo());
                    TwosomeMenu updatedMenu = twosomeMenuService.save(existingMenu);
                    return ResponseEntity.ok(updatedMenu);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    // 메뉴 삭제 (소프트 삭제)
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteMenu(@PathVariable Long id) {
        if (twosomeMenuService.findById(id).isPresent()) {
            twosomeMenuService.softDelete(id);
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }

    // 전체 동기화 (메뉴 + 이미지 + 옵션)
    @PostMapping("/sync")
    public ResponseEntity<Map<String, Object>> syncMenus() {
        try {
            TwosomeMenuSyncService.SyncResult syncResult = twosomeMenuSyncService.syncAll();

            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("menuCount", syncResult.getMenuCount());
            result.put("insertedCount", syncResult.getInsertedCount());
            result.put("updatedCount", syncResult.getUpdatedCount());
            result.put("imageCount", syncResult.getImageCount());
            result.put("optionCount", syncResult.getOptionCount());
            result.put("elapsedTimeMs", syncResult.getElapsedTimeMs());
            result.put("message", String.format(
                    "동기화 완료! 메뉴: %d개 (신규: %d, 업데이트: %d), 이미지: %d개, 옵션: %d개, 소요시간: %.1f초",
                    syncResult.getMenuCount(),
                    syncResult.getInsertedCount(),
                    syncResult.getUpdatedCount(),
                    syncResult.getImageCount(),
                    syncResult.getOptionCount(),
                    syncResult.getElapsedTimeMs() / 1000.0
            ));

            return ResponseEntity.ok(result);
        } catch (SyncInProgressException e) {
            Map<String, Object> errorResult = new HashMap<>();
            errorResult.put("success", false);
            errorResult.put("error", "SYNC_IN_PROGRESS");
            errorResult.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.CONFLICT).body(errorResult);
        }
    }

    // 동기화 진행 상태 조회
    @GetMapping("/sync/status")
    public ResponseEntity<SyncProgress> getSyncStatus() {
        SyncProgress progress = twosomeMenuSyncService.getSyncProgress();
        return ResponseEntity.ok(progress);
    }

    // 동기화 진행 중인지 확인
    @GetMapping("/sync/in-progress")
    public ResponseEntity<Map<String, Object>> isSyncInProgress() {
        boolean inProgress = twosomeMenuSyncService.isSyncInProgress();
        Map<String, Object> result = new HashMap<>();
        result.put("inProgress", inProgress);
        return ResponseEntity.ok(result);
    }
}
