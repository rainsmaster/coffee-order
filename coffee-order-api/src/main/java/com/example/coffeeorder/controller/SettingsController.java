package com.example.coffeeorder.controller;

import com.example.coffeeorder.entity.Settings;
import com.example.coffeeorder.service.SettingsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/settings")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:3000")
public class SettingsController {

    private final SettingsService settingsService;

    // 설정 조회 (부서별, 미지정 시 기본 부서)
    @GetMapping
    public ResponseEntity<Settings> getSettings(
            @RequestParam(required = false) Long departmentId) {
        return ResponseEntity.ok(settingsService.getSettings(departmentId));
    }

    // 설정 업데이트 (부서별, 미지정 시 기본 부서)
    @PutMapping
    public ResponseEntity<Settings> updateSettings(
            @RequestParam(required = false) Long departmentId,
            @RequestBody Settings settings) {
        return ResponseEntity.ok(settingsService.updateSettings(departmentId, settings));
    }

    // 주문 가능 여부 체크 (부서별, 미지정 시 기본 부서)
    @GetMapping("/order-available")
    public ResponseEntity<Map<String, Boolean>> checkOrderAvailable(
            @RequestParam(required = false) Long departmentId) {
        return ResponseEntity.ok(Map.of("available", settingsService.isOrderAvailable(departmentId)));
    }
}
