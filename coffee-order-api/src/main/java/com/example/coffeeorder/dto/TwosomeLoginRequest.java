package com.example.coffeeorder.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 투썸 로그인 요청
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TwosomeLoginRequest {

    private String contextId;   // 캡차 발급 시 받은 컨텍스트 ID
    private String loginId;
    private String loginPwd;
    private String answerCd;    // 캡차 6자리 숫자
}
