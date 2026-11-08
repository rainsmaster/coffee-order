package com.example.coffeeorder.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 초대코드 발급 응답. 평문 코드는 이 응답 1회만 제공된다.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class InviteCodeResponse {

    private String code;
    private String message;
}
