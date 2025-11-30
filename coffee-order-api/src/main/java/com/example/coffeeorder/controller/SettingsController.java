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

    // 설정 조회 (부서별)
    @GetMapping
    public ResponseEntity<Settings> getSettings(
            @RequestParam(required = false) Long departmentId) {
        Settings settings;
        if (departmentId != null) {
            settings = settingsService.getSettingsByDepartment(departmentId);
        } else {
            settings = settingsService.getSettings();
        }
        return ResponseEntity.ok(settings);
    }

    // 설정 업데이트 (부서별)
    @PutMapping
    public ResponseEntity<Settings> updateSettings(
            @RequestParam(required = false) Long departmentId,
            @RequestBody Settings settings) {
        Settings updatedSettings;
        if (departmentId != null) {
            updatedSettings = settingsService.updateSettingsByDepartment(departmentId, settings);
        } else {
            updatedSettings = settingsService.updateSettings(settings);
        }
        return ResponseEntity.ok(updatedSettings);
    }

    // 주문 가능 여부 체크 (부서별)
    @GetMapping("/order-available")
    public ResponseEntity<Map<String, Boolean>> checkOrderAvailable(
            @RequestParam(required = false) Long departmentId) {
        boolean isAvailable;
        if (departmentId != null) {
            isAvailable = settingsService.isOrderAvailableByDepartment(departmentId);
        } else {
            isAvailable = settingsService.isOrderAvailable();
        }
        return ResponseEntity.ok(Map.of("available", isAvailable));
    }
}
