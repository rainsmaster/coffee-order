package com.example.coffeeorder.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class TwosomeSizeOptionResponse {

    @JsonProperty("OPTS")
    private String opts;  // 조합 코드 (예: "020R", "020L", "020M")

    @JsonProperty("SIZE_OPT_GRP_CD")
    private String sizeOptGrpCd;  // 사이즈 그룹 코드 (예: "020")

    @JsonProperty("SIZE_OPT_NM")
    private String sizeOptNm;  // 사이즈명 (예: "레귤러", "라지", "맥스")

    @JsonProperty("SIZE_OPT_CD")
    private String sizeOptCd;  // 사이즈 코드 (예: "R", "L", "M")
}
