package com.example.coffeeorder.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * 투썸 장바구니 수량 조정 요청 (삭제 + 재담기 조합).
 * cartNo는 경로에서 받는다.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TwosomeCartQtyAdjustRequest {

    private String cartDtlNo;   // 삭제할 기존 항목의 상세 키
    private String menuCd;      // 재담기할 메뉴 코드 (기본 코드)
    private Integer qty;        // 새 수량 (1 이상)
    private List<String> opts;  // 재담기용 옵션 조합 (장바구니 항목의 MENU_OPT_VAL)
    private List<Map<String, Object>> cstmInfo; // 재담기용 퍼스널 옵션 (cartCstmInfo 배열 복원분)
}
