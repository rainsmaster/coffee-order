package com.example.coffeeorder.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 로그인 화면용 활성 대표 목록 항목 (id+이름+팀명만)
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RepPublicItem {

    private Long id;
    private String name;
    private Long teamId;
    private String teamName;
    private String twosomeStatus;
    private String statusReason;
}
