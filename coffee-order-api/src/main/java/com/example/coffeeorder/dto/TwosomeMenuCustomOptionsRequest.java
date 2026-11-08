package com.example.coffeeorder.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 투썸 옵션 관련 조회 요청.
 * - custom-options: menuCd(변형 코드)만 사용
 * - available-options: menuCd(기본 코드) + opts + groupOptCds 사용
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TwosomeMenuCustomOptionsRequest {

    private String menuCd;              // 기본/변형 메뉴 코드 (엔드포인트별 상이)
    private List<String> opts;          // 선택한 옵션 조합 ["010H","020R",...]
    private List<String> groupOptCds;   // 선택한 옵션 그룹 코드 ["010","020",...]
}
