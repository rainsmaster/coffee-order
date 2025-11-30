# 배포 가이드 (시놀로지 NAS Container Manager)

## 목차
1. [로컬 개발 환경 테스트](#1-로컬-개발-환경-테스트)
2. [Docker 이미지 빌드](#2-docker-이미지-빌드)
3. [시놀로지 NAS 배포 (Docker Compose)](#3-시놀로지-nas-배포-docker-compose)
4. [시놀로지 NAS 배포 (개별 컨테이너)](#4-시놀로지-nas-배포-개별-컨테이너)
5. [업데이트 배포](#5-업데이트-배포)
6. [트러블슈팅](#6-트러블슈팅)

---

## 프로젝트 아키텍처

```
┌─────────────────────────────────────────────────────────┐
│                    Docker Network                        │
│  ┌─────────────────┐      ┌─────────────────────────┐   │
│  │     Redis       │◄────►│    Coffee Order App     │   │
│  │  (분산 락/캐시)  │      │   (Spring Boot + React) │   │
│  │  Port: 6379     │      │   Port: 8080            │   │
│  └─────────────────┘      └─────────────────────────┘   │
│                                    │                     │
└────────────────────────────────────┼─────────────────────┘
                                     │
                              Port: 8888 (외부)
                                     │
                              ┌──────▼──────┐
                              │   Browser   │
                              └─────────────┘
```

### 개발 모드 (로컬)
- 프론트엔드: http://localhost:3000 (React 개발 서버, Hot reload)
- 백엔드: http://localhost:8080 (Spring Boot)
- Redis: localhost:6379 (Docker)
- H2 Console: http://localhost:8080/h2-console

### 프로덕션 모드 (시놀로지 NAS)
- 접속 URL: http://192.168.0.48:8888
- Spring Boot가 React 정적 파일 + API 모두 제공
- Redis: 같은 Docker 네트워크 내 컨테이너

---

## 1. 로컬 개발 환경 테스트

### 1-1. Redis 실행 (Docker)

```bash
# 프로젝트 루트에서 실행
cd /Users/gyuseonheo/Development/coffee-order

# Redis 컨테이너 시작
docker-compose -f docker-compose.dev.yml up -d

# Redis 실행 확인
docker ps | grep redis
```

**확인 방법:**
```bash
# Redis 연결 테스트
docker exec coffee-redis-dev redis-cli ping
# 응답: PONG
```

### 1-2. 백엔드 실행

```bash
# 프로젝트 루트에서
cd coffee-order-api
../mvnw spring-boot:run
```

또는 IntelliJ에서:
- Run Configuration: `CoffeeOrderApplication [devtools]` 실행

### 1-3. 프론트엔드 실행

```bash
# 새 터미널에서
cd coffee-order-frontweb
npm start
```

### 1-4. 테스트

1. 브라우저에서 http://localhost:3000 접속
2. 관리 페이지 > 투썸 메뉴 탭 이동
3. "메뉴 동기화" 버튼 클릭
4. 진행률 표시 확인

**동시성 테스트:**
- 브라우저 2개에서 동시에 동기화 버튼 클릭
- 먼저 클릭한 쪽: 동기화 진행
- 나중에 클릭한 쪽: "동기화가 이미 진행 중입니다" 메시지

### 1-5. 로컬 테스트 종료

```bash
# Redis 중지
docker-compose -f docker-compose.dev.yml down

# Redis 데이터도 삭제하려면
docker-compose -f docker-compose.dev.yml down -v
```

---

## 2. Docker 이미지 빌드

### 2-1. 이미지 빌드

```bash
# 프로젝트 루트에서 실행
cd /Users/gyuseonheo/Development/coffee-order

# 시놀로지 NAS용 이미지 빌드 (linux/amd64)
docker buildx build --platform linux/amd64 -t coffee-order-svc:latest --load .
```

**참고:** M1/M2 Mac에서도 `--platform linux/amd64`로 빌드해야 시놀로지에서 동작합니다.

### 2-2. 이미지 압축

```bash
docker save coffee-order-svc:latest | gzip > coffee-order-svc.tar.gz
```

### 2-3. 빠른 빌드 스크립트

```bash
# build.sh 실행
chmod +x build.sh
./build.sh
```

---

## 3. 시놀로지 NAS 배포 (Docker Compose) - 권장

DSM 7.2 이상에서 Container Manager의 "프로젝트" 기능을 사용합니다.

### 3-1. 사전 준비

1. **폴더 생성** (File Station)
   ```
   /docker/coffee-order/
   ├── data/           # H2 DB + 이미지 저장
   └── docker-compose.yml
   ```

2. **이미지 업로드**
   - `coffee-order-svc.tar.gz` 파일을 시놀로지에 업로드
   - Container Manager > 이미지 > 추가 > 파일에서 추가
   - 이미지 로드 완료 대기

### 3-2. Docker Compose 파일 업로드

`docker-compose.yml` 파일을 `/docker/coffee-order/` 폴더에 업로드:

```yaml
version: '3.8'
services:
  redis:
    image: redis:7-alpine
    container_name: coffee-redis
    restart: always
    volumes:
      - redis-data:/data
    command: redis-server --appendonly yes
    networks:
      - coffee-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  app:
    image: coffee-order-svc:latest
    container_name: coffee-order
    restart: always
    ports:
      - "8888:8080"
    volumes:
      - ./data:/app/data
    environment:
      - SPRING_DATA_REDIS_HOST=redis
      - SPRING_DATA_REDIS_PORT=6379
      - TZ=Asia/Seoul
    depends_on:
      redis:
        condition: service_healthy
    networks:
      - coffee-network

volumes:
  redis-data:
    driver: local

networks:
  coffee-network:
    driver: bridge
```

### 3-3. Container Manager에서 프로젝트 생성

1. **Container Manager** 앱 실행

2. **프로젝트** 탭 클릭

3. **생성** 버튼 클릭

4. **프로젝트 설정**
   - 프로젝트 이름: `coffee-order`
   - 경로: `/docker/coffee-order` 선택
   - 소스: `docker-compose.yml 업로드` 또는 `기존 docker-compose.yml 사용`

5. **다음** 클릭 후 설정 확인

6. **완료** 클릭

### 3-4. 프로젝트 실행 확인

1. **프로젝트** 탭에서 `coffee-order` 선택
2. 상태가 "실행 중"인지 확인
3. 컨테이너 2개 실행 확인:
   - `coffee-redis` (Redis)
   - `coffee-order` (앱)

### 3-5. 접속 테스트

브라우저에서 접속:
```
http://192.168.0.48:8888
```

---

## 4. 시놀로지 NAS 배포 (개별 컨테이너)

Docker Compose를 사용하지 않고 개별 컨테이너로 배포하는 방법입니다.

### 4-1. Redis 컨테이너 생성

**Container Manager UI:**
1. 레지스트리 > `redis` 검색 > `redis:7-alpine` 다운로드
2. 이미지 탭 > `redis:7-alpine` 선택 > 실행
3. 설정:
   - 컨테이너 이름: `coffee-redis`
   - 자동 재시작: 활성화
   - 네트워크: bridge (기본값)
4. 볼륨: (선택사항)
   - `/docker/redis-data` → `/data`

**SSH 방식:**
```bash
docker run -d \
  --name coffee-redis \
  --restart always \
  redis:7-alpine redis-server --appendonly yes
```

### 4-2. Redis 컨테이너 IP 확인

```bash
# SSH 접속 후
docker inspect coffee-redis | grep IPAddress
# 예: "IPAddress": "172.17.0.2"
```

### 4-3. 앱 컨테이너 생성

**Container Manager UI:**
1. 이미지 탭 > `coffee-order-svc:latest` 선택 > 실행
2. 설정:
   - 컨테이너 이름: `coffee-order`
   - 자동 재시작: 활성화
3. 포트 설정:
   - 로컬 포트: `8888`
   - 컨테이너 포트: `8080`
4. 볼륨 설정:
   - `/docker/coffee-order/data` → `/app/data`
5. 환경 변수:
   - `SPRING_DATA_REDIS_HOST` = `172.17.0.2` (Redis IP)
   - `SPRING_DATA_REDIS_PORT` = `6379`
   - `TZ` = `Asia/Seoul`

**SSH 방식:**
```bash
# Redis IP 확인
REDIS_IP=$(docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' coffee-redis)

# 앱 컨테이너 실행
docker run -d \
  --name coffee-order \
  -p 8888:8080 \
  -v /volume1/docker/coffee-order/data:/app/data \
  -e SPRING_DATA_REDIS_HOST=$REDIS_IP \
  -e SPRING_DATA_REDIS_PORT=6379 \
  -e TZ=Asia/Seoul \
  --restart always \
  coffee-order-svc:latest
```

---

## 5. 업데이트 배포

### 5-1. 새 이미지 빌드

```bash
# 로컬에서
docker buildx build --platform linux/amd64 -t coffee-order-svc:latest --load .
docker save coffee-order-svc:latest | gzip > coffee-order-svc.tar.gz
```

### 5-2. Docker Compose 사용 시 (권장)

1. **이미지 업로드**
   - `coffee-order-svc.tar.gz` 시놀로지에 업로드
   - Container Manager > 이미지 > 추가 > 파일에서 추가

2. **프로젝트 재시작**
   - Container Manager > 프로젝트 > `coffee-order` 선택
   - 동작 > 중지
   - 동작 > 빌드 (새 이미지 적용)
   - 동작 > 시작

**SSH 방식:**
```bash
cd /volume1/docker/coffee-order
docker-compose down
docker-compose up -d
```

### 5-3. 개별 컨테이너 사용 시

1. **이미지 업로드** (위와 동일)

2. **앱 컨테이너만 재생성**
   - Container Manager > 컨테이너 > `coffee-order` 선택
   - 중지 > 삭제
   - 이미지 탭에서 새 이미지로 컨테이너 재생성

**SSH 방식:**
```bash
# 기존 컨테이너 중지/삭제
docker stop coffee-order
docker rm coffee-order

# 새 이미지 로드
gunzip -c /volume1/docker/coffee-order-svc.tar.gz | docker load

# Redis IP 확인 후 재실행
REDIS_IP=$(docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' coffee-redis)

docker run -d \
  --name coffee-order \
  -p 8888:8080 \
  -v /volume1/docker/coffee-order/data:/app/data \
  -e SPRING_DATA_REDIS_HOST=$REDIS_IP \
  -e SPRING_DATA_REDIS_PORT=6379 \
  -e TZ=Asia/Seoul \
  --restart always \
  coffee-order-svc:latest
```

---

## 6. 트러블슈팅

### Redis 연결 오류

**증상:** 앱 시작 시 Redis 연결 실패

**확인:**
```bash
# Redis 컨테이너 상태 확인
docker ps | grep redis

# Redis 연결 테스트
docker exec coffee-redis redis-cli ping

# 앱에서 Redis 연결 확인 (로그)
docker logs coffee-order | grep -i redis
```

**해결:**
1. Redis 컨테이너가 실행 중인지 확인
2. `SPRING_DATA_REDIS_HOST` 환경 변수가 올바른지 확인
3. Docker Compose 사용 시: 서비스명 `redis` 사용
4. 개별 컨테이너 시: Redis 컨테이너 IP 사용

### 동기화 진행률이 표시되지 않음

**증상:** 동기화 버튼 클릭 후 진행률 바가 안 보임

**확인:**
```bash
# Redis에 진행 상태 저장되는지 확인
docker exec coffee-redis redis-cli GET "twosome:sync:progress"
```

**해결:**
1. Redis 연결 상태 확인
2. 브라우저 개발자 도구에서 네트워크 탭 확인
3. `/api/twosome-menus/sync/status` API 응답 확인

### 포트 충돌

**증상:** 컨테이너 시작 실패, 포트 사용 중

**해결:**
```bash
# 8888 포트 사용 중인 프로세스 확인
docker ps | grep 8888
netstat -an | grep 8888

# 다른 포트로 변경 (예: 9999)
# docker-compose.yml에서 ports: "9999:8080"으로 수정
```

### 컨테이너 로그 확인

```bash
# 앱 로그 (실시간)
docker logs -f coffee-order

# 앱 로그 (최근 100줄)
docker logs --tail 100 coffee-order

# Redis 로그
docker logs coffee-redis
```

### 데이터베이스 백업

```bash
# H2 DB 파일 백업
cp -r /volume1/docker/coffee-order/data /volume1/docker/coffee-order/data-backup-$(date +%Y%m%d)
```

---

## 빠른 체크리스트

### 최초 배포
- [ ] 로컬에서 `docker-compose.dev.yml`로 테스트
- [ ] Docker 이미지 빌드 (`build.sh`)
- [ ] 시놀로지에 `coffee-order-svc.tar.gz` 업로드
- [ ] Container Manager에서 이미지 가져오기
- [ ] `/docker/coffee-order/data` 폴더 생성
- [ ] `docker-compose.yml` 업로드
- [ ] Container Manager > 프로젝트 생성
- [ ] http://192.168.0.48:8888 접속 테스트

### 업데이트 배포
- [ ] 로컬에서 새 이미지 빌드
- [ ] 시놀로지에 tar.gz 업로드
- [ ] Container Manager에서 이미지 가져오기
- [ ] 프로젝트 재빌드/재시작
- [ ] 접속 테스트
