package com.example.coffeeorder.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "payment_attempt_order", uniqueConstraints = {
        @UniqueConstraint(name = "uk_payment_attempt_order_attempt_ord", columnNames = {"attempt_id", "ord_no"}),
        @UniqueConstraint(name = "uk_payment_attempt_order_external", columnNames = "external_order_id")
})
@Getter
@Setter
@NoArgsConstructor
public class PaymentAttemptOrder {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "attempt_id", nullable = false)
    private Long attemptId;

    @Column(name = "external_order_id", nullable = false)
    private Long externalOrderId;

    @Column(name = "ord_no", nullable = false, length = 40)
    private String ordNo;

    @Column(name = "snapshot_version", nullable = false)
    private int snapshotVersion;

    @Column(name = "before_hash", nullable = false, length = 64)
    private String beforeHash;

    @Column(name = "after_hash", nullable = false, length = 64)
    private String afterHash;

    @Column(name = "candidate_count", nullable = false)
    private int candidateCount;

    @Column(name = "rule_version", nullable = false, length = 40)
    private String ruleVersion;

    @Column(name = "linked_at", nullable = false)
    private LocalDateTime linkedAt;
}
