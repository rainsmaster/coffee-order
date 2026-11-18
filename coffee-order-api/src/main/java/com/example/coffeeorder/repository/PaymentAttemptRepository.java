package com.example.coffeeorder.repository;

import com.example.coffeeorder.entity.PaymentAttempt;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PaymentAttemptRepository extends JpaRepository<PaymentAttempt, Long> {
    Optional<PaymentAttempt> findFirstByRepMemberIdAndActiveKeyIsNotNullOrderByIdDesc(Long repMemberId);

    long deleteByCreatedAtBeforeAndActiveKeyIsNull(java.time.LocalDateTime cutoff);
}
