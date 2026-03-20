# SOY-BIS Shared DB: Backup / Restore

Paylaşımlı veri (PHP JSON API + MySQL) modunda `Storage` katmanı artık veriyi backend’den okumaya çalışır ve bazı akışlarda backend’e de yazma yapar.

## 1. `yedekOlustur()`
- `yedekOlustur` mevcut durumda **local cache** (`localStorage`) üzerinden yedek üretir.
- Admin girişi yapıldıktan sonra cache warmup olduğu için genellikle doğru veriyi içerir.

## 2. `yedekYukle(yedek)`
- Local cache’e geri yükler (UI hemen güncellensin diye).
- Ardından backend’e asenkron olarak `POST /api/backup/restore` çağrısı atar.
- Backend tarafında:
  - sadece oturum açmış kullanıcı,
  - rolü `Yönetici`
  - veri seti (`sporcular`, `aidatlar`, `yoklamalar`, `giderler`, `antrenorler`) için tablo temizleme + yeniden insert
  - `yoklama_audit` temizliği yapılır.

## 3. `veriMigration()`
- Shared DB modunda **no-op** (devre dışı) çalışır.
- Bunun nedeni local key migration yapmak yerine backend cache’in zaten doğru veriyle başlamasını sağlamaktır.

## 4. `sistemSifirla(kullaniciAdi, sifre)`
- Shared DB modunda önce backend’e `POST /api/system/reset` çağrısı yapar (admin şifresi doğrulanır).
- Backend reset başarılı olunca local cache de temizlenir.
- Reset sonrasında backend:
  - `sporcular`, `aidatlar`, `yoklamalar`, `giderler`, `antrenorler` tablolarını boşaltır
  - `yoklama_audit` tablosunu temizler
  - `ayarlar` ve `baslangic_bakiyesi` default değerlere döndürür.

