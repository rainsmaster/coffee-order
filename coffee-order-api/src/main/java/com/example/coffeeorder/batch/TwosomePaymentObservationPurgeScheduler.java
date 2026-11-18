package com.example.coffeeorder.batch;

import com.example.coffeeorder.repository.CartSnapshotRepository;
import com.example.coffeeorder.repository.PaymentAttemptLocalOrderRepository;
import com.example.coffeeorder.repository.PaymentAttemptOrderRepository;
import com.example.coffeeorder.repository.PaymentAttemptRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Slf4j
@Service
@RequiredArgsConstructor
public class TwosomePaymentObservationPurgeScheduler {
    private static final int RETENTION_DAYS = 180;

    private final PaymentAttemptLocalOrderRepository localOrderRepository;
    private final PaymentAttemptOrderRepository attemptOrderRepository;
    private final CartSnapshotRepository snapshotRepository;
    private final PaymentAttemptRepository attemptRepository;

    @Scheduled(cron = "0 20 3 * * *", zone = "Asia/Seoul")
    @Transactional
    public void purgeOldObservations() {
        LocalDateTime cutoff = LocalDateTime.now().minusDays(RETENTION_DAYS);
        long localOrders = localOrderRepository.deleteByCreatedAtBefore(cutoff);
        long links = attemptOrderRepository.deleteByLinkedAtBefore(cutoff);
        long snapshots = snapshotRepository.deleteByCreatedAtBefore(cutoff);
        long attempts = attemptRepository.deleteByCreatedAtBeforeAndActiveKeyIsNull(cutoff);
        if (localOrders + links + snapshots + attempts > 0) {
            log.info("오래된 결제 관찰 데이터 정리: attempts={}, snapshots={}, links={}, localOrders={}",
                    attempts, snapshots, links, localOrders);
        }
    }
}
