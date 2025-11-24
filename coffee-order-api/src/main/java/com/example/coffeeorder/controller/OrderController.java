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

    // 오늘 주문 전체 조회
    @GetMapping("/today")
    public ResponseEntity<List<Order>> getTodayOrders() {
        List<Order> orders = orderService.findTodayOrders();
        return ResponseEntity.ok(orders);
    }

    // 특정 날짜 주문 조회
    @GetMapping
    public ResponseEntity<List<Order>> getOrdersByDate(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        List<Order> orders = orderService.findOrdersByDate(date);
        return ResponseEntity.ok(orders);
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
        // 주문 가능 시간 체크
        if (!settingsService.isOrderAvailable()) {
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
    public ResponseEntity<Object> updateOrder(@PathVariable Long id, @RequestBody Order order) {
        // 주문 가능 시간 체크
        if (!settingsService.isOrderAvailable()) {
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
}
