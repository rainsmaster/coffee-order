package com.example.coffeeorder.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 대표 로그인 요청
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RepLoginRequest {

    private Long memberId;
    private String pin;
}
