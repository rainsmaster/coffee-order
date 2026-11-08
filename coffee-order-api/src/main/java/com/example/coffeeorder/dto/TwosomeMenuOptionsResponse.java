package com.example.coffeeorder.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 투썸 메뉴 상세 옵션 그룹 (메뉴 상세 페이지 파싱 결과, twosome_menu.option_data 캐시)
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TwosomeMenuOptionsResponse {

    private String menuCd;
    private boolean parsed;     // 파싱 성공 여부 (false면 message 확인)
    private String message;     // 파싱 불가/옵션 없음 안내
    private List<OptionGroup> groups;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class OptionGroup {
        private String grpCd;       // 옵션 그룹 코드 (예: 010)
        private String grpNm;       // 그룹명 (예: 온도)
        private boolean required;   // 기본 선택이 없는 그룹 (예: 컵 선택) — 선택 필수
        private List<Option> options;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Option {
        private String opts;        // 그룹+옵션 코드 (예: 010I)
        private String optNm;       // 옵션명 (예: 아이스)
        private boolean defaultOpt; // 기본 선택 여부
    }
}
