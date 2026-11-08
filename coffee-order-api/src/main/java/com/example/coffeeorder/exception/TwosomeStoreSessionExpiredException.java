package com.example.coffeeorder.exception;

/**
 * 투썸 세션 만료 (30분 유휴 또는 서버 401 응답)
 */
public class TwosomeStoreSessionExpiredException extends TwosomeStoreException {

    public TwosomeStoreSessionExpiredException(String message) {
        super(message);
    }
}
