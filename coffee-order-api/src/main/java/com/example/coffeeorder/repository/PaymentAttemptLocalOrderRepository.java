package com.example.coffeeorder.repository;

import com.example.coffeeorder.entity.PaymentAttemptLocalOrder;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PaymentAttemptLocalOrderRepository extends JpaRepository<PaymentAttemptLocalOrder, Long> {
    List<PaymentAttemptLocalOrder> findByAttemptId(Long attemptId);

    boolean existsByAttemptIdAndOrderId(Long attemptId, Long orderId);

    long deleteByCreatedAtBefore(java.time.LocalDateTime cutoff);
}
