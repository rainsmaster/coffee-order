import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import OrderChangeModal from './OrderChangeModal';

const existingOrders = [
  { id: 10, menuName: '아메리칸호', personalOption: '아이스', teamId: 1 },
  { id: 11, menuName: '카페 라떼', personalOption: '핫', teamId: 1 },
];

test('여러 기존 주문 중 변경 대상을 고르거나 새 메뉴를 추가한다', () => {
  const onConfirm = jest.fn();
  const onAdd = jest.fn();
  const onSelectExisting = jest.fn();
  render(<OrderChangeModal isOpen onClose={jest.fn()} onConfirm={onConfirm} onAdd={onAdd}
    teamName="홍길동" existingOrders={existingOrders} selectedExistingId={10}
    onSelectExisting={onSelectExisting} newOrder={{ menuName: '바닐라 라떼', option: '아이스' }} />);

  expect(screen.getByText('메뉴를 변경하시겠습니까? 아니면 메뉴를 추가하시겠습니까?')).toBeInTheDocument();
  fireEvent.change(screen.getByRole('combobox'), { target: { value: '11' } });
  expect(onSelectExisting).toHaveBeenCalledWith(11);
  fireEvent.click(screen.getByRole('button', { name: '메뉴 변경' }));
  expect(onConfirm).toHaveBeenCalledWith(existingOrders[0]);
  fireEvent.click(screen.getByRole('button', { name: '메뉴 추가' }));
  expect(onAdd).toHaveBeenCalled();
});
