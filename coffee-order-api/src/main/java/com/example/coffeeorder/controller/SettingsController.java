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

    // 설정 조회
    @GetMapping
    public ResponseEntity<Settings> getSettings() {
        Settings settings = settingsService.getSettings();
        return ResponseEntity.ok(settings);
    }

    // 설정 업데이트
    @PutMapping
    public ResponseEntity<Settings> updateSettings(@RequestBody Settings settings) {
        Settings updatedSettings = settingsService.updateSettings(settings);
        return ResponseEntity.ok(updatedSettings);
    }

    // 주문 가능 여부 체크
    @GetMapping("/order-available")
    public ResponseEntity<Map<String, Boolean>> checkOrderAvailable() {
        boolean isAvailable = settingsService.isOrderAvailable();
        return ResponseEntity.ok(Map.of("available", isAvailable));
    }
}
