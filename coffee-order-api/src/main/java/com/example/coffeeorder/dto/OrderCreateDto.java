package com.example.coffeeorder.dto;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class OrderCreateDto {

    private Long departmentId;  // 부서 ID (선택)

    @NotNull(message = "팀 ID는 필수입니다.")
    private Long teamId;

    private Long twosomeMenuId;  // 투썸 메뉴 ID (주문 생성은 항상 투썸 메뉴 기준)

    private String personalOption;

    private LocalDate orderDate;

    // 투썸 변형 정보 (옵션 조합 결과, TWOSOME 모드에서 장바구니 담기용)
    private String variantMenuCd;

    private String variantOpts;

    // 투썸 퍼스널 옵션 JSON (cartCstmInfo 배열)
    private String cstmInfo;
}