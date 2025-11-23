# 배포 가이드 (시놀로지 NAS Container Manager)

## 프로젝트 포트 구조

### 개발 모드 (로컬)
- 프론트엔드: http://localhost:3000 (React 개발 서버)
  - Hot reload 지원
  - API 요청은 자동으로 8080 포트로 프록시
- 백엔드: http://localhost:8080 (Spring Boot)
  - REST API 제공 (/api/*)
  - H2 Console: http://localhost:8080/h2-console

### 프로덕션 모드 (시놀로지 NAS)
- 단일 포트: 8080 (컨테이너 내부)
- 매핑 포트: 8888 (외부 접속용)
- Spring Boot가 React 정적 파일 + API 모두 제공
- 브라우저 접속: http://192.168.0.48:8888

## Docker 이미지 빌드

### 1. Docker 이미지 빌드

```bash
# 프로젝트 루트에서 실행
docker buildx build --platform linux/amd64 -t coffee-order-svc:latest --load .
```

설명:
- --platform linux/amd64: 시놀로지 NAS 호환 (M1/M2 Mac에서도 동작)
- -t coffee-order-svc:latest: 이미지 이름과 태그
- --load: 빌드된 이미지를 로컬에 로드

### 2. 이미지 압축 파일 생성

```bash
docker save coffee-order-svc:latest | gzip > coffee-order-svc.tar.gz
```

생성된 파일: coffee-order-svc.tar.gz

---

## 시놀로지 NAS에서 배포하기

### 3. Container Manager에서 이미지 가져오기

1. 시놀로지 DSM 웹 인터페이스 접속
   - http://192.168.0.48:5000 (또는 사용 중인 DSM 포트)

2. Container Manager 앱 실행

3. 이미지 탭으로 이동

4. 추가 버튼 클릭 → 파일에서 추가 선택

5. 파일 선택
   - coffee-order-svc.tar.gz 파일 업로드
   - 또는 시놀로지 File Station에 먼저 업로드한 후 경로 지정

6. 이미지 가져오기 완료 대기
   - 이미지 목록에 coffee-order-svc:latest 표시 확인

### 4. 컨테이너 생성 및 실행

#### 방법 1: Container Manager UI 사용 (권장)

1. 이미지 탭에서 coffee-order-svc:latest 선택

2. 실행 버튼 클릭

3. 컨테이너 설정
   - 컨테이너 이름: coffee-order-container
   - 자동 재시작 활성화: 체크

4. 포트 설정 탭
   - 로컬 포트: 8888
   - 컨테이너 포트: 8080
   - 유형: TCP

5. 볼륨 설정 탭 (데이터 영구 저장)
   - 폴더 추가 클릭
   - 파일/폴더: 시놀로지 폴더 선택 (예: /docker/coffee-order/data)
     - 없으면 File Station에서 먼저 생성
   - 마운트 경로: /app/data

6. 환경 탭 (선택사항)
   - 필요한 환경 변수 추가 (현재는 불필요)

7. 완료 버튼 클릭

8. 컨테이너 탭에서 실행 상태 확인
   - 상태가 실행 중이면 성공

#### 방법 2: SSH 접속 사용 (고급)

시놀로지에 SSH 접속 후:

```bash
# 이미지 로드 (File Station에 업로드한 경우)
gunzip -c /volume1/docker/coffee-order-svc.tar.gz | docker load

# 기존 컨테이너 중지 및 제거
docker stop coffee-order-container 2>/dev/null || true
docker rm coffee-order-container 2>/dev/null || true

# 새 컨테이너 실행
docker run -d \
  --name coffee-order-container \
  -p 8888:8080 \
  -v /volume1/docker/coffee-order/data:/app/data \
  --restart unless-stopped \
  coffee-order-svc:latest
```

### 5. 접속 확인

브라우저에서 접속:
```
http://192.168.0.48:8888
```

## 빠른 빌드 스크립트

Docker 이미지를 빌드하고 압축하는 스크립트:

```bash
#!/bin/bash
# build.sh

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
else
  echo "이미지 빌드 실패"
  exit 1
fi
```

사용법:
```bash
chmod +x build.sh
./build.sh
```

---

## Container Manager에서 로그 확인

### UI에서 확인
1. Container Manager 앱 실행
2. 컨테이너 탭 선택
3. coffee-order-container 선택
4. 로그 버튼 클릭

### SSH로 확인 (고급)
```bash
# 실시간 로그 확인
docker logs -f coffee-order-container

# 최근 100줄만 확인
docker logs --tail 100 coffee-order-container
```

## Container Manager에서 컨테이너 관리

### UI에서 관리
1. Container Manager > 컨테이너 탭
2. coffee-order-container 선택 후:
   - 중지: 중지 버튼 클릭
   - 시작: 시작 버튼 클릭
   - 재시작: 동작 > 재시작 클릭
   - 삭제: 중지 후 삭제 버튼 클릭

### SSH로 관리 (고급)
```bash
# 컨테이너 중지
docker stop coffee-order-container

# 컨테이너 시작
docker start coffee-order-container

# 컨테이너 재시작
docker restart coffee-order-container

# 컨테이너 상태 확인
docker ps -a | grep coffee-order
```

## 데이터베이스 백업

H2 데이터베이스 파일은 컨테이너의 /app/data 디렉토리에 저장됩니다.

### File Station에서 백업
1. File Station 앱 실행
2. 볼륨 마운트 설정한 폴더로 이동 (예: /docker/coffee-order/data)
3. 폴더 우클릭 > 압축 또는 복사하여 백업

### SSH로 백업 (고급)
```bash
# 시놀로지에서 백업
cp -r /volume1/docker/coffee-order/data /volume1/docker/coffee-order/data-backup-$(date +%Y%m%d)
```

## 업데이트 배포

코드 수정 후 재배포 절차:

### 1. 새 이미지 빌드 및 압축
```bash
# 로컬에서 실행
docker buildx build --platform linux/amd64 -t coffee-order-svc:latest --load .
docker save coffee-order-svc:latest | gzip > coffee-order-svc.tar.gz
```

### 2. Container Manager에서 업데이트

#### 방법 A: UI 사용 (권장)

1. 이미지 업로드
   - File Station에 coffee-order-svc.tar.gz 업로드
   - Container Manager > 이미지 > 추가 > 파일에서 추가
   - 새 이미지 가져오기 (기존 이미지 덮어쓰기)

2. 기존 컨테이너 중지 및 삭제
   - Container Manager > 컨테이너 탭
   - coffee-order-container 선택
   - 중지 버튼 클릭
   - 삭제 버튼 클릭

3. 새 컨테이너 생성
   - 이미지 탭에서 coffee-order-svc:latest 선택
   - 실행 버튼 클릭
   - 이전과 동일한 설정으로 컨테이너 생성
     - 포트: 8888 → 8080
     - 볼륨: /docker/coffee-order/data → /app/data
     - 자동 재시작 활성화

#### 방법 B: SSH 사용 (고급)

```bash
# File Station에 업로드한 이미지 로드
gunzip -c /volume1/docker/coffee-order-svc.tar.gz | docker load

# 기존 컨테이너 중지 및 제거
docker stop coffee-order-container
docker rm coffee-order-container

# 새 컨테이너 실행
docker run -d \
  --name coffee-order-container \
  -p 8888:8080 \
  -v /volume1/docker/coffee-order/data:/app/data \
  --restart unless-stopped \
  coffee-order-svc:latest
```

## 트러블슈팅

### 포트 충돌 시
Container Manager에서 컨테이너 생성 시 다른 포트 번호 사용:
- 로컬 포트: 9999 (또는 사용하지 않는 다른 포트)
- 컨테이너 포트: 8080 (고정)

### 컨테이너가 시작되지 않을 때

1. Container Manager에서 로그 확인
   - 컨테이너 탭 > 컨테이너 선택 > 로그 버튼

2. SSH로 로그 확인
   ```bash
   docker logs coffee-order-container
   ```

3. 볼륨 경로 확인
   - File Station에서 /docker/coffee-order/data 폴더 존재 확인
   - 폴더 권한 확인

### 이미지 크기 최적화
현재 Dockerfile은 이미 최적화되어 있습니다:
- 멀티 스테이지 빌드 사용
- Build stage: Maven + Node.js (빌드 후 삭제)
- Runtime stage: JRE만 포함
- 최종 이미지 크기: 약 300-400MB

## 주요 명령어 정리

### 로컬 개발
```bash
# 백엔드만 실행
./mvnw spring-boot:run

# 프론트엔드만 실행
cd coffee-order-frontweb && npm start

# 전체 빌드 (프로덕션)
./mvnw clean package
```

### Docker 이미지 생성
```bash
# 이미지 빌드
docker buildx build --platform linux/amd64 -t coffee-order-svc:latest --load .

# 이미지 압축
docker save coffee-order-svc:latest | gzip > coffee-order-svc.tar.gz
```

### 빠른 배포 체크리스트
- [ ] 로컬에서 이미지 빌드 및 압축
- [ ] File Station에 tar.gz 파일 업로드
- [ ] Container Manager에서 이미지 가져오기
- [ ] 기존 컨테이너 중지/삭제
- [ ] 새 컨테이너 생성 및 실행
- [ ] 브라우저에서 접속 테스트 (http://192.168.0.48:8888)