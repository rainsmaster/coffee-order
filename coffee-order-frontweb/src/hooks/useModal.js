import { useState } from 'react';

const useModal = () => {
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ message: '', title: '알림' });
  const [confirmConfig, setConfirmConfig] = useState({ message: '', title: '확인', onConfirm: null });

  // Alert 모달 열기
  const showAlert = (message, title = '알림') => {
    setAlertConfig({ message, title });
    setIsAlertOpen(true);
  };

  // Alert 모달 닫기
  const closeAlert = () => {
    setIsAlertOpen(false);
  };

  // Confirm 모달 열기
  const showConfirm = (message, onConfirm, title = '확인') => {
    setConfirmConfig({ message, title, onConfirm });
    setIsConfirmOpen(true);
  };

  // Confirm 모달 닫기
  const closeConfirm = () => {
    setIsConfirmOpen(false);
  };

  return {
    // Alert
    isAlertOpen,
    alertConfig,
    showAlert,
    closeAlert,
    // Confirm
    isConfirmOpen,
    confirmConfig,
    showConfirm,
    closeConfirm,
  };
};

export default useModal;