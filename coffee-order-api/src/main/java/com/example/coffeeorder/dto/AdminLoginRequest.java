package com.example.coffeeorder.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 관리자 로그인 요청
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AdminLoginRequest {
    private String password;
}
