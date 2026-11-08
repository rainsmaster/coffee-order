package com.example.coffeeorder.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * PIN 변경 요청
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PinChangeRequest {

    private String currentPin;
    private String newPin;
}
