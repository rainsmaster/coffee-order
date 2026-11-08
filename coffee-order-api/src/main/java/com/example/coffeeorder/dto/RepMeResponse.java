package com.example.coffeeorder.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 대표 본인 정보 (GET /api/rep/me). PIN 제외.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RepMeResponse {

    private Long id;
    private String name;
    private Long teamId;
    private String teamName;
    private boolean pinSet;
    private LocalDateTime lastLoginAt;
    private boolean twosomeAccount; // 투썸 계정 등록 여부
    private String twosomeId;       // 등록된 투썸 아이디 (미등록 시 null)
}
