import React, { useEffect, useState } from 'react';
import './BottomSheet.css';

const BottomSheet = ({ isOpen, onClose, title, children }) => {
  const [isClosing, setIsClosing] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsClosing(false);
      document.body.style.overflow = 'hidden';
    } else if (shouldRender) {
      setIsClosing(true);
      const timer = setTimeout(() => {
        setShouldRender(false);
        setIsClosing(false);
      }, 300); // 애니메이션 시간과 동일
      document.body.style.overflow = '';
      return () => clearTimeout(timer);
    }
  }, [isOpen, shouldRender]);

  useEffect(() => {
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  if (!shouldRender) return null;

  const handleClose = () => {
    onClose();
  };

  return (
    <div
      className={`bottom-sheet-overlay ${isClosing ? 'closing' : ''}`}
      onClick={handleClose}
    >
      <div
        className={`bottom-sheet-content ${isClosing ? 'closing' : ''}`}
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