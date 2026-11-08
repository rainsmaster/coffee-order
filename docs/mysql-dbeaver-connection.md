# 운영 MySQL DBeaver 접속 매뉴얼

## 접속 정보

| 항목 | 값 |
| --- | --- |
| 드라이버 | MySQL |
| Host | `211.187.101.60` |
| Port | `3306` |
| Database | `coffee_order` |
| Username | `coffee` |
| Password | NAS 운영 Compose의 `MYSQL_PASSWORD`에 설정한 값 |

비밀번호는 이 문서에 저장하지 않는다. root 계정은 일반 조회와 애플리케이션 연결에 사용하지 않는다.

## 사전 적용

NAS `docker/mywebsite/docker-compose.yml`의 MySQL 서비스에 다음 포트 매핑이 있어야 한다.

```yaml
ports:
  - "3306:3306"
```

Container Manager의 `coffee-order` 프로젝트를 빌드한 뒤 `coffee-mysql`이 실행 중이어야 한다.

외부에서 DBeaver로 직접 접속하려면 공유기/NAT에도 다음 규칙이 필요하다.

| Protocol | External Port | Internal IP | Internal Port |
| --- | --- | --- | --- |
| TCP | `3306` | `192.168.0.48` | `3306` |

이 규칙은 MySQL을 외부에 노출하므로 필요한 기간에만 사용한다. 장비가 출발지 IP 제한을 지원하면 작업용 PC 또는 회사 네트워크만 허용한다. NAS 방화벽을 활성화하는 경우에도 같은 출발지만 3306에 허용한다.

## DBeaver 연결

1. DBeaver에서 `Database > New Database Connection`을 선택한다.
2. `MySQL`을 선택한다. MariaDB 드라이버는 선택하지 않는다.
3. Main 탭에 위 접속 정보를 입력한다.
4. 비밀번호는 변경한 `MYSQL_PASSWORD` 값을 입력한다.
5. Driver properties에서 `allowPublicKeyRetrieval`을 `true`로 설정한다.
6. `Test Connection`을 눌러 드라이버 다운로드와 연결을 확인한다.
7. `Finish`를 눌러 저장한다.

`coffee` 계정은 `coffee_order` 데이터베이스용이다. `Administration > Users`를 열 때 `mysql.user` 조회 권한 오류가 나타날 수 있지만, 일반 테이블 조회와 SQL 실행에는 영향이 없다. 계정 관리 화면 대신 `Databases > coffee_order > Tables`를 사용한다.

## 접속 확인 SQL

```sql
SELECT VERSION();
SELECT CURRENT_USER() AS account, DATABASE() AS db;
SELECT @@character_set_database, @@collation_database;
SHOW TABLES;
```

예상값:

- MySQL 버전: `8.4.x`
- 계정: `coffee@%`
- 데이터베이스: `coffee_order`
- 문자셋: `utf8mb4`

## 주의사항

- 운영 앱은 MySQL `coffee_order` 데이터베이스를 사용한다.
- YAML의 `MYSQL_PASSWORD`를 수정하더라도 이미 생성된 MySQL 계정 비밀번호는 자동으로 변경되지 않는다.
- 운영 데이터이므로 DBeaver에서 테이블과 데이터를 직접 수정하기 전에 백업을 확인한다.
- DBeaver에서 `DROP`, `TRUNCATE`, 백업 없는 `DELETE`, `UPDATE`는 실행하지 않는다.
- 외부 DBeaver 접근이 더 이상 필요 없으면 공유기/NAT 규칙, Compose 포트 매핑, 방화벽 허용을 제거한다.
