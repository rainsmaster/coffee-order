package com.example.coffeeorder.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 투썸 장바구니 일괄 담기 요청
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TwosomeCartAddRequest {

    private Long targetRepMemberId;
    private List<TwosomeCartItemRequest> items;
}
