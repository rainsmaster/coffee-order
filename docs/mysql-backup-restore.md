# 운영 MySQL 백업·복원 매뉴얼

대상은 NAS Container Manager에서 실행 중인 `coffee-mysql`의 `coffee_order` 데이터베이스다. 평상시 애플리케이션은 기존과 같이 MySQL을 사용하고, `mysqldump`는 백업 파일을 만들 때만 사용한다.

## 자동 백업 구성

스크립트 위치:

```text
scripts/backup-mysql-nas.sh
```

스크립트는 다음 작업을 수행한다.

- MySQL 컨테이너 안의 `mysqldump`를 사용한다.
- `--single-transaction`으로 서비스 중단 없이 일관된 시점의 데이터를 백업한다.
- 날짜와 시간이 포함된 `.sql.gz` 파일로 압축한다.
- dump 완료 표시와 gzip 무결성을 확인한 뒤 최종 파일로 이동한다.
- 기본 30일이 지난 날짜별 백업 파일을 정리한다.
- 비밀번호를 스크립트에 저장하지 않고 MySQL 컨테이너의 기존 환경 변수를 사용한다.

기본값:

| 항목 | 값 |
| --- | --- |
| MySQL 컨테이너 | `coffee-mysql` |
| NAS 백업 저장소 | `/volume1/docker/mywebsite/backups/mysql` |
| 보관 기간 | 30일 |
| 백업 저장소 권한 | `root:administrators`, `750` |
| 백업 파일 권한 | `root:administrators`, `640` |

관리자 그룹만 백업을 읽을 수 있다. 다른 그룹을 사용해야 하면 `BACKUP_GROUP` 환경 변수로 지정한다.

## NAS에 최초 한 번 등록

1. File Station에서 `docker/mywebsite/scripts`와 `docker/mywebsite/backups/mysql` 저장소를 만든다.
2. 맥의 `scripts/backup-mysql-nas.sh`를 `scripts` 저장소에 업로드한다. NAS상 최종 경로는 `/volume1/docker/mywebsite/scripts/backup-mysql-nas.sh`여야 한다.
3. DSM `제어판 > 작업 스케줄러 > 생성 > 예약된 작업 > 사용자 정의 스크립트`를 선택한다.
4. 일반 설정에서 작업 이름을 `coffee-order-mysql-backup`으로 입력하고 사용자를 `root`로 선택한다.
5. 일정 설정에서 `매일`, 실행 시간 `03:00`을 선택한다.
6. 작업 설정의 실행 명령에 다음을 입력한다.

```sh
/bin/sh /volume1/docker/mywebsite/scripts/backup-mysql-nas.sh
```

7. 저장한 뒤 작업을 선택하고 `실행`을 눌러 즉시 한 번 시험한다.
8. File Station에서 `docker/mywebsite/backups/mysql/coffee_order_YYYYMMDD_HHMMSS.sql.gz` 파일이 생성됐는지 확인한다.

보관 기간만 바꾸려면 실행 명령을 다음처럼 설정한다. 예시는 60일이다.

```sh
RETENTION_DAYS=60 /bin/sh /volume1/docker/mywebsite/scripts/backup-mysql-nas.sh
```

백업 저장소를 바꾸려면 `BACKUP_DIR`도 지정한다.

```sh
BACKUP_DIR=/volume1/docker/mywebsite/backups/mysql RETENTION_DAYS=30 /bin/sh /volume1/docker/mywebsite/scripts/backup-mysql-nas.sh
```

## 수동 실행과 확인

NAS 작업 스케줄러에서 작업을 선택하고 `실행`을 누르는 방법이 가장 간단하다. SSH를 사용한다면 같은 스크립트를 다음 명령으로 실행할 수 있다.

```sh
sudo /bin/sh /volume1/docker/mywebsite/scripts/backup-mysql-nas.sh
```

직접 `mysqldump`를 실행하면 완료 표시 확인, 압축, 권한 설정을 별도로 해야 하므로 수동 백업에도 이 스크립트를 사용한다.

백업 파일의 압축 무결성과 완료 표시를 확인하려면:

```sh
gzip -t /volume1/docker/mywebsite/backups/mysql/백업파일.sql.gz
gzip -dc /volume1/docker/mywebsite/backups/mysql/백업파일.sql.gz | grep '^-- Dump completed on '
```

아무 오류 없이 종료하고 `Dump completed on` 줄이 출력돼야 한다. 파일 크기만 보고 백업 성공으로 판단하지 않는다.

## 복원 시험

복원은 운영 DB가 아닌 별도 DB에서 먼저 시험한다. dump에는 테이블을 삭제하고 다시 만드는 구문이 포함되므로 운영 `coffee_order`에 바로 실행하면 현재 테이블을 덮어쓴다.

2026-11-08에 맥의 임시 MySQL 8.4.13 컨테이너에서 첫 운영 백업을 실제 복원해 확인했다.

- 9개 테이블 생성과 데이터 복원 성공
- 복원 DB와 운영 DB의 테이블별 건수 일치
- 주문 979건, 활성 주문 896건 일치
- 시험 후 임시 컨테이너와 시험 파일 삭제

정기적인 자동 백업 후에도 한 달에 한 번 정도 별도 테스트 DB에서 복원 시험을 하는 것이 좋다.

## 실제 장애 시 복원

다음 명령은 현재 운영 테이블을 덮어쓴다. 복원 날짜 이후의 주문과 변경 사항은 사라질 수 있다. 반드시 복원할 백업 파일을 확인하고, 가능하면 현재 상태도 추가로 백업한 뒤 진행한다.

1. Container Manager에서 `coffee-order` 앱 컨테이너만 중지한다. `coffee-mysql`은 실행 상태로 둔다.
2. 아래 명령의 `백업파일.sql.gz`를 실제 파일명으로 바꾼다.
3. NAS에서 다음 명령으로 기존 `coffee_order`에 복원한다.

```sh
gzip -dc /volume1/docker/mywebsite/backups/mysql/백업파일.sql.gz | \
  sudo /usr/local/bin/docker exec -i coffee-mysql sh -c '
    MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql \
      --default-character-set=utf8mb4 \
      -h 127.0.0.1 -u root "$MYSQL_DATABASE"
  '
```

4. 건수와 최신 주문일을 확인한다.

```sh
sudo /usr/local/bin/docker exec coffee-mysql sh -c '
  MYSQL_PWD="$MYSQL_PASSWORD" exec mysql \
    -h 127.0.0.1 -u "$MYSQL_USER" "$MYSQL_DATABASE" \
    -e "SELECT COUNT(*) AS orders_total, SUM(del_yn=\"N\") AS active_orders, MAX(order_date) AS latest_order_date FROM orders; SHOW TABLES;"
'
```

5. Container Manager에서 `coffee-order` 앱을 시작하고 실제 화면에서 부서·팀·메뉴·주문 내역을 확인한다.

## NAS 장애에 대비한 추가 백업

NAS 안의 백업 저장소는 DB 오류나 실수로 인한 삭제에는 유용하지만, NAS 자체 고장이나 디스크 손상까지 보호하지는 못한다. `docker/mywebsite/backups/mysql`을 대상으로 DSM Hyper Backup을 설정해 외장 USB, 다른 NAS 또는 암호화된 클라우드 저장소에 주 1회 복사하는 것을 권장한다.

백업 파일에는 이름, 부서, 주문 내역 등 개인정보가 포함된다. File Station 공유 권한과 외부 저장소 접근 권한을 최소화하고, 백업 파일을 메신저나 공개 링크로 공유하지 않는다.
