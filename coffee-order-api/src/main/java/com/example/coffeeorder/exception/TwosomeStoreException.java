package com.example.coffeeorder.exception;

/**
 * 투썸 스토어 연동 중 발생하는 일반 오류 (네트워크 실패, 비즈니스 오류 등)
 */
public class TwosomeStoreException extends RuntimeException {

    /** 투썸 서버 응답의 rstCd (loginProc 등). 없으면 null. */
    private final String rstCd;

    public TwosomeStoreException(String message) {
        this(message, null, null);
    }

    public TwosomeStoreException(String message, String rstCd) {
        this(message, rstCd, null);
    }

    public TwosomeStoreException(String message, Throwable cause) {
        this(message, null, cause);
    }

    public TwosomeStoreException(String message, String rstCd, Throwable cause) {
        super(message, cause);
        this.rstCd = rstCd;
    }

    public String getRstCd() {
        return rstCd;
    }
}
