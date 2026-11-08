package com.example.coffeeorder.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * 투썸 장바구니 담기 요청 항목
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TwosomeCartItemRequest {

    private String menuCd;          // 기본 메뉴 코드
    private String upMenuCd;        // 원메뉴 코드 (일반 메뉴는 menuCd와 동일)
    private String midCd;           // 중분류 코드 (미지정 시 DB에서 보완)
    private Integer qty;            // 수량
    private List<String> opts;      // 선택 옵션 조합 (["010I","020L",...])
    private String variantMenuCd;   // 변형 메뉴 코드 (opts 조합의 resolve 결과, 미지정 시 기본 코드로 담김)
    private List<Map<String, Object>> cstmInfo; // 투썸 퍼스널 옵션 (cartCstmInfo 배열, 필드명 원문 그대로)
}
