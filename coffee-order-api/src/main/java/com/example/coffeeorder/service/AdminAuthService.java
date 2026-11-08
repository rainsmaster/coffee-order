package com.example.coffeeorder.service;

import com.example.coffeeorder.exception.AuthException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.UUID;

/**
 * 관리자 인증 (최소 장치).
 * - admin.password가 비어 있으면 로그인 불가
 * - 로그인 성공 시 랜덤 토큰(UUID)을 Redis에 12시간 TTL로 저장
 * - 이후 /api/admin/** 는 X-Admin-Token 헤더로 검증
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AdminAuthService {

    private static final Duration TOKEN_TTL = Duration.ofHours(12);
    private static final String TOKEN_KEY_PREFIX = "admin:token:";

    private final StringRedisTemplate stringRedisTemplate;

    @Value("${admin.password:}")
    private String adminPassword;

    /**
     * 관리자 비밀번호 로그인. 성공 시 토큰 반환.
     */
    public String login(String password) {
        if (adminPassword == null || adminPassword.isBlank()) {
            throw new AuthException("관리자 로그인이 설정되지 않았습니다. 서버 관리자에게 문의해주세요.");
        }
        if (password == null || !constantTimeEquals(adminPassword, password)) {
            throw new AuthException("관리자 비밀번호가 올바르지 않습니다.");
        }
        String token = UUID.randomUUID().toString();
        stringRedisTemplate.opsForValue().set(TOKEN_KEY_PREFIX + token, "1", TOKEN_TTL);
        log.info("Admin logged in, token issued");
        return token;
    }

    /**
     * 토큰 검증. 유효하지 않으면 예외.
     */
    public void requireToken(String token) {
        if (token == null || token.isBlank()) {
            throw new AuthException("관리자 로그인이 필요합니다.");
        }
        String value = stringRedisTemplate.opsForValue().get(TOKEN_KEY_PREFIX + token);
        if (!"1".equals(value)) {
            throw new AuthException("관리자 로그인이 만료되었습니다. 다시 로그인해주세요.");
        }
    }

    private static boolean constantTimeEquals(String expected, String actual) {
        return MessageDigest.isEqual(
                expected.getBytes(StandardCharsets.UTF_8),
                (actual != null ? actual : "").getBytes(StandardCharsets.UTF_8));
    }
}
