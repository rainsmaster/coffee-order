package com.example.coffeeorder.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.redisson.api.RLock;
import org.redisson.api.RedissonClient;
import org.springframework.stereotype.Service;

import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class DistributedLockService {

    private final RedissonClient redissonClient;

    // 락 키
    private static final String TWOSOME_SYNC_LOCK = "twosome:sync:lock";
    // 락 최대 유지 시간 (10분)
    private static final long LOCK_LEASE_TIME_MINUTES = 10;
    // 락 획득 대기 시간 (즉시 실패)
    private static final long LOCK_WAIT_TIME_SECONDS = 0;

    /**
     * 동기화 락 획득 시도
     * @return 락 획득 성공 여부
     */
    public boolean tryAcquireSyncLock() {
        RLock lock = redissonClient.getLock(TWOSOME_SYNC_LOCK);
        try {
            boolean acquired = lock.tryLock(LOCK_WAIT_TIME_SECONDS, LOCK_LEASE_TIME_MINUTES, TimeUnit.MINUTES);
            if (acquired) {
                log.info("Sync lock acquired successfully");
            } else {
                log.info("Failed to acquire sync lock - sync already in progress");
            }
            return acquired;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.error("Interrupted while trying to acquire sync lock", e);
            return false;
        }
    }

    /**
     * 동기화 락 해제
     */
    public void releaseSyncLock() {
        RLock lock = redissonClient.getLock(TWOSOME_SYNC_LOCK);
        if (lock.isHeldByCurrentThread()) {
            lock.unlock();
            log.info("Sync lock released");
        }
    }

    /**
     * 현재 동기화 진행 중인지 확인
     */
    public boolean isSyncInProgress() {
        RLock lock = redissonClient.getLock(TWOSOME_SYNC_LOCK);
        return lock.isLocked();
    }

}
