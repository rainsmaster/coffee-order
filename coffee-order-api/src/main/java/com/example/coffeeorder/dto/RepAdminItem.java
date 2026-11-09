package com.example.coffeeorder.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 관리자용 팀 대표 목록 항목. PIN 관련 값은 절대 포함하지 않는다.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RepAdminItem {

    private Long id;
    private String name;
    private Long departmentId;
    private String departmentName;
    private Long teamId;
    private String teamName;
    private boolean pinSet;
    private LocalDateTime lastLoginAt;
    private LocalDateTime createdDate;
}
