-- 부서(Department) 데이터 마이그레이션 스크립트
-- 이 스크립트는 기존 데이터를 새로운 부서 구조로 마이그레이션합니다.

-- 1. 4개의 초기 부서 생성
INSERT INTO department (name, del_yn, created_date) VALUES ('상품서비스개발팀', 'N', NOW());
INSERT INTO department (name, del_yn, created_date) VALUES ('디자인팀', 'N', NOW());
INSERT INTO department (name, del_yn, created_date) VALUES ('프론트개발팀', 'N', NOW());
INSERT INTO department (name, del_yn, created_date) VALUES ('전시서비스개발팀', 'N', NOW());

-- 2. 기존 팀원(Team) 데이터를 "상품서비스개발팀"에 연결
UPDATE team SET department_id = (SELECT id FROM department WHERE name = '상품서비스개발팀') WHERE department_id IS NULL;

-- 3. 기존 메뉴(Menu) 데이터를 "상품서비스개발팀"에 연결
UPDATE menu SET department_id = (SELECT id FROM department WHERE name = '상품서비스개발팀') WHERE department_id IS NULL;

-- 4. 기존 주문(Orders) 데이터를 "상품서비스개발팀"에 연결
UPDATE orders SET department_id = (SELECT id FROM department WHERE name = '상품서비스개발팀') WHERE department_id IS NULL;

-- 5. 기존 설정(Settings) 데이터를 "상품서비스개발팀"에 연결
UPDATE settings SET department_id = (SELECT id FROM department WHERE name = '상품서비스개발팀') WHERE department_id IS NULL;
