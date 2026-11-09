import React from 'react';
import { needsOptionConfirmation } from '../utils/reorderOptions';
import './ReorderModal.css';

const ReorderModal = ({
  isOpen,
  onClose,
  onConfirm,
  latestOrder,
  isLoading
}) => {
  if (!isOpen || !latestOrder) return null;
  const needsOptions = needsOptionConfirmation(latestOrder);

  const handleConfirm = () => {
    onConfirm();
  };

  const handleCancel = () => {
    onClose();
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // 주문 날짜 포맷팅
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}월 ${day}일`;
  };

  return (
    <div className="reorder-modal-overlay" onClick={handleBackdropClick}>
      <div className="reorder-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="reorder-modal-header">
          <h3>다시 주문하기</h3>
        </div>
        <div className="reorder-modal-body">
          <p className="reorder-message">
            {needsOptions
              ? '이전 주문에 일부 옵션 정보가 없습니다. 현재 메뉴에서 옵션을 확인한 후 주문해주세요.'
              : '아래 내용으로 주문하시겠습니까?'}
          </p>

          <div className="reorder-details">
            <div className="reorder-date">
              {formatDate(latestOrder.orderDate)} 주문 내역
            </div>
            <div className="reorder-menu">
              {latestOrder.menuName}
            </div>
            {latestOrder.personalOption && (
              <div className="reorder-option">
                {latestOrder.personalOption}
              </div>
            )}
          </div>
        </div>
        <div className="reorder-modal-footer">
          <button
            className="reorder-btn reorder-btn-cancel"
            onClick={handleCancel}
            disabled={isLoading}
          >
            취소
          </button>
          <button
            className="reorder-btn reorder-btn-confirm"
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading ? (needsOptions ? '옵션 불러오는 중...' : '주문 중...') : (needsOptions ? '옵션 확인' : '주문하기')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReorderModal;
