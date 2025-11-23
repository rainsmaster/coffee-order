package com.example.coffeeorder.controller;

import com.example.coffeeorder.entity.Menu;
import com.example.coffeeorder.service.MenuService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/menus")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:3000")
public class MenuController {

    private final MenuService menuService;

    // 전체 메뉴 조회 (최근 3개월 주문 많은 순, 카테고리별 그룹화)
    @GetMapping
    public ResponseEntity<Map<String, List<Menu>>> getAllMenus() {
        List<Menu> menus = menuService.findAllActiveOrderByPopularity();

        // 카테고리별로 그룹화
        Map<String, List<Menu>> groupedMenus = menus.stream()
                .collect(Collectors.groupingBy(Menu::getCategory));

        return ResponseEntity.ok(groupedMenus);
    }

    // ID로 조회
    @GetMapping("/{id}")
    public ResponseEntity<Menu> getMenuById(@PathVariable Long id) {
        return menuService.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // 메뉴 생성
    @PostMapping
    public ResponseEntity<Menu> createMenu(@RequestBody Menu menu) {
        Menu savedMenu = menuService.save(menu);
        return ResponseEntity.status(HttpStatus.CREATED).body(savedMenu);
    }

    // 메뉴 수정
    @PutMapping("/{id}")
    public ResponseEntity<Menu> updateMenu(@PathVariable Long id, @RequestBody Menu menu) {
        return menuService.findById(id)
                .map(existingMenu -> {
                    existingMenu.setName(menu.getName());
                    existingMenu.setCategory(menu.getCategory());
                    Menu updatedMenu = menuService.save(existingMenu);
                    return ResponseEntity.ok(updatedMenu);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    // 메뉴 삭제 (소프트 삭제)
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteMenu(@PathVariable Long id) {
        if (menuService.findById(id).isPresent()) {
            menuService.softDelete(id);
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }
}
