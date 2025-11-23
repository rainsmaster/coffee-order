import React from 'react';
import './AlertModal.css';

const AlertModal = ({ isOpen, onClose, message, title = '알림' }) => {
  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="alert-modal-overlay" onClick={handleBackdropClick}>
      <div className="alert-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="alert-modal-header">
          <h3>{title}</h3>
        </div>
        <div className="alert-modal-body">
          <p>{message}</p>
        </div>
        <div className="alert-modal-footer">
          <button className="alert-modal-btn alert-modal-btn-confirm" onClick={onClose}>
            확인
          </button>
        </div>
      </div>
    </div>
  );
};

export default AlertModal;