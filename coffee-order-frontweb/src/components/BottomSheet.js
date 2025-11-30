import React, { useEffect } from 'react';
import './BottomSheet.css';

const BottomSheet = ({ isOpen, onClose, title, children }) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="bottom-sheet-overlay" onClick={onClose}>
      <div
        className="bottom-sheet-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bottom-sheet-handle" />
        {title && <div className="bottom-sheet-title">{title}</div>}
        <div className="bottom-sheet-body">{children}</div>
      </div>
    </div>
  );
};

export default BottomSheet;