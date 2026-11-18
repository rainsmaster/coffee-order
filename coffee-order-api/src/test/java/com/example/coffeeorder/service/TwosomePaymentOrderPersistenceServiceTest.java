package com.example.coffeeorder.service;

import com.example.coffeeorder.dto.TwosomeOrderHistory;
import com.example.coffeeorder.entity.CartSnapshot;
import com.example.coffeeorder.entity.ExternalOrder;
import com.example.coffeeorder.entity.Order;
import com.example.coffeeorder.entity.PaymentAttempt;
import com.example.coffeeorder.entity.PaymentAttemptLocalOrder;
import com.example.coffeeorder.repository.CartSnapshotRepository;
import com.example.coffeeorder.repository.ExternalOrderItemRepository;
import com.example.coffeeorder.repository.ExternalOrderRepository;
import com.example.coffeeorder.repository.OrderRepository;
import com.example.coffeeorder.repository.PaymentAttemptLocalOrderRepository;
import com.example.coffeeorder.repository.PaymentAttemptOrderRepository;
import com.example.coffeeorder.repository.PaymentAttemptRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TwosomePaymentOrderPersistenceServiceTest {
    @Mock private PaymentAttemptRepository attemptRepository;
    @Mock private CartSnapshotRepository snapshotRepository;
    @Mock private ExternalOrderRepository externalOrderRepository;
    @Mock private ExternalOrderItemRepository itemRepository;
    @Mock private PaymentAttemptOrderRepository attemptOrderRepository;
    @Mock private PaymentAttemptLocalOrderRepository localOrderRepository;
    @Mock private OrderRepository orderRepository;

    @Test
    void linksRegisteredLocalOrdersToTheExternalOrder() {
        TwosomePaymentOrderPersistenceService service = new TwosomePaymentOrderPersistenceService(
                attemptRepository, snapshotRepository, externalOrderRepository, itemRepository,
                attemptOrderRepository, localOrderRepository, orderRepository,
                new ObjectMapper().findAndRegisterModules());
        PaymentAttempt attempt = new PaymentAttempt();
        attempt.setId(1L);
        attempt.setRepMemberId(42L);
        attempt.setActiveKey("rep:42");
        CartSnapshot snapshot = new CartSnapshot();
        snapshot.setVersion(1);
        snapshot.setItemsHash("before");
        TwosomeOrderHistory.Summary summary = new TwosomeOrderHistory.Summary(
                "ORD-1", "CJENM커머스부문점", "30", "주문접수",
                LocalDateTime.now(), null, "10", "아메리칸노", null);
        TwosomeOrderHistory.Item item = new TwosomeOrderHistory.Item(
                "1", "A", "아메리칸노", null, 1, 5000, 5000, List.of());
        TwosomeOrderHistory.Detail detail = new TwosomeOrderHistory.Detail(
                summary, "907", null, "주문접수", List.of(), 5000, 0, 5000,
                Map.of(), null, null, null, List.of(item), true);
        when(externalOrderRepository.findByRepMemberIdAndOrdNo(42L, "ORD-1"))
                .thenReturn(Optional.empty());
        when(externalOrderRepository.save(org.mockito.ArgumentMatchers.any())).thenAnswer(invocation -> {
                        ExternalOrder order = invocation.getArgument(0);
                        order.setId(55L);
                        return order;
                });
        PaymentAttemptLocalOrder relation = new PaymentAttemptLocalOrder();
        relation.setAttemptId(1L);
        relation.setOrderId(100L);
        when(localOrderRepository.findByAttemptId(1L)).thenReturn(List.of(relation));
        when(orderRepository.findByExternalOrderId(55L)).thenReturn(List.of());
        Order localOrder = new Order();
        localOrder.setId(100L);
        localOrder.setDelYn("N");
        localOrder.setCartReflectedBy(42L);
        when(orderRepository.findById(100L)).thenReturn(Optional.of(localOrder));

        ExternalOrder linked = service.link(attempt, detail, snapshot, "after", 1);

        assertThat(linked.getId()).isEqualTo(55L);
        assertThat(localOrder.getExternalOrderId()).isEqualTo(55L);
        assertThat(localOrder.getExternalOrderNo()).isEqualTo("ORD-1");
        assertThat(localOrder.getExternalOrderStatus()).isEqualTo("30");
        assertThat(localOrder.getExternalOrderLinkedAt()).isNotNull();
        verify(orderRepository).saveAll(argThat(orders -> {
            java.util.Iterator<Order> iterator = orders.iterator();
            return iterator.hasNext() && iterator.next().getId().equals(100L) && !iterator.hasNext();
        }));
    }
}
