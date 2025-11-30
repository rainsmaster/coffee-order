package com.example.coffeeorder.config;

import com.example.coffeeorder.entity.Department;
import com.example.coffeeorder.repository.DepartmentRepository;
import com.example.coffeeorder.repository.MenuRepository;
import com.example.coffeeorder.repository.OrderRepository;
import com.example.coffeeorder.repository.SettingsRepository;
import com.example.coffeeorder.repository.TeamRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataInitializer implements CommandLineRunner {

    private final DepartmentRepository departmentRepository;
    private final TeamRepository teamRepository;
    private final MenuRepository menuRepository;
    private final OrderRepository orderRepository;
    private final SettingsRepository settingsRepository;

    // 초기 부서 목록
    private static final List<String> INITIAL_DEPARTMENTS = Arrays.asList(
            "상품서비스개발팀",
            "디자인팀",
            "프론트개발팀",
            "전시서비스개발팀"
    );

    @Override
    @Transactional
    public void run(String... args) {
        initializeDepartments();
        migrateExistingData();
    }

    private void initializeDepartments() {
        // 부서 데이터가 없으면 초기 부서 생성
        if (departmentRepository.count() == 0) {
            log.info("초기 부서 데이터 생성 중...");

            for (String deptName : INITIAL_DEPARTMENTS) {
                Department department = new Department();
                department.setName(deptName);
                departmentRepository.save(department);
                log.info("부서 생성: {}", deptName);
            }

            log.info("초기 부서 데이터 생성 완료");
        }
    }

    private void migrateExistingData() {
        // 첫 번째 부서(상품서비스개발팀)를 기본 부서로 사용
        Department defaultDepartment = departmentRepository.findByDelYnOrderByIdAsc("N")
                .stream()
                .findFirst()
                .orElse(null);

        if (defaultDepartment == null) {
            log.warn("기본 부서를 찾을 수 없습니다. 마이그레이션을 건너뜁니다.");
            return;
        }

        // 부서가 할당되지 않은 팀원 마이그레이션
        long migratedTeams = teamRepository.findByDelYn("N").stream()
                .filter(team -> team.getDepartment() == null)
                .peek(team -> {
                    team.setDepartment(defaultDepartment);
                    teamRepository.save(team);
                })
                .count();

        if (migratedTeams > 0) {
            log.info("{}개의 팀원이 '{}'에 연결되었습니다.", migratedTeams, defaultDepartment.getName());
        }

        // 부서가 할당되지 않은 메뉴 마이그레이션
        long migratedMenus = menuRepository.findByDelYn("N").stream()
                .filter(menu -> menu.getDepartment() == null)
                .peek(menu -> {
                    menu.setDepartment(defaultDepartment);
                    menuRepository.save(menu);
                })
                .count();

        if (migratedMenus > 0) {
            log.info("{}개의 메뉴가 '{}'에 연결되었습니다.", migratedMenus, defaultDepartment.getName());
        }

        // 부서가 할당되지 않은 주문 마이그레이션
        long migratedOrders = orderRepository.findAll().stream()
                .filter(order -> order.getDepartment() == null && "N".equals(order.getDelYn()))
                .peek(order -> {
                    order.setDepartment(defaultDepartment);
                    orderRepository.save(order);
                })
                .count();

        if (migratedOrders > 0) {
            log.info("{}개의 주문이 '{}'에 연결되었습니다.", migratedOrders, defaultDepartment.getName());
        }

        // 부서가 할당되지 않은 설정 마이그레이션
        long migratedSettings = settingsRepository.findAll().stream()
                .filter(settings -> settings.getDepartment() == null)
                .peek(settings -> {
                    settings.setDepartment(defaultDepartment);
                    settingsRepository.save(settings);
                })
                .count();

        if (migratedSettings > 0) {
            log.info("{}개의 설정이 '{}'에 연결되었습니다.", migratedSettings, defaultDepartment.getName());
        }
    }
}
