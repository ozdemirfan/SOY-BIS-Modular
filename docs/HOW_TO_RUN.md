# 🚀 SOY-BIS v3.0 - Çalıştırma Kılavuzu

## ✅ Migration Tamamlandı!

Tüm JavaScript modülleri başarıyla TypeScript'e migrate edildi. Artık modern, type-safe bir codebase'iniz var!

## 📋 Çalıştırma Adımları

### 1. Bağımlılıkları Yükleyin (Eğer yapmadıysanız)

```bash
npm install
```

### 2. Development Server'ı Başlatın

```bash
npm run dev
```

Bu komut:
- Vite development server'ı başlatır
- Otomatik olarak tarayıcıda `http://localhost:3000` adresini açar
- Hot Module Replacement (HMR) ile kod değişikliklerini anında yansıtır

### 3. Uygulamayı Kullanın

- Varsayılan admin kullanıcısı ile giriş yapın:
  - **Kullanıcı Adı:** `admin`
  - **Şifre:** `admin123`

## 🛠️ Diğer Komutlar

### Type Checking
```bash
npm run type-check
```
TypeScript type kontrolü yapar (hata varsa gösterir).

### Linting
```bash
npm run lint
```
Kod kalitesi kontrolü yapar.

### Formatting
```bash
npm run format
```
Prettier ile kod formatlar.

### Build (Production)
```bash
npm run build
```
Production için optimize edilmiş build oluşturur.

### Preview (Production Build)
```bash
npm run build
npm run preview
```
Production build'i local'de test eder.

## 📁 Proje Yapısı

```
SOY-BIS-Modular/
├── src/                    # TypeScript kaynak kodları
│   ├── app.ts             # Ana uygulama modülü
│   ├── main.ts            # Vite entry point
│   ├── modules/           # Tüm modüller (TypeScript)
│   ├── utils/             # Yardımcı fonksiyonlar (TypeScript)
│   ├── types/             # TypeScript type definitions
│   └── styles/            # CSS dosyaları
├── public/                # Static dosyalar (logo.png)
├── js/                    # Eski JavaScript dosyaları (artık kullanılmıyor)
├── css/                   # CSS dosyaları
├── index.html             # Ana HTML dosyası
├── package.json           # NPM dependencies
├── vite.config.ts         # Vite konfigürasyonu
└── tsconfig.json          # TypeScript konfigürasyonu
```

## 🔧 Önemli Notlar

1. **Eski JS Dosyaları**: `js/` klasöründeki eski JavaScript dosyaları artık kullanılmıyor. TypeScript versiyonları `src/` klasöründe.

2. **External Libraries**: 
   - Chart.js: npm'den import ediliyor ✅
   - xlsx: npm'den import ediliyor ✅
   - html2pdf.js: Şimdilik kullanılmıyor (rapor.ts window.print kullanıyor)

3. **Global Window Objeleri**: Modüller hala `window` objesi üzerinden erişilebilir (backward compatibility için).

## 🐛 Sorun Giderme

### Uygulama açılmıyor / Beyaz ekran
- Tarayıcı konsolunu kontrol edin (F12)
- `npm run type-check` ile type hatalarını kontrol edin
- Vite server'ın çalıştığından emin olun

### Module not found hatası
- `npm install` komutunu tekrar çalıştırın
- `node_modules` klasörünü silip tekrar `npm install` yapın

### Type errors
- `npm run type-check` ile hataları görüntüleyin
- Tüm modüllerin doğru import edildiğinden emin olun

## 🎉 Başarılı Migration!

- ✅ 15 modül TypeScript'e migrate edildi
- ✅ Tüm kodlar type-safe
- ✅ Modern ES Modules kullanılıyor
- ✅ Vite + TypeScript + ESLint + Prettier aktif

Uygulama hazır! `npm run dev` ile başlatabilirsiniz.

