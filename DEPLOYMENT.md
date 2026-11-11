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

## V3 카테고리별 동일 메뉴 코드 대응

투썸은 기본 아메리칸노와 디카페인 아메리칸노처럼 같은 `menu_cd`를 다른 `mid_cd`로 구분해 제공한다. V3는 기존 `menu_cd` 단일 고유키를 `(menu_cd, mid_cd)` 복합 고유키로 바꿔 두 메뉴를 모두 보존한다.

- 배포 전 MySQL 백업과 복원 가능 여부를 확인한다. 앱 시작 시 Flyway가 기존 단일 고유 인덱스를 찾아 복합 고유 인덱스로 바꾼다.
- 배포 후 관리자 계정으로 매장 메뉴를 즉시 갱신하고, 커피의 기본 아메리칸노와 디카페인 커피의 디카페인 아메리칸노가 각각 보이는지 확인한다.
- 두 레코드가 생성된 뒤 이전 앱으로 되돌리면 `menu_cd`만 조회하는 코드에서 중복 결과 오류가 날 수 있다. 이전 앱 롤백은 카테고리별 메뉴 갱신 전에만 허용하거나, V3 이전 백업 복원과 함께 수행한다.

## Jenkins 수동 빌드·배포

일반 배포는 Jenkins의 `Jenkinsfile`을 사용한다. GitHub 웹훅과 주기적 빌드는 설정하지 않으며, 관리자가 `Build with Parameters`로 직접 실행한다.

- `DEPLOY=false`: 테스트와 앱·OCR 이미지 빌드만 수행한다.
- `DEPLOY=true`: 빌드 후 별도 승인 화면을 거쳐 운영 앱·OCR만 교체한다.
- 이미지 태그는 12자리 Git 커밋 해시다. 기존 이미지를 덮어쓰지 않는다.
- 배포 스크립트는 현재 Compose 프로젝트를 자동으로 찾고 MySQL·Redis의 컨테이너 ID와 저장소가 바뀌지 않았는지 검증한다.
- `/actuator/health`와 부서 조회 API가 성공해야 배포가 완료된다. 실패하면 이전 앱 이미지로 되돌린다.
- DB 구조 변경이 있는 배포는 최신 백업과 롤백 가능 여부를 별도로 확인한다. 앱 이미지 롤백이 DB 롤백을 대신하지 않는다.

### Jenkins 설치

`jenkins/`의 파일을 NAS `/volume1/docker/jenkins`에 올린다. Container Manager에서 이 경로로 별도 프로젝트를 만들고 `docker-compose.yml`을 선택해 빌드한다. SSH를 사용한다면 다음과 같다.

```bash
cd /volume1/docker/jenkins
docker compose up -d --build
```

Jenkins 설정은 `coffee-jenkins_jenkins-home` Docker 볼륨에 보존하고, NAS Docker 소켓을 사용해 이미지를 빌드한다. 컨테이너 시작 스크립트가 Docker 소켓 그룹을 설정한 뒤 Jenkins 실행 사용자를 `jenkins`로 전환한다. 운영 앱 Compose와 분리된 프로젝트이므로 `coffee-jenkins`만 생성된다. Jenkins 홈은 Synology ACL 영향이 없는 이름 볼륨을 사용한다. Jenkins 실행은 Java 21, 애플리케이션 빌드 결과는 Java 17을 사용한다. Jenkins base 이미지는 Dockerfile에 다이제스트로 고정하고, `pull`과 `no_cache`로 캐시된 구버전을 재사용하지 않는다.

초기 관리자 설정은 외부 공개 전에 NAS와 같은 네트워크에서 완료하는 것을 권장한다. 외부 터널을 먼저 연 경우에도 Setup Wizard 잠금 해제와 관리자 생성 전에는 운영하지 않는다.

```text
http://192.168.0.48:18080
```

초기 관리자 비밀번호는 Container Manager의 `coffee-jenkins` 로그에서 확인한다. 설치 마법사에서 권장 플러그인을 다시 설치할 필요는 없다. 관리자 계정과 Jenkins URL을 설정한 뒤 로그인한다.

### Jenkins Credentials

`Manage Jenkins > Credentials > System > Global credentials`에서 다음 항목을 만든다. 값은 Git과 Jenkinsfile에 넣지 않는다.

| ID | 종류 | 값 |
| --- | --- | --- |
| `coffee-mysql-password` | Secret text | 기존 MySQL `coffee` 계정 비밀번호 |
| `coffee-mysql-root-password` | Secret text | 기존 MySQL root 비밀번호 |
| `coffee-twosome-admin` | Username with password | 매장 메뉴 갱신용 투썸 관리자 계정 |
| `coffee-twosome-crypto-key` | Secret text | 기존 대표 계정 암호화 키, Base64 32바이트 |
| `coffee-admin-password` | Secret text | 허다방 관리자 비밀번호 |

MySQL root 비밀번호를 Compose 값만 바꾼다고 실제 비밀번호가 변경되지는 않는다. Redis의 기존 암호화 키로 암호화한 대표 계정이 있으면 새 키를 만들지 말고 같은 키를 등록한다.

### Pipeline 작업

1. `New Item > Pipeline`에서 `coffee-order` 작업을 만든다.
2. Pipeline 정의를 `Pipeline script from SCM`으로 선택한다.
3. SCM은 `Git`, 저장소는 `https://github.com/rainsmaster/coffee-order.git`, 브랜치는 `*/main`으로 설정한다.
4. Script Path는 `Jenkinsfile`로 설정한다.
5. 빌드 트리거는 모두 끄고 저장한다.
6. 첫 실행은 `DEPLOY`를 체크하지 않고 `Build with Parameters`를 눌러 이미지 빌드만 검증한다.
7. 운영 배포는 최신 MySQL 백업을 확인한 뒤 `DEPLOY=true`로 실행하고 승인 화면에서 `배포 실행`을 누른다.

Jenkins가 Git에서 `Jenkinsfile`을 읽으므로 파이프라인 변경은 해당 파일을 커밋·푸시한 뒤 실행해야 한다.

### 외부 HTTPS 접속

초기 설정이 끝난 후 `jenkins.heodabang.me`를 사용한다. 기존 `허다방` Cloudflare Tunnel을 재사용하므로 공유기/NAT에 18080 포트를 열 필요가 없다.

1. Cloudflare Dashboard에서 `Networking > Tunnels > 허다방 > Routes > Add route`를 선택한다.
2. `Published application`을 선택하고 다음을 입력한다.
   - Subdomain: `jenkins`
   - Domain: `heodabang.me`
   - Service URL: `http://192.168.0.48:18080`
3. `Add route`를 누륀다. `jenkins.heodabang.me` CNAME이 터널 주소로 자동 생성된다.
4. `Manage Jenkins > System > Jenkins URL`을 `https://jenkins.heodabang.me/`로 설정한다.

Cloudflare가 외부 HTTPS를 처리하고, tunnel은 NAS의 Jenkins HTTP 포트에 outbound 연결로 전달한다. DSM 리버스 프록시나 추가 인증서·포트 전달은 필요하지 않다.

### Cloudflare 캐시 규칙

`heodabang.me`의 `Caching > Cache Rules`에 다음 두 규칙을 사용한다.

- `heodabang-public-read-apis-60s`: GET `/api/twosome-menus`, `/api/departments`, `/api/twosome/store-info`만 Edge TTL 60초로 캐시한다.
- `heodabang-versioned-static-1y`: GET `/static/*`, `/images/twosome/*`를 Edge TTL 1년으로 캐시한다. CRA 파일 해시와 이미지 버전 쿼리를 유지해야 한다.

주문, 대표, 관리자, 장바구니, 로그인 API는 캐시하지 않는다. 서버의 `ApiCacheControlFilter`도 공개 조회 외 API에 `no-store`를 적용한다. 배포 후 `cf-cache-status`가 공개 조회에서는 `HIT`, 주문 조회에서는 `DYNAMIC`인지 확인한다.

### 메뉴 이미지 WebP

원본 JPG·PNG는 삭제하지 않는다. `cwebp`가 설치된 환경에서 `scripts/convert-twosome-webp.sh ORIGINAL_IMAGE_DIR WEBP_OUTPUT_DIR`을 실행하면 원본 파일명 뒤에 `.webp`를 붙인 파일이 생성된다. 예를 들어 `10100010.png`의 최적화 파일은 `10100010.png.webp`다.

생성된 WebP만 `/volume1/docker/mywebsite/data/images/twosome`에 업로드하고 기존 이미지는 같은 경로에 유지한다. 화면은 원본 URL에 `.webp`를 붙인 이미지를 먼저 요청하고, 실패하면 기존 원본을 사용한다. 원본 이미지 버전 쿼리는 두 URL에 같게 유지하므로 이미지가 바뀌면 Cloudflare와 서비스 워커 캐시도 함께 갱신된다.

앱은 수동·예약 매장 메뉴 갱신 후 활성 메뉴의 이미지도 자동 동기화한다. 메뉴 코드를 파일명으로 사용하며, 같은 메뉴 코드의 일반·디카페인 레코드는 같은 로컬 경로를 공유한다. 원본 URL이 바뀐 이미지와 누락된 원본·WebP를 보충하고 `local_img_path`도 저장한다. 변환에 성공하기 전에는 기존 파일을 덮어쓰지 않으며, 개별 이미지 실패는 메뉴 갱신 자체를 중단하지 않는다. `.source` 파일은 다음 갱신 때 동일 이미지를 다시 받지 않기 위한 원본 URL 기록이다. 운영 이미지에는 `cwebp`가 포함되며 `TWOSOME_IMAGE_DIR`이 기존 볼륨의 `/app/data/images/twosome`으로 설정된다. 위 수동 스크립트는 초기 복구나 일괄 재변환이 필요할 때만 사용한다.

Jenkins 관리자와 Pipeline 설정 권한은 관리자에게만 허용한다. 익명 사용자의 읽기·빌드 권한과 가입 기능은 허용하지 않는다. Jenkins가 Docker 소켓을 사용하므로 외부 관리자 계정에는 강한 고유 비밀번호를 사용한다.

운영 앱은 이제 Container Manager에서 다시 빌드하지 않고 Jenkins로만 배포한다. Container Manager에서는 상태와 로그를 확인한다.

## Container Manager 수동 배포

Jenkins를 사용하지 않는 예외 상황의 수동 배포 순서:

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
