DROP PROCEDURE IF EXISTS migrate_twosome_menu_composite_key;
DELIMITER $$
CREATE PROCEDURE migrate_twosome_menu_composite_key()
BEGIN
    DECLARE current_schema VARCHAR(64);
    DECLARE old_index_name VARCHAR(64);
    DECLARE composite_index_count INT DEFAULT 0;
    SET current_schema = DATABASE();

    SELECT COUNT(*) INTO composite_index_count
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = current_schema AND TABLE_NAME = 'twosome_menu'
      AND INDEX_NAME = 'uk_twosome_menu_cd_mid_cd';

    IF composite_index_count = 0 THEN
        SET old_index_name = (
            SELECT INDEX_NAME
            FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA = current_schema AND TABLE_NAME = 'twosome_menu' AND NON_UNIQUE = 0
            GROUP BY INDEX_NAME
            HAVING COUNT(*) = 1 AND MAX(COLUMN_NAME) = 'menu_cd'
            LIMIT 1
        );

        IF old_index_name IS NOT NULL THEN
            SET @drop_index_sql = CONCAT('ALTER TABLE twosome_menu DROP INDEX `', old_index_name, '`');
            PREPARE drop_index_statement FROM @drop_index_sql;
            EXECUTE drop_index_statement;
            DEALLOCATE PREPARE drop_index_statement;
        END IF;

        ALTER TABLE twosome_menu
            ADD UNIQUE KEY uk_twosome_menu_cd_mid_cd (menu_cd, mid_cd);
    END IF;
END $$
DELIMITER ;
CALL migrate_twosome_menu_composite_key();
DROP PROCEDURE IF EXISTS migrate_twosome_menu_composite_key;
