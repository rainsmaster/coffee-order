import { isWithinStoreHours } from './storeHours';

describe('매장 영업시간 판정', () => {
  const at = (hour, minute) => new Date(2026, 10, 8, hour, minute);

  test('영업 시작과 종료 경계를 구분한다', () => {
    const info = { ordTime: '08:00 ~ 20:50' };
    expect(isWithinStoreHours(info, at(8, 0))).toBe(true);
    expect(isWithinStoreHours(info, at(20, 49))).toBe(true);
    expect(isWithinStoreHours(info, at(20, 50))).toBe(false);
    expect(isWithinStoreHours(info, at(7, 59))).toBe(false);
  });

  test('자정을 넘는 영업시간과 잘못된 응답을 처리한다', () => {
    expect(isWithinStoreHours({ ordTime: '22:00 ~ 02:00' }, at(23, 0))).toBe(true);
    expect(isWithinStoreHours({ ordTime: '22:00 ~ 02:00' }, at(1, 59))).toBe(true);
    expect(isWithinStoreHours({ ordTime: '22:00 ~ 02:00' }, at(2, 0))).toBe(false);
    expect(isWithinStoreHours(null, at(12, 0))).toBe(false);
    expect(isWithinStoreHours({ ordTime: '확인 불가' }, at(12, 0))).toBe(false);
  });
});
