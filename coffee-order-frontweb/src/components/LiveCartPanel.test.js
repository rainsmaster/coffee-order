import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import LiveCartPanel from './LiveCartPanel';
import { orderAPI, repAPI, twosomeStoreAPI } from '../services/api';

jest.mock('./TwosomeOrderTracker', () => function MockTwosomeOrderTracker() {
  return null;
});

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
    fireEvent.click(screen.getByRole('combobox', { name: '장바구니 대표' }));
    expect(screen.getByRole('option', { name: /박주임/ })).toHaveAttribute('aria-disabled', 'true');
  });

  test('대표 전환 시 이전 장바구니 항목을 섞지 않는다', async () => {
    repAPI.repGetCart.mockImplementation((id) => Promise.resolve(id === 1 ? [{
      cartNo: 'c1', cartDtlNo: '1', menuCd: 'm1', menuNm: 'Americano', qty: 1, price: 4500,
    }] : []));
    render(<LiveCartPanel departmentId={1} onOrderClick={jest.fn()} />);
    expect(await screen.findByText('Americano')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('combobox', { name: '장바구니 대표' }));
    fireEvent.click(await screen.findByRole('option', { name: /김대리/ }));

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

  const reflectedOrders = [
    {
      id: 1, teamName: '홍길동', menuName: '아메리칸노', twosomeMenuCode: 'A', twosomeMenuMidCd: '01',
      variantMenuCd: 'VA', variantOpts: '010I', cstmInfo: null,
      cartReflectedAt: '2026-11-18T09:00:00', cartReflectedBy: 1,
    },
    {
      id: 2, teamName: '김대리', menuName: '카페라떼', twosomeMenuCode: 'B', twosomeMenuMidCd: '01',
      variantMenuCd: 'VB', variantOpts: '010H', cstmInfo: null,
      cartReflectedAt: '2026-11-18T09:00:00', cartReflectedBy: 1,
    },
  ];
  const activeReps = [{ id: 1, name: '홍길동', twosomeStatus: 'ACTIVE', statusReason: '사용 가능' }];

  test('실제 장바구니가 비어 있으면 반영 완료 주문을 다시 담을 수 있다', async () => {
    repAPI.repGetCart.mockResolvedValue([]);
    repAPI.repAddToCart.mockResolvedValue({ results: [
      { menuCd: 'A', success: true }, { menuCd: 'B', success: true },
    ] });
    orderAPI.markCartReflected.mockResolvedValue({ updatedCount: 2 });
    render(<LiveCartPanel
      departmentId={1} onOrderClick={jest.fn()} orders={reflectedOrders} reps={activeReps}
      onOrdersChange={jest.fn()} onSummaryChange={jest.fn()}
    />);

    const readdButton = await screen.findByRole('button', { name: '반영 완료 2건 다시 담기' });
    expect(readdButton).toBeEnabled();
    fireEvent.click(readdButton);
    expect(screen.getByText('결제가 완료된 주문이 아니라 장바구니를 비운 경우에만 다시 담아주세요.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '장바구니에 2건 다시 담기' }));

    await waitFor(() => expect(repAPI.repAddToCart).toHaveBeenCalledWith(1, [
      expect.objectContaining({ menuCd: 'A', variantMenuCd: 'VA', qty: 1 }),
      expect.objectContaining({ menuCd: 'B', variantMenuCd: 'VB', qty: 1 }),
    ]));
    expect(orderAPI.markCartReflected).toHaveBeenCalledWith([1, 2], 1);
  });

  test('재담기 확인 중 장바구니에 항목이 생기면 중복 담기를 중단한다', async () => {
    repAPI.repGetCart.mockResolvedValue([]).mockResolvedValueOnce([]).mockResolvedValueOnce([{
      cartNo: 'c1', cartDtlNo: '1', menuCd: 'A', menuNm: '아메리칸노', qty: 1, price: 4700,
    }]);
    render(<LiveCartPanel
      departmentId={1} onOrderClick={jest.fn()} orders={reflectedOrders} reps={activeReps}
      onOrdersChange={jest.fn()} onSummaryChange={jest.fn()}
    />);

    fireEvent.click(await screen.findByRole('button', { name: '반영 완료 2건 다시 담기' }));
    fireEvent.click(screen.getByRole('button', { name: '장바구니에 2건 다시 담기' }));

    expect(await screen.findByText('확인 사이에 장바구니에 항목이 추가되어 다시 담기를 중단했습니다. 현재 항목을 먼저 확인해주세요.')).toBeInTheDocument();
    expect(repAPI.repAddToCart).not.toHaveBeenCalled();
    expect(orderAPI.markCartReflected).not.toHaveBeenCalled();
  });

  test('실제 주문과 연결된 미취소 항목은 다시 담기 대상에서 제외한다', async () => {
    repAPI.repGetCart.mockResolvedValue([]);
    const paidOrders = reflectedOrders.map((order) => ({
      ...order, externalOrderId: 99, externalOrderNo: 'TPSO-ORDER', externalOrderStatus: '60',
    }));
    render(<LiveCartPanel
      departmentId={1} onOrderClick={jest.fn()} orders={paidOrders} reps={activeReps}
      onOrdersChange={jest.fn()} onSummaryChange={jest.fn()}
    />);

    expect(await screen.findByText(/실제 주문 연결 2건/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /반영 완료 .*다시 담기/ })).not.toBeInTheDocument();
  });

  test('같은 기본 메뉴가 섞여도 요청 순서의 성공 결과만 반영한다', async () => {
    repAPI.repGetCart.mockResolvedValue([]);
    repAPI.repAddToCart.mockResolvedValue({ results: [
      { menuCd: 'A', success: false }, { menuCd: 'A', success: true },
    ] });
    const sameMenuOrders = reflectedOrders.map((order) => ({ ...order, twosomeMenuCode: 'A' }));
    render(<LiveCartPanel
      departmentId={1} onOrderClick={jest.fn()} orders={sameMenuOrders} reps={activeReps}
      onOrdersChange={jest.fn()} onSummaryChange={jest.fn()}
    />);

    fireEvent.click(await screen.findByRole('button', { name: '반영 완료 2건 다시 담기' }));
    fireEvent.click(screen.getByRole('button', { name: '장바구니에 2건 다시 담기' }));

    await waitFor(() => expect(orderAPI.markCartReflected).toHaveBeenCalledWith([2], 1));
  });
});
