-- SOY-BIS MySQL Schema (shared DB)
-- Not: Türkçe karakterler/kolaylık için utf8mb4 kullanıyoruz.
-- Veritabanı oluşturduktan sonra bu dosyayı çalıştırın.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS users (
  id INT NOT NULL AUTO_INCREMENT,
  kullaniciAdi VARCHAR(50) NOT NULL,
  adSoyad VARCHAR(120) NOT NULL,
  email VARCHAR(120) NOT NULL DEFAULT '',
  rol VARCHAR(30) NOT NULL,
  aktif TINYINT(1) NOT NULL DEFAULT 1,
  sifreHash CHAR(64) NOT NULL,
  olusturmaTarihi DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_kullaniciAdi (kullaniciAdi)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Sporcular: id primary key + JSON/TEXT kayıt
CREATE TABLE IF NOT EXISTS sporcular (
  id INT NOT NULL,
  data LONGTEXT NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS aidatlar (
  id INT NOT NULL,
  sporcuId INT NOT NULL,
  donemAy INT NOT NULL,
  donemYil INT NOT NULL,
  data LONGTEXT NOT NULL,
  PRIMARY KEY (id),
  KEY ix_aidatlar_sporcuId (sporcuId),
  KEY ix_aidatlar_donem (donemAy, donemYil)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Yoklama: (tarih, grup) unique + JSON/TEXT kayıt
CREATE TABLE IF NOT EXISTS yoklamalar (
  tarih DATE NOT NULL,
  grup VARCHAR(50) NOT NULL,
  data LONGTEXT NOT NULL,
  PRIMARY KEY (tarih, grup)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS giderler (
  id INT NOT NULL,
  data LONGTEXT NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS antrenorler (
  id INT NOT NULL,
  data LONGTEXT NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Ayarlar (notificationSettings ve benzeri JSON object)
CREATE TABLE IF NOT EXISTS ayarlar (
  id INT NOT NULL DEFAULT 1,
  data LONGTEXT NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Başlangıç bakiyesi (kolay alanlar)
CREATE TABLE IF NOT EXISTS baslangic_bakiyesi (
  id INT NOT NULL DEFAULT 1,
  nakit DECIMAL(20,2) NOT NULL DEFAULT 0,
  banka DECIMAL(20,2) NOT NULL DEFAULT 0,
  tarih DATE NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Enhanced yoklama audit trail
CREATE TABLE IF NOT EXISTS yoklama_audit (
  id INT NOT NULL AUTO_INCREMENT,
  yoklamaTarih DATE NOT NULL,
  yoklamaGrup VARCHAR(50) NOT NULL,
  sporcuId INT NOT NULL,
  eskiDurum VARCHAR(20) NOT NULL,
  yeniDurum VARCHAR(20) NOT NULL,
  kullaniciId INT NOT NULL,
  kullaniciAdi VARCHAR(50) NOT NULL,
  kullaniciRol VARCHAR(30) NOT NULL,
  timestamp DATETIME NOT NULL,
  cihaz VARCHAR(30) NOT NULL DEFAULT 'web',
  userAgent TEXT NULL,
  PRIMARY KEY (id),
  KEY ix_yoklama_audit_tarih_grup (yoklamaTarih, yoklamaGrup),
  KEY ix_yoklama_audit_sporcu (sporcuId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Varsayılan ayarlar/başlangıç bakiyesi için tek satır oluştur
INSERT IGNORE INTO ayarlar (id, data) VALUES (1, '{}');
INSERT IGNORE INTO baslangic_bakiyesi (id, nakit, banka, tarih)
VALUES (1, 0, 0, CURDATE());

