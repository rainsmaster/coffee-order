package com.example.coffeeorder.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 투썸 장바구니 담기 항목별 결과
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TwosomeCartItemResult {

    private String menuNm;
    private String menuCd;
    private boolean success;
    private String message;
}
