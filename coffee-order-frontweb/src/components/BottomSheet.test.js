import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import BottomSheet from './BottomSheet';

test('부서 선택 BottomSheet가 접근 가능한 dialog로 열리고 Escape로 닫힌다', () => {
  const onClose = jest.fn();
  render(
    <BottomSheet isOpen onClose={onClose} title="부서 선택">
      <button type="button">MSA TF</button>
    </BottomSheet>
  );

  expect(screen.getByRole('dialog', { name: '부서 선택' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'MSA TF' })).toBeInTheDocument();
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  expect(onClose).toHaveBeenCalledTimes(1);
});
