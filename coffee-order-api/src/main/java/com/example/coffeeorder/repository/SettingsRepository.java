package com.example.coffeeorder.repository;

import com.example.coffeeorder.entity.Department;
import com.example.coffeeorder.entity.Settings;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface SettingsRepository extends JpaRepository<Settings, Long> {
    // 부서별 설정 조회
    Optional<Settings> findFirstByDepartment(Department department);

    // 부서 ID로 설정 조회 (첫 번째 결과만 반환)
    Optional<Settings> findFirstByDepartmentId(Long departmentId);

    // 부서 ID로 설정 존재 여부 확인
    boolean existsByDepartmentId(Long departmentId);
}
