package com.example.coffeeorder.dto;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public record RepTwosomeOrderView(
        String status,
        String message,
        boolean refreshSkipped,
        LocalDateTime checkedAt,
        Observation observation,
        List<Order> orders) {

    public record Observation(
            Long id,
            String status,
            String holdReason,
            Integer snapshotVersion,
            LocalDateTime createdAt,
            LocalDateTime linkedAt) {
    }

    public record Order(
            Long id,
            String ordNo,
            String simpleOrderNo,
            String storeNm,
            String statusCode,
            String statusName,
            String currentStep,
            String displayStatus,
            List<TwosomeOrderHistory.Step> steps,
            LocalDateTime orderedAt,
            LocalDateTime pickupAt,
            Integer totalOrderAmount,
            Integer discountAmount,
            Integer finalPaymentAmount,
            Map<String, Integer> paymentAmounts,
            String posSaleNo,
            boolean receiptAvailable,
            boolean paymentApproved,
            LocalDateTime paymentApprovedAt,
            String message,
            LocalDateTime linkedAt,
            LocalDateTime lastCheckedAt,
            List<Item> items) {
    }

    public record Item(
            String ordDtlNo,
            String menuCd,
            String menuNm,
            String optionNm,
            int quantity,
            Integer displayUnitPrice,
            Integer displayLineAmount,
            List<TwosomeOrderHistory.CustomOption> customOptions) {
    }
}
