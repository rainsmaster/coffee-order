import { getFID, getLCP, getTTFB } from 'web-vitals';
import reportWebVitals from './reportWebVitals';

jest.mock('web-vitals', () => ({
  getFID: jest.fn(),
  getLCP: jest.fn(),
  getTTFB: jest.fn(),
}));

test('사용자 식별 정보 없이 성능 지표만 기존 분석 도구로 전송한다', () => {
  window.gtag = jest.fn();
  reportWebVitals();
  expect(getLCP).toHaveBeenCalledTimes(1);
  expect(getFID).toHaveBeenCalledTimes(1);
  expect(getTTFB).toHaveBeenCalledTimes(1);

  getLCP.mock.calls[0][0]({ name: 'LCP', value: 1234.4 });

  expect(window.gtag).toHaveBeenCalledWith('event', 'web_vital', {
    metric_name: 'LCP',
    value: 1234,
    metric_rating: 'good',
    page_path: '/',
    non_interaction: true,
  });
  delete window.gtag;
});
