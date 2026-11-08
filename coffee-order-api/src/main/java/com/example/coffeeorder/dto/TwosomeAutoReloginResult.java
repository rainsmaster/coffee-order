package com.example.coffeeorder.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 투썸 자동 재로그인 결과
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TwosomeAutoReloginResult {

    private boolean success;
    private int attempts;       // 시도 횟수 (캡차 발급 기준)
    private String message;
}
