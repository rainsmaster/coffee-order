package com.example.coffeeorder.exception;

/**
 * 관리자/대표 인증 실패 (토큰 없음·무효, 비밀번호/PIN 오류 등).
 * 컨트롤러에서 401 또는 400으로 매핑한다.
 */
public class AuthException extends RuntimeException {

    /** 프론트가 분기 처리할 수 있는 오류 코드 (예: PIN_NOT_SET) */
    private final String errorCode;

    public AuthException(String message) {
        this(null, message);
    }

    public AuthException(String errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
    }

    public String getErrorCode() {
        return errorCode;
    }
}
