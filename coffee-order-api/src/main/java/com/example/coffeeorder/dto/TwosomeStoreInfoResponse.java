package com.example.coffeeorder.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 투썸 매장 상세 정보 (storeDetailInfoAjax, 1시간 캐시)
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TwosomeStoreInfoResponse {

    private String storeNm;
    private String ordTime;             // 영업 시간 (예: "07:30 ~ 20:50")
    private String overtimeOrderYn;     // 시간외 주문 가능 여부
    private String easmPrvtYn;
    private List<Facility> facilities;  // 시설 태그 (OPT_CD_JSON)

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Facility {
        private String cd;
        private String nm;
        private String ref;
    }
}
