import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import HistoryPage from './HistoryPage';
import { orderAPI, teamAPI, repAPI } from '../services/api';

jest.mock('../services/api', () => ({
  orderAPI: { getByDate: jest.fn(), delete: jest.fn() },
  teamAPI: { getAll: jest.fn() },
  repAPI: { list: jest.fn(), repGetCart: jest.fn() },
}));

jest.mock('../context/DepartmentContext', () => ({
  useDepartment: () => ({ selectedDepartmentId: 7 }),
}));

jest.mock('../components/LiveCartPanel', () => {
  const React = require('react');
  return function MockLiveCartPanel() {
    return React.createElement('section', { id: 'live-cart-section' },
      React.createElement('h2', null, '실시간 장바구니'));
  };
});

const orders = [
  {
    id: 1, teamId: 10, teamName: '허규선', menuName: '아메리칸노', personalOption: '아이스 · 라지',
    twosomeMenuCode: 'A', twosomeMenuCategory: '커피', cartReflectedAt: null,
  },
  {
    id: 2, teamId: 10, teamName: '허규선', menuName: '카페라떼', personalOption: '핫 · 레귤러',
    twosomeMenuCode: 'B', twosomeMenuCategory: '커피', cartReflectedAt: '2026-11-10T10:00:00', cartReflectedBy: 2,
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  orderAPI.getByDate.mockResolvedValue(orders);
  teamAPI.getAll.mockResolvedValue([{ id: 10, name: '허규선' }, { id: 11, name: '미주문자' }]);
  repAPI.list.mockResolvedValue([{ id: 2, name: '박성훈' }]);
});

test('탭 없이 장바구니·개인별 주문·메뉴 집계를 함께 보여준다', async () => {
  render(<HistoryPage onOrderClick={jest.fn()} />);

  expect(await screen.findByRole('heading', { name: '개인별 주문 내역 (2건)' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '실시간 장바구니' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '메뉴·옵션별 주문 집계' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '허규선 · 2건' })).toBeInTheDocument();
  expect(screen.getByText('미주문 (1명)')).toBeInTheDocument();
  expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  expect(screen.getAllByRole('link')).toHaveLength(3);
});

test('날짜를 바꿔도 두 기록 영역이 유지되고 과거 주문은 취소할 수 없다', async () => {
  render(<HistoryPage onOrderClick={jest.fn()} />);
  expect(await screen.findByRole('heading', { name: '개인별 주문 내역 (2건)' })).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('날짜 선택'), { target: { value: '2026-11-01' } });

  await waitFor(() => expect(orderAPI.getByDate).toHaveBeenLastCalledWith('2026-11-01', 7));
  expect(screen.getByRole('heading', { name: '개인별 주문 내역 (2건)' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '메뉴·옵션별 주문 집계' })).toBeInTheDocument();
  const cancelButtons = await screen.findAllByRole('button', { name: '주문 취소' });
  expect(cancelButtons[0]).toBeDisabled();
});
