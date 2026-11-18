package com.example.coffeeorder.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "payment_attempt", uniqueConstraints = {
        @UniqueConstraint(name = "uk_payment_attempt_active", columnNames = "active_key")
})
@Getter
@Setter
@NoArgsConstructor
public class PaymentAttempt {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "rep_member_id", nullable = false)
    private Long repMemberId;

    @Column(nullable = false, length = 30)
    private String status;

    @Column(name = "store_cd", nullable = false, length = 20)
    private String storeCd;

    @Column(name = "baseline_order_nos_json", columnDefinition = "TEXT")
    private String baselineOrderNosJson;

    @Column(name = "baseline_captured", nullable = false)
    private boolean baselineCaptured;

    @Column(name = "hold_reason", length = 1000)
    private String holdReason;

    @Column(name = "active_key", length = 100)
    private String activeKey;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Column(name = "linked_at")
    private LocalDateTime linkedAt;

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
