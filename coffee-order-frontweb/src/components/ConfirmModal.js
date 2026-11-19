import React from 'react';
import { AlertDialog } from '@astryxdesign/core/AlertDialog';

const ConfirmModal = ({ isOpen, onClose, onConfirm, message, title = '확인' }) => {
  const handleOpenChange = (nextOpen) => {
    if (!nextOpen) onClose();
  };

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <AlertDialog
      isOpen={isOpen}
      onOpenChange={handleOpenChange}
      title={title}
      description={message}
      actionLabel="확인"
      cancelLabel="취소"
      actionVariant="primary"
      onAction={handleConfirm}
    />
  );
};

export default ConfirmModal;
