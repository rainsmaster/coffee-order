package com.example.coffeeorder.repository;

import com.example.coffeeorder.entity.ExternalOrderItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ExternalOrderItemRepository extends JpaRepository<ExternalOrderItem, Long> {
    List<ExternalOrderItem> findByExternalOrderIdOrderByIdAsc(Long externalOrderId);

    void deleteByExternalOrderId(Long externalOrderId);
}
