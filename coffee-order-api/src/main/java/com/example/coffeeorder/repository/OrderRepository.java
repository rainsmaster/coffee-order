package com.example.coffeeorder.repository;

import com.example.coffeeorder.entity.Department;
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

    // 부서별 날짜 주문 조회
    List<Order> findByDepartmentAndOrderDateAndDelYn(Department department, LocalDate orderDate, String delYn);

    // 부서 ID와 날짜로 주문 조회
    List<Order> findByDepartmentIdAndOrderDateAndDelYn(Long departmentId, LocalDate orderDate, String delYn);

    Optional<Order> findByTeamAndOrderDateAndDelYn(Team team, LocalDate orderDate, String delYn);

    // 특정 날짜에 팀원이 이미 주문했는지 확인
    boolean existsByTeamAndOrderDateAndDelYn(Team team, LocalDate orderDate, String delYn);

    // 특정 팀원의 최근 주문 조회 (날짜 내림차순, 생성시간 내림차순)
    Optional<Order> findTopByTeamAndDelYnOrderByOrderDateDescCreatedTimeDesc(Team team, String delYn);

    // 부서별 오늘 주문 수 조회
    long countByDepartmentIdAndOrderDateAndDelYn(Long departmentId, LocalDate orderDate, String delYn);
}
