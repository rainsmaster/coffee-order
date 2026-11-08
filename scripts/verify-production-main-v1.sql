USE coffee_order;

-- upgrade-production-to-main-v1.sql 적용 후 실행하는 검증 쿼리.
-- actual과 expected가 다른 항목이 있으면 운영 배포를 중단한다.

SELECT 'new_tables' AS check_name, COUNT(*) AS actual, 3 AS expected
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'coffee_order'
  AND TABLE_NAME IN ('member', 'invite_code', 'twosome_health_event');

SELECT 'orders_new_columns' AS check_name, COUNT(*) AS actual, 4 AS expected
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'coffee_order' AND TABLE_NAME = 'orders'
  AND COLUMN_NAME IN ('cart_reflected_at', 'variant_menu_cd', 'variant_opts', 'cstm_info');

SELECT 'twosome_menu_new_columns' AS check_name, COUNT(*) AS actual, 5 AS expected
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'coffee_order' AND TABLE_NAME = 'twosome_menu'
  AND COLUMN_NAME IN ('sale_amt', 'sales_psbl_qty', 'default_menu_cd', 'use_fr_dt', 'option_data');

SELECT 'suggestion_hash_columns' AS check_name, COUNT(*) AS actual, 4 AS expected
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'coffee_order'
  AND ((TABLE_NAME = 'suggestion' AND COLUMN_NAME IN ('password_hash', 'password_salt'))
    OR (TABLE_NAME = 'suggestion_comment' AND COLUMN_NAME IN ('password_hash', 'password_salt')));

SELECT 'legacy_password_now_nullable' AS check_name, COUNT(*) AS actual, 2 AS expected
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'coffee_order'
  AND TABLE_NAME IN ('suggestion', 'suggestion_comment')
  AND COLUMN_NAME = 'password' AND IS_NULLABLE = 'YES';

SELECT 'orders_date_index' AS check_name, COUNT(DISTINCT INDEX_NAME) AS actual, 1 AS expected
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = 'coffee_order' AND TABLE_NAME = 'orders'
  AND INDEX_NAME = 'idx_orders_date_del';

SELECT 'suggestion_missing_hash' AS check_name, COUNT(*) AS actual, 0 AS expected
FROM suggestion
WHERE password IS NOT NULL AND (password_hash IS NULL OR password_salt IS NULL);

SELECT 'suggestion_hash_mismatch' AS check_name, COUNT(*) AS actual, 0 AS expected
FROM suggestion
WHERE password IS NOT NULL
  AND password_hash <> LOWER(SHA2(CONCAT(password, ':', password_salt), 256));

SELECT 'comment_missing_hash' AS check_name, COUNT(*) AS actual, 0 AS expected
FROM suggestion_comment
WHERE password IS NOT NULL AND (password_hash IS NULL OR password_salt IS NULL);

SELECT 'comment_hash_mismatch' AS check_name, COUNT(*) AS actual, 0 AS expected
FROM suggestion_comment
WHERE password IS NOT NULL
  AND password_hash <> LOWER(SHA2(CONCAT(password, ':', password_salt), 256));

SELECT 'suggestion_invalid_hash_length' AS check_name, COUNT(*) AS actual, 0 AS expected
FROM suggestion
WHERE password IS NOT NULL
  AND (CHAR_LENGTH(password_hash) <> 64 OR CHAR_LENGTH(password_salt) <> 32);

SELECT 'comment_invalid_hash_length' AS check_name, COUNT(*) AS actual, 0 AS expected
FROM suggestion_comment
WHERE password IS NOT NULL
  AND (CHAR_LENGTH(password_hash) <> 64 OR CHAR_LENGTH(password_salt) <> 32);

SELECT 'legacy_custom_missing_name' AS check_name, COUNT(*) AS actual, 0 AS expected
FROM orders
WHERE (menu_type IS NULL OR menu_type <> 'TWOSOME')
  AND NULLIF(TRIM(personal_option), '') IS NULL;

SELECT 'orders_preserved_count' AS check_name, COUNT(*) AS actual, 'compare_with_backup' AS expected
FROM orders;
SELECT 'twosome_menu_preserved_count' AS check_name, COUNT(*) AS actual, 'compare_with_backup' AS expected
FROM twosome_menu;
SELECT 'suggestion_preserved_count' AS check_name, COUNT(*) AS actual, 'compare_with_backup' AS expected
FROM suggestion;
SELECT 'comment_preserved_count' AS check_name, COUNT(*) AS actual, 'compare_with_backup' AS expected
FROM suggestion_comment;
