import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import CustomOptionsPanel from './CustomOptionsPanel';

const choices = (groupKey, prefix, price = 800) => [
  { choiceKey: `${groupKey}-10`, label: `${prefix}많이`, price },
  { choiceKey: `${groupKey}-20`, label: `${prefix}보통`, price },
  { choiceKey: `${groupKey}-30`, label: `${prefix}적게`, price },
];

const caramel = {
  groupKey: '9004-10', name: '카라멜드리즐', toggleable: true,
  defaultChoiceKey: '9004-10-20', displayPrice: 800, choices: choices('9004-10', '드리즐'),
};
const chocolate = {
  groupKey: '9004-20', name: '초콜릿드리즐', toggleable: true,
  defaultChoiceKey: '9004-20-20', displayPrice: 800, choices: choices('9004-20', '드리즐'),
};
const milk = {
  groupKey: '3004-00', name: '기본(조정만)', toggleable: true, exclusiveGroupKey: '3004',
  defaultChoiceKey: '3004-00-20', displayPrice: 0, choices: choices('3004-00', '', 0),
};
const oat = {
  groupKey: '3004-50', name: '오트음료', toggleable: true, exclusiveGroupKey: '3004',
  defaultChoiceKey: '3004-50-20', displayPrice: 600, choices: choices('3004-50', '', 600),
};
const shot = {
  groupKey: '1000-10', name: '에스프레소 샷', toggleable: false,
  choices: [{ choiceKey: '1000-10-10', label: '연하게', price: 0 }],
};
const shotAddition = {
  key: '1001-10', name: '에스프레소 샷 추가', unitPrice: 800, maxQty: 2,
};

const customOptions = {
  menuCd: '10101030',
  choiceGroups: [caramel, chocolate, milk, oat, shot],
  categories: [
    { categoryKey: '9004', categoryName: '드리즐', qtyItems: [], choiceGroups: [caramel, chocolate] },
    { categoryKey: '3004', categoryName: '우유/식물성 음료', qtyItems: [], choiceGroups: [milk, oat] },
    { categoryKey: '1000', categoryName: '샷 조절', qtyItems: [], choiceGroups: [shot] },
    { categoryKey: '1001', categoryName: '샷 추가', qtyItems: [shotAddition], choiceGroups: [] },
  ],
};

const Harness = () => {
  const [selected, setSelected] = useState({ qty: {}, choices: {} });
  return (
    <>
      <CustomOptionsPanel customOptions={customOptions} selectedCustom={selected} onChange={setSelected} />
      <output data-testid="selection">{JSON.stringify(selected)}</output>
    </>
  );
};

const selection = () => JSON.parse(screen.getByTestId('selection').textContent);

test('드리즐은 체크박스 두 개만 보이고 체크하면 보통이 선택된 하위 옵션이 열린다', () => {
  render(<Harness />);

  fireEvent.click(screen.getByRole('button', { name: '드리즐' }));
  const caramelToggle = screen.getByRole('checkbox', { name: '카라멜드리즐' });
  expect(caramelToggle).not.toBeChecked();
  expect(screen.getByRole('checkbox', { name: '초콜릿드리즐' })).not.toBeChecked();
  expect(screen.queryByRole('radio', { name: '드리즐많이' })).not.toBeInTheDocument();

  fireEvent.click(caramelToggle);

  expect(screen.getByRole('radio', { name: '드리즐보통' })).toBeChecked();
  expect(selection().choices).toEqual({ '9004-10': '9004-10-20' });
  fireEvent.click(screen.getByRole('radio', { name: '드리즐많이' }));
  expect(selection().choices).toEqual({ '9004-10': '9004-10-10' });

  fireEvent.click(caramelToggle);
  expect(screen.queryByRole('radio', { name: '드리즐보통' })).not.toBeInTheDocument();
  expect(selection().choices).toEqual({});
});

test('우유와 식물성 음료는 서로 배타적으로 선택된다', () => {
  render(<Harness />);

  fireEvent.click(screen.getByRole('button', { name: '우유/식물성 음료' }));
  fireEvent.click(screen.getByRole('checkbox', { name: '기본(조정만)' }));
  expect(selection().choices).toEqual({ '3004-00': '3004-00-20' });

  fireEvent.click(screen.getByRole('checkbox', { name: '오트음료' }));

  expect(screen.getByRole('checkbox', { name: '기본(조정만)' })).not.toBeChecked();
  expect(screen.getByRole('checkbox', { name: '오트음료' })).toBeChecked();
  expect(selection().choices).toEqual({ '3004-50': '3004-50-20' });
});

test('조정 전용 옵션은 바로 보이고 수량형 옵션은 기존처럼 조절된다', () => {
  render(<Harness />);

  fireEvent.click(screen.getByRole('button', { name: '샷 조절' }));
  expect(screen.getByRole('radio', { name: '연하게' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('radio', { name: '연하게' }));
  expect(selection().choices).toEqual({ '1000-10': '1000-10-10' });

  fireEvent.click(screen.getByRole('button', { name: '샷 추가' }));
  fireEvent.click(screen.getByRole('button', { name: '에스프레소 샷 추가 수량 늘리기' }));
  expect(selection().qty).toEqual({ '1001-10': 1 });
  fireEvent.click(screen.getByRole('button', { name: '에스프레소 샷 추가 수량 줄이기' }));
  expect(selection().qty).toEqual({ '1001-10': 0 });
});
