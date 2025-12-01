// Service Worker 등록 유틸리티

const isLocalhost = Boolean(
  window.location.hostname === 'localhost' ||
  window.location.hostname === '[::1]' ||
  window.location.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/)
);

export function register(config) {
  if ('serviceWorker' in navigator) {
    const publicUrl = new URL(process.env.PUBLIC_URL, window.location.href);

    if (publicUrl.origin !== window.location.origin) {
      return;
    }

    window.addEventListener('load', () => {
      const swUrl = `${process.env.PUBLIC_URL}/service-worker.js`;

      if (isLocalhost) {
        // 로컬호스트에서는 서비스 워커 확인
        checkValidServiceWorker(swUrl, config);
        navigator.serviceWorker.ready.then(() => {
          console.log('Service Worker가 로컬호스트에서 실행 중입니다.');
        });
      } else {
        // 프로덕션에서 서비스 워커 등록
        registerValidSW(swUrl, config);
      }
    });
  }
}

function registerValidSW(swUrl, config) {
  navigator.serviceWorker
    .register(swUrl)
    .then((registration) => {
      console.log('Service Worker 등록 성공:', registration.scope);

      registration.onupdatefound = () => {
        const installingWorker = registration.installing;

        if (installingWorker == null) {
          return;
        }

        installingWorker.onstatechange = () => {
          if (installingWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              // 새 콘텐츠 사용 가능
              console.log('새 버전이 사용 가능합니다. 페이지를 새로고침하세요.');

              if (config && config.onUpdate) {
                config.onUpdate(registration);
              }
            } else {
              // 콘텐츠가 오프라인 사용을 위해 캐시됨
              console.log('콘텐츠가 오프라인 사용을 위해 캐시되었습니다.');

              if (config && config.onSuccess) {
                config.onSuccess(registration);
              }
            }
          }
        };
      };
    })
    .catch((error) => {
      console.error('Service Worker 등록 실패:', error);
    });
}

function checkValidServiceWorker(swUrl, config) {
  fetch(swUrl, {
    headers: { 'Service-Worker': 'script' }
  })
    .then((response) => {
      const contentType = response.headers.get('content-type');

      if (
        response.status === 404 ||
        (contentType != null && contentType.indexOf('javascript') === -1)
      ) {
        // 서비스 워커를 찾을 수 없음, 페이지 다시 로드
        navigator.serviceWorker.ready.then((registration) => {
          registration.unregister().then(() => {
            window.location.reload();
          });
        });
      } else {
        // 서비스 워커 발견, 정상 진행
        registerValidSW(swUrl, config);
      }
    })
    .catch(() => {
      console.log('인터넷 연결 없음. 앱이 오프라인 모드로 실행됩니다.');
    });
}

export function unregister() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.unregister();
      })
      .catch((error) => {
        console.error(error.message);
      });
  }
}