package com.example.coffeeorder.service;

import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;

/**
 * 대표 PIN 해시 유틸.
 * SHA-256 + 멤버별 랜덤 salt, 비교는 MessageDigest.isEqual (constant-time).
 * 평문은 발급/검증 직후 즉시 폐기하는 것을 전제로 한다.
 */
@Component
public class PinCrypto {

    private static final SecureRandom RANDOM = new SecureRandom();

    /** 16바이트 랜덤 salt (hex 32자) */
    public String newSalt() {
        byte[] salt = new byte[16];
        RANDOM.nextBytes(salt);
        return toHex(salt);
    }

    /** pin:salt 조합의 SHA-256 hex */
    public String hash(String plainText, String salt) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashed = digest.digest((plainText + ":" + salt).getBytes(StandardCharsets.UTF_8));
            return toHex(hashed);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 알고리즘을 사용할 수 없습니다.", e);
        }
    }

    /** constant-time 비교 */
    public boolean matches(String plainText, String salt, String expectedHash) {
        if (plainText == null || salt == null || expectedHash == null) {
            return false;
        }
        return MessageDigest.isEqual(
                hash(plainText, salt).getBytes(StandardCharsets.UTF_8),
                expectedHash.getBytes(StandardCharsets.UTF_8));
    }

    /** PIN 형식 검증: 숫자 6자리 */
    public boolean isValidPinFormat(String pin) {
        return pin != null && pin.matches("\\d{6}");
    }

    private static String toHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }
}
