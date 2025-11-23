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

    @NotNull(message = "팀 ID는 필수입니다.")
    private Long teamId;

    @NotNull(message = "메뉴 ID는 필수입니다.")
    private Long menuId;

    private String personalOption;

    private LocalDate orderDate;
}