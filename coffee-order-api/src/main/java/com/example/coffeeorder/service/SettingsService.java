package com.example.coffeeorder.service;

import com.example.coffeeorder.entity.Settings;
import com.example.coffeeorder.repository.SettingsRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalTime;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SettingsService {

    private final SettingsRepository settingsRepository;

    // 설정 조회 (단일 레코드)
    public Settings getSettings() {
        return settingsRepository.findAll().stream()
            .findFirst()
            .orElseGet(() -> {
                // 설정이 없으면 기본값으로 생성
                Settings defaultSettings = new Settings();
                defaultSettings.setOrderDeadlineTime(LocalTime.of(9, 0)); // 기본 9시
                defaultSettings.setIs24Hours(false);
                return settingsRepository.save(defaultSettings);
            });
    }

    // 설정 업데이트
    @Transactional
    public Settings updateSettings(Settings settings) {
        Settings existingSettings = getSettings();
        existingSettings.setOrderDeadlineTime(settings.getOrderDeadlineTime());
        existingSettings.setIs24Hours(settings.getIs24Hours());
        return settingsRepository.save(existingSettings);
    }

    // 현재 주문 가능 여부 체크
    public boolean isOrderAvailable() {
        Settings settings = getSettings();

        // 24시간 주문 가능이면 항상 true
        if (settings.getIs24Hours()) {
            return true;
        }

        // 마감 시간이 설정되어 있으면 현재 시간과 비교
        if (settings.getOrderDeadlineTime() != null) {
            LocalTime now = LocalTime.now();
            return now.isBefore(settings.getOrderDeadlineTime());
        }

        // 설정이 없으면 항상 가능
        return true;
    }
}
