-- 투썸플레이스 메뉴 초기 데이터

-- 커피 카테고리
INSERT INTO menu (name, category, del_yn, created_date) VALUES ('아메리카노', '커피', 'N', CURRENT_TIMESTAMP);
INSERT INTO menu (name, category, del_yn, created_date) VALUES ('카페 라떼', '커피', 'N', CURRENT_TIMESTAMP);
INSERT INTO menu (name, category, del_yn, created_date) VALUES ('카푸치노', '커피', 'N', CURRENT_TIMESTAMP);
INSERT INTO menu (name, category, del_yn, created_date) VALUES ('바닐라 라떼', '커피', 'N', CURRENT_TIMESTAMP);
INSERT INTO menu (name, category, del_yn, created_date) VALUES ('카페 모카', '커피', 'N', CURRENT_TIMESTAMP);
INSERT INTO menu (name, category, del_yn, created_date) VALUES ('카라멜 마키아또', '커피', 'N', CURRENT_TIMESTAMP);
INSERT INTO menu (name, category, del_yn, created_date) VALUES ('헤이즐넛 라떼', '커피', 'N', CURRENT_TIMESTAMP);
INSERT INTO menu (name, category, del_yn, created_date) VALUES ('카페 비엔나', '커피', 'N', CURRENT_TIMESTAMP);
INSERT INTO menu (name, category, del_yn, created_date) VALUES ('연유 라떼', '커피', 'N', CURRENT_TIMESTAMP);

-- 디카페인 커피
INSERT INTO menu (name, category, del_yn, created_date) VALUES ('디카페인 아메리카노', '디카페인 커피', 'N', CURRENT_TIMESTAMP);
INSERT INTO menu (name, category, del_yn, created_date) VALUES ('디카페인 카페 라떼', '디카페인 커피', 'N', CURRENT_TIMESTAMP);
INSERT INTO menu (name, category, del_yn, created_date) VALUES ('디카페인 바닐라 라떼', '디카페인 커피', 'N', CURRENT_TIMESTAMP);

-- 음료
INSERT INTO menu (name, category, del_yn, created_date) VALUES ('초코 칩 프라페', '음료', 'N', CURRENT_TIMESTAMP);
INSERT INTO menu (name, category, del_yn, created_date) VALUES ('민트 초코 칩 프라페', '음료', 'N', CURRENT_TIMESTAMP);
INSERT INTO menu (name, category, del_yn, created_date) VALUES ('쿠키 앤 크림 블렌디드', '음료', 'N', CURRENT_TIMESTAMP);
INSERT INTO menu (name, category, del_yn, created_date) VALUES ('딸기 라떼', '음료', 'N', CURRENT_TIMESTAMP);
INSERT INTO menu (name, category, del_yn, created_date) VALUES ('녹차 라떼', '음료', 'N', CURRENT_TIMESTAMP);
INSERT INTO menu (name, category, del_yn, created_date) VALUES ('고구마 라떼', '음료', 'N', CURRENT_TIMESTAMP);
INSERT INTO menu (name, category, del_yn, created_date) VALUES ('초콜릿', '음료', 'N', CURRENT_TIMESTAMP);
INSERT INTO menu (name, category, del_yn, created_date) VALUES ('레몬 에이드', '음료', 'N', CURRENT_TIMESTAMP);
INSERT INTO menu (name, category, del_yn, created_date) VALUES ('자몽 에이드', '음료', 'N', CURRENT_TIMESTAMP);
INSERT INTO menu (name, category, del_yn, created_date) VALUES ('청포도 에이드', '음료', 'N', CURRENT_TIMESTAMP);
INSERT INTO menu (name, category, del_yn, created_date) VALUES ('오렌지 주스', '음료', 'N', CURRENT_TIMESTAMP);

-- 티/티라떼
INSERT INTO menu (name, category, del_yn, created_date) VALUES ('얼그레이', '티/티라떼', 'N', CURRENT_TIMESTAMP);
INSERT INTO menu (name, category, del_yn, created_date) VALUES ('캐모마일', '티/티라떼', 'N', CURRENT_TIMESTAMP);
INSERT INTO menu (name, category, del_yn, created_date) VALUES ('페퍼민트', '티/티라떼', 'N', CURRENT_TIMESTAMP);
INSERT INTO menu (name, category, del_yn, created_date) VALUES ('유자차', '티/티라떼', 'N', CURRENT_TIMESTAMP);
INSERT INTO menu (name, category, del_yn, created_date) VALUES ('레몬티', '티/티라떼', 'N', CURRENT_TIMESTAMP);
INSERT INTO menu (name, category, del_yn, created_date) VALUES ('밀크티', '티/티라떼', 'N', CURRENT_TIMESTAMP);

-- 아이스크림/빙수
INSERT INTO menu (name, category, del_yn, created_date) VALUES ('바닐라 아이스크림', '아이스크림/빙수', 'N', CURRENT_TIMESTAMP);
INSERT INTO menu (name, category, del_yn, created_date) VALUES ('초코 아이스크림', '아이스크림/빙수', 'N', CURRENT_TIMESTAMP);
INSERT INTO menu (name, category, del_yn, created_date) VALUES ('딸기 빙수', '아이스크림/빙수', 'N', CURRENT_TIMESTAMP);
INSERT INTO menu (name, category, del_yn, created_date) VALUES ('망고 빙수', '아이스크림/빙수', 'N', CURRENT_TIMESTAMP);

-- 기본 설정 (주문 마감 시간: 09:00, 24시간 주문 가능: false)
INSERT INTO settings (order_deadline_time, is_24hours, updated_date) VALUES ('09:00:00', false, CURRENT_TIMESTAMP);

-- 샘플 팀원 데이터 (선택사항)
INSERT INTO team (name, del_yn, created_date) VALUES ('홍길동', 'N', CURRENT_TIMESTAMP);
INSERT INTO team (name, del_yn, created_date) VALUES ('김철수', 'N', CURRENT_TIMESTAMP);
INSERT INTO team (name, del_yn, created_date) VALUES ('이영희', 'N', CURRENT_TIMESTAMP);
