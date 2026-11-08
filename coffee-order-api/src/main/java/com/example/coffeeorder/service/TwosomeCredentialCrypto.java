package com.example.coffeeorder.service;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * 대표 투썸 계정 자격증명의 양방향 암호화 (AES-256-GCM).
 *
 * 키 우선순위:
 * 1. properties/env의 twosome.crypto.key (Base64, 32바이트)
 * 2. Redis에 저장된 기존 랜덤 키
 * 3. 신규 랜덤 생성 후 Redis 영속 (기동 경고 로그 — 재시작 간 키 유지용, 서버 교체 시 복호화 불가)
 *
 * 결제가 아닌 장바구니 담기 실행용 자격증명이므로 양방향이 필요하며,
 * 복호화 평문은 담기 실행 시점의 메모리에만 존재한다.
 */
@Slf4j
@Component
public class TwosomeCredentialCrypto {

    private static final String REDIS_KEY = "twosome:crypto:key";
    private static final int GCM_IV_LENGTH = 12;
    private static final int GCM_TAG_BITS = 128;

    private final StringRedisTemplate stringRedisTemplate;
    private final String configuredKey;

    private SecretKeySpec keySpec;
    private final SecureRandom secureRandom = new SecureRandom();

    public TwosomeCredentialCrypto(StringRedisTemplate stringRedisTemplate,
                                   @Value("${twosome.crypto.key:}") String configuredKey) {
        this.stringRedisTemplate = stringRedisTemplate;
        this.configuredKey = configuredKey;
    }

    @PostConstruct
    void init() {
        byte[] keyBytes = resolveKeyBytes();
        this.keySpec = new SecretKeySpec(keyBytes, "AES");
    }

    private byte[] resolveKeyBytes() {
        // 1) properties/env
        if (configuredKey != null && !configuredKey.isBlank()) {
            try {
                byte[] decoded = Base64.getDecoder().decode(configuredKey.trim());
                if (decoded.length == 32) {
                    log.info("Twosome credential crypto key loaded from configuration");
                    return decoded;
                }
                log.warn("twosome.crypto.key is not 32 bytes ({} bytes), falling back to random key",
                        decoded.length);
            } catch (IllegalArgumentException e) {
                log.warn("twosome.crypto.key is not valid Base64, falling back to random key");
            }
        }
        // 2) Redis에 저장된 기존 키
        try {
            String stored = stringRedisTemplate.opsForValue().get(REDIS_KEY);
            if (stored != null) {
                byte[] decoded = Base64.getDecoder().decode(stored);
                if (decoded.length == 32) {
                    log.warn("Twosome credential crypto key loaded from Redis random storage. "
                            + "Set twosome.crypto.key (Base64, 32 bytes) for a stable key.");
                    return decoded;
                }
            }
            // 3) 신규 랜덤 생성 + Redis 영속
            byte[] generated = new byte[32];
            secureRandom.nextBytes(generated);
            stringRedisTemplate.opsForValue().set(REDIS_KEY, Base64.getEncoder().encodeToString(generated));
            log.warn("Twosome credential crypto key was randomly generated and persisted to Redis. "
                    + "Set twosome.crypto.key (Base64, 32 bytes) for a stable key.");
            return generated;
        } catch (Exception e) {
            // Redis 장애 시 메모리 키만 사용 (재시작 시 기존 암호문 복호화 불가)
            byte[] generated = new byte[32];
            secureRandom.nextBytes(generated);
            log.error("Redis unavailable for crypto key persistence; using in-memory random key. "
                    + "Previously encrypted credentials will not survive restart: {}", e.getMessage());
            return generated;
        }
    }

    /** AES-256-GCM 암호화 → Base64(iv + ciphertext) */
    public String encrypt(String plainText) {
        try {
            byte[] iv = new byte[GCM_IV_LENGTH];
            secureRandom.nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, keySpec, new GCMParameterSpec(GCM_TAG_BITS, iv));
            byte[] encrypted = cipher.doFinal(plainText.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(
                    ByteBuffer.allocate(iv.length + encrypted.length)
                            .put(iv).put(encrypted).array());
        } catch (Exception e) {
            throw new IllegalStateException("자격증명 암호화에 실패했습니다.", e);
        }
    }

    /** decrypt(encrypt(x)) == x */
    public String decrypt(String cipherText) {
        try {
            byte[] combined = Base64.getDecoder().decode(cipherText);
            ByteBuffer buffer = ByteBuffer.wrap(combined);
            byte[] iv = new byte[GCM_IV_LENGTH];
            buffer.get(iv);
            byte[] encrypted = new byte[buffer.remaining()];
            buffer.get(encrypted);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, keySpec, new GCMParameterSpec(GCM_TAG_BITS, iv));
            return new String(cipher.doFinal(encrypted), StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new IllegalStateException("자격증명 복호화에 실패했습니다. (키가 변경되었을 수 있습니다)", e);
        }
    }
}
