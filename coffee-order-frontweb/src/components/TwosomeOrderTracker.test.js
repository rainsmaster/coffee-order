import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import TwosomeOrderTracker from './TwosomeOrderTracker';
import { repAPI } from '../services/api';

jest.mock('../services/api', () => ({
  repAPI: {
    me: jest.fn(),
    getTwosomeOrders: jest.fn(),
    refreshTwosomeOrders: jest.fn(),
    resetTwosomeOrders: jest.fn(),
  },
}));

const selectedRep = { id: 1, name: '홍길동', twosomeStatus: 'ACTIVE' };

const order = (overrides = {}) => ({
  id: 9,
  ordNo: 'TPSO2026111200000001',
  simpleOrderNo: '907',
  storeNm: 'CJENM커머스부문점',
  statusCode: '30',
  statusName: '주문접수',
  currentStep: '주문접수',
  displayStatus: '준비중',
  steps: [
    { name: '결제완료', state: 'ENDED' },
    { name: '주문전송', state: 'ENDED' },
    { name: '주문접수', state: 'CURRENT' },
    { name: '준비완료', state: 'PENDING' },
    { name: '수령완료', state: 'PENDING' },
  ],
  orderedAt: '2026-11-12T09:40:44',
  pickupAt: null,
  totalOrderAmount: 5800,
  discountAmount: 0,
  finalPaymentAmount: 5800,
  paymentAmounts: { '총 주문금액': 5800, 할인: 0, '최종 결제금액': 5800, '신용/체크카드': 5800 },
  posSaleNo: null,
  receiptAvailable: false,
  paymentApproved: false,
  paymentApprovedAt: null,
  linkedAt: '2026-11-12T09:41:00',
  lastCheckedAt: '2026-11-12T09:41:00',
  items: [{
    ordDtlNo: '1', menuCd: '10101010', menuNm: '카페라떼', optionNm: '(핫 | 레귤러)', quantity: 1,
    displayUnitPrice: 5300, displayLineAmount: 5300,
    customOptions: [{ name: '샷 추가', grpCd: '10', typeAddCd: 'A', cstmAddCd: 'SHOT', quantity: 1 }],
  }],
  ...overrides,
});

const view = (overrides = {}) => ({
  status: 'WATCHING',
  message: null,
  refreshSkipped: false,
  checkedAt: '2026-11-12T09:41:00',
  observation: { id: 1, status: 'WATCHING', holdReason: null, snapshotVersion: 1 },
  orders: [order()],
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  localStorage.setItem('repToken', 'pin-token');
  repAPI.me.mockResolvedValue({ id: 1 });
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
});

afterEach(() => {
  jest.useRealTimers();
});

test('짧은 주문번호와 준비중 상태를 표시하고 진행 중에는 3초마다 갱신한다', async () => {
  jest.useFakeTimers();
  repAPI.refreshTwosomeOrders.mockResolvedValue(view());
  render(<TwosomeOrderTracker selectedRep={selectedRep} onNeedLogin={jest.fn()} />);

  expect(await screen.findByText('907')).toBeInTheDocument();
  expect(screen.getByText('준비중')).toBeInTheDocument();
  expect(screen.getByText('3초마다 자동 확인', { exact: false })).toBeInTheDocument();
  expect(repAPI.refreshTwosomeOrders).toHaveBeenCalledTimes(1);

  fireEvent.click(screen.getByRole('button', { name: '메뉴·결제 상세 보기' }));
  expect(screen.getByText('TPSO2026111200000001')).toBeInTheDocument();
  expect(screen.getByText(/샷 추가/)).toBeInTheDocument();

  await act(async () => {
    jest.advanceTimersByTime(3000);
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(repAPI.refreshTwosomeOrders).toHaveBeenCalledTimes(2);
});

test('수령완료와 취소완료만 있으면 자동 갱신을 멈춘다', async () => {
  jest.useFakeTimers();
  const completedSteps = ['결제완료', '주문전송', '주문접수', '준비완료', '수령완료']
    .map((name) => ({ name, state: name === '수령완료' ? 'CURRENT' : 'ENDED' }));
  repAPI.refreshTwosomeOrders.mockResolvedValue(view({
    status: 'UPDATED',
    observation: null,
    orders: [order({
      statusCode: '60', currentStep: '수령완료', displayStatus: '수령완료', steps: completedSteps,
    })],
  }));
  render(<TwosomeOrderTracker selectedRep={selectedRep} onNeedLogin={jest.fn()} />);

  expect(await screen.findAllByText('수령완료')).not.toHaveLength(0);
  expect(screen.getByText('진행 중인 주문이 없어 자동 확인 대기', { exact: false })).toBeInTheDocument();

  await act(async () => {
    jest.advanceTimersByTime(15000);
    await Promise.resolve();
  });
  expect(repAPI.refreshTwosomeOrders).toHaveBeenCalledTimes(1);
});

test('PIN 로그인이 없으면 외부 주문을 조회하지 않고 로그인으로 안내한다', async () => {
  localStorage.clear();
  render(<TwosomeOrderTracker selectedRep={selectedRep} onNeedLogin={jest.fn()} />);

  expect(await screen.findByText('홍길동 대표의 주문은 본인만 조회할 수 있습니다.')).toBeInTheDocument();
  expect(repAPI.me).not.toHaveBeenCalled();
  expect(repAPI.refreshTwosomeOrders).not.toHaveBeenCalled();
});

test('확인 불가 상태에서는 3초 대신 30초 후에 다시 확인한다', async () => {
  jest.useFakeTimers();
  repAPI.refreshTwosomeOrders.mockResolvedValue(view({
    status: 'CHECK_UNAVAILABLE',
    message: '일시적으로 확인할 수 없습니다.',
  }));
  render(<TwosomeOrderTracker selectedRep={selectedRep} onNeedLogin={jest.fn()} />);

  expect(await screen.findByText('일시적으로 확인할 수 없습니다.')).toBeInTheDocument();
  expect(screen.getByText('30초마다 자동 확인', { exact: false })).toBeInTheDocument();

  await act(async () => {
    jest.advanceTimersByTime(3000);
    await Promise.resolve();
  });
  expect(repAPI.refreshTwosomeOrders).toHaveBeenCalledTimes(1);

  await act(async () => {
    jest.advanceTimersByTime(27000);
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(repAPI.refreshTwosomeOrders).toHaveBeenCalledTimes(2);
});

test('외부 담기 신호가 오면 자동 갱신 대기 중에도 즉시 관찰 상태를 조회한다', async () => {
  repAPI.refreshTwosomeOrders.mockResolvedValue(view({ observation: null, orders: [] }));
  const { rerender } = render(<TwosomeOrderTracker selectedRep={selectedRep} onNeedLogin={jest.fn()} refreshNonce={0} />);
  await screen.findByText('자동 연결된 투썸 주문이 없습니다. 장바구니 반영 후 투썸 앱에서 결제해주세요.');
  expect(repAPI.refreshTwosomeOrders).toHaveBeenCalledTimes(1);

  rerender(<TwosomeOrderTracker selectedRep={selectedRep} onNeedLogin={jest.fn()} refreshNonce={1} />);
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(repAPI.refreshTwosomeOrders).toHaveBeenCalledTimes(2);
});

test('수령완료 후 영수증 승인 대기는 60초 간격으로 확인한다', async () => {
  jest.useFakeTimers();
  repAPI.refreshTwosomeOrders.mockResolvedValue(view({
    status: 'UPDATED', observation: null,
    orders: [order({ statusCode: '60', displayStatus: '수령완료', receiptAvailable: true, paymentApproved: false })],
  }));
  render(<TwosomeOrderTracker selectedRep={selectedRep} onNeedLogin={jest.fn()} />);

  expect(await screen.findByText('60초마다 자동 확인', { exact: false })).toBeInTheDocument();
  await act(async () => {
    jest.advanceTimersByTime(3000);
    await Promise.resolve();
  });
  expect(repAPI.refreshTwosomeOrders).toHaveBeenCalledTimes(1);
});

test('PIN 토큰이 만료되면 반복 조회를 멈추고 로그인 안내로 전환한다', async () => {
  repAPI.refreshTwosomeOrders.mockRejectedValue(new Error('AUTH_FAILED'));
  render(<TwosomeOrderTracker selectedRep={selectedRep} onNeedLogin={jest.fn()} />);

  expect(await screen.findByText('홍길동 대표의 주문은 본인만 조회할 수 있습니다.')).toBeInTheDocument();
  expect(localStorage.getItem('repToken')).toBeNull();
});

test('보류 상태를 현재 장바구니 기준으로 다시 관찰할 수 있다', async () => {
  repAPI.refreshTwosomeOrders.mockResolvedValue(view({
    observation: { id: 1, status: 'HOLD', holdReason: '후보가 여러 건입니다.', snapshotVersion: 2 },
  }));
  repAPI.resetTwosomeOrders.mockResolvedValue(view({ status: 'WATCHING' }));
  render(<TwosomeOrderTracker selectedRep={selectedRep} onNeedLogin={jest.fn()} />);

  fireEvent.click(await screen.findByRole('button', { name: '현재 장바구니로 다시 관찰' }));
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(repAPI.resetTwosomeOrders).toHaveBeenCalledTimes(1);
});
