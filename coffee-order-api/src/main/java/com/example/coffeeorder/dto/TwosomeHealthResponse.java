package com.example.coffeeorder.dto;

import com.example.coffeeorder.entity.TwosomeHealthEvent;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 투썸 연동 상태 패널 응답.
 * 현재 세션 상태, 유형별 지표, 최근 이벤트 이력을 담는다.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TwosomeHealthResponse {

    private SessionHealth session;
    private List<Indicator> indicators;
    private List<TwosomeHealthEvent> recentEvents;

    /**
     * 현재 세션 상태 (getSessionStatus 스펙 + 마지막 투썸 서버 통신 성공 시각)
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SessionHealth {
        private String status;              // NONE | ACTIVE | EXPIRED
        private String storeNm;
        private LocalDateTime lastUsedAt;
        private Long remainingMinutes;
        private String source;              // RESTORED / FRESH / null
        private LocalDateTime lastSuccessAt; // 마지막 투썸 서버 통신 성공 시각
    }

    /**
     * 유형별 지표. ok = 최근 24시간 내 실패 없음.
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Indicator {
        private String eventType;
        private LocalDateTime lastSuccessAt;
        private LocalDateTime lastFailureAt;
        private String lastMessage;
        private boolean ok;
    }
}
