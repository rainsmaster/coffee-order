package com.example.coffeeorder.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 투썸 캡차 발급 결과
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TwosomeCaptchaResponse {

    private String contextId;
    private String imageBase64; // "data:image/png;base64,..." 형태
}
