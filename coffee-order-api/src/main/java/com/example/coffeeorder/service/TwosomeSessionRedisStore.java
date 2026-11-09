package com.example.coffeeorder.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

@Slf4j
@Component
@RequiredArgsConstructor
public class TwosomeSessionRedisStore {

    public static final String REDIS_KEY = "twosome:session:active";
    private static final String KEY_PREFIX = "twosome:session:";
    private static final Duration SESSION_TTL = Duration.ofHours(24);

    private final StringRedisTemplate stringRedisTemplate;
    private final ObjectMapper objectMapper;

    public record StoredSession(Map<String, String> cookieJar,
                                String storeNm,
                                String loginId,
                                LocalDateTime loggedInAt) {
    }

    public void save(StoredSession session) {
        save("active", session);
    }

    public void save(String sessionKey, StoredSession session) {
        try {
            stringRedisTemplate.opsForValue().set(
                    redisKey(sessionKey), objectMapper.writeValueAsString(session), SESSION_TTL);
            log.info("Saved twosome session to redis (key={}, storeNm={})", sessionKey, session.storeNm());
        } catch (Exception e) {
            log.warn("Failed to save twosome session to redis (key={}, ignored): {}", sessionKey, e.getMessage());
        }
    }

    public Optional<StoredSession> load() {
        return load("active");
    }

    public Optional<StoredSession> load(String sessionKey) {
        try {
            String json = stringRedisTemplate.opsForValue().get(redisKey(sessionKey));
            return parse(json);
        } catch (Exception e) {
            log.warn("Failed to load twosome session from redis (key={}, ignored): {}", sessionKey, e.getMessage());
            return Optional.empty();
        }
    }

    public Map<String, StoredSession> loadAll() {
        Set<String> keys;
        try {
            keys = stringRedisTemplate.keys(KEY_PREFIX + "*");
        } catch (Exception e) {
            log.warn("Failed to find twosome sessions from redis (ignored): {}", e.getMessage());
            return Collections.emptyMap();
        }
        if (keys == null || keys.isEmpty()) {
            return Collections.emptyMap();
        }

        Map<String, StoredSession> sessions = new LinkedHashMap<>();
        for (String redisKey : keys) {
            String sessionKey = redisKey.substring(KEY_PREFIX.length());
            try {
                String json = stringRedisTemplate.opsForValue().get(redisKey);
                parse(json).ifPresent(stored -> sessions.put(sessionKey, stored));
            } catch (Exception e) {
                log.warn("Skipping broken twosome session in redis (key={}): {}", sessionKey, e.getMessage());
            }
        }
        return sessions;
    }

    public void delete() {
        delete("active");
    }

    public void delete(String sessionKey) {
        try {
            stringRedisTemplate.delete(redisKey(sessionKey));
        } catch (Exception e) {
            log.warn("Failed to delete twosome session from redis (key={}, ignored): {}", sessionKey, e.getMessage());
        }
    }

    private Optional<StoredSession> parse(String json) {
        try {
            if (json == null || json.isBlank()) {
                return Optional.empty();
            }
            StoredSession stored = objectMapper.readValue(json, StoredSession.class);
            if (stored.cookieJar() == null || stored.cookieJar().isEmpty()) {
                return Optional.empty();
            }
            return Optional.of(stored);
        } catch (Exception e) {
            log.warn("Failed to parse twosome session from redis (ignored): {}", e.getMessage());
            return Optional.empty();
        }
    }

    private static String redisKey(String sessionKey) {
        return KEY_PREFIX + sessionKey;
    }
}
