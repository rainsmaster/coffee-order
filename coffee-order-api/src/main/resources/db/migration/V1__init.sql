-- =============================================================
-- V1__init.sql — coffee-order MySQL 초기 스키마
-- CUSTOM 모드 제거 완료 상태의 엔티티 기준 (2026-10-26)
--   - MENU / TWOSOME_MENU_OPTION 테이블 없음 (폐기 확정)
--   - orders.menu_id 없음, orders.menu_type은 레거시 구분용으로 유지
--   - settings.menu_mode 없음 (TWOSOME 고정), department_id UNIQUE
--   - suggestion 계열은 password_hash/password_salt (SHA-256 + 행별 salt)
-- =============================================================

-- 부서
CREATE TABLE department (
    id BIGINT NOT NULL AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    del_yn VARCHAR(1) NOT NULL,
    created_date DATETIME(6) NOT NULL,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 팀원
CREATE TABLE team (
    id BIGINT NOT NULL AUTO_INCREMENT,
    department_id BIGINT,
    name VARCHAR(100) NOT NULL,
    del_yn VARCHAR(1) NOT NULL,
    created_date DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_team_department FOREIGN KEY (department_id) REFERENCES department (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 팀 대표 (PIN 해시+salt 저장)
CREATE TABLE member (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 대표 초대코드 (해시만 저장, 1회 사용)
CREATE TABLE invite_code (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 주문 설정 (부서당 1건 강제 — 이중 INSERT 방지)
CREATE TABLE settings (
    id BIGINT NOT NULL AUTO_INCREMENT,
    order_deadline_time TIME,
    is_24hours TINYINT(1) NOT NULL DEFAULT 0,
    department_id BIGINT,
    updated_date DATETIME(6),
    PRIMARY KEY (id),
    UNIQUE KEY uk_settings_department (department_id),
    CONSTRAINT fk_settings_department FOREIGN KEY (department_id) REFERENCES department (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 투썸 메뉴
CREATE TABLE twosome_menu (
    id BIGINT NOT NULL AUTO_INCREMENT,
    menu_cd VARCHAR(20) NOT NULL,
    menu_nm VARCHAR(200) NOT NULL,
    en_menu_nm VARCHAR(200),
    grt_cd VARCHAR(10),
    grt_nm VARCHAR(50),
    mid_cd VARCHAR(10),
    mid_nm VARCHAR(50),
    menu_img VARCHAR(500),
    menu_img_01 VARCHAR(500),
    menu_img_02 VARCHAR(500),
    menu_img_03 VARCHAR(500),
    badg_cd VARCHAR(20),
    badg_nm VARCHAR(50),
    sort_ord INT,
    dm_display_no VARCHAR(20),
    local_img_path VARCHAR(500),
    sale_amt INT,
    sales_psbl_qty INT,
    default_menu_cd VARCHAR(20),
    use_fr_dt VARCHAR(8),
    option_data LONGTEXT,
    del_yn VARCHAR(1) NOT NULL,
    created_date DATETIME(6) NOT NULL,
    updated_date DATETIME(6),
    PRIMARY KEY (id),
    UNIQUE KEY uk_twosome_menu_cd (menu_cd)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 주문 (CUSTOM 모드 제거 후 — menu_id 없음, menu_type은 레거시 구분용)
CREATE TABLE orders (
    id BIGINT NOT NULL AUTO_INCREMENT,
    created_time DATETIME(6) NOT NULL,
    del_yn VARCHAR(1) NOT NULL,
    order_date DATE NOT NULL,
    personal_option VARCHAR(500),
    team_id BIGINT NOT NULL,
    menu_type VARCHAR(20),
    department_id BIGINT,
    twosome_menu_id BIGINT,
    cart_reflected_at DATETIME(6),
    variant_menu_cd VARCHAR(20),
    variant_opts VARCHAR(100),
    cstm_info TEXT,
    PRIMARY KEY (id),
    KEY idx_orders_date_del (order_date, del_yn),
    CONSTRAINT fk_orders_team FOREIGN KEY (team_id) REFERENCES team (id),
    CONSTRAINT fk_orders_department FOREIGN KEY (department_id) REFERENCES department (id),
    CONSTRAINT fk_orders_twosome_menu FOREIGN KEY (twosome_menu_id) REFERENCES twosome_menu (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 건의사항 (비밀번호는 SHA-256 + 행별 salt 해시 저장)
CREATE TABLE suggestion (
    id BIGINT NOT NULL AUTO_INCREMENT,
    title VARCHAR(100) NOT NULL,
    content VARCHAR(1000) NOT NULL,
    author VARCHAR(50) NOT NULL,
    password_hash VARCHAR(100) NOT NULL,
    password_salt VARCHAR(100) NOT NULL,
    pinned TINYINT(1) NOT NULL DEFAULT 0,
    del_yn VARCHAR(1) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6),
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 건의사항 댓글
CREATE TABLE suggestion_comment (
    id BIGINT NOT NULL AUTO_INCREMENT,
    suggestion_id BIGINT NOT NULL,
    content VARCHAR(500) NOT NULL,
    author VARCHAR(50) NOT NULL,
    password_hash VARCHAR(100) NOT NULL,
    password_salt VARCHAR(100) NOT NULL,
    del_yn VARCHAR(1) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6),
    PRIMARY KEY (id),
    CONSTRAINT fk_suggestion_comment_suggestion FOREIGN KEY (suggestion_id) REFERENCES suggestion (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 투썸 연동 헬스 이벤트 (180일 보관 후 purge)
CREATE TABLE twosome_health_event (
    id BIGINT NOT NULL AUTO_INCREMENT,
    event_type VARCHAR(50) NOT NULL,
    success TINYINT(1) NOT NULL,
    message VARCHAR(2000),
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    KEY idx_health_event_created (created_at),
    KEY idx_health_event_type_created (event_type, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
