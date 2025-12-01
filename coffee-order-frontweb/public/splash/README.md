# iOS 스플래시 스크린 가이드

## 필요한 스플래시 이미지

iOS에서 PWA 실행 시 표시되는 시작 화면입니다.
아래 파일들을 이 폴더(`public/splash/`)에 추가해주세요.

### 필요한 파일

| 파일명 | 크기 | 기기 |
|--------|------|------|
| `splash-640x1136.png` | 640x1136 | iPhone SE (1세대) |
| `splash-750x1334.png` | 750x1334 | iPhone 6/7/8, SE (2,3세대) |
| `splash-1242x2208.png` | 1242x2208 | iPhone 6/7/8 Plus |
| `splash-1125x2436.png` | 1125x2436 | iPhone X/XS/11 Pro |
| `splash-1170x2532.png` | 1170x2532 | iPhone 12/13/14 |
| `splash-1284x2778.png` | 1284x2778 | iPhone 12/13/14 Pro Max |

## 스플래시 디자인 가이드

### 권장 구성
- 중앙에 앱 아이콘 또는 로고
- 배경색: `#f5f5f5` (앱 배경과 동일)
- 앱 이름: "커피주문"

### 예시 레이아웃
```
┌─────────────────────┐
│                     │
│                     │
│                     │
│        ☕           │  <- 아이콘 (중앙)
│      커피주문       │  <- 앱 이름 (선택)
│                     │
│                     │
│                     │
└─────────────────────┘
```

### 생성 도구
1. **Figma** 또는 **Canva**로 직접 제작
2. **PWA Splash Screen Generator**: https://progressier.com/pwa-splash-screen-generator
3. **RealFaviconGenerator**: https://realfavicongenerator.net

## 참고사항
- 스플래시 이미지가 없어도 PWA는 정상 작동합니다
- 단, iOS에서 앱 시작 시 흰 화면이 잠깐 보일 수 있습니다