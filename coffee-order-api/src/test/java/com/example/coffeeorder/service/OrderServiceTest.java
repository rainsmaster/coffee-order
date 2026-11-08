package com.example.coffeeorder.service;

import com.example.coffeeorder.dto.OrderCreateDto;
import com.example.coffeeorder.entity.Order;
import com.example.coffeeorder.entity.Team;
import com.example.coffeeorder.entity.TwosomeMenu;
import com.example.coffeeorder.mapper.OrderMapper;
import com.example.coffeeorder.repository.DepartmentRepository;
import com.example.coffeeorder.repository.OrderRepository;
import com.example.coffeeorder.repository.TeamRepository;
import com.example.coffeeorder.repository.TwosomeMenuRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OrderServiceTest {

    @Mock
    private OrderRepository orderRepository;
    @Mock
    private TeamRepository teamRepository;
    @Mock
    private TwosomeMenuRepository twosomeMenuRepository;
    @Mock
    private DepartmentRepository departmentRepository;
    @Mock
    private OrderMapper orderMapper;

    private OrderService orderService;

    @BeforeEach
    void setUp() {
        orderService = new OrderService(orderRepository, teamRepository, twosomeMenuRepository,
                departmentRepository, orderMapper);
    }

    @Test
    void sameMemberCanCreateMultipleOrdersOnSameDay() throws Exception {
        Team team = new Team();
        team.setId(10L);
        team.setDelYn("N");
        TwosomeMenu menu = new TwosomeMenu();
        menu.setId(20L);
        when(teamRepository.findById(10L)).thenReturn(Optional.of(team));
        when(twosomeMenuRepository.findById(20L)).thenReturn(Optional.of(menu));
        AtomicLong ids = new AtomicLong(100);
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> {
            Order saved = invocation.getArgument(0);
            saved.setId(ids.getAndIncrement());
            return saved;
        });
        OrderCreateDto request = new OrderCreateDto();
        request.setTeamId(10L);
        request.setTwosomeMenuId(20L);

        Long firstId = orderService.createOrderFromDto(request);
        Long secondId = orderService.createOrderFromDto(request);

        assertThat(firstId).isEqualTo(100L);
        assertThat(secondId).isEqualTo(101L);
        verify(orderRepository, times(2)).save(any(Order.class));
        verify(orderRepository, never()).existsByTeamAndOrderDateAndDelYn(any(), any(), any());
    }

    @Test
    void cartReflectionKeepsSelectedRepresentative() {
        Order order = new Order();
        order.setId(100L);
        order.setDelYn("N");
        when(orderRepository.findAllById(List.of(100L))).thenReturn(List.of(order));

        int updated = orderService.markCartReflected(List.of(100L), 42L);

        assertThat(updated).isEqualTo(1);
        assertThat(order.getCartReflectedAt()).isNotNull();
        assertThat(order.getCartReflectedBy()).isEqualTo(42L);
    }

    @Test
    void menuChangeClearsPreviousCartReflection() {
        Order existing = new Order();
        existing.setId(100L);
        existing.setCartReflectedBy(42L);
        existing.setCartReflectedAt(java.time.LocalDateTime.now());
        when(orderRepository.findById(100L)).thenReturn(Optional.of(existing));
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> invocation.getArgument(0));
        Order change = new Order();
        change.setMenuType("TWOSOME");

        orderService.updateOrder(100L, change);

        assertThat(existing.getCartReflectedAt()).isNull();
        assertThat(existing.getCartReflectedBy()).isNull();
    }
}
