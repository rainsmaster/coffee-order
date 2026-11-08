package com.example.coffeeorder.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 투썸 세션 상태 조회 결과
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TwosomeSessionResponse {

    private String status;              // NONE | ACTIVE | EXPIRED
    private String storeNm;
    private LocalDateTime lastUsedAt;
    private Long remainingMinutes;      // ACTIVE일 때 남은 유효 시간(분)
    private String source;              // RESTORED (Redis 복구) / FRESH (신규 로그인) / null
}
