package com.example.coffeeorder.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 대표 투썸 계정 등록 요청 (비밀번호는 서버에서 AES-256-GCM 암호화 후 저장)
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RepTwosomeAccountRequest {

    private String twosomeId;
    private String twosomePw;
}
