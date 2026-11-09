import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import AdminPage from './AdminPage';
import { adminAPI, departmentAPI, teamAPI } from '../services/api';

jest.mock('../services/api', () => ({
  adminAPI: {
    getReps: jest.fn(),
    createRep: jest.fn(),
    updateRep: jest.fn(),
    deleteRep: jest.fn(),
    verifyRepTwosome: jest.fn(),
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

test('지금 확인으로 실제 투썸 상태와 마지막 검증 정보를 갱신한다', async () => {
  const rep = {
    id: 2,
    name: '허규선',
    departmentId: 137,
    departmentName: 'MSA TF',
    teamId: 247,
    teamName: '허규선',
    pinSet: true,
    lastLoginAt: null,
    twosomeStatus: 'EXPIRED',
    twosomeStoreNm: 'CJENM커머스부문점',
    twosomeLastVerifiedAt: '2026-11-09T15:00:00',
    autoReloginBlocked: false,
  };
  adminAPI.getReps.mockResolvedValue([rep]);
  departmentAPI.getAll.mockResolvedValue([]);
  teamAPI.getAll.mockResolvedValue([]);
  adminAPI.verifyRepTwosome.mockResolvedValue({
    result: 'RELOGINED',
    message: 'OCR 자동 재로그인 후 실제 로그인 상태를 확인했습니다.',
    rep: {
      ...rep,
      twosomeStatus: 'ACTIVE',
      twosomeSource: 'RESTORED',
      twosomeLastVerifiedAt: '2026-11-09T16:00:00',
    },
  });

  render(<AdminPage embedded />);

  expect(await screen.findByText('만료')).toBeInTheDocument();
  expect(screen.getByText('PIN 최종 로그인')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '지금 확인' }));

  expect(await screen.findByText('정상')).toBeInTheDocument();
  expect(screen.getByText('OCR 자동 재로그인 후 실제 로그인 상태를 확인했습니다.')).toBeInTheDocument();
  expect(screen.getByText(/마지막 확인/)).toBeInTheDocument();
  expect(screen.getByText(/Redis 복구/)).toBeInTheDocument();
  expect(adminAPI.verifyRepTwosome).toHaveBeenCalledWith(2);
});

test('자동 로그인 차단 상태와 사유를 표시한다', async () => {
  adminAPI.getReps.mockResolvedValue([{
    id: 3,
    name: '강원구',
    departmentId: 137,
    departmentName: 'MSA TF',
    teamId: 248,
    teamName: '강원구',
    pinSet: true,
    twosomeStatus: 'EXPIRED',
    autoReloginBlocked: true,
    autoReloginMessage: '비밀번호 확인 후 수동 로그인이 필요합니다.',
  }]);
  departmentAPI.getAll.mockResolvedValue([]);
  teamAPI.getAll.mockResolvedValue([]);

  render(<AdminPage embedded />);

  expect(await screen.findByText('자동 로그인 중단')).toBeInTheDocument();
  expect(screen.getByText('비밀번호 확인 후 수동 로그인이 필요합니다.')).toBeInTheDocument();
});
