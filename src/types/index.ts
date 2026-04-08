/**
 * SOY-BIS - Type Definitions
 * Centralized type definitions for the application
 */

// User & Authentication Types
export interface User {
  id: number;
  kullaniciAdi: string;
  adSoyad: string;
  email?: string;
  rol: 'Yönetici' | 'Antrenör' | 'Muhasebe';
  aktif: boolean;
  sifreHash?: string;
  olusturmaTarihi?: string;
}

export interface Session {
  id: number;
  kullaniciAdi: string;
  rol: string;
  adSoyad: string;
  email: string;
  girisTarihi: string;
}

/** Kulüp içi antrenman grubu (merkezi liste, `soybis_antrenman_gruplari`) */
export interface AntrenmanGrubu {
  id: string;
  ad: string;
  /** Spor branşı (Futbol, Basketbol, …). Eski kayıtlarda boş olabilir. */
  brans?: string;
}

// Sporcu Types
export interface Sporcu {
  id: number;
  temelBilgiler: {
    adSoyad: string;
    tcKimlik?: string;
    dogumTarihi?: string;
    cinsiyet?: string;
  };
  sporBilgileri: {
    brans?: string;
    formaNo?: string;
  };
  iletisim: {
    telefon?: string;
    email?: string;
  };
  veliBilgileri: {
    veli1: {
      ad?: string;
      telefon?: string;
      yakinlik?: string;
    };
    veli2: {
      ad?: string;
      telefon?: string;
    };
  };
  odemeBilgileri: {
    aylikUcret: number;
    burslu: boolean;
    odemeGunu: number | null;
  };
  ekUcretler: {
    esofman: {
      tutar: number;
      odendi: boolean;
    };
    forma: {
      tutar: number;
      odendi: boolean;
    };
    yagmurluk: {
      tutar: number;
      odendi: boolean;
    };
    diger: {
      tutar: number;
      odendi: boolean;
    };
  };
  kayitOdemeDurumu: 'alindi' | 'alinmadi';
  fiziksel: {
    boy?: string;
    kilo?: string;
    beden?: string;
    ayakNo?: string;
  };
  saglik: {
    kanGrubu?: string;
    alerjiler?: string;
    kronikHastalik?: string;
  };
  tffGruplari: {
    anaGrup?: string;
  };
  /** Merkezi antrenman grubu listesinden atama (`Storage.antrenmanGruplariGetir`) */
  antrenmanGrubuId?: string;
  belgeler: {
    saglikRaporu?: string | null;
    lisans?: string | null;
    lisansNo?: string;
    sigorta?: string | null;
  };
  /** Aktif/Pasif: işlemde; Ayrıldı: listeden düşer, aidat geçmişi korunur */
  durum: 'Aktif' | 'Pasif' | 'Ayrıldı';
  /** durum=Ayrıldı iken doldurulur — muhasebe silinmez */
  silinmeBilgisi?: {
    tarih: string;
    kaynak: 'kendi' | 'yonetici';
  };
  /** Son kez arşivden operasyonel listeye alındığında (Ayrıldı → Aktif) */
  yenidenKatilmaTarihi?: string;
  kayitTarihi?: string; // ISO formatında kayıt tarihi (örn: "2024-01-15T10:30:00.000Z")
}

// Aidat Types
export interface Aidat {
  id: number;
  sporcuId: number;
  sporcuAd?: string;
  donemAy?: number;
  donemYil?: number;
  tutar: number; // Pozitif (borç) veya Negatif (tahsilat)
  tarih?: string; // Ödeme tarihi (eski kayıtlar için)
  odemeTarihi?: string;
  odemeDurumu: 'Ödendi' | 'Ödenmedi' | 'Kısmi';
  odemeYontemi?: string;
  yontem?: string; // Ödeme yöntemi (eski kayıtlar için - 'Nakit' | 'Banka / Havale')
  kayitTarihi: string;
  notlar?: string;
  aciklama?: string;
  tip?: string;
  islem_turu?: 'Aidat' | 'Tahsilat' | 'Malzeme'; // İşlem türü (yeni mantık)
}

// Yoklama Types
export interface Yoklama {
  id: number;
  tarih: string;
  grup: string;
  sporcular: Array<{
    id: number;
    durum: 'var' | 'yok' | 'izinli' | 'gec-geldi';
  }>;
}

// Gider Types
export interface Gider {
  id: number;
  baslik: string;
  kategori: string;
  miktar: number;
  tarih: string;
  yontem?: string; // Ödeme kaynağı ('Nakit Kasa' | 'Banka Hesabı')
  aciklama?: string;
  kayitTarihi: string;
}

// Antrenör Types
// Antrenör Types
export interface Antrenor {
  id: number;
  adSoyad: string;
  tc?: string; // <--- BU SATIRI EKLE (Soru işareti koymayı unutma)
  telefon?: string;
  email?: string;
  brans?: string;
  maas?: number;
  durum: 'Aktif' | 'Pasif';
  kayitTarihi: string;
}

// Ayarlar Types
export interface Ayarlar {
  sistemAdi?: string;
  logo?: string;
  tema?: 'light' | 'dark';
  dil?: 'tr' | 'en';
  baslangicBakiyesi?: {
    nakit: number;
    banka: number;
    tarih: string; // Bakiyenin geçerli olduğu tarih
  };
}

// Storage Keys
export const STORAGE_KEYS = {
  SPORCULAR: 'soybis_sporcular',
  AIDATLAR: 'soybis_aidatlar',
  YOKLAMALAR: 'soybis_yoklamalar',
  GIDERLER: 'soybis_giderler',
  ANTRENORLER: 'soybis_antrenorler',
  AYARLAR: 'soybis_ayarlar',
  KULLANICILAR: 'soybis_kullanicilar',
  BASLANGIC_BAKIYESI: 'soybis_baslangic_bakiyesi',
  ANTRENMAN_GRUPLARI: 'soybis_antrenman_gruplari',
} as const;

// Utility Types
export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
export type UserRole = User['rol'];
export type SporcuDurum = Sporcu['durum'];
export type YoklamaDurum = Yoklama['sporcular'][0]['durum'];
