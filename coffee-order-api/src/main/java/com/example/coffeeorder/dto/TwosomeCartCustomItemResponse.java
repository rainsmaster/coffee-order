package com.example.coffeeorder.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 장바구니 항목의 퍼스널 옵션(커스텀) 명세 항목 (getMenuCustomListAjax 응답 정제)
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TwosomeCartCustomItemResponse {

    private String name;        // CSTM_NM (수량 포함 표시명)
    private Integer price;      // PRICE (항목 합계 금액)
    private Integer cnt;        // CSTM_ORD_CNT
    private String selId;       // CSTM_SEL_ID (수량형 key와 동일)
    private String grpCd;       // CSTM_GRP_CD
    private String typeAddCd;   // TYPE_ADD_CD
    private String cstmAddCd;   // CSTM_ADD_CD
    private String typeChgCd;   // TYPE_CHG_CD
    private String cstmChgCd;   // CSTM_CHG_CD
}
