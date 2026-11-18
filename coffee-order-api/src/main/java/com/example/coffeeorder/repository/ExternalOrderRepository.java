package com.example.coffeeorder.repository;

import com.example.coffeeorder.entity.ExternalOrder;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ExternalOrderRepository extends JpaRepository<ExternalOrder, Long> {
    Optional<ExternalOrder> findByRepMemberIdAndOrdNo(Long repMemberId, String ordNo);

    List<ExternalOrder> findTop20ByRepMemberIdOrderByOrderedAtDesc(Long repMemberId);
}
