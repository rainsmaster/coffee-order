package com.example.coffeeorder.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "external_order", uniqueConstraints = {
        @UniqueConstraint(name = "uk_external_order_rep_ord", columnNames = {"rep_member_id", "ord_no"})
})
@Getter
@Setter
@NoArgsConstructor
public class ExternalOrder {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "rep_member_id", nullable = false)
    private Long repMemberId;

    @Column(name = "ord_no", nullable = false, length = 40)
    private String ordNo;

    @Column(name = "simple_order_no", length = 20)
    private String simpleOrderNo;

    @Column(name = "store_cd", nullable = false, length = 20)
    private String storeCd;

    @Column(name = "store_nm", length = 200)
    private String storeNm;

    @Column(name = "status_code", length = 10)
    private String statusCode;

    @Column(name = "status_name", length = 50)
    private String statusName;

    @Column(name = "current_step", length = 50)
    private String currentStep;

    @Column(name = "steps_json", columnDefinition = "TEXT")
    private String stepsJson;

    @Column(name = "ordered_at")
    private LocalDateTime orderedAt;

    @Column(name = "pickup_at")
    private LocalDateTime pickupAt;

    @Column(name = "total_order_amount")
    private Integer totalOrderAmount;

    @Column(name = "discount_amount")
    private Integer discountAmount;

    @Column(name = "final_payment_amount")
    private Integer finalPaymentAmount;

    @Column(name = "payment_amounts_json", columnDefinition = "TEXT")
    private String paymentAmountsJson;

    @Column(name = "pos_sale_no", length = 50)
    private String posSaleNo;

    @Column(name = "receipt_no", length = 50)
    private String receiptNo;

    @Column(name = "payment_approval_no", length = 50)
    private String paymentApprovalNo;

    @Column(name = "payment_approved_at")
    private LocalDateTime paymentApprovedAt;

    @Column(length = 500)
    private String message;

    @Column(name = "linked_at")
    private LocalDateTime linkedAt;

    @Column(name = "last_checked_at")
    private LocalDateTime lastCheckedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
