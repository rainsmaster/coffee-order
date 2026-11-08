package com.example.coffeeorder.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 변형 메뉴 코드 조회 요청 (getNewMenuInfoAjax)
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TwosomeVariantResolveRequest {

    private String menuCd;      // 기본 메뉴 코드
    private List<String> opts;  // 선택 옵션 조합 ["010I","020L","040B","051T"]
}
