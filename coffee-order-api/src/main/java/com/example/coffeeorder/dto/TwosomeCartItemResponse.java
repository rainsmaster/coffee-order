package com.example.coffeeorder.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 투썸 장바구니 항목 (목록 조회 + 수량 조정 재담기용).
 * 투썸 응답 필드명 실측 불가로 복수 후보에서 추출한다.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TwosomeCartItemResponse {

    private String cartNo;      // 삭제 키
    private String cartDtlNo;   // 삭제 키 (상세)
    private String menuCd;      // 재담기 키
    private String upMenuCd;    // 재담기용 (없으면 menuCd와 동일 처리)
    private String midCd;       // 재담기용 (없으면 로컬 메뉴 테이블에서 조회)
    private String menuNm;      // 표시용
    private int qty;            // 수량
    private Integer price;      // 표시용 (단가 또는 행 합계, 응답에 따라 다름)
    private String menuOptVal;  // 재담기용 옵션 조합 ("010H,020R,040A,051E")
    private String optNm;       // 옵션 표시 문자열 ("아이스 | 라지 | 블랙그라운드 | 일회용컵")
    private String ordAbleYn;   // 주문 가능 여부 (IS_ORD_ABLE_YN)
    private String ordStopYn;   // 판매 중지 여부 (ORD_STOP_YN)
    private String notSaleMsg;  // 판매 불가 사유 (NOT_SALE_MSG)
    private Integer depositAmt; // 보증금 (DEPOSIT_AMT)
    private String indvCupYn;   // 개인컵 여부 (INDVCUP_YN)
    private Integer cstmAmt;    // 퍼스널 옵션 합계 금액 (CSTM_AMT, 0보다 크면 펼치기 노출)
    private Integer cstmCnt;    // 퍼스널 옵션 건수 (CSTM_CNT)
}
