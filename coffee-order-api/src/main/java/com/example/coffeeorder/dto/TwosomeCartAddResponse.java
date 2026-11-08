package com.example.coffeeorder.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 투썸 장바구니 일괄 담기 결과
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TwosomeCartAddResponse {

    private int total;
    private int success;
    private int failed;
    private List<TwosomeCartItemResult> results;
}
