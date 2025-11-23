package com.example.coffeeorder.repository;

import com.example.coffeeorder.entity.Order;
import com.example.coffeeorder.entity.Team;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface OrderRepository extends JpaRepository<Order, Long> {
    List<Order> findByOrderDateAndDelYn(LocalDate orderDate, String delYn);

    Optional<Order> findByTeamAndOrderDateAndDelYn(Team team, LocalDate orderDate, String delYn);

    // 특정 날짜에 팀원이 이미 주문했는지 확인
    boolean existsByTeamAndOrderDateAndDelYn(Team team, LocalDate orderDate, String delYn);
}
