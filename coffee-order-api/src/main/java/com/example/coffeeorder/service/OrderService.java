package com.example.coffeeorder.service;

import com.example.coffeeorder.dto.MenuSummaryDto;
import com.example.coffeeorder.dto.OrderCreateDto;
import com.example.coffeeorder.dto.OrderResponseDto;
import com.example.coffeeorder.entity.Department;
import com.example.coffeeorder.entity.Menu;
import com.example.coffeeorder.entity.Order;
import com.example.coffeeorder.entity.Team;
import com.example.coffeeorder.entity.TwosomeMenu;
import com.example.coffeeorder.mapper.OrderMapper;
import com.example.coffeeorder.repository.DepartmentRepository;
import com.example.coffeeorder.repository.MenuRepository;
import com.example.coffeeorder.repository.OrderRepository;
import com.example.coffeeorder.repository.TeamRepository;
import com.example.coffeeorder.repository.TwosomeMenuRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class OrderService {

    private final OrderRepository orderRepository;
    private final TeamRepository teamRepository;
    private final MenuRepository menuRepository;
    private final TwosomeMenuRepository twosomeMenuRepository;
    private final DepartmentRepository departmentRepository;
    private final OrderMapper orderMapper;

    // 한국 시간 기준 ZoneId
    private static final ZoneId KOREA_ZONE = ZoneId.of("Asia/Seoul");

    // 오늘 주문 전체 조회 (하위 호환용)
    public List<Order> findTodayOrders() {
        return orderRepository.findByOrderDateAndDelYn(LocalDate.now(KOREA_ZONE), "N");
    }

    // 부서별 오늘 주문 조회
    public List<Order> findTodayOrdersByDepartment(Long departmentId) {
        return orderRepository.findByDepartmentIdAndOrderDateAndDelYn(
            departmentId, LocalDate.now(KOREA_ZONE), "N");
    }

    // 특정 날짜 주문 조회 (하위 호환용)
    public List<Order> findOrdersByDate(LocalDate date) {
        return orderRepository.findByOrderDateAndDelYn(date, "N");
    }

    // 부서별 특정 날짜 주문 조회
    public List<Order> findOrdersByDepartmentAndDate(Long departmentId, LocalDate date) {
        return orderRepository.findByDepartmentIdAndOrderDateAndDelYn(departmentId, date, "N");
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
        // Team 조회
        Team team = teamRepository.findById(dto.getTeamId())
                .orElseThrow(() -> new Exception("팀원을 찾을 수 없습니다."));

        // Order 날짜 설정 - 한국 시간 기준
        LocalDate orderDate = dto.getOrderDate() != null ? dto.getOrderDate() : LocalDate.now(KOREA_ZONE);

        // 중복 체크
        boolean exists = orderRepository.existsByTeamAndOrderDateAndDelYn(team, orderDate, "N");
        if (exists) {
            throw new Exception("이미 오늘 주문하셨습니다.");
        }

        // Order 엔티티 생성
        Order order = new Order();
        order.setTeam(team);
        order.setPersonalOption(dto.getPersonalOption());
        order.setOrderDate(orderDate);

        // 부서 설정 (팀의 부서를 따라가거나 직접 지정)
        if (dto.getDepartmentId() != null) {
            Department department = departmentRepository.findById(dto.getDepartmentId())
                    .orElseThrow(() -> new Exception("부서를 찾을 수 없습니다."));
            order.setDepartment(department);
        } else if (team.getDepartment() != null) {
            order.setDepartment(team.getDepartment());
        }

        // 메뉴 타입에 따라 처리
        String menuType = dto.getMenuType() != null ? dto.getMenuType() : "CUSTOM";
        order.setMenuType(menuType);

        if ("TWOSOME".equals(menuType)) {
            // 투썸 메뉴 모드
            if (dto.getTwosomeMenuId() == null) {
                throw new Exception("투썸 메뉴를 선택해주세요.");
            }
            TwosomeMenu twosomeMenu = twosomeMenuRepository.findById(dto.getTwosomeMenuId())
                    .orElseThrow(() -> new Exception("투썸 메뉴를 찾을 수 없습니다."));
            order.setTwosomeMenu(twosomeMenu);
            order.setMenu(null);
        } else {
            // 커스텀 메뉴 모드
            if (dto.getMenuId() == null) {
                throw new Exception("메뉴를 선택해주세요.");
            }
            Menu menu = menuRepository.findById(dto.getMenuId())
                    .orElseThrow(() -> new Exception("메뉴를 찾을 수 없습니다."));
            order.setMenu(menu);
            order.setTwosomeMenu(null);
        }

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

            // 메뉴 타입 업데이트
            if (updatedOrder.getMenuType() != null) {
                order.setMenuType(updatedOrder.getMenuType());
            }

            // 메뉴 타입에 따라 적절한 메뉴 설정
            if ("TWOSOME".equals(updatedOrder.getMenuType())) {
                order.setTwosomeMenu(updatedOrder.getTwosomeMenu());
                order.setMenu(null);
            } else {
                order.setMenu(updatedOrder.getMenu());
                order.setTwosomeMenu(null);
            }

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
                LocalDate.now(KOREA_ZONE),
                "N"
            );
        }
        return Optional.empty();
    }

    // 특정 팀원의 최근 주문 조회
    public Optional<Order> findLatestOrderByTeam(Long teamId) {
        Optional<Team> team = teamRepository.findById(teamId);
        if (team.isPresent()) {
            return orderRepository.findTopByTeamAndDelYnOrderByOrderDateDescCreatedTimeDesc(
                team.get(),
                "N"
            );
        }
        return Optional.empty();
    }
}
