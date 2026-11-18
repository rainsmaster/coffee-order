package com.example.coffeeorder.service;

import com.example.coffeeorder.dto.TwosomeOrderHistory;
import com.example.coffeeorder.entity.*;
import com.example.coffeeorder.repository.*;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class TwosomePaymentOrderPersistenceService {

    private final PaymentAttemptRepository attemptRepository;
    private final CartSnapshotRepository snapshotRepository;
    private final ExternalOrderRepository externalOrderRepository;
    private final ExternalOrderItemRepository itemRepository;
    private final PaymentAttemptOrderRepository attemptOrderRepository;
    private final PaymentAttemptLocalOrderRepository attemptLocalOrderRepository;
    private final OrderRepository orderRepository;
    private final ObjectMapper objectMapper;

    @Transactional
    public void registerLocalOrders(PaymentAttempt attempt, List<Long> orderIds) {
        if (orderIds == null || orderIds.isEmpty()) {
            return;
        }
        java.util.Set<Long> existing = attemptLocalOrderRepository.findByAttemptId(attempt.getId())
                .stream().map(PaymentAttemptLocalOrder::getOrderId)
                .collect(java.util.stream.Collectors.toSet());
        for (Long orderId : new java.util.LinkedHashSet<>(orderIds)) {
            if (orderId == null || existing.contains(orderId)) {
                continue;
            }
            PaymentAttemptLocalOrder localOrder = new PaymentAttemptLocalOrder();
            localOrder.setAttemptId(attempt.getId());
            localOrder.setOrderId(orderId);
            attemptLocalOrderRepository.save(localOrder);
        }
    }

    @Transactional
    public CartSnapshot captureBaseline(PaymentAttempt attempt, List<String> baselineOrderNos,
                                        String rawHash, String itemsHash, String itemsJson) {
        attempt.setBaselineOrderNosJson(write(baselineOrderNos));
        attempt.setBaselineCaptured(true);
        attempt.setStatus("WATCHING");
        attemptRepository.save(attempt);
        return saveSnapshot(attempt, 1, rawHash, itemsHash, itemsJson);
    }

    @Transactional
    public CartSnapshot appendSnapshot(PaymentAttempt attempt, int version,
                                       String rawHash, String itemsHash, String itemsJson) {
        attempt.setStatus("WATCHING");
        attempt.setHoldReason(null);
        attemptRepository.save(attempt);
        return saveSnapshot(attempt, version, rawHash, itemsHash, itemsJson);
    }

    @Transactional
    public void hold(PaymentAttempt attempt, String reason) {
        attempt.setStatus("HOLD");
        attempt.setHoldReason(reason);
        attemptRepository.save(attempt);
    }

    @Transactional
    public void expire(PaymentAttempt attempt, String reason) {
        attempt.setStatus("EXPIRED");
        attempt.setActiveKey(null);
        attempt.setHoldReason(reason);
        attemptRepository.save(attempt);
    }

    @Transactional
    public ExternalOrder link(PaymentAttempt attempt, TwosomeOrderHistory.Detail detail,
                              CartSnapshot before, String afterHash, int candidateCount) {
        LocalDateTime now = LocalDateTime.now();
        ExternalOrder externalOrder = saveDetailInternal(attempt.getRepMemberId(), detail, now);

        PaymentAttemptOrder link = new PaymentAttemptOrder();
        link.setAttemptId(attempt.getId());
        link.setExternalOrderId(externalOrder.getId());
        link.setOrdNo(externalOrder.getOrdNo());
        link.setSnapshotVersion(before.getVersion());
        link.setBeforeHash(before.getItemsHash());
        link.setAfterHash(afterHash);
        link.setCandidateCount(candidateCount);
        link.setRuleVersion("CART_ORDER_DELTA_V2");
        link.setLinkedAt(now);
        attemptOrderRepository.save(link);

        externalOrder.setLinkedAt(now);
        externalOrderRepository.save(externalOrder);
        attempt.setStatus("LINKED");
        attempt.setHoldReason(null);
        attempt.setLinkedAt(now);
        attempt.setActiveKey(null);
        attemptRepository.save(attempt);
        synchronizeLocalOrders(attempt, externalOrder, now);
        return externalOrder;
    }

    @Transactional
    public ExternalOrder saveDetail(Long repMemberId, TwosomeOrderHistory.Detail detail) {
        ExternalOrder saved = saveDetailInternal(repMemberId, detail, LocalDateTime.now());
        synchronizeLocalOrders(null, saved, saved.getLinkedAt());
        return saved;
    }

    @Transactional
    public ExternalOrder saveReceipt(ExternalOrder order, TwosomeOrderHistory.Receipt receipt) {
        order.setPaymentApprovalNo(receipt.approvalNo());
        order.setPaymentApprovedAt(receipt.approvedAt());
        order.setLastCheckedAt(LocalDateTime.now());
        return externalOrderRepository.save(order);
    }

    private ExternalOrder saveDetailInternal(Long repMemberId, TwosomeOrderHistory.Detail detail,
                                             LocalDateTime checkedAt) {
        TwosomeOrderHistory.Summary summary = detail.summary();
        ExternalOrder order = externalOrderRepository.findByRepMemberIdAndOrdNo(repMemberId, summary.ordNo())
                .orElseGet(ExternalOrder::new);
        order.setRepMemberId(repMemberId);
        order.setOrdNo(summary.ordNo());
        order.setSimpleOrderNo(detail.simpleOrderNo());
        order.setStoreCd("1102115");
        order.setStoreNm(summary.storeNm());
        order.setStatusCode(summary.statusCode());
        order.setStatusName(summary.statusName());
        order.setCurrentStep(detail.currentStep());
        order.setStepsJson(write(detail.steps()));
        order.setOrderedAt(summary.orderedAt());
        order.setPickupAt(summary.pickupAt());
        order.setTotalOrderAmount(detail.totalOrderAmount());
        order.setDiscountAmount(detail.discountAmount());
        order.setFinalPaymentAmount(detail.finalPaymentAmount());
        order.setPaymentAmountsJson(write(detail.paymentAmounts()));
        order.setPosSaleNo(detail.posSaleNo());
        order.setReceiptNo(detail.receiptNo());
        order.setMessage(detail.message());
        order.setLastCheckedAt(checkedAt);
        ExternalOrder savedOrder = externalOrderRepository.save(order);

        itemRepository.deleteByExternalOrderId(savedOrder.getId());
        itemRepository.flush();
        List<ExternalOrderItem> items = detail.items().stream().map(item -> {
            ExternalOrderItem entity = new ExternalOrderItem();
            entity.setExternalOrderId(savedOrder.getId());
            entity.setOrdDtlNo(item.ordDtlNo());
            entity.setMenuCd(item.menuCd());
            entity.setMenuNm(item.menuNm());
            entity.setOptionNm(item.optionNm());
            entity.setQuantity(item.quantity());
            entity.setDisplayUnitPrice(item.displayUnitPrice());
            entity.setDisplayLineAmount(item.displayLineAmount());
            entity.setCustomOptionsJson(write(item.customOptions()));
            return entity;
        }).toList();
        itemRepository.saveAll(items);
        return savedOrder;
    }

    private void synchronizeLocalOrders(PaymentAttempt attempt, ExternalOrder externalOrder,
                                        LocalDateTime linkedAt) {
        List<Order> localOrders = new java.util.ArrayList<>(orderRepository
                .findByExternalOrderId(externalOrder.getId()));
        if (attempt != null) {
            for (PaymentAttemptLocalOrder relation : attemptLocalOrderRepository
                    .findByAttemptId(attempt.getId())) {
                Order localOrder = orderRepository.findById(relation.getOrderId()).orElse(null);
                if (localOrder == null || !"N".equals(localOrder.getDelYn())
                        || !java.util.Objects.equals(localOrder.getCartReflectedBy(), attempt.getRepMemberId())) {
                    continue;
                }
                if (localOrder.getExternalOrderId() != null
                        && !localOrder.getExternalOrderId().equals(externalOrder.getId())
                        && !"80".equals(localOrder.getExternalOrderStatus())) {
                    continue;
                }
                if (!localOrders.contains(localOrder)) {
                    localOrders.add(localOrder);
                }
            }
        }
        for (Order localOrder : localOrders) {
            localOrder.setExternalOrderId(externalOrder.getId());
            localOrder.setExternalOrderNo(externalOrder.getOrdNo());
            localOrder.setExternalOrderStatus(externalOrder.getStatusCode());
            localOrder.setExternalOrderLinkedAt(linkedAt);
        }
        orderRepository.saveAll(localOrders);
    }

    private CartSnapshot saveSnapshot(PaymentAttempt attempt, int version,
                                      String rawHash, String itemsHash, String itemsJson) {
        CartSnapshot snapshot = new CartSnapshot();
        snapshot.setAttemptId(attempt.getId());
        snapshot.setVersion(version);
        snapshot.setRawHash(rawHash);
        snapshot.setItemsHash(itemsHash);
        snapshot.setItemsJson(itemsJson);
        CartSnapshot saved = snapshotRepository.save(snapshot);
        if (version > 50) {
            snapshotRepository.deleteByAttemptIdAndVersionLessThan(attempt.getId(), version - 49);
        }
        return saved;
    }

    private String write(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("결제 관찰 데이터를 저장하지 못했습니다.", e);
        }
    }
}
