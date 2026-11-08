import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import RepSelectModal from './RepSelectModal';

describe('대표 선택 모달', () => {
  const reps = [
    { id: 1, name: '홍길동', twosomeStatus: 'ACTIVE', statusReason: '사용 가능' },
    { id: 2, name: '김대리', twosomeStatus: 'EXPIRED', statusReason: '세션 만료 · 다시 로그인 필요' },
  ];

  test('활성 대표만 선택하고 확정할 수 있다', () => {
    const onSelect = jest.fn();
    const onConfirm = jest.fn();
    render(<RepSelectModal isOpen reps={reps} selectedId={1} onSelect={onSelect} onConfirm={onConfirm} onCancel={jest.fn()} />);

    expect(screen.getByText('세션 만료 · 다시 로그인 필요').closest('button')).toBeDisabled();
    fireEvent.click(screen.getByText('홍길동').closest('button'));
    expect(onSelect).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByRole('button', { name: '선택한 대표 장바구니에 담기' }));
    expect(onConfirm).toHaveBeenCalledWith(reps[0]);
  });

  test('대표를 고르지 않으면 로컬 주문서만 유지할 수 있다', () => {
    const onCancel = jest.fn();
    render(<RepSelectModal isOpen reps={reps} selectedId={1} onSelect={jest.fn()} onConfirm={jest.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: '팀 주문서만 유지' }));
    expect(onCancel).toHaveBeenCalled();
  });
});
