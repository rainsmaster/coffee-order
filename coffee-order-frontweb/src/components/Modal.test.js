import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { InternationalizationProvider } from '@astryxdesign/core/i18n';
import koKR from '@astryxdesign/core/locales/ko-KR.generated.js';
import Modal from './Modal';

const renderModal = (onClose) => render(
  <InternationalizationProvider locale="ko-KR" messages={{ 'ko-KR': koKR }}>
    <Modal isOpen onClose={onClose} title="테스트 모달">
      모달 본문
    </Modal>
  </InternationalizationProvider>
);

test('제목으로 접근 가능하고 한국어 닫기 버튼을 제공한다', () => {
  const onClose = jest.fn();
  renderModal(onClose);

  expect(screen.getByRole('dialog', { name: '테스트 모달' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '닫기' }));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('Escape로 닫기를 요청한다', () => {
  const onClose = jest.fn();
  renderModal(onClose);

  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  expect(onClose).toHaveBeenCalledTimes(1);
});
