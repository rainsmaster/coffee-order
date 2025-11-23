import React from 'react';
import './ConfirmModal.css';

const ConfirmModal = ({ isOpen, onClose, onConfirm, message, title = '확인' }) => {
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
    <div className="confirm-modal-overlay" onClick={handleBackdropClick}>
      <div className="confirm-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-modal-header">
          <h3>{title}</h3>
        </div>
        <div className="confirm-modal-body">
          <p>{message}</p>
        </div>
        <div className="confirm-modal-footer">
          <button className="confirm-modal-btn confirm-modal-btn-cancel" onClick={handleCancel}>
            취소
          </button>
          <button className="confirm-modal-btn confirm-modal-btn-confirm" onClick={handleConfirm}>
            확인
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;