package com.example.coffeeorder.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 대표 로그인 성공 응답
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RepLoginResponse {

    private String token;
    private String name;
    private String teamName;
    private Long teamId;
}
