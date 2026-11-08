import React from 'react';
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
        <label className="form-label">변경할 기존 주문
          <select value={existingOrder?.id || ''} onChange={(e) => onSelectExisting(Number(e.target.value))}>
            {existingOrders.map((order) => <option key={order.id} value={order.id}>{order.menuName}{order.personalOption ? ` · ${order.personalOption}` : ''}</option>)}
          </select>
        </label>
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
      <div className="order-change-modal-footer">
        <button className="order-change-btn order-change-btn-cancel" onClick={onClose} disabled={loading}>취소</button>
        <button className="order-change-btn" onClick={() => onConfirm(existingOrder)} disabled={loading || !existingOrder}>메뉴 변경</button>
        <button className="order-change-btn order-change-btn-confirm" onClick={onAdd} disabled={loading}>{loading ? '처리 중...' : '메뉴 추가'}</button>
      </div>
    </Modal>
  );
};

export default OrderChangeModal;
