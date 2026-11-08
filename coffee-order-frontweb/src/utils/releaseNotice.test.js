import { dismissReleaseForToday, shouldShowRelease } from './releaseNotice';

describe('버전별 릴리즈 노트 표시', () => {
  const note = { version: '2026.11.1' };

  test('같은 버전은 오늘 숨기고 다음 날 다시 표시한다', () => {
    const storage = { getItem: jest.fn().mockReturnValue('2026-11-08'), setItem: jest.fn() };
    expect(shouldShowRelease(note, storage, '2026-11-08')).toBe(false);
    expect(shouldShowRelease(note, storage, '2026-11-09')).toBe(true);
  });

  test('새 버전은 이전 버전을 숨겼어도 표시한다', () => {
    const storage = {
      getItem: jest.fn().mockImplementation((key) => key === 'releaseNotice:2026.11.1:dismissedOn' ? '2026-11-08' : null),
      setItem: jest.fn(),
    };
    expect(shouldShowRelease(note, storage, '2026-11-08')).toBe(false);
    expect(shouldShowRelease({ version: '2026.11.2' }, storage, '2026-11-08')).toBe(true);
    expect(storage.getItem).toHaveBeenLastCalledWith('releaseNotice:2026.11.2:dismissedOn');
  });

  test('오늘 하루 보지 않기를 버전별 키로 저장한다', () => {
    const storage = { getItem: jest.fn(), setItem: jest.fn() };
    dismissReleaseForToday(note, storage, '2026-11-08');
    expect(storage.setItem).toHaveBeenCalledWith('releaseNotice:2026.11.1:dismissedOn', '2026-11-08');
    expect(shouldShowRelease(null, storage, '2026-11-08')).toBe(false);
  });

  test('브라우저 저장소 오류가 서비스 이용을 막지 않는다', () => {
    const storage = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
    expect(shouldShowRelease(note, storage, '2026-11-08')).toBe(true);
    expect(() => dismissReleaseForToday(note, storage, '2026-11-08')).not.toThrow();
  });
});
