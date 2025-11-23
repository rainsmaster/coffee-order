#!/bin/bash
# build.sh - Docker 이미지 빌드 및 압축 스크립트

echo "Docker 이미지 빌드 중..."
docker buildx build --platform linux/amd64 -t coffee-order-svc:latest --load .

if [ $? -eq 0 ]; then
  echo "이미지 빌드 완료!"

  echo "이미지 압축 중..."
  docker save coffee-order-svc:latest | gzip > coffee-order-svc.tar.gz

  echo "압축 완료: coffee-order-svc.tar.gz"
  echo ""
  echo "다음 단계:"
  echo "1. coffee-order-svc.tar.gz 파일을 시놀로지 File Station에 업로드"
  echo "2. Container Manager > 이미지 > 추가 > 파일에서 추가"
  echo "3. 업로드한 파일 선택하여 이미지 가져오기"
  echo "4. 이미지 실행하여 컨테이너 생성"
  echo ""
  echo "접속 주소: http://192.168.0.48:8888"
else
  echo "이미지 빌드 실패"
  exit 1
fi