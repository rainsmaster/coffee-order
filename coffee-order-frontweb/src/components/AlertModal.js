import React from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { HStack } from '@astryxdesign/core/HStack';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/VStack';

const AlertModal = ({ isOpen, onClose, message, title = '알림' }) => {
  const handleOpenChange = (nextOpen) => {
    if (!nextOpen) onClose();
  };

  return (
    <Dialog isOpen={isOpen} onOpenChange={handleOpenChange} width={400} purpose="info">
      <DialogHeader title={title} />
      <VStack gap={4} width="100%">
        <Text as="p" style={{ whiteSpace: 'pre-wrap' }}>{message}</Text>
        <HStack justify="end" width="100%">
          <Button label="확인" variant="primary" onClick={onClose} />
        </HStack>
      </VStack>
    </Dialog>
  );
};

export default AlertModal;
