import React from 'react';
import { Button } from '@astryxdesign/core/Button';
import { HStack } from '@astryxdesign/core/HStack';
import { RadioList, RadioListItem } from '@astryxdesign/core/RadioList';
import Modal from './Modal';

const RepSelectModal = ({ isOpen, reps, selectedId, onSelect, onConfirm, onCancel, loading = false }) => {
  const selected = reps.find((rep) => rep.id === Number(selectedId));
  return (
    <Modal isOpen={isOpen} onClose={onCancel} title="누구의 투썸플레이스 앱 장바구니에 담을까요?">
      <RadioList
        label="팀 대표"
        value={selected ? String(selected.id) : ''}
        onChange={(value) => onSelect(Number(value))}
      >
        {reps.map((rep) => (
          <RadioListItem
            key={rep.id}
            value={String(rep.id)}
            label={rep.name}
            description={rep.statusReason}
            isDisabled={rep.twosomeStatus !== 'ACTIVE'}
          />
        ))}
      </RadioList>
      <HStack gap={2} justify="end" wrap="wrap" width="100%">
        <Button label="팀 주문서만 유지" variant="secondary" onClick={onCancel} />
        <Button
          label="선택한 대표 장바구니에 담기"
          variant="primary"
          isDisabled={!selected || selected.twosomeStatus !== 'ACTIVE' || loading}
          isLoading={loading}
          onClick={() => onConfirm(selected)}
        />
      </HStack>
    </Modal>
  );
};

export default RepSelectModal;
