package com.example.coffeeorder.service;

import com.example.coffeeorder.entity.Department;
import com.example.coffeeorder.entity.Settings;
import com.example.coffeeorder.repository.DepartmentRepository;
import com.example.coffeeorder.repository.SettingsRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalTime;
import java.time.ZoneId;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SettingsService {

    private final SettingsRepository settingsRepository;
    private final DepartmentRepository departmentRepository;

    // 한국 시간 기준 ZoneId
    private static final ZoneId KOREA_ZONE = ZoneId.of("Asia/Seoul");

    // 설정 조회 (단일 레코드) - 하위 호환용
    public Settings getSettings() {
        Settings settings = settingsRepository.findAll().stream()
            .findFirst()
            .orElseGet(() -> {
                // 설정이 없으면 기본값으로 생성
                Settings defaultSettings = new Settings();
                defaultSettings.setOrderDeadlineTime(LocalTime.of(9, 0)); // 기본 9시
                defaultSettings.setIs24Hours(false);
                defaultSettings.setMenuMode("CUSTOM");
                return settingsRepository.save(defaultSettings);
            });

        // 기존 데이터에 menuMode가 없는 경우 기본값 설정
        if (settings.getMenuMode() == null) {
            settings.setMenuMode("CUSTOM");
        }
        return settings;
    }

    // 부서별 설정 조회
    @Transactional
    public Settings getSettingsByDepartment(Long departmentId) {
        return settingsRepository.findFirstByDepartmentId(departmentId)
            .map(settings -> {
                // 기존 데이터에 menuMode가 없는 경우 기본값 설정
                if (settings.getMenuMode() == null) {
                    settings.setMenuMode("CUSTOM");
                }
                return settings;
            })
            .orElseGet(() -> {
                // 부서별 설정이 없으면 기본값으로 생성
                Department department = departmentRepository.findById(departmentId)
                    .orElseThrow(() -> new RuntimeException("부서를 찾을 수 없습니다."));

                Settings defaultSettings = new Settings();
                defaultSettings.setDepartment(department);
                defaultSettings.setOrderDeadlineTime(LocalTime.of(9, 0)); // 기본 9시
                defaultSettings.setIs24Hours(false);
                defaultSettings.setMenuMode("CUSTOM");
                return settingsRepository.save(defaultSettings);
            });
    }

    // 설정 업데이트 - 하위 호환용
    @Transactional
    public Settings updateSettings(Settings settings) {
        Settings existingSettings = getSettings();
        existingSettings.setOrderDeadlineTime(settings.getOrderDeadlineTime());
        existingSettings.setIs24Hours(settings.getIs24Hours());
        existingSettings.setMenuMode(settings.getMenuMode() != null ? settings.getMenuMode() : "CUSTOM");
        return settingsRepository.save(existingSettings);
    }

    // 부서별 설정 업데이트
    @Transactional
    public Settings updateSettingsByDepartment(Long departmentId, Settings settings) {
        Settings existingSettings = getSettingsByDepartment(departmentId);
        existingSettings.setOrderDeadlineTime(settings.getOrderDeadlineTime());
        existingSettings.setIs24Hours(settings.getIs24Hours());
        existingSettings.setMenuMode(settings.getMenuMode() != null ? settings.getMenuMode() : "CUSTOM");
        return settingsRepository.save(existingSettings);
    }

    // 현재 주문 가능 여부 체크 - 하위 호환용
    public boolean isOrderAvailable() {
        Settings settings = getSettings();
        return checkOrderAvailable(settings);
    }

    // 부서별 주문 가능 여부 체크
    public boolean isOrderAvailableByDepartment(Long departmentId) {
        Settings settings = getSettingsByDepartment(departmentId);
        return checkOrderAvailable(settings);
    }

    // 주문 가능 여부 체크 공통 로직
    private boolean checkOrderAvailable(Settings settings) {
        // 24시간 주문 가능이면 항상 true
        if (settings.getIs24Hours()) {
            return true;
        }

        // 마감 시간이 설정되어 있으면 현재 시간과 비교 (한국 시간 기준)
        if (settings.getOrderDeadlineTime() != null) {
            LocalTime now = LocalTime.now(KOREA_ZONE);
            return now.isBefore(settings.getOrderDeadlineTime());
        }

        // 설정이 없으면 항상 가능
        return true;
    }
}
