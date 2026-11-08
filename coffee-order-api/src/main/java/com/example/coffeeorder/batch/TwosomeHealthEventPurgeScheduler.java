package com.example.coffeeorder.batch;

import com.example.coffeeorder.repository.TwosomeHealthEventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * 투썸 연동 헬스 이벤트 보관 기한 purge 스케줄러.
 * 매일 새벽 3시 10분에 생성 시각이 180일 지난 이벤트를 일괄 삭제한다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class TwosomeHealthEventPurgeScheduler {

    private static final int RETENTION_DAYS = 180;

    private final TwosomeHealthEventRepository healthEventRepository;

    @Scheduled(cron = "0 10 3 * * *")
    @Transactional
    public void purgeOldEvents() {
        LocalDateTime cutoff = LocalDateTime.now().minusDays(RETENTION_DAYS);
        long deleted = healthEventRepository.deleteByCreatedAtBefore(cutoff);
        if (deleted > 0) {
            log.info("투썸 헬스 이벤트 purge 완료: {}건 삭제 (기준: {} 이전)", deleted, cutoff);
        }
    }
}
