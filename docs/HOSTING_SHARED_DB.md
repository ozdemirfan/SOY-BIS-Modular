# Shared DB Hosting (cPanel/LiteSpeed + PHP/MySQL)

Bu doküman, SOY-BIS’i tarayıcıdaki `localStorage` modundan **paylaşımlı veri** moduna (PHP JSON API + MySQL) almak için gereken kurulum adımlarını özetler.

## 0. Ön koşullar
- cPanel/LiteSpeed üzerinde `PHP` ve `MySQL` aktif olmalı.
- cPanel içinde `mod_rewrite` (veya benzeri URL rewrite) çalışıyorsa önerilir.
- Front-end statik dosyalar için `dist/` web köküne yüklenecek.

## 1. MySQL şemayı kur
1. cPanel -> MySQL Databases içinde:
   - Veritabanı oluşturun
   - Kullanıcı oluşturun ve yetki verin
2. `docs/db_schema_mysql.sql` dosyasını çalıştırın.
   - İçerikte tablolar: `users`, `sporcular`, `aidatlar`, `yoklamalar`, `giderler`, `antrenorler`, `ayarlar`, `baslangic_bakiyesi`, `yoklama_audit`

## 2. API DB bağlantısını ayarla (`api/config.php`)
`api/config.php` içindeki şu alanları kendi DB bilgilerinle değiştir:
- `db.host`
- `db.name`
- `db.user`
- `db.pass`

Ayrıca ilk kurulum için:
- `default_admin.sifreDuzMetin` (varsayılan `1234`)
- Admin kullanıcı adı varsayılan: `admin`

> Güvenlik: `api/config.php` herkese açık hale gelmemeli. cPanel’de izin ayarlarını kontrol edin.

## 3. API klasörünü yükle
Proje root’undan üretim ortamına şu klasörü kopyalayın:
- `api/`  (web köküne `/api` olacak şekilde)

`api/` içinde ayrıca:
- `api/index.php`
- `api/config.php`
- `.htaccess`
- `routes/*.php`

## 4. Front-end build ve API base ayarı
Paylaşımlı veri modunu açmak için build sırasında aşağıdaki env değerini set etmeniz gerekir:
- `VITE_SOYBIS_API_BASE=/api`

Örnek:
- `VITE_SOYBIS_API_BASE=/api npm run build`

Sonrasında `dist/` içeriğini web köküne yükleyin.

> Önemli: cPanel’de runtime’da env set etmek yerine, Vite build sırasında bu değer JS dosyalarına gömülür.

## 5. İlk çalıştırma / Default Admin oluşturma
- Kullanıcı sayfayı açtığında UI tarafından `Storage.sistemBaslat()` çağrılır.
- API tarafında `POST /api/system/init` çalışır ve `users` tablosu boşsa default admin oluşturulur.
- Varsayılan admin:
  - kullanıcı adı: `admin`
  - şifre: `1234` (config’teki `default_admin.sifreDuzMetin`)

## 6. Rewrite sorunu olursa
`api/.htaccess` ile `/api/*` istekleri `api/index.php`’ye yönlendirilir.
- Eğer `mod_rewrite` kapalıysa:
  - endpoint’ler beklenildiği gibi çalışmayabilir.

Bu durumda hosting provider ile rewrite’i etkinleştirmeniz veya endpoint adresleme yöntemini değiştirmeniz gerekir.

## 7. Backup / Restore / Sistem Reset
Frontend’ten çağrılan backend akışları:
- `POST /api/backup/restore` (Admin rolü ister)
- `POST /api/system/reset` (Admin şifresi ister)

Detay: `docs/BACKUP_RESTORE_SHARED_DB.md`

