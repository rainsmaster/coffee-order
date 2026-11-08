package com.example.coffeeorder.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 최초 PIN 설정 요청 (1회용 초대코드 필요)
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PinSetupRequest {

    private Long memberId;
    private String inviteCode;
    private String pin;
}
