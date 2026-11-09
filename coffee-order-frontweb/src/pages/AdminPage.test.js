import React from 'react';
import { render, screen } from '@testing-library/react';
import AdminPage from './AdminPage';
import { adminAPI, departmentAPI, teamAPI } from '../services/api';

jest.mock('../services/api', () => ({
  adminAPI: {
    getReps: jest.fn(),
    createRep: jest.fn(),
    updateRep: jest.fn(),
    deleteRep: jest.fn(),
  },
  departmentAPI: { getAll: jest.fn() },
  teamAPI: { getAll: jest.fn() },
}));

test('대표 관리는 관리자 로그인 없이 열리고 소속을 실제 부서명으로 표시한다', async () => {
  adminAPI.getReps.mockResolvedValue([{
    id: 2,
    name: '허규선',
    departmentId: 137,
    departmentName: 'MSA TF',
    teamId: 247,
    teamName: '허규선',
    pinSet: true,
    lastLoginAt: null,
  }]);
  departmentAPI.getAll.mockResolvedValue([]);
  teamAPI.getAll.mockResolvedValue([]);

  render(<AdminPage embedded />);

  expect(await screen.findByText('허규선')).toBeInTheDocument();
  expect(screen.getByText('MSA TF')).toBeInTheDocument();
  expect(screen.queryByText('관리자 로그인')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '관리자 로그아웃' })).not.toBeInTheDocument();
  expect(adminAPI.getReps).toHaveBeenCalled();
});
