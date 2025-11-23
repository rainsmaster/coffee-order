package com.example.coffeeorder.repository;

import com.example.coffeeorder.entity.Settings;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SettingsRepository extends JpaRepository<Settings, Long> {
    // 설정은 단일 레코드만 존재
}
