import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ReleaseNoteEditorModal from './ReleaseNoteEditorModal';
import { adminAPI } from '../services/api';

jest.mock('../services/api', () => ({
  adminAPI: {
    login: jest.fn(),
    createReleaseNote: jest.fn(),
    updateReleaseNote: jest.fn(),
  },
}));

const note = {
  id: 7,
  version: '2026.11.1',
  title: '기존 업데이트',
  summary: '기존 요약',
  content: '기존 내용',
  published: true,
};

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
});

test('관리자 로그인 후 업데이트를 작성하고 공개한다', async () => {
  adminAPI.login.mockResolvedValue({ token: 'admin-token' });
  adminAPI.createReleaseNote.mockImplementation(async (data) => ({ id: 8, ...data }));
  const onSaved = jest.fn();
  const onAdminToken = jest.fn();
  render(<ReleaseNoteEditorModal isOpen note={null} onClose={jest.fn()} onSaved={onSaved} onAdminToken={onAdminToken} />);

  fireEvent.change(screen.getByLabelText('관리자 비밀번호'), { target: { value: 'password' } });
  fireEvent.click(screen.getByRole('button', { name: '로그인' }));
  fireEvent.change(await screen.findByLabelText('버전'), { target: { value: '2026.11.2' } });
  fireEvent.change(screen.getByLabelText('제목'), { target: { value: '새 업데이트' } });
  fireEvent.change(screen.getByLabelText('팝업 요약'), { target: { value: '새 요약' } });
  fireEvent.change(screen.getByLabelText('상세 내용'), { target: { value: '새 기능\n개선 사항' } });
  fireEvent.click(screen.getByLabelText(/게시판에 고정하고/));
  fireEvent.click(screen.getByRole('button', { name: '저장' }));

  await waitFor(() => expect(adminAPI.createReleaseNote).toHaveBeenCalledWith({
    version: '2026.11.2',
    title: '새 업데이트',
    summary: '새 요약',
    content: '새 기능\n개선 사항',
    published: true,
  }));
  expect(onAdminToken).toHaveBeenCalledWith('admin-token');
  expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: 8, published: true }), 'admin-token');
});

test('기존 업데이트를 같은 작성 모달에서 수정한다', async () => {
  localStorage.setItem('adminToken', 'admin-token');
  adminAPI.updateReleaseNote.mockResolvedValue({ ...note, title: '수정된 업데이트' });
  const onSaved = jest.fn();
  render(<ReleaseNoteEditorModal isOpen note={note} onClose={jest.fn()} onSaved={onSaved} onAdminToken={jest.fn()} />);

  fireEvent.change(await screen.findByLabelText('제목'), { target: { value: '수정된 업데이트' } });
  fireEvent.click(screen.getByRole('button', { name: '저장' }));

  await waitFor(() => expect(adminAPI.updateReleaseNote).toHaveBeenCalledWith(7, expect.objectContaining({
    title: '수정된 업데이트',
    published: true,
  })));
  expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: 7, title: '수정된 업데이트' }), 'admin-token');
});

test('모달을 열 때 최신 관리자 로그인 상태를 다시 읽는다', () => {
  localStorage.setItem('adminToken', 'expired-token');
  const props = { note: null, onClose: jest.fn(), onSaved: jest.fn(), onAdminToken: jest.fn() };
  const { rerender } = render(<ReleaseNoteEditorModal {...props} isOpen={false} />);
  localStorage.removeItem('adminToken');
  rerender(<ReleaseNoteEditorModal {...props} isOpen />);

  expect(screen.getByLabelText('관리자 비밀번호')).toBeInTheDocument();
  expect(screen.getByText('업데이트 작성과 수정은 관리자만 할 수 있습니다.')).toBeInTheDocument();
});
