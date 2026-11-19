import React from 'react';
import { Button } from '@astryxdesign/core/Button';
import { HStack } from '@astryxdesign/core/HStack';
import { RadioList, RadioListItem } from '@astryxdesign/core/RadioList';
import Modal from './Modal';
import './OrderChangeModal.css';

const OrderChangeModal = ({
  isOpen,
  onClose,
  onConfirm,
  onAdd,
  teamName,
  existingOrders = [],
  selectedExistingId,
  onSelectExisting,
  newOrder,
  loading = false,
}) => {
  const existingOrder = existingOrders.find((order) => order.id === Number(selectedExistingId)) || existingOrders[0];
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${teamName || ''} 주문 변경 또는 추가`}>
      <p className="order-change-message">메뉴를 변경하시겠습니까? 아니면 메뉴를 추가하시겠습니까?</p>
      {existingOrders.length > 1 && (
        <RadioList
          label="변경할 기존 주문"
          value={String(existingOrder?.id || '')}
          onChange={(value) => onSelectExisting(Number(value))}
        >
          {existingOrders.map((order) => (
            <RadioListItem
              key={order.id}
              value={String(order.id)}
              label={order.menuName}
              description={order.personalOption}
            />
          ))}
        </RadioList>
      )}
      <div className="order-comparison">
        <div className="order-box existing-order">
          <div className="order-box-label">기존 주문</div>
          <div className="order-box-menu">{existingOrder?.menuName}</div>
          {existingOrder?.personalOption && <div className="order-box-option">{existingOrder.personalOption}</div>}
        </div>
        <div className="order-arrow">↓</div>
        <div className="order-box new-order">
          <div className="order-box-label">새로 선택한 주문</div>
          <div className="order-box-menu">{newOrder?.menuName}</div>
          {newOrder?.option && <div className="order-box-option">{newOrder.option}</div>}
        </div>
      </div>
      <p className="order-change-add-guide">메뉴 추가를 선택하면 기존 주문을 그대로 두고 한 건 더 저장합니다.</p>
      <HStack gap={2} justify="end" wrap="wrap" width="100%">
        <Button label="취소" variant="secondary" onClick={onClose} isDisabled={loading} />
        <Button label="메뉴 변경" variant="secondary" onClick={() => onConfirm(existingOrder)} isDisabled={loading || !existingOrder} />
        <Button label="메뉴 추가" variant="primary" onClick={onAdd} isDisabled={loading} isLoading={loading} />
      </HStack>
    </Modal>
  );
};

export default OrderChangeModal;
