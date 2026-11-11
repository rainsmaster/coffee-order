import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import LiveCartPanel from './LiveCartPanel';
import { orderAPI, repAPI, twosomeStoreAPI } from '../services/api';

jest.mock('../services/api', () => ({
  orderAPI: { getToday: jest.fn(), markCartReflected: jest.fn() },
  repAPI: {
    list: jest.fn(), repGetCart: jest.fn(), repAddToCart: jest.fn(),
    repRemoveCartItem: jest.fn(), repAdjustCartItemQty: jest.fn(), repClearCart: jest.fn(),
  },
  twosomeStoreAPI: { getStoreInfo: jest.fn(), getCartCustomList: jest.fn() },
}));

describe('대표별 실시간 장바구니', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    orderAPI.getToday.mockResolvedValue([]);
    twosomeStoreAPI.getStoreInfo.mockResolvedValue({ ordTime: '00:00 ~ 23:59' });
    repAPI.list.mockResolvedValue([
      { id: 1, name: '홍길동', twosomeStatus: 'ACTIVE', statusReason: '사용 가능' },
      { id: 2, name: '김대리', twosomeStatus: 'ACTIVE', statusReason: '사용 가능' },
      { id: 3, name: '박주임', twosomeStatus: 'EXPIRED', statusReason: '세션 만료 · 다시 로그인 필요' },
    ]);
  });

  test('빈 장바구니의 대표 이름과 마지막 확인 시각을 표시한다', async () => {
    repAPI.repGetCart.mockResolvedValue([]);
    render(<LiveCartPanel departmentId={1} onOrderClick={jest.fn()} />);

    expect(await screen.findByText('현재는 홍길동의 장바구니가 비어 있습니다.')).toBeInTheDocument();
    expect(screen.getByText(/마지막 확인:/)).toBeInTheDocument();
    expect(repAPI.repGetCart).toHaveBeenCalledWith(1, { signal: undefined });
    expect(screen.getByRole('option', { name: /박주임/ })).toBeDisabled();
  });

  test('대표 전환 시 이전 장바구니 항목을 섞지 않는다', async () => {
    repAPI.repGetCart.mockImplementation((id) => Promise.resolve(id === 1 ? [{
      cartNo: 'c1', cartDtlNo: '1', menuCd: 'm1', menuNm: 'Americano', qty: 1, price: 4500,
    }] : []));
    render(<LiveCartPanel departmentId={1} onOrderClick={jest.fn()} />);
    expect(await screen.findByText('Americano')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('장바구니 대표'), { target: { value: '2' } });

    expect(await screen.findByText('현재는 김대리의 장바구니가 비어 있습니다.')).toBeInTheDocument();
    expect(screen.queryByText('Americano')).not.toBeInTheDocument();
    expect(repAPI.repGetCart).toHaveBeenCalledWith(2, { signal: undefined });
  });

  test('15초마다 현재 대표 장바구니를 다시 확인한다', async () => {
    jest.useFakeTimers();
    repAPI.repGetCart.mockResolvedValue([]);
    render(<LiveCartPanel departmentId={1} onOrderClick={jest.fn()} />);
    await act(async () => { await Promise.resolve(); });
    expect(repAPI.repGetCart).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(15000);
      await Promise.resolve();
    });

    await waitFor(() => expect(repAPI.repGetCart).toHaveBeenCalledTimes(2));
    jest.useRealTimers();
  });

  test('부모가 제공한 대표와 주문은 다시 조회하지 않고 장바구니 요약만 전달한다', async () => {
    const nextOrders = [{ id: 1, twosomeMenuCode: 'A', cartReflectedAt: null }];
    const reps = [{ id: 1, name: '홍길동', twosomeStatus: 'ACTIVE', statusReason: '사용 가능' }];
    repAPI.repGetCart.mockResolvedValue([{
      cartNo: 'c1', cartDtlNo: '1', menuCd: 'A', menuNm: '아메리칸노', qty: 2, price: 4700,
    }]);
    const onOrdersChange = jest.fn();
    const onSummaryChange = jest.fn();

    render(<LiveCartPanel
      departmentId={1}
      onOrderClick={jest.fn()}
      orders={nextOrders}
      reps={reps}
      onOrdersChange={onOrdersChange}
      onSummaryChange={onSummaryChange}
    />);

    await waitFor(() => expect(onSummaryChange).toHaveBeenCalledWith({ itemCount: 2, totalPrice: 9400 }));
    expect(orderAPI.getToday).not.toHaveBeenCalled();
    expect(repAPI.list).not.toHaveBeenCalled();
    expect(onOrdersChange).not.toHaveBeenCalled();
    expect(screen.getByText('미반영 1건', { exact: false })).toBeInTheDocument();
  });
});
