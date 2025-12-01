# PWA 아이콘 가이드

## 필요한 아이콘 파일

아래 아이콘들을 이 폴더(`public/icons/`)에 추가해주세요.

### 기본 아이콘 (필수)

| 파일명 | 크기 | 용도 |
|--------|------|------|
| `icon-72x72.png` | 72x72 | Android 저해상도 |
| `icon-96x96.png` | 96x96 | Android |
| `icon-128x128.png` | 128x128 | Chrome Web Store |
| `icon-144x144.png` | 144x144 | MS 타일 |
| `icon-152x152.png` | 152x152 | iOS iPad |
| `icon-167x167.png` | 167x167 | iOS iPad Pro |
| `icon-192x192.png` | 192x192 | Android 기본 |
| `icon-384x384.png` | 384x384 | Android 고해상도 |
| `icon-512x512.png` | 512x512 | Android 스플래시 |

### iOS 전용 (필수)

| 파일명 | 크기 | 용도 |
|--------|------|------|
| `apple-touch-icon.png` | 180x180 | iOS 홈 화면 |

### Maskable 아이콘 (권장)

Android 적응형 아이콘용으로, 이미지의 중요한 부분이 중앙 72% 영역 안에 있어야 합니다.

| 파일명 | 크기 |
|--------|------|
| `icon-maskable-192x192.png` | 192x192 |
| `icon-maskable-512x512.png` | 512x512 |

## 아이콘 디자인 가이드

### 테마 색상
- **Primary**: `#6F4E37` (커피 브라운)
- **Background**: `#f5f5f5` (밝은 회색)

### 권장 디자인
- 커피 컵 아이콘
- 심플하고 명확한 형태
- 작은 크기에서도 인식 가능하도록

### 아이콘 생성 도구
1. **Figma** - https://figma.com
2. **Canva** - https://canva.com
3. **PWA Asset Generator** - https://www.pwabuilder.com/imageGenerator

### 빠른 생성 방법
1. 512x512 크기의 원본 아이콘을 하나 만듭니다
2. https://www.pwabuilder.com/imageGenerator 에서 업로드
3. 자동으로 모든 크기의 아이콘이 생성됩니다

## Favicon 업데이트

`public/favicon.ico`도 앱에 맞게 교체해주세요.
- 권장: 32x32 또는 64x64 ICO 파일
- https://favicon.io 에서 PNG를 ICO로 변환 가능