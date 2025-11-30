package com.example.coffeeorder.service;

import com.example.coffeeorder.dto.SyncProgress;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.redisson.api.RLock;
import org.redisson.api.RedissonClient;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class DistributedLockService {

    private final RedissonClient redissonClient;
    private final RedisTemplate<String, Object> redisTemplate;

    // 락 키
    private static final String TWOSOME_SYNC_LOCK = "twosome:sync:lock";
    // 진행 상태 키
    private static final String TWOSOME_SYNC_PROGRESS = "twosome:sync:progress";
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

    /**
     * 동기화 진행 상태 저장
     */
    public void saveSyncProgress(SyncProgress progress) {
        try {
            redisTemplate.opsForValue().set(TWOSOME_SYNC_PROGRESS, progress, Duration.ofMinutes(30));
        } catch (Exception e) {
            log.error("Failed to save sync progress to Redis", e);
        }
    }

    /**
     * 동기화 진행 상태 조회
     */
    public SyncProgress getSyncProgress() {
        try {
            Object value = redisTemplate.opsForValue().get(TWOSOME_SYNC_PROGRESS);
            if (value instanceof SyncProgress) {
                return (SyncProgress) value;
            }
        } catch (Exception e) {
            log.error("Failed to get sync progress from Redis", e);
        }

        // Redis에 값이 없거나 오류 시 현재 락 상태 기반으로 반환
        if (isSyncInProgress()) {
            return SyncProgress.builder()
                    .status(SyncProgress.Status.RUNNING)
                    .currentStepName("동기화 진행 중...")
                    .build();
        }
        return SyncProgress.idle();
    }

    /**
     * 동기화 진행 상태 삭제
     */
    public void clearSyncProgress() {
        try {
            redisTemplate.delete(TWOSOME_SYNC_PROGRESS);
        } catch (Exception e) {
            log.error("Failed to clear sync progress from Redis", e);
        }
    }
}
