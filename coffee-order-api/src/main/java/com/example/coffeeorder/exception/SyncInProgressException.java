package com.example.coffeeorder.exception;

public class SyncInProgressException extends RuntimeException {

    public SyncInProgressException(String message) {
        super(message);
    }

    public SyncInProgressException(String message, Throwable cause) {
        super(message, cause);
    }
}
