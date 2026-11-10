import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import SuggestionPage from './SuggestionPage';
import { suggestionAPI } from '../services/api';

jest.mock('../services/api', () => ({
  suggestionAPI: {
    getList: jest.fn(),
    getById: jest.fn(),
    getComments: jest.fn(),
  },
  releaseNoteAPI: { getById: jest.fn() },
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

beforeEach(() => {
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
});

test('건의 항목을 실제 버튼으로 제공하고 상세 내용을 연다', async () => {
  render(<SuggestionPage releaseNoteId={null} />);

  const item = await screen.findByRole('button', { name: /접근성 개선 요청/ });
  fireEvent.click(item);

  expect(await screen.findByText('모바일에서도 읽기 쉽게 해주세요.')).toBeInTheDocument();
  expect(suggestionAPI.getById).toHaveBeenCalledWith(1);
  expect(suggestionAPI.getComments).toHaveBeenCalledWith(1);
});
