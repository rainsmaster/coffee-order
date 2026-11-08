package com.example.coffeeorder.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 투썸 로그인 결과
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TwosomeLoginResponse {

    private String status;      // SUCCESS / FAILED
    private String message;
    private String rstCd;       // 투썸 서버 rstCd (실패 시, 캡차 오답 5557 등)
}
