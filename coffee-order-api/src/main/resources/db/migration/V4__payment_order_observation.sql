CREATE TABLE payment_attempt (
    id BIGINT NOT NULL AUTO_INCREMENT,
    rep_member_id BIGINT NOT NULL,
    status VARCHAR(30) NOT NULL,
    store_cd VARCHAR(20) NOT NULL,
    baseline_order_nos_json TEXT NULL,
    baseline_captured TINYINT(1) NOT NULL DEFAULT 0,
    hold_reason VARCHAR(1000) NULL,
    active_key VARCHAR(100) NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    linked_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_payment_attempt_active (active_key),
    KEY idx_payment_attempt_rep (rep_member_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE cart_snapshot (
    id BIGINT NOT NULL AUTO_INCREMENT,
    attempt_id BIGINT NOT NULL,
    version INT NOT NULL,
    raw_hash VARCHAR(64) NOT NULL,
    items_hash VARCHAR(64) NOT NULL,
    items_json MEDIUMTEXT NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_cart_snapshot_version (attempt_id, version),
    KEY idx_cart_snapshot_attempt (attempt_id, version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE external_order (
    id BIGINT NOT NULL AUTO_INCREMENT,
    rep_member_id BIGINT NOT NULL,
    ord_no VARCHAR(40) NOT NULL,
    simple_order_no VARCHAR(20) NULL,
    store_cd VARCHAR(20) NOT NULL,
    store_nm VARCHAR(200) NULL,
    status_code VARCHAR(10) NULL,
    status_name VARCHAR(50) NULL,
    current_step VARCHAR(50) NULL,
    steps_json TEXT NULL,
    ordered_at DATETIME(6) NULL,
    pickup_at DATETIME(6) NULL,
    total_order_amount INT NULL,
    discount_amount INT NULL,
    final_payment_amount INT NULL,
    payment_amounts_json TEXT NULL,
    pos_sale_no VARCHAR(50) NULL,
    receipt_no VARCHAR(50) NULL,
    payment_approval_no VARCHAR(50) NULL,
    payment_approved_at DATETIME(6) NULL,
    message VARCHAR(500) NULL,
    linked_at DATETIME(6) NULL,
    last_checked_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_external_order_rep_ord (rep_member_id, ord_no),
    KEY idx_external_order_rep_status (rep_member_id, status_code, ordered_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE external_order_item (
    id BIGINT NOT NULL AUTO_INCREMENT,
    external_order_id BIGINT NOT NULL,
    ord_dtl_no VARCHAR(20) NOT NULL,
    menu_cd VARCHAR(20) NOT NULL,
    menu_nm VARCHAR(200) NULL,
    option_nm VARCHAR(1000) NULL,
    quantity INT NOT NULL,
    display_unit_price INT NULL,
    display_line_amount INT NULL,
    custom_options_json TEXT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_external_order_item_line (external_order_id, ord_dtl_no),
    KEY idx_external_order_item_order (external_order_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE payment_attempt_order (
    id BIGINT NOT NULL AUTO_INCREMENT,
    attempt_id BIGINT NOT NULL,
    external_order_id BIGINT NOT NULL,
    ord_no VARCHAR(40) NOT NULL,
    snapshot_version INT NOT NULL,
    before_hash VARCHAR(64) NOT NULL,
    after_hash VARCHAR(64) NOT NULL,
    candidate_count INT NOT NULL,
    rule_version VARCHAR(40) NOT NULL,
    linked_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_payment_attempt_order_attempt_ord (attempt_id, ord_no),
    UNIQUE KEY uk_payment_attempt_order_external (external_order_id),
    KEY idx_payment_attempt_order_attempt (attempt_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE payment_attempt_local_order (
    id BIGINT NOT NULL AUTO_INCREMENT,
    attempt_id BIGINT NOT NULL,
    order_id BIGINT NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_payment_attempt_local_order (attempt_id, order_id),
    KEY idx_payment_attempt_local_order_id (order_id),
    KEY idx_payment_attempt_local_order_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE orders
    ADD COLUMN external_order_id BIGINT NULL,
    ADD COLUMN external_order_no VARCHAR(40) NULL,
    ADD COLUMN external_order_status VARCHAR(10) NULL,
    ADD COLUMN external_order_linked_at DATETIME(6) NULL,
    ADD KEY idx_orders_external_order_id (external_order_id);
