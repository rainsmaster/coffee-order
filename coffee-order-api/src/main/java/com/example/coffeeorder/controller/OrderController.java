package com.example.coffeeorder.controller;

import com.example.coffeeorder.dto.OrderCreateDto;
import com.example.coffeeorder.dto.OrderResponseDto;
import com.example.coffeeorder.entity.Order;
import com.example.coffeeorder.service.OrderService;
import com.example.coffeeorder.service.SettingsService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:3000")
public class OrderController {

    private final OrderService orderService;
    private final SettingsService settingsService;

    // 오늘 주문 전체 조회 (부서별 필터링 지원)
    @GetMapping("/today")
    public ResponseEntity<List<OrderResponseDto>> getTodayOrders(
            @RequestParam(required = false) Long departmentId) {
        List<Order> orders;
        if (departmentId != null) {
            orders = orderService.findTodayOrdersByDepartment(departmentId);
        } else {
            orders = orderService.findTodayOrders();
        }
        List<OrderResponseDto> response = orders.stream()
                .map(OrderResponseDto::from)
                .toList();
        return ResponseEntity.ok(response);
    }

    // 특정 날짜 주문 조회 (부서별 필터링 지원)
    @GetMapping
    public ResponseEntity<List<OrderResponseDto>> getOrdersByDate(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) Long departmentId) {
        List<Order> orders;
        if (departmentId != null) {
            orders = orderService.findOrdersByDepartmentAndDate(departmentId, date);
        } else {
            orders = orderService.findOrdersByDate(date);
        }
        List<OrderResponseDto> response = orders.stream()
                .map(OrderResponseDto::from)
                .toList();
        return ResponseEntity.ok(response);
    }

    // ID로 조회
    @GetMapping("/{id}")
    public ResponseEntity<Order> getOrderById(@PathVariable Long id) {
        return orderService.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // 주문 생성
    @PostMapping
    public ResponseEntity<Object> createOrder(@Valid @RequestBody OrderCreateDto orderDto) {
        // 부서별 주문 가능 시간 체크
        boolean isAvailable;
        if (orderDto.getDepartmentId() != null) {
            isAvailable = settingsService.isOrderAvailableByDepartment(orderDto.getDepartmentId());
        } else {
            isAvailable = settingsService.isOrderAvailable();
        }

        if (!isAvailable) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "주문 마감 시간이 지났습니다."));
        }

        try {
            Long orderId = orderService.createOrderFromDto(orderDto);

            OrderResponseDto response = orderService.getOrderResponseById(orderId);

            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    // 주문 수정
    @PutMapping("/{id}")
    public ResponseEntity<Object> updateOrder(
            @PathVariable Long id,
            @RequestParam(required = false) Long departmentId,
            @RequestBody Order order) {
        // 부서별 주문 가능 시간 체크
        boolean isAvailable;
        if (departmentId != null) {
            isAvailable = settingsService.isOrderAvailableByDepartment(departmentId);
        } else {
            isAvailable = settingsService.isOrderAvailable();
        }

        if (!isAvailable) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "주문 마감 시간이 지났습니다."));
        }

        Order updatedOrder = orderService.updateOrder(id, order);
        if (updatedOrder != null) {
            return ResponseEntity.ok(updatedOrder);
        }
        return ResponseEntity.notFound().build();
    }

    // 주문 삭제 (소프트 삭제)
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteOrder(@PathVariable Long id) {
        if (orderService.findById(id).isPresent()) {
            orderService.softDelete(id);
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }

    // 날짜별 메뉴 집계
    @GetMapping("/summary")
    public ResponseEntity<Map<String, Object>> getMenuSummary(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        Map<String, Object> summary = orderService.getMenuSummaryByDate(date);
        return ResponseEntity.ok(summary);
    }

    // 특정 팀원의 오늘 주문 조회
    @GetMapping("/team/{teamId}/today")
    public ResponseEntity<Order> getTodayOrderByTeam(@PathVariable Long teamId) {
        return orderService.findTodayOrderByTeam(teamId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // 특정 팀원의 최근 주문 조회
    @GetMapping("/team/{teamId}/latest")
    public ResponseEntity<OrderResponseDto> getLatestOrderByTeam(@PathVariable Long teamId) {
        return orderService.findLatestOrderByTeam(teamId)
                .map(order -> ResponseEntity.ok(OrderResponseDto.from(order)))
                .orElse(ResponseEntity.notFound().build());
    }
}
