package com.example.coffeeorder.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RepTwosomeVerifyResponse {

    public enum Result {
        VALID,
        RELOGINED,
        NONE,
        EXPIRED,
        BLOCKED,
        TEMPORARY_ERROR,
        RATE_LIMITED
    }

    private Result result;
    private String message;
    private RepAdminItem rep;
}
