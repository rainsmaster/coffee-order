package com.example.coffeeorder.repository;

import com.example.coffeeorder.entity.Menu;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface MenuRepository extends JpaRepository<Menu, Long> {
    List<Menu> findByDelYnOrderByCategory(String delYn);

    // 최근 3개월 주문 많은 순으로 정렬
    @Query("SELECT m FROM Menu m WHERE m.delYn = 'N' ORDER BY " +
           "(SELECT COUNT(o) FROM Order o WHERE o.menu.id = m.id " +
           "AND o.delYn = 'N' AND o.orderDate >= :threeMonthsAgo) DESC")
    List<Menu> findAllOrderByRecentOrderCount(@Param("threeMonthsAgo") LocalDate threeMonthsAgo);
}
