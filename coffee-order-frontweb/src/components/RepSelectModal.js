import React from 'react';
import Modal from './Modal';
import './RepSelectModal.css';

const RepSelectModal = ({ isOpen, reps, selectedId, onSelect, onConfirm, onCancel, loading = false }) => {
  const selected = reps.find((rep) => rep.id === Number(selectedId));
  return (
    <Modal isOpen={isOpen} onClose={onCancel} title="누구의 투썸플레이스 앱 장바구니에 담을까요?">
      <div className="rep-select-list">
        {reps.map((rep) => {
          const enabled = rep.twosomeStatus === 'ACTIVE';
          return (
            <button
              type="button"
              key={rep.id}
              className={`rep-select-item ${selected?.id === rep.id ? 'selected' : ''}`}
              disabled={!enabled}
              onClick={() => onSelect(rep.id)}
            >
              <span className="rep-select-name">{rep.name}</span>
              <span className={`rep-select-status ${enabled ? 'available' : 'unavailable'}`}>
                {rep.statusReason}
              </span>
            </button>
          );
        })}
      </div>
      <div className="rep-select-actions">
        <button type="button" className="btn-secondary" onClick={onCancel}>팀 주문서만 유지</button>
        <button
          type="button"
          className="btn-primary"
          disabled={!selected || selected.twosomeStatus !== 'ACTIVE' || loading}
          onClick={() => onConfirm(selected)}
        >
          {loading ? '담는 중...' : '선택한 대표 장바구니에 담기'}
        </button>
      </div>
    </Modal>
  );
};

export default RepSelectModal;
