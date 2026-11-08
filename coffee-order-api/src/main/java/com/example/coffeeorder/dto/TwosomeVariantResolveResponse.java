package com.example.coffeeorder.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 변형 메뉴 코드 조회 결과
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TwosomeVariantResolveResponse {

    private String variantMenuCd;   // 변형 메뉴 코드 (담기의 MENU_CD)
    private String variantMenuNm;   // 변형 메뉴 이름 (예: T)ice아메리칸노L)
    private Integer price;          // 판매가 (SALE_AMT, 쉼표 제거)
    private String upMenuNm;        // 원메뉴 이름
}
