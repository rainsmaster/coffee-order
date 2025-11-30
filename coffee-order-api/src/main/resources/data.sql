-- menu_id 컬럼을 nullable로 변경 (TWOSOME 모드에서는 menu_id가 null일 수 있음)
ALTER TABLE orders ALTER COLUMN menu_id SET NULL;
