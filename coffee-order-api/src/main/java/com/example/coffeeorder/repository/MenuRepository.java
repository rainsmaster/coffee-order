package com.example.coffeeorder.repository;

import com.example.coffeeorder.entity.Department;
import com.example.coffeeorder.entity.Menu;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface MenuRepository extends JpaRepository<Menu, Long> {
    List<Menu> findByDelYn(String delYn);

    List<Menu> findByDelYnOrderByCategory(String delYn);

    // 부서별 메뉴 조회
    List<Menu> findByDepartmentAndDelYnOrderByCategory(Department department, String delYn);

    // 부서 ID로 메뉴 조회
    List<Menu> findByDepartmentIdAndDelYnOrderByCategory(Long departmentId, String delYn);

    // ID와 부서로 조회
    Optional<Menu> findByIdAndDepartment(Long id, Department department);

    // 최근 3개월 주문 많은 순으로 정렬
    @Query("SELECT m FROM Menu m WHERE m.delYn = 'N' ORDER BY " +
           "(SELECT COUNT(o) FROM Order o WHERE o.menu.id = m.id " +
           "AND o.delYn = 'N' AND o.orderDate >= :threeMonthsAgo) DESC")
    List<Menu> findAllOrderByRecentOrderCount(@Param("threeMonthsAgo") LocalDate threeMonthsAgo);

    // 부서별 최근 3개월 주문 많은 순으로 정렬
    @Query("SELECT m FROM Menu m WHERE m.department.id = :departmentId AND m.delYn = 'N' ORDER BY " +
           "(SELECT COUNT(o) FROM Order o WHERE o.menu.id = m.id " +
           "AND o.delYn = 'N' AND o.orderDate >= :threeMonthsAgo) DESC")
    List<Menu> findByDepartmentOrderByRecentOrderCount(@Param("departmentId") Long departmentId, @Param("threeMonthsAgo") LocalDate threeMonthsAgo);
}
