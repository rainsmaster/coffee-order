import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/layers.css';
import '@astryxdesign/core/reset.css';
import '@astryxdesign/core/astryx.css';
import './index.css';
import './styles/tokens.css';
import { Theme } from '@astryxdesign/core/theme';
import { InternationalizationProvider } from '@astryxdesign/core/i18n';
import koKR from '@astryxdesign/core/locales/ko-KR.generated.js';
import { themes, defaultThemeSlug } from './astryx-themes';
import App from './App';
import './styles/responsive-controls.css';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <InternationalizationProvider locale="ko-KR" messages={{ 'ko-KR': koKR }}>
      <Theme theme={themes[defaultThemeSlug]} mode="light">
        <App />
      </Theme>
    </InternationalizationProvider>
  </React.StrictMode>
);

reportWebVitals();

// PWA Service Worker 등록
serviceWorkerRegistration.register({
  onSuccess: () => {
    console.log('앱이 오프라인 사용을 위해 캐시되었습니다.');
  },
  onUpdate: () => {
    console.log('새 버전이 사용 가능합니다. 페이지를 새로고침하세요.');
  }
});
