import { getFID, getLCP, getTTFB } from 'web-vitals';

const reportWebVitals = () => {
  const report = ({ name, value }) => {
    if (typeof window.gtag !== 'function') return;
    const thresholds = {
      LCP: [2500, 4000],
      FID: [100, 300],
      TTFB: [800, 1800],
    };
    const [good, needsImprovement] = thresholds[name] || [Infinity, Infinity];
    const rating = value <= good ? 'good' : value <= needsImprovement ? 'needs-improvement' : 'poor';
    window.gtag('event', 'web_vital', {
      metric_name: name,
      value: Math.round(value),
      metric_rating: rating,
      page_path: window.location.pathname,
      non_interaction: true,
    });
  };

  getLCP(report);
  getFID(report);
  getTTFB(report);
};

export default reportWebVitals;
