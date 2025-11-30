-- 테스트용 데이터 INSERT 스크립트
-- H2 콘솔(http://localhost:8080/h2-console)에서 실행하거나
-- 백엔드 실행 시 자동으로 로드됩니다.

-- ============================================
-- 1. 팀원 데이터 (Team)
-- ============================================
INSERT INTO team (name, del_yn, created_date) VALUES ('김철수', 'N', CURRENT_TIMESTAMP);
INSERT INTO team (name, del_yn, created_date) VALUES ('이영희', 'N', CURRENT_TIMESTAMP);
INSERT INTO team (name, del_yn, created_date) VALUES ('박지민', 'N', CURRENT_TIMESTAMP);
INSERT INTO team (name, del_yn, created_date) VALUES ('최수현', 'N', CURRENT_TIMESTAMP);
INSERT INTO team (name, del_yn, created_date) VALUES ('정민수', 'N', CURRENT_TIMESTAMP);
INSERT INTO team (name, del_yn, created_date) VALUES ('강예린', 'N', CURRENT_TIMESTAMP);
INSERT INTO team (name, del_yn, created_date) VALUES ('윤서준', 'N', CURRENT_TIMESTAMP);
INSERT INTO team (name, del_yn, created_date) VALUES ('한지우', 'N', CURRENT_TIMESTAMP);

-- ============================================
-- 2. 커스텀 메뉴 데이터 (Menu)
-- ============================================
-- 커피
INSERT INTO menu (name, category, del_yn, created_date) VALUES ('아메리카노', '커피', 'N', CURRENT_TIMESTAMP);
INSERT INTO menu (name, category, del_yn, created_date) VALUES ('카페라떼', '커피', 'N', CURRENT_TIMESTAMP);
INSERT INTO menu (name, category, del_yn, created_date) VALUES ('바닐라라떼', '커피', 'N', CURRENT_TIMESTAMP);
INSERT INTO menu (name, category, del_yn, created_date) VALUES ('카라멜마끼아또', '커피', 'N', CURRENT_TIMESTAMP);
INSERT INTO menu (name, category, del_yn, created_date) VALUES ('카푸치노', '커피', 'N', CURRENT_TIMESTAMP);

-- 디카페인
INSERT INTO menu (name, category, del_yn, created_date) VALUES ('디카페인 아메리카노', '디카페인', 'N', CURRENT_TIMESTAMP);
INSERT INTO menu (name, category, del_yn, created_date) VALUES ('디카페인 라떼', '디카페인', 'N', CURRENT_TIMESTAMP);

-- 음료
INSERT INTO menu (name, category, del_yn, created_date) VALUES ('초코라떼', '음료', 'N', CURRENT_TIMESTAMP);
INSERT INTO menu (name, category, del_yn, created_date) VALUES ('녹차라떼', '음료', 'N', CURRENT_TIMESTAMP);
INSERT INTO menu (name, category, del_yn, created_date) VALUES ('고구마라떼', '음료', 'N', CURRENT_TIMESTAMP);
INSERT INTO menu (name, category, del_yn, created_date) VALUES ('딸기스무디', '음료', 'N', CURRENT_TIMESTAMP);

-- 티
INSERT INTO menu (name, category, del_yn, created_date) VALUES ('얼그레이', '티', 'N', CURRENT_TIMESTAMP);
INSERT INTO menu (name, category, del_yn, created_date) VALUES ('캐모마일', '티', 'N', CURRENT_TIMESTAMP);
INSERT INTO menu (name, category, del_yn, created_date) VALUES ('페퍼민트', '티', 'N', CURRENT_TIMESTAMP);
INSERT INTO menu (name, category, del_yn, created_date) VALUES ('유자차', '티', 'N', CURRENT_TIMESTAMP);

-- ============================================
-- 3. 과거 주문 데이터 (Orders) - 커스텀 메뉴
-- ============================================
-- 3일 전 주문들 (커스텀 메뉴)
INSERT INTO orders (team_id, menu_id, twosome_menu_id, menu_type, personal_option, order_date, del_yn, created_time)
SELECT t.id, m.id, NULL, 'CUSTOM', '아이스, 샷 추가', DATEADD('DAY', -3, CURRENT_DATE), 'N', DATEADD('DAY', -3, CURRENT_TIMESTAMP)
FROM team t, menu m WHERE t.name = '김철수' AND m.name = '아메리카노';

INSERT INTO orders (team_id, menu_id, twosome_menu_id, menu_type, personal_option, order_date, del_yn, created_time)
SELECT t.id, m.id, NULL, 'CUSTOM', '핫', DATEADD('DAY', -3, CURRENT_DATE), 'N', DATEADD('DAY', -3, CURRENT_TIMESTAMP)
FROM team t, menu m WHERE t.name = '이영희' AND m.name = '카페라떼';

INSERT INTO orders (team_id, menu_id, twosome_menu_id, menu_type, personal_option, order_date, del_yn, created_time)
SELECT t.id, m.id, NULL, 'CUSTOM', '아이스', DATEADD('DAY', -3, CURRENT_DATE), 'N', DATEADD('DAY', -3, CURRENT_TIMESTAMP)
FROM team t, menu m WHERE t.name = '박지민' AND m.name = '바닐라라떼';

-- 2일 전 주문들 (커스텀 메뉴)
INSERT INTO orders (team_id, menu_id, twosome_menu_id, menu_type, personal_option, order_date, del_yn, created_time)
SELECT t.id, m.id, NULL, 'CUSTOM', '아이스', DATEADD('DAY', -2, CURRENT_DATE), 'N', DATEADD('DAY', -2, CURRENT_TIMESTAMP)
FROM team t, menu m WHERE t.name = '김철수' AND m.name = '아메리카노';

INSERT INTO orders (team_id, menu_id, twosome_menu_id, menu_type, personal_option, order_date, del_yn, created_time)
SELECT t.id, m.id, NULL, 'CUSTOM', '핫, 시럽 추가', DATEADD('DAY', -2, CURRENT_DATE), 'N', DATEADD('DAY', -2, CURRENT_TIMESTAMP)
FROM team t, menu m WHERE t.name = '최수현' AND m.name = '카라멜마끼아또';

INSERT INTO orders (team_id, menu_id, twosome_menu_id, menu_type, personal_option, order_date, del_yn, created_time)
SELECT t.id, m.id, NULL, 'CUSTOM', NULL, DATEADD('DAY', -2, CURRENT_DATE), 'N', DATEADD('DAY', -2, CURRENT_TIMESTAMP)
FROM team t, menu m WHERE t.name = '정민수' AND m.name = '초코라떼';

INSERT INTO orders (team_id, menu_id, twosome_menu_id, menu_type, personal_option, order_date, del_yn, created_time)
SELECT t.id, m.id, NULL, 'CUSTOM', '아이스', DATEADD('DAY', -2, CURRENT_DATE), 'N', DATEADD('DAY', -2, CURRENT_TIMESTAMP)
FROM team t, menu m WHERE t.name = '강예린' AND m.name = '녹차라떼';

-- 1일 전(어제) 주문들 (커스텀 메뉴)
INSERT INTO orders (team_id, menu_id, twosome_menu_id, menu_type, personal_option, order_date, del_yn, created_time)
SELECT t.id, m.id, NULL, 'CUSTOM', '아이스, 연하게', DATEADD('DAY', -1, CURRENT_DATE), 'N', DATEADD('DAY', -1, CURRENT_TIMESTAMP)
FROM team t, menu m WHERE t.name = '김철수' AND m.name = '아메리카노';

INSERT INTO orders (team_id, menu_id, twosome_menu_id, menu_type, personal_option, order_date, del_yn, created_time)
SELECT t.id, m.id, NULL, 'CUSTOM', '핫', DATEADD('DAY', -1, CURRENT_DATE), 'N', DATEADD('DAY', -1, CURRENT_TIMESTAMP)
FROM team t, menu m WHERE t.name = '이영희' AND m.name = '디카페인 라떼';

INSERT INTO orders (team_id, menu_id, twosome_menu_id, menu_type, personal_option, order_date, del_yn, created_time)
SELECT t.id, m.id, NULL, 'CUSTOM', '아이스', DATEADD('DAY', -1, CURRENT_DATE), 'N', DATEADD('DAY', -1, CURRENT_TIMESTAMP)
FROM team t, menu m WHERE t.name = '박지민' AND m.name = '바닐라라떼';

INSERT INTO orders (team_id, menu_id, twosome_menu_id, menu_type, personal_option, order_date, del_yn, created_time)
SELECT t.id, m.id, NULL, 'CUSTOM', '핫', DATEADD('DAY', -1, CURRENT_DATE), 'N', DATEADD('DAY', -1, CURRENT_TIMESTAMP)
FROM team t, menu m WHERE t.name = '최수현' AND m.name = '얼그레이';

INSERT INTO orders (team_id, menu_id, twosome_menu_id, menu_type, personal_option, order_date, del_yn, created_time)
SELECT t.id, m.id, NULL, 'CUSTOM', NULL, DATEADD('DAY', -1, CURRENT_DATE), 'N', DATEADD('DAY', -1, CURRENT_TIMESTAMP)
FROM team t, menu m WHERE t.name = '윤서준' AND m.name = '카푸치노';

INSERT INTO orders (team_id, menu_id, twosome_menu_id, menu_type, personal_option, order_date, del_yn, created_time)
SELECT t.id, m.id, NULL, 'CUSTOM', '아이스', DATEADD('DAY', -1, CURRENT_DATE), 'N', DATEADD('DAY', -1, CURRENT_TIMESTAMP)
FROM team t, menu m WHERE t.name = '한지우' AND m.name = '딸기스무디';
