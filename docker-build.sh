#!/bin/bash

# 커피 주문 서비스 Docker 빌드 및 내보내기 스크립트
# Docker 이미지를 빌드하고 시놀로지 업로드용 tar 파일생성

IMAGE_NAME="coffee-order-svc:latest"
OUTPUT_FILE="coffee-order-svc.tar"

echo "======================================"
echo "1단계: Docker 이미지 빌드"
echo "======================================"
echo "플랫폼: linux/amd64"
echo "이미지 태그: $IMAGE_NAME"
echo ""

if ! docker buildx build --platform linux/amd64 -t $IMAGE_NAME --load .; then
    echo ""
    echo "Docker 빌드 실패!"
    exit 1
fi

echo ""
echo "Docker 이미지 빌드 성공!"
echo ""

echo "======================================"
echo "2단계: tar 파일로 내보내기"
echo "======================================"
echo "출력 파일: $OUTPUT_FILE"
echo ""

if docker save $IMAGE_NAME -o $OUTPUT_FILE; then
    # 파일 크기 확인
    FILE_SIZE=$(du -h $OUTPUT_FILE | cut -f1)

    echo ""
    echo "내보내기 완료!"
    echo ""
    echo "======================================"
    echo "빌드 요약"
    echo "======================================"
    echo "이미지: $IMAGE_NAME"
    echo "내보낸 파일: $OUTPUT_FILE"
    echo "파일 크기: $FILE_SIZE"
    echo ""
    echo "시놀로지 배포 단계:"
    echo "  1. $OUTPUT_FILE 을 시놀로지 NAS에 업로드"
    echo "  2. Container Manager → 이미지 → 파일에서 추가"
    echo "  3. 포트 매핑 8888:8080 으로 컨테이너 생성"
    echo "  4. http://192.168.0.48:8888 에서 접속"
    echo ""
    echo "로컬 테스트 실행:"
    echo "  docker run -p 8888:8080 $IMAGE_NAME"
else
    echo ""
    echo "✗ 내보내기 실패!"
    exit 1
fi