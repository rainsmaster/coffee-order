import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import RepLoginModal from './RepLoginModal';
import { repAPI } from '../services/api';

jest.mock('../services/api', () => ({
  repAPI: {
    login: jest.fn(),
    me: jest.fn(),
    twosomeCaptcha: jest.fn(),
    twosomeLogin: jest.fn(),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
});

test('저장된 대표 토큰이 있어도 항상 PIN부터 입력한다', () => {
  localStorage.setItem('repToken', 'existing-token');
  repAPI.me.mockResolvedValue({ id: 2, name: '허규선', twosomeId: 'saved-id' });

  render(<RepLoginModal rep={{ id: 2, name: '허규선' }} onClose={jest.fn()} onSuccess={jest.fn()} />);

  expect(screen.getByLabelText('PIN (숫자 6자리)')).toBeInTheDocument();
  expect(screen.queryByLabelText('투썸 아이디')).not.toBeInTheDocument();
  expect(repAPI.me).not.toHaveBeenCalled();
  expect(repAPI.twosomeCaptcha).not.toHaveBeenCalled();
});

test('PIN 확인에 성공한 뒤에만 투썸 로그인 단계로 이동한다', async () => {
  repAPI.login.mockResolvedValue({ token: 'new-token' });
  repAPI.me.mockResolvedValue({ id: 2, name: '허규선', twosomeId: 'saved-id' });
  repAPI.twosomeCaptcha.mockResolvedValue({ contextId: 'captcha', imageBase64: 'data:image/png;base64,abc' });

  render(<RepLoginModal rep={{ id: 2, name: '허규선' }} onClose={jest.fn()} onSuccess={jest.fn()} />);
  fireEvent.change(screen.getByLabelText('PIN (숫자 6자리)'), { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: '다음' }));

  expect(await screen.findByLabelText('투썸 아이디')).toHaveValue('saved-id');
  expect(repAPI.login).toHaveBeenCalledWith(2, '123456');
  expect(localStorage.getItem('repToken')).toBe('new-token');
});
