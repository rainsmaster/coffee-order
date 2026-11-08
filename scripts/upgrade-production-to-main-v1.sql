USE coffee_order;

-- H2에서 이관한 기존 운영 MySQL을 최신 메인 V1과 호환되게 만드는 1회용 스크립트.
-- Flyway db/migration에 넣지 않는다. 복원본 검증 없이 운영에 실행하지 않는다.
-- 레거시 테이블과 컬럼은 삭제하지 않으며, DDL은 실행 중 자동 커밋된다.

DROP PROCEDURE IF EXISTS upgrade_production_to_main_v1;
DELIMITER $$
CREATE PROCEDURE upgrade_production_to_main_v1()
BEGIN
    DECLARE current_schema VARCHAR(64);
    SET current_schema = DATABASE();

    IF current_schema IS NULL OR current_schema <> 'coffee_order' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'coffee_order 데이터베이스를 선택해야 합니다.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = current_schema AND TABLE_NAME = 'orders'
    ) OR NOT EXISTS (
        SELECT 1 FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = current_schema AND TABLE_NAME = 'twosome_menu'
    ) OR NOT EXISTS (
        SELECT 1 FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = current_schema AND TABLE_NAME = 'suggestion'
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '기존 운영 스키마가 아니므로 실행을 중단합니다.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = current_schema AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'cart_reflected_at'
    ) THEN
        ALTER TABLE orders ADD COLUMN cart_reflected_at DATETIME(6) NULL AFTER twosome_menu_id;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = current_schema AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'variant_menu_cd'
    ) THEN
        ALTER TABLE orders ADD COLUMN variant_menu_cd VARCHAR(20) NULL AFTER cart_reflected_at;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = current_schema AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'variant_opts'
    ) THEN
        ALTER TABLE orders ADD COLUMN variant_opts VARCHAR(100) NULL AFTER variant_menu_cd;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = current_schema AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'cstm_info'
    ) THEN
        ALTER TABLE orders ADD COLUMN cstm_info TEXT NULL AFTER variant_opts;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = current_schema AND TABLE_NAME = 'orders' AND INDEX_NAME = 'idx_orders_date_del'
    ) THEN
        ALTER TABLE orders ADD INDEX idx_orders_date_del (order_date, del_yn);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = current_schema AND TABLE_NAME = 'twosome_menu' AND COLUMN_NAME = 'sale_amt'
    ) THEN
        ALTER TABLE twosome_menu ADD COLUMN sale_amt INT NULL AFTER local_img_path;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = current_schema AND TABLE_NAME = 'twosome_menu' AND COLUMN_NAME = 'sales_psbl_qty'
    ) THEN
        ALTER TABLE twosome_menu ADD COLUMN sales_psbl_qty INT NULL AFTER sale_amt;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = current_schema AND TABLE_NAME = 'twosome_menu' AND COLUMN_NAME = 'default_menu_cd'
    ) THEN
        ALTER TABLE twosome_menu ADD COLUMN default_menu_cd VARCHAR(20) NULL AFTER sales_psbl_qty;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = current_schema AND TABLE_NAME = 'twosome_menu' AND COLUMN_NAME = 'use_fr_dt'
    ) THEN
        ALTER TABLE twosome_menu ADD COLUMN use_fr_dt VARCHAR(8) NULL AFTER default_menu_cd;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = current_schema AND TABLE_NAME = 'twosome_menu' AND COLUMN_NAME = 'option_data'
    ) THEN
        ALTER TABLE twosome_menu ADD COLUMN option_data LONGTEXT NULL AFTER use_fr_dt;
    END IF;

    -- 새 메인은 password를 저장하지 않으므로 레거시 컬럼은 NULL을 허용해야 한다.
    -- 새 해시 컬럼도 롤백 기간에는 NULL을 허용해 이전 앱의 작성을 허용한다.
    IF EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = current_schema AND TABLE_NAME = 'suggestion'
          AND COLUMN_NAME = 'password' AND IS_NULLABLE = 'NO'
    ) THEN
        ALTER TABLE suggestion MODIFY COLUMN password VARCHAR(255) NULL;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = current_schema AND TABLE_NAME = 'suggestion' AND COLUMN_NAME = 'password_hash'
    ) THEN
        ALTER TABLE suggestion ADD COLUMN password_hash VARCHAR(100) NULL AFTER password;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = current_schema AND TABLE_NAME = 'suggestion' AND COLUMN_NAME = 'password_salt'
    ) THEN
        ALTER TABLE suggestion ADD COLUMN password_salt VARCHAR(100) NULL AFTER password_hash;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = current_schema AND TABLE_NAME = 'suggestion_comment'
          AND COLUMN_NAME = 'password' AND IS_NULLABLE = 'NO'
    ) THEN
        ALTER TABLE suggestion_comment MODIFY COLUMN password VARCHAR(255) NULL;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = current_schema AND TABLE_NAME = 'suggestion_comment' AND COLUMN_NAME = 'password_hash'
    ) THEN
        ALTER TABLE suggestion_comment ADD COLUMN password_hash VARCHAR(100) NULL AFTER password;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = current_schema AND TABLE_NAME = 'suggestion_comment' AND COLUMN_NAME = 'password_salt'
    ) THEN
        ALTER TABLE suggestion_comment ADD COLUMN password_salt VARCHAR(100) NULL AFTER password_hash;
    END IF;

    -- 기존 password는 Base64(SHA-256(평문))이다.
    -- 메인 PinCrypto.matches(legacyPasswordInput(raw), salt, hash)와 같은 값이 되도록 재해시한다.
    UPDATE suggestion
    SET password_salt = LOWER(REPLACE(UUID(), '-', ''))
    WHERE password IS NOT NULL AND password_hash IS NULL AND password_salt IS NULL;
    UPDATE suggestion
    SET password_hash = LOWER(SHA2(CONCAT(password, ':', password_salt), 256))
    WHERE password IS NOT NULL AND password_hash IS NULL AND password_salt IS NOT NULL;

    UPDATE suggestion_comment
    SET password_salt = LOWER(REPLACE(UUID(), '-', ''))
    WHERE password IS NOT NULL AND password_hash IS NULL AND password_salt IS NULL;
    UPDATE suggestion_comment
    SET password_hash = LOWER(SHA2(CONCAT(password, ':', password_salt), 256))
    WHERE password IS NOT NULL AND password_hash IS NULL AND password_salt IS NOT NULL;

    -- 최신 메인은 레거시 CUSTOM 주문의 메뉴 이름을 personal_option으로 표시한다.
    -- 초기 주문은 menu_id에만 이름이 있으므로 비어 있는 경우에만 기존 메뉴 이름을 보정한다.
    UPDATE orders o
    JOIN menu m ON m.id = o.menu_id
    SET o.personal_option = m.name
    WHERE (o.menu_type IS NULL OR o.menu_type <> 'TWOSOME')
      AND NULLIF(TRIM(o.personal_option), '') IS NULL;

    CREATE TABLE IF NOT EXISTS member (
        id BIGINT NOT NULL AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL,
        team_id BIGINT,
        role VARCHAR(20),
        pin_hash VARCHAR(100),
        pin_salt VARCHAR(100),
        pin_set_at DATETIME(6),
        pin_fail_count INT NOT NULL DEFAULT 0,
        pin_locked_until DATETIME(6),
        last_login_at DATETIME(6),
        twosome_id VARCHAR(100),
        twosome_pw VARCHAR(500),
        del_yn VARCHAR(1) NOT NULL,
        created_date DATETIME(6) NOT NULL,
        updated_date DATETIME(6),
        PRIMARY KEY (id),
        CONSTRAINT fk_member_team FOREIGN KEY (team_id) REFERENCES team (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    CREATE TABLE IF NOT EXISTS invite_code (
        id BIGINT NOT NULL AUTO_INCREMENT,
        member_id BIGINT,
        code_hash VARCHAR(100) NOT NULL,
        issued_at DATETIME(6) NOT NULL,
        expires_at DATETIME(6) NOT NULL,
        used_at DATETIME(6),
        del_yn VARCHAR(1) NOT NULL,
        created_date DATETIME(6) NOT NULL,
        PRIMARY KEY (id),
        CONSTRAINT fk_invite_code_member FOREIGN KEY (member_id) REFERENCES member (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    CREATE TABLE IF NOT EXISTS twosome_health_event (
        id BIGINT NOT NULL AUTO_INCREMENT,
        event_type VARCHAR(50) NOT NULL,
        success TINYINT(1) NOT NULL,
        message VARCHAR(2000),
        created_at DATETIME(6) NOT NULL,
        PRIMARY KEY (id),
        KEY idx_health_event_created (created_at),
        KEY idx_health_event_type_created (event_type, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    -- settings는 기존 부서별 중복 행이 있으므로 이번 전환에서 unique 제약을 추가하지 않는다.
    -- menu, twosome_menu_option, orders.menu_id, settings.menu_mode, password 컬럼도 유지한다.
END$$
DELIMITER ;

CALL upgrade_production_to_main_v1();
DROP PROCEDURE IF EXISTS upgrade_production_to_main_v1;
