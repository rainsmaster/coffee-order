import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import MenuThumbnail from './MenuThumbnail';

const menu = {
  menuCd: '10100002',
  menuNm: '카페 라떼',
  localImgPath: '/images/twosome/10100002.jpg',
  menuImg: '/menu_image/10100002_20260608055115.jpg',
};

const originalComplete = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'complete');
const originalNaturalWidth = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'naturalWidth');

afterEach(() => {
  Object.defineProperty(HTMLImageElement.prototype, 'complete', originalComplete);
  Object.defineProperty(HTMLImageElement.prototype, 'naturalWidth', originalNaturalWidth);
});

test('로딩 중에는 크기가 고정된 스켈레톤을 보이고 로드 후 이미지를 표시한다', () => {
  const { container } = render(<MenuThumbnail menu={menu} />);
  const thumbnail = container.querySelector('.menu-thumbnail');

  expect(container.querySelector('.menu-thumbnail-skeleton')).toBeInTheDocument();
  expect(thumbnail).toHaveAttribute('aria-busy', 'true');
  const image = screen.getByRole('img', { name: '카페 라떼' });
  expect(image).toHaveAttribute('width', '276');
  expect(image).toHaveAttribute('height', '276');
  expect(image).toHaveAttribute('loading', 'lazy');
  expect(image).toHaveAttribute('decoding', 'async');
  expect(image.src).toContain('/images/twosome/10100002.jpg?v=10100002_20260608055115.jpg');

  fireEvent.load(image);

  expect(container.querySelector('.menu-thumbnail-skeleton')).not.toBeInTheDocument();
  expect(thumbnail).toHaveAttribute('aria-busy', 'false');
});

test('이미 표시한 이미지를 다시 마운트하면 스켈레톤이 다시 나타나지 않는다', () => {
  const first = render(<MenuThumbnail menu={menu} />);
  fireEvent.load(screen.getByRole('img', { name: '카페 라떼' }));
  first.unmount();

  const second = render(<MenuThumbnail menu={menu} />);

  expect(second.container.querySelector('.menu-thumbnail-skeleton')).not.toBeInTheDocument();
  expect(second.container.querySelector('.menu-thumbnail')).toHaveClass('is-loaded');
});

test('캐시되어 이미 완료된 이미지는 첫 화멶부터 스켈레톤 없이 표시한다', () => {
  Object.defineProperty(HTMLImageElement.prototype, 'complete', { configurable: true, get: () => true });
  Object.defineProperty(HTMLImageElement.prototype, 'naturalWidth', { configurable: true, get: () => 276 });

  const { container } = render(<MenuThumbnail menu={menu} />);

  expect(container.querySelector('.menu-thumbnail-skeleton')).not.toBeInTheDocument();
  expect(container.querySelector('.menu-thumbnail')).toHaveClass('is-loaded');
});

test('이미지 실패 시 외부 요청 없이 로컬 대체 아이콘을 표시한다', () => {
  const { container } = render(<MenuThumbnail menu={menu} />);
  const image = screen.getByRole('img', { name: '카페 라떼' });

  fireEvent.error(image);

  expect(screen.getByRole('img', { name: '카페 라떼 이미지 없음' })).toBeInTheDocument();
  expect(container.querySelector('.menu-thumbnail-skeleton')).not.toBeInTheDocument();
  expect(container.querySelector('img')).not.toBeInTheDocument();
});

test('원본 이미지 버전이 바뀌면 캐시 키도 바뀐다', () => {
  const changed = { ...menu, menuImg: '/menu_image/10100002_20261110090000.jpg' };
  render(<MenuThumbnail menu={changed} />);

  expect(screen.getByRole('img', { name: '카페 라떼' }).src).toContain('?v=10100002_20261110090000.jpg');
});
