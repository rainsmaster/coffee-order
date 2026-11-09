package com.example.coffeeorder.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
@RequiredArgsConstructor
public class TwosomeAutoReloginGuard {

    private static final String BLOCKED_KEY_PREFIX = "twosome:auto-relogin:blocked:";

    private final StringRedisTemplate stringRedisTemplate;
    private final Map<String, String> localBlocks = new ConcurrentHashMap<>();

    public Optional<String> blockedReason(String sessionKey) {
        String localReason = localBlocks.get(sessionKey);
        if (localReason != null) {
            return Optional.of(localReason);
        }
        try {
            return Optional.ofNullable(stringRedisTemplate.opsForValue().get(blockedKey(sessionKey)));
        } catch (Exception e) {
            log.warn("Failed to read auto relogin guard; blocking attempts for safety (key={}): {}",
                    sessionKey, e.getMessage());
            return Optional.of("자동 재로그인 차단 상태를 확인할 수 없어 로그인 시도를 중단합니다.");
        }
    }

    public void block(String sessionKey, String reason) {
        localBlocks.put(sessionKey, reason);
        try {
            stringRedisTemplate.opsForValue().set(blockedKey(sessionKey), reason);
        } catch (Exception e) {
            log.warn("Failed to persist auto relogin block (key={}): {}", sessionKey, e.getMessage());
        }
    }

    public void clear(String sessionKey) {
        localBlocks.remove(sessionKey);
        try {
            stringRedisTemplate.delete(blockedKey(sessionKey));
        } catch (Exception e) {
            log.warn("Failed to clear auto relogin block (key={}): {}", sessionKey, e.getMessage());
        }
    }

    private static String blockedKey(String sessionKey) {
        return BLOCKED_KEY_PREFIX + sessionKey;
    }
}
