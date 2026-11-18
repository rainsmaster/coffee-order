package com.example.coffeeorder.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "cart_snapshot", uniqueConstraints = {
        @UniqueConstraint(name = "uk_cart_snapshot_version", columnNames = {"attempt_id", "version"})
})
@Getter
@Setter
@NoArgsConstructor
public class CartSnapshot {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "attempt_id", nullable = false)
    private Long attemptId;

    @Column(nullable = false)
    private int version;

    @Column(name = "raw_hash", nullable = false, length = 64)
    private String rawHash;

    @Column(name = "items_hash", nullable = false, length = 64)
    private String itemsHash;

    @Lob
    @Column(name = "items_json", nullable = false)
    private String itemsJson;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
