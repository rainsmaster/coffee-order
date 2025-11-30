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

    private Long menuId;  // 커스텀 메뉴 ID (CUSTOM 모드)

    private Long twosomeMenuId;  // 투썸 메뉴 ID (TWOSOME 모드)

    private String menuType = "CUSTOM";  // CUSTOM 또는 TWOSOME

    private String personalOption;

    private LocalDate orderDate;
}