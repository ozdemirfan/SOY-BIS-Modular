# SOY-BIS v3.0 - Modern Architecture

Spor Okulları Yönetim Bilgi Sistemi - Modern TypeScript + Vite Architecture

## 🚀 Teknoloji Stack

- **Build Tool**: Vite 5.0
- **Language**: TypeScript 5.3
- **Package Manager**: npm/pnpm/yarn
- **Linting**: ESLint + Prettier
- **Module System**: ES Modules

## 📦 Kurulum

```bash
# Bağımlılıkları yükle
npm install
# veya
pnpm install
# veya
yarn install
```

## 🛠️ Geliştirme

```bash
# Development server başlat
npm run dev

# Production build
npm run build

# Build önizleme
npm run preview

# Type checking
npm run type-check

# Linting
npm run lint
npm run lint:fix

# Code formatting
npm run format
```

## 📁 Proje Yapısı

```
SOY-BIS-Modular/
├── public/              # Statik dosyalar (logo.png, favicon, vb.)
├── src/
│   ├── components/      # Reusable UI components
│   ├── modules/         # Feature modules (sporcu, aidat, yoklama, vb.)
│   ├── services/        # API services & business logic
│   ├── utils/           # Utility functions
│   ├── types/           # TypeScript type definitions
│   ├── styles/          # CSS/SCSS files
│   └── main.ts          # Application entry point
├── dist/                # Build output
├── node_modules/        # Dependencies
├── index.html           # HTML entry point
├── vite.config.ts       # Vite configuration
├── tsconfig.json        # TypeScript configuration
├── package.json         # Dependencies & scripts
└── README.md           # This file
```

## 🔧 Konfigürasyon

### TypeScript
- Strict mode aktif
- Path aliases: `@/`, `@components/`, `@modules/`, `@utils/`, `@types/`, `@services/`
- Target: ES2020
- Module: ESNext

### Vite
- Dev server: `http://localhost:3000`
- Code splitting: Vendor chunks (charts, utils)
- Source maps: Production'da aktif

### ESLint & Prettier
- TypeScript-aware linting
- Auto-formatting
- Strict rules

### Ortam değişkenleri (Vite + PHP API)

| Amaç | Nerede | Örnek |
|------|--------|--------|
| Frontend’in çağırdığı API kök adresi | `.env.local` (kopya: `.env.example`) | `VITE_SOYBIS_API_BASE=http://localhost/soybis/api` veya üretimde `/api` |
| Vite dev: `/api` isteklerinin yönlendirileceği Apache kökü (sonda `/api` yok) | `.env.local` | `VITE_SOYBIS_API_PROXY_TARGET=http://localhost/soybis` |
| PHP API’de hata ayıklama (JSON 500 yanıtına `detail` ekler) | Apache/nginx **ortam değişkeni** (Vite `.env` otomatik yüklemez) | `SOYBIS_API_DEBUG=1` |

**Yedek / geri yükleme:** Uygulama içi yedek indirme ve dosyadan geri yükleme; paylaşımlı modda sunucuya da `backup/restore` isteği gider. API kapalıyken veriler yerelde güncellenir; senkron uyarısı gösterilebilir.

## 📝 Migration Notları

Bu versiyon, vanilla JavaScript'ten TypeScript + Vite mimarisine geçiş yapıyor.

### Yapılacaklar:
- [x] Package.json ve build tool kurulumu
- [x] TypeScript konfigürasyonu
- [ ] Mevcut JS dosyalarının TypeScript'e migration'ı
- [ ] Module system'e geçiş (ES Modules)
- [ ] Type definitions oluşturma
- [ ] Component-based architecture'a geçiş

## 📄 PDF Export Stabilite Notu

- PDF render akışı `createPdfExportRuntime()` üzerinden izole host (`iframe`) içinde çalışır.
- Geçici PDF DOM'u ana UI'ya eklenmez; bu sayede indirme sırasında katman/z-index çakışmaları azalır.
- Temizleme sırası her zaman: `worker.save()` sonrası `cleanup(root)`.
- Smoke test önerisi:
  - Masaüstü: `Raporlar > PDF İndir`
  - Mobil: `Raporlar > PDF İndir`
  - Sporcu: `Sporcu Detay > PDF İndir`

## 🎯 Hedefler

- ✅ Modern build tool (Vite)
- ✅ Type safety (TypeScript)
- ✅ Code quality (ESLint + Prettier)
- ✅ Better developer experience
- ✅ Optimized bundle size
- ✅ Fast development server

## 📄 Lisans

MIT

