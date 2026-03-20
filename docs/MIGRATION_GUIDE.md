# SOY-BIS v3.0 - Migration Guide

## 🎯 Modern Architecture Migration

Bu doküman, SOY-BIS'in vanilla JavaScript'ten modern TypeScript + Vite mimarisine geçiş sürecini açıklar.

## ✅ Tamamlanan Adımlar

### 1. Build Tool & Package Management
- ✅ `package.json` oluşturuldu
- ✅ Vite 5.0 kuruldu
- ✅ TypeScript 5.3 kuruldu
- ✅ ESLint + Prettier konfigürasyonu

### 2. Proje Yapısı
- ✅ Modern klasör yapısı oluşturuldu (`src/`, `public/`)
- ✅ Type definitions eklendi (`src/types/index.ts`)
- ✅ Entry point oluşturuldu (`src/main.ts`)

### 3. Konfigürasyon Dosyaları
- ✅ `tsconfig.json` - TypeScript ayarları
- ✅ `vite.config.ts` - Build konfigürasyonu
- ✅ `.eslintrc.json` - Linting kuralları
- ✅ `.prettierrc` - Code formatting
- ✅ `.gitignore` - Git ignore rules

## 📋 Yapılacaklar

### Faz 1: Bağımlılıkları Yükleme
```bash
npm install
```

### Faz 2: Mevcut Kodun Migration'ı

#### 2.1 Utils Migration
- [ ] `js/utils/helpers.js` → `src/utils/helpers.ts`
- [ ] `js/utils/storage.js` → `src/utils/storage.ts`
- [ ] `js/utils/auth.js` → `src/utils/auth.ts`
- [ ] `js/utils/validation.js` → `src/utils/validation.ts`

#### 2.2 Modules Migration
- [ ] `js/modules/dashboard.js` → `src/modules/dashboard.ts`
- [ ] `js/modules/sporcu.js` → `src/modules/sporcu.ts`
- [ ] `js/modules/aidat.js` → `src/modules/aidat.ts`
- [ ] `js/modules/yoklama.js` → `src/modules/yoklama.ts`
- [ ] `js/modules/gider.js` → `src/modules/gider.ts`
- [ ] `js/modules/antrenor.js` → `src/modules/antrenor.ts`
- [ ] `js/modules/rapor.js` → `src/modules/rapor.ts`
- [ ] `js/modules/notification.js` → `src/modules/notification.ts`
- [ ] `js/modules/ayarlar.js` → `src/modules/ayarlar.ts`
- [ ] `js/modules/kullanici-yonetimi.js` → `src/modules/kullanici-yonetimi.ts`

#### 2.3 App Migration
- [ ] `js/app.js` → `src/app.ts`

### Faz 3: External Libraries
- [ ] Chart.js: CDN'den npm package'a geçiş
- [ ] html2pdf.js: CDN'den npm package'a geçiş
- [ ] xlsx: CDN'den npm package'a geçiş
- [ ] Font Awesome: CDN'den npm package'a geçiş (opsiyonel)

### Faz 4: Type Safety
- [ ] Tüm fonksiyonlara type annotations ekle
- [ ] Interface'ler oluştur
- [ ] Generic types kullan
- [ ] Strict mode'u aktif et

### Faz 5: Module System
- [ ] IIFE pattern'den ES Modules'e geçiş
- [ ] Named exports kullan
- [ ] Import/export statements

## 🔄 Migration Stratejisi

### Adım 1: Utils'leri Migrate Et
Utils modülleri en az bağımlılığa sahip olduğu için önce bunlardan başla.

```typescript
// Before (helpers.js)
const Helpers = (function() {
  function paraFormat(sayi) {
    // ...
  }
  return { paraFormat };
})();

// After (helpers.ts)
export function paraFormat(sayi: number | string): string {
  // ...
}
```

### Adım 2: Storage & Auth Migrate Et
Bu modüller diğer modüller tarafından kullanıldığı için öncelikli.

### Adım 3: Modules'leri Migrate Et
Her modülü tek tek migrate et ve test et.

### Adım 4: App.ts'yi Güncelle
Tüm modüller migrate edildikten sonra app.ts'yi güncelle.

## 🧪 Test Stratejisi

1. Her modül migrate edildikten sonra test et
2. Development server'da çalıştır (`npm run dev`)
3. Type checking yap (`npm run type-check`)
4. Linting kontrolü yap (`npm run lint`)

## 📝 Notlar

- Mevcut `js/` klasörü migration tamamlanana kadar korunacak
- Migration sırasında hem eski hem yeni kod çalışabilir
- Her adımda commit yap
- Migration tamamlandıktan sonra `js/` klasörü silinebilir

## 🚀 Sonraki Adımlar

1. `npm install` çalıştır
2. `npm run dev` ile development server'ı başlat
3. İlk modülü (helpers) migrate et
4. Test et ve devam et

