package com.example.coffeeorder.repository;

import com.example.coffeeorder.entity.CartSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CartSnapshotRepository extends JpaRepository<CartSnapshot, Long> {
    Optional<CartSnapshot> findTopByAttemptIdOrderByVersionDesc(Long attemptId);

    List<CartSnapshot> findTop50ByAttemptIdOrderByVersionDesc(Long attemptId);

    void deleteByAttemptIdAndVersionLessThan(Long attemptId, int version);

    long deleteByCreatedAtBefore(java.time.LocalDateTime cutoff);
}
