import React from 'react';
import './OrderChangeModal.css';

const OrderChangeModal = ({
  isOpen,
  onClose,
  onConfirm,
  teamName,
  existingOrder,
  newOrder
}) => {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="order-change-modal-overlay" onClick={handleBackdropClick}>
      <div className="order-change-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="order-change-modal-header">
          <h3>주문 변경 확인</h3>
        </div>
        <div className="order-change-modal-body">
          <p className="order-change-message">
            <strong>{teamName}</strong>님은 이미 주문하셨습니다.<br />
            메뉴를 변경하시겠습니까?
          </p>

          <div className="order-comparison">
            <div className="order-box existing-order">
              <div className="order-box-label">기존 주문</div>
              <div className="order-box-menu">{existingOrder?.menuName}</div>
              {existingOrder?.option && (
                <div className="order-box-option">{existingOrder.option}</div>
              )}
            </div>

            <div className="order-arrow">↓</div>

            <div className="order-box new-order">
              <div className="order-box-label">변경 주문</div>
              <div className="order-box-menu">{newOrder?.menuName}</div>
              {newOrder?.option && (
                <div className="order-box-option">{newOrder.option}</div>
              )}
            </div>
          </div>
        </div>
        <div className="order-change-modal-footer">
          <button className="order-change-btn order-change-btn-cancel" onClick={handleCancel}>
            취소
          </button>
          <button className="order-change-btn order-change-btn-confirm" onClick={handleConfirm}>
            변경하기
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrderChangeModal;
