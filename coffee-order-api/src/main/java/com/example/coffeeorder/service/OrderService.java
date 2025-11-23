package com.example.coffeeorder.service;

import com.example.coffeeorder.entity.Order;
import com.example.coffeeorder.entity.Team;
import com.example.coffeeorder.repository.OrderRepository;
import com.example.coffeeorder.repository.TeamRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class OrderService {

    private final OrderRepository orderRepository;
    private final TeamRepository teamRepository;

    // 오늘 주문 전체 조회
    public List<Order> findTodayOrders() {
        return orderRepository.findByOrderDateAndDelYn(LocalDate.now(), "N");
    }

    // 특정 날짜 주문 조회
    public List<Order> findOrdersByDate(LocalDate date) {
        return orderRepository.findByOrderDateAndDelYn(date, "N");
    }

    // ID로 조회
    public Optional<Order> findById(Long id) {
        return orderRepository.findById(id);
    }

    // 주문 생성 (중복 체크)
    @Transactional
    public Order createOrder(Order order) throws Exception {
        // 같은 날짜에 같은 팀원이 이미 주문했는지 체크
        boolean exists = orderRepository.existsByTeamAndOrderDateAndDelYn(
            order.getTeam(),
            order.getOrderDate(),
            "N"
        );

        if (exists) {
            throw new Exception("이미 오늘 주문하셨습니다.");
        }

        return orderRepository.save(order);
    }

    // 주문 수정
    @Transactional
    public Order updateOrder(Long id, Order updatedOrder) {
        Optional<Order> existingOrder = orderRepository.findById(id);
        if (existingOrder.isPresent()) {
            Order order = existingOrder.get();
            order.setMenu(updatedOrder.getMenu());
            order.setPersonalOption(updatedOrder.getPersonalOption());
            return orderRepository.save(order);
        }
        return null;
    }

    // 소프트 삭제
    @Transactional
    public void softDelete(Long id) {
        Optional<Order> order = orderRepository.findById(id);
        order.ifPresent(o -> {
            o.setDelYn("Y");
            orderRepository.save(o);
        });
    }

    // 날짜별 메뉴 집계
    public Map<String, Object> getMenuSummaryByDate(LocalDate date) {
        List<Object[]> results = orderRepository.findMenuSummaryByDate(date);

        Map<String, Object> summary = new LinkedHashMap<>();

        for (Object[] result : results) {
            String menuName = (String) result[0];
            String category = (String) result[1];
            String personalOption = (String) result[2];
            Long count = (Long) result[3];

            String key = menuName;
            if (personalOption != null && !personalOption.isEmpty()) {
                key += " (옵션: " + personalOption + ")";
            }

            summary.put(key, Map.of(
                "menuName", menuName,
                "category", category,
                "personalOption", personalOption != null ? personalOption : "",
                "count", count
            ));
        }

        return summary;
    }

    // 특정 팀원의 오늘 주문 조회
    public Optional<Order> findTodayOrderByTeam(Long teamId) {
        Optional<Team> team = teamRepository.findById(teamId);
        if (team.isPresent()) {
            return orderRepository.findByTeamAndOrderDateAndDelYn(
                team.get(),
                LocalDate.now(),
                "N"
            );
        }
        return Optional.empty();
    }
}
