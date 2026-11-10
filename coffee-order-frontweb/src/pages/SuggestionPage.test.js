import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SuggestionPage from './SuggestionPage';
import { suggestionAPI, releaseNoteAPI, adminAPI } from '../services/api';

jest.mock('../services/api', () => ({
  suggestionAPI: {
    getList: jest.fn(),
    getById: jest.fn(),
    getComments: jest.fn(),
  },
  releaseNoteAPI: {
    getPublished: jest.fn(),
    getById: jest.fn(),
  },
  adminAPI: {
    login: jest.fn(),
    getReleaseNotes: jest.fn(),
    createReleaseNote: jest.fn(),
    updateReleaseNote: jest.fn(),
  },
}));

const suggestion = {
  id: 1,
  title: '접근성 개선 요청',
  content: '모바일에서도 읽기 쉽게 해주세요.',
  author: '홍길동',
  createdAt: '2026-11-10T09:00:00',
  commentCount: 0,
  pinned: false,
  deleted: false,
};

const releaseNote = {
  id: 7,
  version: '2026.11.1',
  title: '허다방 업데이트 안내',
  summary: '게시판 통합 요약',
  content: '새 기능\n업데이트를 건의 게시판에 고정합니다.',
  published: true,
  publishedAt: '2026-11-10T10:00:00',
};

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
  suggestionAPI.getList.mockResolvedValue({
    pinnedSuggestions: [],
    suggestions: [suggestion],
    currentPage: 0,
    totalPages: 1,
    totalElements: 1,
  });
  suggestionAPI.getById.mockResolvedValue(suggestion);
  suggestionAPI.getComments.mockResolvedValue([]);
  releaseNoteAPI.getPublished.mockResolvedValue([releaseNote]);
  releaseNoteAPI.getById.mockResolvedValue(releaseNote);
});

test('건의 항목을 실제 버튼으로 제공하고 상세 내용을 연다', async () => {
  render(<SuggestionPage releaseNoteId={null} />);

  const item = await screen.findByRole('button', { name: /접근성 개선 요청/ });
  fireEvent.click(item);

  expect(await screen.findByText('모바일에서도 읽기 쉽게 해주세요.')).toBeInTheDocument();
  expect(suggestionAPI.getById).toHaveBeenCalledWith(1);
  expect(suggestionAPI.getComments).toHaveBeenCalledWith(1);
});

test('공개 업데이트를 고정글로 표시하고 필요할 때만 상세를 연다', async () => {
  render(<SuggestionPage releaseNoteId={null} />);

  const item = await screen.findByRole('button', { name: /고정.*업데이트.*허다방 업데이트 안내/ });
  expect(item).toHaveClass('release-item', 'pinned');
  expect(screen.queryByText('업데이트를 건의 게시판에 고정합니다.')).not.toBeInTheDocument();
  fireEvent.click(item);

  expect(await screen.findByRole('dialog', { name: '업데이트' })).toBeInTheDocument();
  expect(screen.getByText('게시판 통합 요약')).toBeInTheDocument();
  expect(screen.getByText('업데이트를 건의 게시판에 고정합니다.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '이 버전의 의견 남기기' }));
  expect(screen.getByPlaceholderText('제목을 입력하세요')).toHaveValue('[2026.11.1] ');
});

test('팝업의 기존 링크가 게시판 상세 모달로 연결된다', async () => {
  render(<SuggestionPage releaseNoteId="7" onReleaseNoteClosed={jest.fn()} />);

  expect(await screen.findByRole('dialog', { name: '업데이트' })).toBeInTheDocument();
  expect(screen.getByText('업데이트를 건의 게시판에 고정합니다.')).toBeInTheDocument();
  expect(releaseNoteAPI.getById).toHaveBeenCalledWith('7');
});

test('업데이트 상세에서 관리자 수정 모달을 연다', async () => {
  render(<SuggestionPage releaseNoteId={null} />);

  fireEvent.click(await screen.findByRole('button', { name: /허다방 업데이트 안내/ }));
  fireEvent.click(await screen.findByRole('button', { name: '관리자 수정' }));

  expect(await screen.findByRole('dialog', { name: '업데이트 수정' })).toBeInTheDocument();
  expect(screen.getByText('업데이트 작성과 수정은 관리자만 할 수 있습니다.')).toBeInTheDocument();
});

test('만료된 관리자 토큰은 제거하고 공개 업데이트를 계속 표시한다', async () => {
  localStorage.setItem('adminToken', 'expired-token');
  adminAPI.getReleaseNotes.mockRejectedValue(new Error('ADMIN_AUTH_FAILED'));
  render(<SuggestionPage releaseNoteId={null} />);

  expect(await screen.findByRole('button', { name: /허다방 업데이트 안내/ })).toBeInTheDocument();
  await waitFor(() => expect(localStorage.getItem('adminToken')).toBeNull());
  expect(adminAPI.getReleaseNotes).toHaveBeenCalledTimes(1);
});
