package com.example.coffeeorder.service;

import com.example.coffeeorder.entity.Department;
import com.example.coffeeorder.entity.Settings;
import com.example.coffeeorder.repository.DepartmentRepository;
import com.example.coffeeorder.repository.SettingsRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalTime;
import java.time.ZoneId;

@Service
@RequiredArgsConstructor
public class SettingsService {

    private final SettingsRepository settingsRepository;
    private final DepartmentRepository departmentRepository;

    // 한국 시간 기준 ZoneId
    private static final ZoneId KOREA_ZONE = ZoneId.of("Asia/Seoul");

    // 설정 생성 동기화용 락 (동시 생성 경쟁 방지)
    private static final Object SETTINGS_CREATE_LOCK = new Object();

    // 설정 조회 단일 경로 — findFirstByDepartmentId만 사용 (레거시 findAll 경로 제거)
    // 없으면 기본값으로 생성 (이중 INSERT는 락 내 재확인 + unique 제약 위반 시 재조회로 차단)
    @Transactional
    public Settings getSettings(Long departmentId) {
        Long targetDepartmentId = resolveDepartmentId(departmentId);
        return settingsRepository.findFirstByDepartmentId(targetDepartmentId)
            .orElseGet(() -> createDefaultSettings(targetDepartmentId));
    }

    // 설정 업데이트
    @Transactional
    public Settings updateSettings(Long departmentId, Settings settings) {
        Settings existingSettings = getSettings(departmentId);
        existingSettings.setOrderDeadlineTime(settings.getOrderDeadlineTime());
        existingSettings.setIs24Hours(settings.getIs24Hours());
        return settingsRepository.save(existingSettings);
    }

    // 현재 주문 가능 여부 체크
    public boolean isOrderAvailable(Long departmentId) {
        Settings settings = getSettings(departmentId);
        return checkOrderAvailable(settings);
    }

    // 부서 미지정 레거시 호출용: 부서가 지정되지 않으면 최초 생성 부서(기본 부서) 사용
    private Long resolveDepartmentId(Long departmentId) {
        if (departmentId != null) {
            return departmentId;
        }
        return departmentRepository.findByDelYnOrderByIdAsc("N").stream()
            .findFirst()
            .map(Department::getId)
            .orElse(null);
    }

    // 기본값 설정 생성 (락 내 재확인 — 락 대기 중 다른 요청이 생성했을 수 있음)
    private Settings createDefaultSettings(Long departmentId) {
        synchronized (SETTINGS_CREATE_LOCK) {
            return settingsRepository.findFirstByDepartmentId(departmentId)
                .orElseGet(() -> saveDefaultSettings(departmentId));
        }
    }

    private Settings saveDefaultSettings(Long departmentId) {
        Settings settings = new Settings();
        if (departmentId != null) {
            Department department = departmentRepository.findById(departmentId)
                .orElseThrow(() -> new RuntimeException("부서를 찾을 수 없습니다."));
            settings.setDepartment(department);
        }
        settings.setOrderDeadlineTime(LocalTime.of(9, 0));
        settings.setIs24Hours(true); // 기본: 24시간 주문 가능
        try {
            return settingsRepository.saveAndFlush(settings);
        } catch (DataIntegrityViolationException e) {
            // 동시 요청이 먼저 생성해 unique 제약 위반 시, 생성된 행을 재조회해 반환
            return settingsRepository.findFirstByDepartmentId(departmentId)
                .orElseThrow(() -> e);
        }
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
