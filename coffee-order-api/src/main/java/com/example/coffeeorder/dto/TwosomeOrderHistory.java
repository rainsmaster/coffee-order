package com.example.coffeeorder.dto;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public final class TwosomeOrderHistory {

    private TwosomeOrderHistory() {
    }

    public record Summary(
            String ordNo,
            String storeNm,
            String statusCode,
            String statusName,
            LocalDateTime orderedAt,
            LocalDateTime pickupAt,
            String orderTypeCode,
            String menuName,
            String menuImage) {
    }

    public record Step(String name, String state) {
    }

    public record CustomOption(
            String name,
            String grpCd,
            String typeAddCd,
            String cstmAddCd,
            String typeChgCd,
            String cstmChgCd,
            int quantity) {
    }

    public record Item(
            String ordDtlNo,
            String menuCd,
            String menuNm,
            String optionNm,
            int quantity,
            Integer displayUnitPrice,
            Integer displayLineAmount,
            List<CustomOption> customOptions) {
        public Item withCustomOptions(List<CustomOption> options) {
            return new Item(ordDtlNo, menuCd, menuNm, optionNm, quantity,
                    displayUnitPrice, displayLineAmount, options);
        }
    }

    public record Detail(
            Summary summary,
            String simpleOrderNo,
            String storeAddress,
            String currentStep,
            List<Step> steps,
            Integer totalOrderAmount,
            Integer discountAmount,
            Integer finalPaymentAmount,
            Map<String, Integer> paymentAmounts,
            String posSaleNo,
            String receiptNo,
            String message,
            List<Item> items,
            boolean itemsComplete) {
    }

    public record Receipt(
            String receiptNo,
            String simpleOrderNo,
            Integer paymentAmount,
            String approvalNo,
            LocalDateTime approvedAt) {
    }
}
