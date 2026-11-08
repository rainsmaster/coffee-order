# 배포 가이드 — MySQL, Redis, OCR 구성

이 문서는 시놀로지 NAS Container Manager 배포 기준이다. 현재 대상 구성은 Spring Boot·React 앱, MySQL, Redis, OCR 사이드카다. 과거 H2 파일 DB와 공식 홈페이지 메뉴 동기화만 사용하던 배포 절차는 사용하지 않는다.

## 구성 요소

| 컨테이너 | 역할 | 기본 포트 |
| --- | --- | --- |
| `coffee-order` | Spring Boot API와 React 정적 파일 | `8888:8080` |
| `coffee-mysql` | 운영 데이터 저장 | `3306:3306` |
| `coffee-redis` | 세션·분산 락·연동 상태 저장 | 외부 포트 없음 |
| `coffee-ocr` | 투썸 캡챠 OCR | `8090:8090` |

Redis는 같은 Docker 네트워크 안에서만 접근한다. MySQL과 OCR의 외부 포트 공개 범위는 운영 보안 점검 시 별도로 조정한다.

## 로컬 개발 환경

프로젝트 루트는 `/Users/heogyuseon/Development/coffee-order`다.

### 의존 서비스 실행

```bash
cd /Users/heogyuseon/Development/coffee-order
docker compose -f docker-compose.dev.yml up -d
```

로컬 MySQL, Redis, OCR이 실행된다. 상태 확인:

```bash
docker ps
docker exec coffee-redis-dev redis-cli ping
curl http://localhost:8090/health
```

### 애플리케이션 실행

MySQL 프로파일 사용:

```bash
cd /Users/heogyuseon/Development/coffee-order/coffee-order-api
../mvnw spring-boot:run -Dspring-boot.run.profiles=mysql
```

`application-mysql.properties`의 기본값은 로컬 개발용이다. NAS에서는 `DB_HOST=mysql` 등 환경 변수로 접속 정보를 바꾼다.

투썸 자동 재로그인과 매장 메뉴 갱신을 로컬에서 사용하려면 실제 값은 소스가 아닌 환경 변수로 설정한다.

```bash
export TWOSOME_ADMIN_ID='투썸-계정'
export TWOSOME_ADMIN_PW='투썸-비밀번호'
export TWOSOME_CRYPTO_KEY='발급한-Base64-32바이트-키'
export ADMIN_PASSWORD='로컬-관리자-비밀번호'
```

투썸 연동 없이 일반 API만 시험할 때는 두 스케줄러를 끄고 실행할 수 있다.

```bash
TWOSOME_KEEPALIVE_ENABLED=false \
TWOSOME_MENU_REFRESH_ENABLED=false \
../mvnw spring-boot:run -Dspring-boot.run.profiles=mysql
```

프론트엔드 개발 서버가 필요하면 별도 터미널에서 실행한다.

```bash
cd /Users/heogyuseon/Development/coffee-order/coffee-order-frontweb
npm start
```

로컬 의존 서비스 종료:

```bash
docker compose -f docker-compose.dev.yml down
```

`-v`는 로컬 MySQL과 Redis 데이터까지 삭제하므로 일반 종료에는 사용하지 않는다.

## 빌드

### 애플리케이션 검증

```bash
cd /Users/heogyuseon/Development/coffee-order
./mvnw clean package
```

### NAS용 앱 이미지

NAS 아키텍처에 맞춰 `linux/amd64`로 빌드한다.

```bash
docker buildx build --platform linux/amd64 \
  -t coffee-order-svc:main-mysql --load .
docker save -o coffee-order-svc-main-mysql.tar coffee-order-svc:main-mysql
```

현재 운영 이미지와 같은 태그를 덮어쓰지 않는다. 기존 `coffee-order-svc:mysql`은 롤백 후보로 보존한다.

### OCR 이미지

`docker-compose.yml`은 `./ocr-service`에서 OCR을 빌드하도록 설정돼 있다. NAS에서 직접 빌드하려면 `ocr-service` 디렉터리 전체를 함께 업로드한다.

맥에서 미리 빌드할 수도 있다.

```bash
docker buildx build --platform linux/amd64 \
  -t coffee-order-ocr:main --load ./ocr-service
docker save -o coffee-order-ocr-main.tar coffee-order-ocr:main
```

### 앱과 OCR 한 번에 빌드

다음 스크립트는 두 이미지를 `linux/amd64`로 빌드하고 배포용 tar 두 개를 생성한다.

```bash
cd /Users/heogyuseon/Development/coffee-order
./docker-build.sh
```

출력 파일:

- `coffee-order-svc-main-mysql.tar`
- `coffee-order-ocr-main.tar`

## 필수 환경 변수

실제 비밀번호와 계정은 Git이나 이 문서에 저장하지 않는다. Container Manager 프로젝트의 환경 변수 또는 안전한 배포용 환경 파일로 전달한다.

| 변수 | 용도 |
| --- | --- |
| `MYSQL_PASSWORD` | 앱의 `coffee` 계정 비밀번호 |
| `MYSQL_ROOT_PASSWORD` | MySQL root 비밀번호, 앱 계정과 분리 |
| `TWOSOME_ADMIN_ID` | 매장 메뉴 갱신용 투썸 관리자 ID |
| `TWOSOME_ADMIN_PW` | 매장 메뉴 갱신용 투썸 관리자 비밀번호 |
| `TWOSOME_CRYPTO_KEY` | 대표 투썸 계정 암호화 키, Base64 32바이트 |
| `ADMIN_PASSWORD` | 허다방 관리자 페이지와 건의사항 관리 비밀번호 |

선택 변수:

- `APP_IMAGE`: 기본값 `coffee-order-svc:main-mysql`
- `MYSQL_DATABASE`: 기본값 `coffee_order`
- `MYSQL_USER`: 기본값 `coffee`

암호화 키는 다음처럼 생성할 수 있다. 이미 암호화된 계정이 있으면 키를 바꾸지 말고 기존 키를 유지해야 한다.

```bash
openssl rand -base64 32
```

## NAS 파일 구성

현재 운영 경로는 `/volume1/docker/mywebsite`다.

```text
/volume1/docker/mywebsite/
  docker-compose.yml
  ocr-service/
    Dockerfile
    main.py
    requirements.txt
  data/
    images/
  scripts/
    backup-mysql-nas.sh
  backups/
    mysql/
```

MySQL 데이터는 Compose의 `mysql-data` Docker 볼륨에 저장된다. File Station의 `data/demo.mv.db`는 현재 MySQL 운영 DB가 아니다.

## 운영 DB 1회 전환

기존 H2에서 이관한 운영 DB는 다음 스키마 전환 없이 `coffee-order-svc:main-mysql`로 교체하면 안 된다. 앱 이미지만 먼저 바꾸면 테이블과 컬럼 부족으로 실행에 실패한다.

1. 운영 MySQL 백업이 생성되고 복원 가능한지 확인한다.
2. DBeaver에서 `coffee` 계정으로 `scripts/upgrade-production-to-main-v1.sql`을 실행한다. 스크립트는 추가·보정 위주이며 기존 레거시 테이블과 컬럼은 삭제하지 않는다.
3. `scripts/verify-production-main-v1.sql`을 실행한다. 숫자 검증 항목의 `actual`과 `expected`가 모두 같아야 하고, 기존 데이터 건수는 백업 시점과 비교한다.
4. 메인 앱을 시작하면 기존 DB에는 Flyway baseline이 생성된다. 초기 스키마 V1이 다시 실행되는 것은 아니다.
5. 사용자에게 열기 전에 관리자 계정으로 실제 매장 메뉴를 즉시 갱신한다. 매장 배치 정보가 채워지기 전에는 주문 페이지 메뉴가 0개로 표시되는 것이 정상이다. 갱신 결과와 매장 재고를 확인하지 않은 채 주문을 받으면 안 된다.
6. 초기 CUSTOM 주문 6건의 메뉴 이름과 기존 건의사항·댓글의 비밀번호 확인 동작을 점검한다.

이 스크립트는 Flyway `db/migration`에 넣지 않는다. 이후 스키마 변경은 새 Flyway 버전으로 관리한다. 운영 `coffee` 계정에는 `coffee_order` 전체 권한이 있어 이 전환 SQL을 실행할 수 있다.

## Container Manager 배포

전환 검증이 끝난 후의 배포 순서:

1. 앱 이미지 tar와 OCR 관련 파일을 NAS에 업로드한다.
2. Container Manager에서 이미지를 불러온다.
3. 필수 환경 변수를 설정한다.
4. `/volume1/docker/mywebsite/docker-compose.yml`을 확인한다.
5. Container Manager 프로젝트를 빌드하고 실행한다.
6. 다음 컨테이너 상태를 확인한다.
   - `coffee-order`
   - `coffee-mysql`
   - `coffee-redis`
   - `coffee-ocr`
7. 실제 매장 메뉴 갱신을 완료한 뒤 부서·팀·메뉴·주문 내역을 확인한다.

로컬 네트워크 접속 주소:

```text
http://192.168.0.48:8888
```

외부 서비스 주소:

```text
https://heodabang.me
```

## 업데이트와 롤백

- 새 앱은 기존 태그를 덮어쓰지 않고 새 태그로 빌드한다.
- 배포 전 `docker compose config --quiet`로 환경 변수와 YAML을 확인한다.
- DB 구조 변경이 포함된 업데이트는 앱 롤백과 DB 롤백을 함께 검토한다.
- 새로 추가된 NOT NULL 컬럼이나 데이터 변환이 있으면 이전 앱 이미지로 되돌리는 것만으로는 롤백이 완료되지 않을 수 있다.
- 현재 MySQL 백업과 현재 운영 이미지를 함께 보존한 상태에서만 전환한다.

## 백업과 접속 매뉴얼

- MySQL 백업·복원: `docs/mysql-backup-restore.md`
- DBeaver 접속: `docs/mysql-dbeaver-connection.md`
- NAS 백업 스크립트: `scripts/backup-mysql-nas.sh`

MySQL 백업은 NAS 작업 스케줄러에서 매일 실행하며, NAS 자체 고장에 대비한 외부 저장소 복사도 별도로 설정한다.

## 기본 점검 명령

```bash
# Compose 문법과 필수 환경 변수 확인
docker compose -f docker-compose.yml config --quiet

# 컨테이너 상태
docker ps

# 앱 로그
docker logs coffee-order

# MySQL 로그
docker logs coffee-mysql

# OCR 상태
curl http://localhost:8090/health

# Redis 상태
docker exec coffee-redis redis-cli ping
```

운영 DB에서 테이블이나 데이터를 직접 삭제하기 전에는 반드시 최신 백업과 복원 절차를 확인한다.
