# 🔐 Login Debug Kılavuzu

## Varsayılan Giriş Bilgileri

**Kullanıcı Adı:** `admin`  
**Şifre:** `1234` ⚠️ (admin123 değil!)

## Sorun Giderme

### 1. Tarayıcı Konsolunu Açın
- `F12` tuşuna basın
- "Console" sekmesine geçin

### 2. Login Form Submit Kontrolü
Aşağıdaki mesajları görmelisiniz:
- ✅ `Login form submit edildi`
- ✅ `Giriş denemesi: { kullaniciAdi: "admin", sifreUzunluk: 4 }`
- ✅ `Auth.girisYap çağrılıyor...`
- ✅ `Giriş sonucu: Başarılı` veya `Giriş sonucu: Başarısız`

### 3. Olası Hatalar

#### ❌ "Login form bulunamadı!"
- `index.html`'de `#loginForm` ID'si olmalı
- Sayfayı yenileyin (F5)

#### ❌ "Giriş sonucu: Başarısız"
- Şifreyi kontrol edin: `1234` (dört rakam)
- Kullanıcı adını kontrol edin: `admin` (küçük harf)
- Tarayıcı konsolunda detaylı hata mesajını kontrol edin

#### ❌ Hiçbir log görünmüyor
- Login form submit event listener çalışmıyor
- Sayfayı yenileyin ve tekrar deneyin
- Tarayıcı konsolunda JavaScript hatalarını kontrol edin

### 4. İlk Kullanım

İlk kez çalıştırıyorsanız, varsayılan admin kullanıcısı otomatik oluşturulur:
- Kullanıcı Adı: `admin`
- Şifre: `1234`
- Rol: `Yönetici`

### 5. Şifreyi Unuttuysanız

LocalStorage'ı temizleyip tekrar başlatın:
1. Tarayıcı konsolunu açın (F12)
2. Console sekmesinde şu komutu çalıştırın:
```javascript
localStorage.clear();
sessionStorage.clear();
location.reload();
```
3. Sayfa yenilendikten sonra varsayılan admin tekrar oluşturulur

## Debug İpuçları

- Konsol log'larını kontrol edin
- Network sekmesinde API çağrılarını kontrol edin (varsa)
- Application > Local Storage'da verileri kontrol edin
- Application > Session Storage'da oturum bilgisini kontrol edin

