package com.example.coffeeorder.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 장바구니 항목의 퍼스널 옵션(커스텀) 명세 조회 요청 (getMenuCustomListAjax 프록시)
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TwosomeCartCustomListRequest {

    private String cartNo;
    private String cartDtlNo;
}
