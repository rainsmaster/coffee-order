import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ManagePage from './ManagePage';
import { adminAPI, teamAPI, twosomeStoreAPI } from '../services/api';

jest.mock('../context/DepartmentContext', () => ({
  useDepartment: () => ({
    selectedDepartment: { id: 1, name: 'MSA TF' },
    selectedDepartmentId: 1,
    setSelectedDepartment: jest.fn(),
    refreshDepartments: jest.fn(),
  }),
}));

jest.mock('./AdminPage', () => function MockAdminPage() {
  return <section>대표 관리 화면</section>;
});

jest.mock('../services/api', () => ({
  teamAPI: { getAll: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
  departmentAPI: { getAll: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
  adminAPI: { login: jest.fn() },
  twosomeStoreAPI: {
    getStoreInfo: jest.fn(), getHealth: jest.fn(), getMenuRefreshDiff: jest.fn(), getSession: jest.fn(),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  teamAPI.getAll.mockResolvedValue([{ id: 1, name: '허규선' }]);
  twosomeStoreAPI.getStoreInfo.mockResolvedValue({ ordTime: '08:00 ~ 20:00' });
  twosomeStoreAPI.getHealth.mockResolvedValue({});
  twosomeStoreAPI.getMenuRefreshDiff.mockResolvedValue({});
  twosomeStoreAPI.getSession.mockResolvedValue({ status: 'NONE' });
  adminAPI.login.mockResolvedValue({ token: 'admin-token' });
});

test('설정 탭을 전환하고 관리자 비밀번호로 로그인한다', async () => {
  render(<ManagePage initialTab="team" />);

  expect(await screen.findByText('팀원 목록 (MSA TF)')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '매장·주문 안내' }));
  expect(await screen.findByRole('heading', { name: '매장·주문 안내 (MSA TF)' })).toBeInTheDocument();
  expect(twosomeStoreAPI.getStoreInfo).toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: '관리자' }));
  fireEvent.change(await screen.findByLabelText('관리자 비밀번호'), { target: { value: 'test-password' } });
  fireEvent.click(screen.getByRole('button', { name: '로그인' }));

  expect(await screen.findByText('관리자 설정')).toBeInTheDocument();
  expect(adminAPI.login).toHaveBeenCalledWith('test-password');
  expect(localStorage.getItem('adminToken')).toBe('admin-token');
});
