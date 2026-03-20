/**
 * SOY-BIS - Gelişmiş Yoklama Veri Modelleri
 * Offline-First, Real-time, Audit Trail desteği
 */

// ========== CORE TYPES ==========

export interface YoklamaSeansi {
  id: number;
  tarih: string; // ISO format: YYYY-MM-DD
  grup: string; // "U12", "U15" vb.

  // Seans detayları
  seansBaslangic?: string; // "14:00"
  seansBitis?: string; // "16:00"
  konum?: string; // "Salon A"
  notlar?: string;

  // Audit trail
  olusturanKullaniciId: number;
  olusturmaTarihi: string; // ISO timestamp
  guncellemeTarihi?: string;
  versiyon: number; // Conflict resolution için

  // Antrenör bilgisi
  antrenorId?: number;

  // Katılımcılar
  katilimcilar: YoklamaKatilimci[];

  // Analytics cache (hesaplama performansı için)
  _cache?: {
    toplamKatilimci: number;
    varSayisi: number;
    yokSayisi: number;
    izinliSayisi: number;
    gecGeldiSayisi: number;
    devamOrani: number;
    seansOncesiPlan?: number;
  };

  // Sync durumu
  _syncStatus?: {
    synced: boolean;
    lastSyncTimestamp?: string;
    conflicted?: boolean;
  };
}

export interface YoklamaKatilimci {
  sporcuId: number;
  durum: YoklamaDurum;

  // Detay bilgileri
  gelisSaati?: string; // "14:15" - Geç gelme tracking
  notlar?: string; // Sporcu özel not

  // Audit
  kaydedenKullaniciId: number;
  kayitZamani: string; // ISO timestamp
  degistirmeSayisi: number; // Kaç kez değiştirildi
  sonDegistiren?: number; // Son değiştiren kullanıcı ID
  sonDegistirmeTarihi?: string;
}

export type YoklamaDurum = 'var' | 'yok' | 'izinli' | 'gec-geldi';

// ========== AUDIT TRAIL ==========

export interface YoklamaAuditLog {
  id: number;
  yoklamaSeansId: number;
  sporcuId: number;

  islem: 'ekle' | 'guncelle' | 'sil' | 'toplu-islem';
  eskiDeger?: YoklamaDurum;
  yeniDeger?: YoklamaDurum;

  kullaniciId: number;
  kullaniciAdi: string;
  kullaniciRol: string;

  timestamp: string; // ISO timestamp
  cihaz: 'web' | 'mobile' | 'tablet';
  ip?: string;
  userAgent?: string;
}

// ========== STATE MANAGEMENT ==========

export interface YoklamaPendingChange {
  sporcuId: number;
  yeniDurum: YoklamaDurum;
  eskiDurum: YoklamaDurum;
  timestamp: number;
  applied: boolean; // UI'da uygulandı mı
  saved: boolean; // Storage'a kaydedildi mi
}

export interface YoklamaStateSnapshot {
  seansId: number;
  timestamp: number;
  katilimcilar: Map<number, YoklamaDurum>; // sporcuId -> durum
  pendingChanges: YoklamaPendingChange[];
}

// ========== HISTORY (UNDO/REDO) ==========

export interface YoklamaHistoryEntry {
  id: number;
  timestamp: number;
  type: 'single' | 'bulk';

  // Single change
  sporcuId?: number;
  eskiDurum?: YoklamaDurum;
  yeniDurum?: YoklamaDurum;

  // Bulk change
  changes?: Array<{
    sporcuId: number;
    eskiDurum: YoklamaDurum;
    yeniDurum: YoklamaDurum;
  }>;

  undoable: boolean;
  redoable: boolean;
}

// ========== ANALYTICS ==========

export interface DevamTrendi {
  tarih: string;
  grup: string;
  devamOrani: number;
  toplamSporcu: number;
  varSayisi: number;
}

export interface SporcuDevamPaterni {
  sporcuId: number;
  toplamYoklama: number;
  devamOrani: number;

  // Pattern'ler
  ardasikDevamsizlik: number; // Üst üste kaç gün gelmedi
  genellikleGeldigiGunler: string[]; // ["Pazartesi", "Çarşamba"]
  genellikleGelmedigiGunler: string[]; // ["Cuma"]
  sonDevamsizlikTarihi?: string;

  // Risk skorları
  riskSkoru: number; // 0-100, yüksek = risk
  riskSeviyesi: 'dusuk' | 'orta' | 'yuksek';

  // Öneriler
  oneriler: string[];
}

export interface SeansIstatistik {
  seansId: number;
  tarih: string;
  grup: string;

  toplamBeklenen: number;
  toplamKatilan: number;
  devamOrani: number;

  // Detay
  varSayisi: number;
  yokSayisi: number;
  izinliSayisi: number;
  gecGelenler: number;

  // Karşılaştırma
  oncekiSeansDevamOrani?: number;
  degisim?: number; // +5% veya -3%

  // Hedef
  hedefDevamOrani: number; // %85
  hedefe: number; // -5% (hedefe ulaşmak için)
}

// ========== OFFLINE SYNC ==========

export interface SyncQueueItem {
  id: string; // Unique ID
  type: 'yoklama-kayit' | 'yoklama-guncelle' | 'yoklama-sil';
  data: any;
  timestamp: number;
  retryCount: number;
  synced: boolean;
  error?: string;
}

export interface ConflictResolution {
  localVersion: YoklamaSeansi;
  remoteVersion: YoklamaSeansi;
  conflictType: 'update-update' | 'update-delete' | 'delete-update';
  resolution: 'local-wins' | 'remote-wins' | 'merge' | 'user-prompt';
  mergedVersion?: YoklamaSeansi;
}

// ========== VALIDATION ==========

export interface YoklamaValidationResult {
  valid: boolean;
  errors: {
    [key: string]: string;
  };
  warnings: {
    [key: string]: string;
  };
}

// ========== EXPORTS ==========

export const YOKLAMA_DURUM_LABELS: Record<YoklamaDurum, string> = {
  var: 'VAR',
  yok: 'YOK',
  izinli: 'İZİNLİ',
  'gec-geldi': 'GEÇ GELDİ',
} as const;

export const YOKLAMA_DURUM_COLORS: Record<YoklamaDurum, string> = {
  var: '#38a169',
  yok: '#e53e3e',
  izinli: '#d69e2e',
  'gec-geldi': '#ed8936',
} as const;

export const YOKLAMA_DURUM_ICONS: Record<YoklamaDurum, string> = {
  var: 'fa-check-circle',
  yok: 'fa-times-circle',
  izinli: 'fa-clock',
  'gec-geldi': 'fa-exclamation-triangle',
} as const;
