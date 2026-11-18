package com.example.coffeeorder.repository;

import com.example.coffeeorder.entity.PaymentAttemptOrder;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PaymentAttemptOrderRepository extends JpaRepository<PaymentAttemptOrder, Long> {
    boolean existsByExternalOrderId(Long externalOrderId);

    long deleteByLinkedAtBefore(java.time.LocalDateTime cutoff);
}
