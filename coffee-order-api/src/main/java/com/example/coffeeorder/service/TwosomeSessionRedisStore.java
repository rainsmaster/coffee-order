package com.example.coffeeorder.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;

/**
 * 투썸 ACTIVE 세션의 Redis 영속화 저장소.
 *
 * 애플리케이션 재시작/재배포 후에도 로그인 세션(쿠키 jar)을 복구하기 위해
 * 로그인 성공 시 저장하고, 로그아웃/만료 시 삭제한다.
 * 쿠키 자체의 유효기간은 투썸 서버의 30분 유휴 슬라이딩 규칙이 지배하므로
 * 복구된 세션도 첫 실사용에서 401이면 기존 만료 흐름으로 처리한다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class TwosomeSessionRedisStore {

    public static final String REDIS_KEY = "twosome:session:active";

    private final StringRedisTemplate stringRedisTemplate;
    private final ObjectMapper objectMapper;

    /**
     * 저장 페이로드. 쿠키 jar(Map) + 표시용 메타 정보.
     */
    public record StoredSession(Map<String, String> cookieJar,
                                String storeNm,
                                String loginId,
                                LocalDateTime loggedInAt) {
    }

    public void save(StoredSession session) {
        try {
            stringRedisTemplate.opsForValue().set(REDIS_KEY, objectMapper.writeValueAsString(session));
            log.info("Saved twosome session to redis (loginId={}, storeNm={})", session.loginId(), session.storeNm());
        } catch (Exception e) {
            log.warn("Failed to save twosome session to redis (ignored): {}", e.getMessage());
        }
    }

    public Optional<StoredSession> load() {
        try {
            String json = stringRedisTemplate.opsForValue().get(REDIS_KEY);
            if (json == null || json.isBlank()) {
                return Optional.empty();
            }
            return Optional.of(objectMapper.readValue(json, StoredSession.class));
        } catch (Exception e) {
            log.warn("Failed to load twosome session from redis (ignored): {}", e.getMessage());
            return Optional.empty();
        }
    }

    public void delete() {
        try {
            stringRedisTemplate.delete(REDIS_KEY);
        } catch (Exception e) {
            log.warn("Failed to delete twosome session from redis (ignored): {}", e.getMessage());
        }
    }
}
