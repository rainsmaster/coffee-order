ALTER TABLE orders
    ADD COLUMN cart_reflected_by BIGINT NULL;

CREATE TABLE release_note (
    id BIGINT NOT NULL AUTO_INCREMENT,
    version VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    summary VARCHAR(1000) NOT NULL,
    content TEXT NOT NULL,
    published_at DATETIME(6),
    is_published TINYINT(1) NOT NULL DEFAULT 0,
    created_by VARCHAR(100),
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6),
    PRIMARY KEY (id),
    KEY idx_release_note_published (is_published, published_at, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS invite_code;
