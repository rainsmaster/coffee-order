#!/bin/bash
set -euo pipefail

APP_IMAGE_NAME="${APP_IMAGE_NAME:-coffee-order-svc:main-mysql}"
OCR_IMAGE_NAME="${OCR_IMAGE_NAME:-coffee-order-ocr:main}"
APP_OUTPUT_FILE="${APP_OUTPUT_FILE:-coffee-order-svc-main-mysql.tar}"
OCR_OUTPUT_FILE="${OCR_OUTPUT_FILE:-coffee-order-ocr-main.tar}"

echo "======================================"
echo "1단계: 앱 이미지 빌드"
echo "======================================"
echo "플랫폼: linux/amd64"
echo "이미지 태그: $APP_IMAGE_NAME"

docker buildx build --platform linux/amd64 -t "$APP_IMAGE_NAME" --load .
docker save "$APP_IMAGE_NAME" -o "$APP_OUTPUT_FILE"

echo "App image saved: $APP_OUTPUT_FILE"

echo "======================================"
echo "2단계: OCR 이미지 빌드"
echo "======================================"
echo "플랫폼: linux/amd64"
echo "이미지 태그: $OCR_IMAGE_NAME"

docker buildx build --platform linux/amd64 -t "$OCR_IMAGE_NAME" --load ./ocr-service
docker save "$OCR_IMAGE_NAME" -o "$OCR_OUTPUT_FILE"

echo "======================================"
echo "빌드 완료"
echo "======================================"
echo "앱 이미지: $APP_IMAGE_NAME"
echo "앱 tar: $APP_OUTPUT_FILE ($(du -h "$APP_OUTPUT_FILE" | cut -f1))"
echo "OCR 이미지: $OCR_IMAGE_NAME"
echo "OCR tar: $OCR_OUTPUT_FILE ($(du -h "$OCR_OUTPUT_FILE" | cut -f1))"
echo ""
echo "두 tar 파일과 docker-compose.yml, ocr-service 디렉터리를 NAS에 업로드하세요."
