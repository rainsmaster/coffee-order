package com.example.coffeeorder.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class TwosomeMenuResponse {

    @JsonProperty("queryCode")
    private int queryCode;

    @JsonProperty("queryMessage")
    private String queryMessage;

    @JsonProperty("fetchResultListSet")
    private List<TwosomeMenuItem> fetchResultListSet;

    @Data
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class TwosomeMenuItem {

        @JsonProperty("MENU_CD")
        private String menuCd;

        @JsonProperty("MENU_NM")
        private String menuNm;

        @JsonProperty("EN_MENU_NM")
        private String enMenuNm;

        @JsonProperty("GRT_CD")
        private String grtCd;

        @JsonProperty("GRT_NM")
        private String grtNm;

        @JsonProperty("MID_CD")
        private String midCd;

        @JsonProperty("MID_NM")
        private String midNm;

        @JsonProperty("MENU_IMG")
        private String menuImg;

        @JsonProperty("MENU_IMG_01")
        private String menuImg01;

        @JsonProperty("MENU_IMG_02")
        private String menuImg02;

        @JsonProperty("MENU_IMG_03")
        private String menuImg03;

        @JsonProperty("BADG_CD")
        private String badgCd;

        @JsonProperty("BADG_NM")
        private String badgNm;

        @JsonProperty("SORT_ORD")
        private Integer sortOrd;

        @JsonProperty("DM_DISPLAY_NO")
        private String dmDisplayNo;
    }
}