package com.example.coffeeorder.service;

import com.example.coffeeorder.dto.TwosomeHealthResponse;
import com.example.coffeeorder.entity.TwosomeHealthEvent;
import com.example.coffeeorder.repository.TwosomeHealthEventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;

/**
 * 투썸 연동 헬스 이벤트 기록/조회 서비스.
 *
 * record()는 연동 본 흐름에서 호출되므로 절대 실패시키지 않는다:
 * 남부 try-catch로 감싸고 로그만 남긴다 (REQUIRES_NEW로 호출측 트랜잭션과 분리).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TwosomeHealthService {

    private final TwosomeHealthEventRepository healthEventRepository;

    /**
     * 헬스 이벤트를 기록한다. 어떤 경우에도 예외를 던지지 않는다.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(TwosomeHealthEventType eventType, boolean success, String message) {
        try {
            healthEventRepository.save(new TwosomeHealthEvent(eventType.name(), success, message));
        } catch (Exception e) {
            log.warn("Failed to record twosome health event {} (ignored): {}", eventType, e.getMessage());
        }
    }

    /**
     * 유형별 지표 목록 (모든 이벤트 유형, 정의 순).
     * ok = 최근 24시간 내 실패 이벤트가 없음.
     */
    public List<TwosomeHealthResponse.Indicator> getIndicators() {
        return Arrays.stream(TwosomeHealthEventType.values())
                .map(this::toIndicator)
                .toList();
    }

    /**
     * 최근 이벤트 20건 (시각 역순)
     */
    public List<TwosomeHealthEvent> getRecentEvents() {
        return healthEventRepository.findTop20ByOrderByCreatedAtDesc();
    }

    private TwosomeHealthResponse.Indicator toIndicator(TwosomeHealthEventType type) {
        TwosomeHealthEvent lastSuccess = healthEventRepository
                .findTopByEventTypeAndSuccessTrueOrderByCreatedAtDesc(type.name())
                .orElse(null);
        TwosomeHealthEvent lastFailure = healthEventRepository
                .findTopByEventTypeAndSuccessFalseOrderByCreatedAtDesc(type.name())
                .orElse(null);
        // 정상 판정: 마지막 이벤트가 성공이면 정상 (실패 이력이 오래됐어도 이후 성공이 있으면 복구된 것으로 본다)
        boolean ok = lastFailure == null
                || (lastSuccess != null && !lastSuccess.getCreatedAt().isBefore(lastFailure.getCreatedAt()));
        return new TwosomeHealthResponse.Indicator(
                type.name(),
                (lastSuccess != null) ? lastSuccess.getCreatedAt() : null,
                (lastFailure != null) ? lastFailure.getCreatedAt() : null,
                (lastFailure != null) ? lastFailure.getMessage() : null,
                ok);
    }
}
