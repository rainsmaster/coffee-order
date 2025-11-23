package com.example.coffeeorder.service;

import com.example.coffeeorder.dto.MenuSummaryDto;
import com.example.coffeeorder.dto.OrderCreateDto;
import com.example.coffeeorder.dto.OrderResponseDto;
import com.example.coffeeorder.entity.Menu;
import com.example.coffeeorder.entity.Order;
import com.example.coffeeorder.entity.Team;
import com.example.coffeeorder.mapper.OrderMapper;
import com.example.coffeeorder.repository.MenuRepository;
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
    private final MenuRepository menuRepository;
    private final OrderMapper orderMapper;

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

    // 주문 생성 (DTO 사용)
    @Transactional
    public Long createOrderFromDto(OrderCreateDto dto) throws Exception {
        // Team과 Menu 조회
        Team team = teamRepository.findById(dto.getTeamId())
                .orElseThrow(() -> new Exception("팀원을 찾을 수 없습니다."));
        Menu menu = menuRepository.findById(dto.getMenuId())
                .orElseThrow(() -> new Exception("메뉴를 찾을 수 없습니다."));

        // Order 날짜 설정
        LocalDate orderDate = dto.getOrderDate() != null ? dto.getOrderDate() : LocalDate.now();

        // 중복 체크
        boolean exists = orderRepository.existsByTeamAndOrderDateAndDelYn(team, orderDate, "N");
        if (exists) {
            throw new Exception("이미 오늘 주문하셨습니다.");
        }

        // Order 엔티티 생성
        Order order = new Order();
        order.setTeam(team);
        order.setMenu(menu);
        order.setPersonalOption(dto.getPersonalOption());
        order.setOrderDate(orderDate);

        Order savedOrder = orderRepository.save(order);
        // 저장된 ID만 반환 (사용자 입력으로부터 완전히 분리)
        return savedOrder.getId();
    }

    // ID로 OrderResponseDto 조회
    public OrderResponseDto getOrderResponseById(Long id) throws Exception {
        Order order = orderRepository.findById(id)
                .orElseThrow(() -> new Exception("주문을 찾을 수 없습니다."));
        return OrderResponseDto.from(order);
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

    // 날짜별 메뉴 집계 (MyBatis 사용)
    public Map<String, Object> getMenuSummaryByDate(LocalDate date) {
        List<MenuSummaryDto> results = orderMapper.findMenuSummaryByDate(date);

        Map<String, Object> summary = new LinkedHashMap<>();

        for (MenuSummaryDto dto : results) {
            String key = dto.getMenuName();
            if (dto.getPersonalOption() != null && !dto.getPersonalOption().isEmpty()) {
                key += " (옵션: " + dto.getPersonalOption() + ")";
            }

            summary.put(key, Map.of(
                "menuName", dto.getMenuName(),
                "category", dto.getCategory(),
                "personalOption", dto.getPersonalOption() != null ? dto.getPersonalOption() : "",
                "count", dto.getCount()
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
