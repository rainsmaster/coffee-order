package com.example.coffeeorder.controller;

import com.example.coffeeorder.entity.TwosomeMenu;
import com.example.coffeeorder.service.TwosomeMenuService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/twosome-menus")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:3000")
public class TwosomeMenuController {

    private final TwosomeMenuService twosomeMenuService;

    // 전체 메뉴 조회 (중분류별 그룹화, 매장 메뉴 기준)
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
    public ResponseEntity<TwosomeMenu> getMenuByCode(
            @PathVariable String menuCd,
            @RequestParam(required = false) String midCd) {
        return (midCd != null && !midCd.isBlank()
                ? twosomeMenuService.findByMenuCdAndMidCd(menuCd, midCd)
                : twosomeMenuService.findByMenuCd(menuCd))
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // 중분류명으로 조회
    @GetMapping("/category/{midNm}")
    public ResponseEntity<List<TwosomeMenu>> getMenusByCategory(@PathVariable String midNm) {
        List<TwosomeMenu> menus = twosomeMenuService.findByMidNm(midNm);
        return ResponseEntity.ok(menus);
    }

    // 메뉴 생성
    @PostMapping
    public ResponseEntity<TwosomeMenu> createMenu(@RequestBody TwosomeMenu menu) {
        TwosomeMenu savedMenu = twosomeMenuService.save(menu);
        return ResponseEntity.status(HttpStatus.CREATED).body(savedMenu);
    }

    // 일괄 저장
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
}
