import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import OrderPage from './OrderPage';
import { orderAPI, repAPI, teamAPI, twosomeMenuAPI, twosomeStoreAPI } from '../services/api';

jest.mock('../context/DepartmentContext', () => ({
  useDepartment: () => ({ selectedDepartmentId: 1 }),
}));

jest.mock('../services/api', () => ({
  teamAPI: { getAll: jest.fn() },
  orderAPI: {
    getToday: jest.fn(),
    getLatestByTeam: jest.fn(),
    create: jest.fn(),
    markCartReflected: jest.fn(),
  },
  twosomeMenuAPI: { getAll: jest.fn() },
  twosomeStoreAPI: {
    getStoreInfo: jest.fn(),
    getMenuOptions: jest.fn(),
    getAvailableOptions: jest.fn(),
    resolveVariant: jest.fn(),
    getMenuCustomOptions: jest.fn(),
  },
  repAPI: {
    list: jest.fn(),
    me: jest.fn(),
    twosomeSession: jest.fn(),
    repAddToCart: jest.fn(),
  },
}));

const menu = {
  id: 11,
  menuCd: '10191489',
  menuNm: '디카페인 콜드브루',
  midCd: '10',
  salesPsblQty: 10,
};

const options = {
  menuCd: '10191489',
  parsed: true,
  groups: [
    {
      grpCd: '011', grpNm: '온도', required: false,
      options: [{ opts: '011I', optNm: '아이스', defaultOpt: true }],
    },
    {
      grpCd: '020', grpNm: '사이즈', required: false,
      options: [
        { opts: '020R', optNm: '레귤러', defaultOpt: true },
        { opts: '020L', optNm: '라지', defaultOpt: false },
      ],
    },
    {
      grpCd: '042', grpNm: '원두', required: false,
      options: [{ opts: '042D', optNm: '디카페인', defaultOpt: true }],
    },
    {
      grpCd: '051', grpNm: '컵 선택', required: true,
      options: [
        { opts: '051T', optNm: '일회용컵', defaultOpt: false },
        { opts: '051E', optNm: '머그컵', defaultOpt: false },
      ],
    },
  ],
};

const legacyOrder = {
  id: 1100,
  teamId: 128,
  teamName: '박성훈',
  menuName: '디카페인 콜드브루',
  twosomeMenuId: 11,
  twosomeMenuCode: '10191489',
  menuType: 'TWOSOME',
  personalOption: '아이스/라지',
  orderDate: '2026-11-04',
  variantMenuCd: null,
  variantOpts: null,
};

const openLegacyReorder = async () => {
  render(<OrderPage />);
  fireEvent.change(await screen.findByRole('combobox'), { target: { value: '128' } });
  fireEvent.click(await screen.findByRole('button', { name: '다시 주문' }));
  expect(screen.getByText('이전 주문에 일부 옵션 정보가 없습니다. 현재 메뉴에서 옵션을 확인한 후 주문해주세요.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '옵션 확인' }));
};

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  teamAPI.getAll.mockResolvedValue([{ id: 128, name: '박성훈' }]);
  twosomeMenuAPI.getAll.mockResolvedValue({ 커피: [menu] });
  orderAPI.getToday.mockResolvedValue([]);
  orderAPI.getLatestByTeam.mockResolvedValue(legacyOrder);
  orderAPI.create.mockImplementation(async (order) => ({
    ...order,
    id: 999,
    menuType: 'TWOSOME',
    twosomeMenuCode: '10191489',
  }));
  orderAPI.markCartReflected.mockResolvedValue(null);
  twosomeStoreAPI.getStoreInfo.mockResolvedValue({ ordTime: '00:00 ~ 23:59' });
  twosomeStoreAPI.getMenuOptions.mockResolvedValue(options);
  twosomeStoreAPI.getAvailableOptions.mockResolvedValue([]);
  twosomeStoreAPI.resolveVariant.mockResolvedValue({
    variantMenuCd: '10191496', variantMenuNm: '디카페인 콜드브루 라지', price: 5300,
  });
  twosomeStoreAPI.getMenuCustomOptions.mockResolvedValue({ hasCustom: false, qtyItems: [], choiceGroups: [] });
  repAPI.list.mockResolvedValue([{ id: 3, name: '박성훈', twosomeStatus: 'ACTIVE' }]);
  repAPI.repAddToCart.mockResolvedValue({
    success: 1,
    failed: 0,
    results: [{ menuCd: '10191489', menuNm: '디카페인 콜드브루', success: true, message: '담기 완료' }],
  });
});

test('옵션 코드가 없는 과거 주문은 바로 저장하지 않고 복원된 옵션 확인 후 장바구니에 담는다', async () => {
  await openLegacyReorder();

  expect(await screen.findByText(/이전 주문에 저장되지 않은 옵션이 있어/)).toBeInTheDocument();
  expect(twosomeStoreAPI.getMenuOptions).toHaveBeenCalledWith('10191489', '10');
  expect(orderAPI.create).not.toHaveBeenCalled();
  expect(repAPI.repAddToCart).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: '아이스' })).toHaveClass('selected');
  expect(screen.getByRole('button', { name: '라지' })).toHaveClass('selected');
  expect(screen.getByRole('button', { name: '레귤러' })).not.toHaveClass('selected');
  expect(screen.getByRole('button', { name: '일회용컵' })).not.toHaveClass('selected');

  fireEvent.click(screen.getByRole('button', { name: '확인' }));
  fireEvent.click(screen.getByRole('button', { name: '일회용컵' }));
  await waitFor(() => expect(twosomeStoreAPI.resolveVariant).toHaveBeenCalledWith(
    '10191489', ['011I', '020L', '042D', '051T']));

  fireEvent.click(await screen.findByRole('button', { name: '투썸 장바구니 담기 (박성훈 계정)' }));

  expect(await screen.findByText(/실제 투썸 장바구니 반영: 성공 1건/)).toBeInTheDocument();
  expect(orderAPI.create).toHaveBeenCalledWith(expect.objectContaining({
    teamId: 128,
    variantMenuCd: '10191496',
    variantOpts: '011I,020L,042D,051T',
    personalOption: '아이스 | 라지 | 디카페인 | 일회용컵',
  }));
  expect(repAPI.repAddToCart).toHaveBeenCalledWith(3, [expect.objectContaining({
    menuCd: '10191489',
    midCd: '10',
    variantMenuCd: '10191496',
    opts: ['011I', '020L', '042D', '051T'],
  })]);
  expect(orderAPI.markCartReflected).toHaveBeenCalledWith([999], 3);
});

test('과거 주문의 옵션 조회에 실패하면 주문서나 장바구니에 저장하지 않는다', async () => {
  twosomeStoreAPI.getMenuOptions.mockResolvedValue(null);

  await openLegacyReorder();

  expect(await screen.findByText('이전 주문의 옵션을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.')).toBeInTheDocument();
  expect(orderAPI.create).not.toHaveBeenCalled();
  expect(repAPI.repAddToCart).not.toHaveBeenCalled();
});

test('체크한 퍼스널 옵션의 기본값과 코드가 주문서와 장바구니에 전달된다', async () => {
  const drizzleChoices = ['많이', '보통', '적게'].map((label, index) => ({
    choiceKey: `9004-10-${(index + 1) * 10}`,
    label: `드리즐${label}`,
    price: 800,
    chgYn: 'N',
    deposit: 0,
    grpCd: '9004',
    typeAddCd: '10',
    cstmAddCd: '10',
    typeChgCd: '20',
    cstmChgCd: `${(index + 1) * 10}`,
  }));
  const caramel = {
    groupKey: '9004-10',
    name: '카라멜드리즐',
    toggleable: true,
    defaultChoiceKey: '9004-10-20',
    displayPrice: 800,
    choices: drizzleChoices,
  };
  twosomeStoreAPI.getMenuCustomOptions.mockResolvedValue({
    menuCd: '10191496',
    hasCustom: true,
    qtyItems: [],
    choiceGroups: [caramel],
    categories: [{ categoryKey: '9004', categoryName: '드리즐', qtyItems: [], choiceGroups: [caramel] }],
  });

  render(<OrderPage />);
  fireEvent.change(await screen.findByRole('combobox'), { target: { value: '128' } });
  await screen.findByText('최근 주문');
  fireEvent.change(screen.getByPlaceholderText(/메뉴 검색/), {
    target: { value: '디카페인' },
  });
  fireEvent.click(await screen.findByRole('button', { name: /디카페인 콜드브루/ }));
  fireEvent.click(await screen.findByRole('button', { name: '일회용컵' }));
  fireEvent.click(await screen.findByRole('button', { name: /퍼스널 옵션 \(선택\)/ }));
  fireEvent.click(screen.getByRole('button', { name: '드리즐' }));
  fireEvent.click(screen.getByRole('checkbox', { name: '카라멜드리즐' }));

  expect(screen.getByRole('radio', { name: '드리즐보통' })).toBeChecked();
  expect(screen.getByText(/예상 가격:/)).toHaveTextContent('예상 가격: 6,100원');
  const summary = screen.getByLabelText('주문 요약');
  expect(summary).toHaveTextContent('디카페인 콜드브루');
  expect(summary).toHaveTextContent('6,100원');
  expect(summary).toHaveTextContent('박성훈 대표의 투썸 장바구니');
  fireEvent.click(screen.getByRole('button', { name: '초기화' }));
  expect(screen.queryByRole('radio', { name: '드리즐보통' })).not.toBeInTheDocument();
  expect(screen.getByRole('checkbox', { name: '카라멜드리즐' })).not.toBeChecked();
  expect(screen.getByRole('button', { name: '초기화' })).toBeDisabled();
  expect(screen.getByText(/예상 가격:/)).toHaveTextContent('예상 가격: 5,300원');
  expect(summary).toHaveTextContent('5,300원');
  expect(summary).not.toHaveTextContent('드리즐보통');

  fireEvent.click(screen.getByRole('checkbox', { name: '카라멜드리즐' }));
  expect(screen.getByRole('radio', { name: '드리즐보통' })).toBeChecked();
  expect(screen.getByText(/예상 가격:/)).toHaveTextContent('예상 가격: 6,100원');
  fireEvent.click(screen.getByRole('button', { name: '투썸 장바구니 담기 (박성훈 계정)' }));

  expect(await screen.findByText(/실제 투썸 장바구니 반영: 성공 1건/)).toBeInTheDocument();
  const createdOrder = orderAPI.create.mock.calls[0][0];
  expect(JSON.parse(createdOrder.cstmInfo)).toEqual([expect.objectContaining({
    MENU_CD: '10191496',
    CSTM_GRP_CD: '9004',
    TYPE_ADD_CD: '10',
    CSTM_ADD_CD: '10',
    TYPE_CHG_CD: '20',
    CSTM_CHG_CD: '20',
    CSTM_ORD_CNT: 1,
    CSTM_ORD_AMT: 800,
  })]);
  expect(createdOrder.personalOption).toContain('카라멜드리즐 드리즐보통');
  const cartItems = repAPI.repAddToCart.mock.calls[0][1];
  expect(cartItems[0].cstmInfo).toHaveLength(1);
  expect(cartItems[0].cstmInfo[0]).toEqual(expect.objectContaining({
    CSTM_CHG_CD: '20',
    CSTM_ORD_CNT: 1,
    CSTM_ORD_AMT: 800,
  }));
});

test('퍼스널 옵션 로딩과 빈 상태가 주문 버튼 앞의 같은 영역에 표시된다', async () => {
  let resolveCustom;
  twosomeStoreAPI.getMenuCustomOptions.mockReturnValue(new Promise((resolve) => {
    resolveCustom = resolve;
  }));

  render(<OrderPage />);
  fireEvent.change(await screen.findByRole('combobox'), { target: { value: '128' } });
  await screen.findByText('최근 주문');
  fireEvent.change(screen.getByPlaceholderText(/메뉴 검색/), { target: { value: '디카페인' } });
  fireEvent.click(await screen.findByRole('button', { name: /디카페인 콜드브루/ }));
  fireEvent.click(await screen.findByRole('button', { name: '일회용컵' }));

  const loading = await screen.findByText('퍼스널 옵션을 불러오는 중…');
  const statusArea = loading.closest('.custom-accordion');
  const orderButton = screen.getByRole('button', { name: '투썸 장바구니 담기 (박성훈 계정)' });
  expect(orderButton.previousElementSibling).toBe(statusArea);

  resolveCustom({ menuCd: '10191496', hasCustom: false, qtyItems: [], choiceGroups: [], categories: [] });

  const empty = await screen.findByText('퍼스널 옵션 없음');
  expect(empty.closest('.custom-accordion')).toBe(statusArea);
  expect(orderButton.previousElementSibling).toBe(statusArea);
});

test('퍼스널 옵션 조회 실패 후 재시도하면 정상 옵션으로 전환된다', async () => {
  twosomeStoreAPI.getMenuCustomOptions
    .mockRejectedValueOnce(new Error('일시적 네트워크 오류'))
    .mockResolvedValueOnce({ menuCd: '10191496', hasCustom: true, qtyItems: [], choiceGroups: [], categories: [] });

  render(<OrderPage />);
  fireEvent.change(await screen.findByRole('combobox'), { target: { value: '128' } });
  await screen.findByText('최근 주문');
  fireEvent.change(screen.getByPlaceholderText(/메뉴 검색/), { target: { value: '디카페인' } });
  fireEvent.click(await screen.findByRole('button', { name: /디카페인 콜드브루/ }));
  fireEvent.click(await screen.findByRole('button', { name: '일회용컵' }));

  expect(await screen.findByText('퍼스널 옵션을 불러오지 못했습니다.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));

  expect(await screen.findByRole('button', { name: /퍼스널 옵션 \(선택\)/ })).toBeInTheDocument();
  expect(twosomeStoreAPI.getMenuCustomOptions).toHaveBeenCalledTimes(2);
});

const openNoOptionMenu = async (item) => {
  twosomeMenuAPI.getAll.mockResolvedValue({ 음료: [item] });
  twosomeStoreAPI.getMenuOptions.mockResolvedValue({ menuCd: item.menuCd, parsed: true, groups: [] });
  render(<OrderPage />);
  fireEvent.click(await screen.findByRole('button', { name: '음료 (1)' }));
  fireEvent.click(await screen.findByRole('button', { name: new RegExp(item.menuNm) }));
};

test.each([
  { saleAmt: 4000, defaultMenuCd: null, expectedPrice: '4,000원', expectedCode: 'BASE-MENU' },
  { saleAmt: 5800, defaultMenuCd: 'DEFAULT-VARIANT', expectedPrice: '5,800원', expectedCode: 'DEFAULT-VARIANT' },
])('옵션이 없는 메뉴는 매장 가격과 기본 코드를 즉시 사용한다', async ({ saleAmt, defaultMenuCd, expectedPrice, expectedCode }) => {
  await openNoOptionMenu({
    id: 90, menuCd: 'BASE-MENU', menuNm: '기본 음료', midCd: '02', saleAmt, defaultMenuCd, salesPsblQty: -1,
  });

  await waitFor(() => expect(screen.getByLabelText('주문 요약')).toHaveTextContent(expectedPrice));
  expect(twosomeStoreAPI.resolveVariant).not.toHaveBeenCalled();
  expect(twosomeStoreAPI.getMenuCustomOptions).toHaveBeenCalledWith(expectedCode);
});

test('가격을 확인할 수 없는 메뉴는 대기 대신 가격 정보 없음으로 표시한다', async () => {
  twosomeStoreAPI.resolveVariant.mockRejectedValue(new Error('가격 조회 실패'));
  await openNoOptionMenu({
    id: 91, menuCd: 'UNKNOWN-PRICE', menuNm: '가격 미확인 음료', midCd: '02', saleAmt: null,
    defaultMenuCd: 'DEFAULT-VARIANT', salesPsblQty: -1,
  });

  await waitFor(() => expect(screen.getByLabelText('주문 요약')).toHaveTextContent('가격 정보 없음'));
  expect(screen.queryByText('가격 확인 중…')).not.toBeInTheDocument();
});
