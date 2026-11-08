package com.example.coffeeorder.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 팀 대표 등록/수정 요청
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RepCreateRequest {

    private String name;
    private Long teamId;
}
