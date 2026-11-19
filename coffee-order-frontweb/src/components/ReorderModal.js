import React from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { HStack } from '@astryxdesign/core/HStack';
import { Text } from '@astryxdesign/core/Text';
import { VStack } from '@astryxdesign/core/VStack';
import { needsOptionConfirmation } from '../utils/reorderOptions';
import Modal from './Modal';

const ReorderModal = ({ isOpen, onClose, onConfirm, latestOrder, isLoading }) => {
  if (!isOpen || !latestOrder) return null;
  const needsOptions = needsOptionConfirmation(latestOrder);
  const date = new Date(latestOrder.orderDate);
  const dateLabel = latestOrder.orderDate ? `${date.getMonth() + 1}월 ${date.getDate()}일` : '';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="다시 주문하기">
      <Text as="p">
        {needsOptions
          ? '이전 주문에 일부 옵션 정보가 없습니다. 현재 메뉴에서 옵션을 확인한 후 주문해주세요.'
          : '아래 내용으로 주문하시겠습니까?'}
      </Text>
      <Card padding={3}>
        <VStack gap={1}>
          <Text type="supporting">{dateLabel} 주문 내역</Text>
          <Text weight="semibold">{latestOrder.menuName}</Text>
          {latestOrder.personalOption && <Text type="supporting">{latestOrder.personalOption}</Text>}
        </VStack>
      </Card>
      <HStack gap={2} justify="end" width="100%">
        <Button label="취소" variant="secondary" onClick={onClose} isDisabled={isLoading} />
        <Button
          label={needsOptions ? '옵션 확인' : '주문하기'}
          variant="primary"
          onClick={onConfirm}
          isDisabled={isLoading}
          isLoading={isLoading}
        />
      </HStack>
    </Modal>
  );
};

export default ReorderModal;
