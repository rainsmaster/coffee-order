import React from 'react';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { VStack } from '@astryxdesign/core/VStack';

const Modal = ({ isOpen, onClose, title, children }) => {
  const handleOpenChange = (nextOpen) => {
    if (!nextOpen) onClose();
  };

  return (
    <Dialog isOpen={isOpen} onOpenChange={handleOpenChange} width={500} purpose="info">
      <DialogHeader title={title} onOpenChange={handleOpenChange} />
      <VStack gap={3} width="100%">
        {children}
      </VStack>
    </Dialog>
  );
};

export default Modal;
