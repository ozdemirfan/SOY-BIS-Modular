-- Mevcut INT PK/FK’ları BIGINT’e yükseltir (Date.now() tabanlı ID taşması / 2147483647 hatası için).
-- Yedek aldıktan sonra phpMyAdmin veya mysql CLI ile çalıştırın.

SET NAMES utf8mb4;

ALTER TABLE sporcular MODIFY id BIGINT NOT NULL;
ALTER TABLE aidatlar MODIFY id BIGINT NOT NULL;
ALTER TABLE aidatlar MODIFY sporcuId BIGINT NOT NULL;
ALTER TABLE giderler MODIFY id BIGINT NOT NULL;
ALTER TABLE antrenorler MODIFY id BIGINT NOT NULL;
ALTER TABLE yoklama_audit MODIFY sporcuId BIGINT NOT NULL;
