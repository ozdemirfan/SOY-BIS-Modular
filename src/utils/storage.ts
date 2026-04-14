/**
 * SOY-BIS - Veri Depolama Modülü (storage.ts)
 * LocalStorage yönetimi, yedekleme ve geri yükleme - TypeScript Version
 */

import type { Sporcu, Aidat, Yoklama, Gider, Antrenor, User, Ayarlar, AntrenmanGrubu } from '../types';
import { STORAGE_KEYS } from '../types';
import { toast, bugunISO, suAnkiDonem, ayAdi, adSoyadFormatla } from './helpers';
import { TC_GECICI_YER_TUTUCU } from './validation';
import { apiDelete, apiGet, apiPost } from '../services/apiClient';

// Hostingte env gömülmese bile shared DB modunun zorunlu çalışması için true.
const API_ENABLED = true;
const MAX_DB_INT_ID = 2147483647;

/** Arka plan API hatası — konsol (toast spam’ini önlemek için kaydet() tetikli senkronlarda sadece bu). */
function logApiSyncFailure(context: string, error: unknown): void {
  const detail = error instanceof Error ? error.message : String(error);
  console.warn(`[SOY-BIS API] ${context}:`, detail);
}

/** CRUD senkronu başarısız — kullanıcıya uyarı (yerel veri zaten güncellendi). */
function notifyApiSyncFailure(context: string, error: unknown): void {
  logApiSyncFailure(context, error);
  toast('Sunucuya yazılamadı; yerel kayıt güncel. Bağlantıyı kontrol edin.', 'warning');
}

// Backup interface
interface BackupData {
  versiyon: string;
  tarih: string;
  veriler: {
    sporcular: Sporcu[];
    aidatlar: Aidat[];
    yoklamalar: Yoklama[];
    giderler: Gider[];
    antrenorler: Antrenor[];
    antrenmanGruplari?: AntrenmanGrubu[];
  };
}

interface StorageStats {
  sporcuSayisi: number;
  odemeSayisi: number;
  yoklamaSayisi: number;
  giderSayisi: number;
  depolamaKB: number;
}

interface UserWithPassword extends Partial<User> {
  sifre?: string;
  sifreHash?: string;
}

function isValidDbIntId(value: unknown): value is number {
  return (
    typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= MAX_DB_INT_ID
  );
}

function generateDbSafeId(existingIds: number[]): number {
  const usedIds = new Set(existingIds.filter(isValidDbIntId));
  const baseId = Date.now() % MAX_DB_INT_ID;

  // Deterministik bir aralıkta ilerleyerek çakışmasız ve INT uyumlu ID üret.
  for (let offset = 0; offset < 10000; offset++) {
    const candidate = (baseId + offset) % MAX_DB_INT_ID || 1;
    if (!usedIds.has(candidate)) {
      return candidate;
    }
  }

  // Çok düşük olasılıklı yoğun çakışma durumunda rastgele fallback.
  for (let attempt = 0; attempt < 10000; attempt++) {
    const candidate = Math.floor(Math.random() * MAX_DB_INT_ID) + 1;
    if (!usedIds.has(candidate)) {
      return candidate;
    }
  }

  throw new Error('Uygun ID üretilemedi, lütfen tekrar deneyin.');
}

function normalizeAdSoyadFields<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(item => normalizeAdSoyadFields(item)) as unknown as T;
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const src = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  Object.entries(src).forEach(([key, fieldValue]) => {
    if (key === 'adSoyad' && typeof fieldValue === 'string') {
      out[key] = adSoyadFormatla(fieldValue);
      return;
    }
    out[key] = normalizeAdSoyadFields(fieldValue);
  });

  return out as T;
}

/**
 * Şifreyi hash'le (SHA-256)
 */
export async function sifreHash(sifre: string): Promise<string> {
  if (!sifre) return '';
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(sifre);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (error) {
    console.error('Şifre hash hatası:', error);
    // Fallback: Base64 encoding (daha az güvenli ama çalışır)
    return btoa(sifre);
  }
}

/**
 * LocalStorage'a veri kaydet
 */
export function kaydet<T>(key: string, data: T): boolean {
  try {
    // Quota kontrolü: Önce mevcut kullanımı kontrol et
    const mevcutKullanım = quotaKullanimi();
    if (mevcutKullanım.yuzde > 90) {
      console.warn("⚠️ LocalStorage kullanımı %90'ı aştı:", mevcutKullanım);
      // Kullanıcıyı uyar (sadece kritik durumda)
      if (mevcutKullanım.yuzde > 95) {
        toast('Depolama alanı neredeyse dolu! Lütfen bazı verileri silin.', 'warning');
      }
    }

    const jsonData = JSON.stringify(data);

    // localStorage'a yaz
    localStorage.setItem(key, jsonData);

    // Shared DB modunda sadece bazı ayar anahtarlarını backend'e de yazıyoruz.
    // Entity (sporcu/aidat/yoklama) yazımları ilgili CRUD fonksiyonlarında ayrıca yapılır.
    if (API_ENABLED) {
      if (key === STORAGE_KEYS.AYARLAR) {
        void apiPost('/ayarlar', data as unknown as Record<string, unknown>).catch(err =>
          logApiSyncFailure('Ayarlar senkronu', err)
        );
      }
      if (key === STORAGE_KEYS.BASLANGIC_BAKIYESI) {
        void apiPost('/baslangic_bakiyesi', data as unknown as Record<string, unknown>).catch(err =>
          logApiSyncFailure('Başlangıç bakiyesi senkronu', err)
        );
      }
    }

    // SessionStorage senkronizasyonu (sadece sporcular için)
    // Bazı tarayıcılarda localStorage farklı sekmelerde izole olabilir
    if (key === STORAGE_KEYS.SPORCULAR) {
      try {
        sessionStorage.setItem(key, jsonData);
      } catch (e) {
        // sessionStorage yazma hatası (quota vs.) - sessizce devam et
      }
    }

    // Yazma sonrası doğrulama (sadece kritik durumlarda)
    const dataLength = Array.isArray(data) ? data.length : undefined;
    if (dataLength !== undefined) {
      try {
        const dogrulama = localStorage.getItem(key);
        if (dogrulama) {
          const dogrulamaParsed = JSON.parse(dogrulama);
          const dogrulamaLength = Array.isArray(dogrulamaParsed)
            ? dogrulamaParsed.length
            : dogrulamaParsed
              ? 1
              : 0;
          if (dogrulamaLength !== dataLength) {
            console.error('⚠️ localStorage yazma doğrulama başarısız!', {
              key,
              beklenen: dataLength,
              gercek: dogrulamaLength,
            });
          }
        }
      } catch (e) {
        // Doğrulama hatası - kritik değil, devam et
      }
    }

    return true;
  } catch (error) {
    console.error('Kayıt hatası:', error);
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      const kullanım = quotaKullanimi();
      toast(
        `Depolama alanı dolu! (Kullanım: ${kullanım.yuzde.toFixed(1)}%)\n` +
          `Lütfen bazı verileri silin veya yedek alın.`,
        'error'
      );
    }
    return false;
  }
}

/**
 * LocalStorage quota kullanımını hesapla
 * @returns Kullanım bilgisi (byte, yüzde)
 */
export function quotaKullanimi(): { kullanilan: number; toplam: number; yuzde: number } {
  try {
    let kullanilan = 0;
    const tumKeyler: string[] = [];

    // Tüm localStorage key'lerini topla
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        tumKeyler.push(key);
        const deger = localStorage.getItem(key);
        if (deger) {
          kullanilan += new Blob([deger]).size;
        }
      }
    }

    // Tipik localStorage limiti: 5-10MB (tarayıcıya göre değişir)
    // Güvenli limit: 5MB (5 * 1024 * 1024 byte)
    const toplam = 5 * 1024 * 1024; // 5MB
    const yuzde = (kullanilan / toplam) * 100;

    return {
      kullanilan,
      toplam,
      yuzde: Math.min(100, yuzde), // Maksimum %100
    };
  } catch (error) {
    console.error('Quota kullanım hesaplama hatası:', error);
    return { kullanilan: 0, toplam: 5 * 1024 * 1024, yuzde: 0 };
  }
}

/**
 * LocalStorage'dan veri oku
 */
export function oku<T>(key: string, defaultValue: T): T {
  try {
    const data = localStorage.getItem(key);
    if (!data) {
      return defaultValue;
    }
    const parsed = JSON.parse(data) as T;
    return parsed;
  } catch (error) {
    console.error('Okuma hatası:', error);
    return defaultValue;
  }
}

/**
 * LocalStorage'dan veri sil
 */
export function sil(key: string): boolean {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error('Silme hatası:', error);
    return false;
  }
}

// ========== ANTRENMAN GRUPLARI (merkezi liste) ==========

export function antrenmanGruplariGetir(): AntrenmanGrubu[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ANTRENMAN_GRUPLARI);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const list: AntrenmanGrubu[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const o = item as Record<string, unknown>;
      const id = typeof o.id === 'string' ? o.id.trim() : '';
      if (!id) continue;
      const ad = typeof o.ad === 'string' ? o.ad : String(o.ad ?? '');
      const bransRaw = o.brans;
      const brans =
        typeof bransRaw === 'string' && bransRaw.trim() ? bransRaw.trim() : undefined;
      list.push(brans ? { id, ad, brans } : { id, ad });
    }
    return list;
  } catch {
    return [];
  }
}

export function antrenmanGruplariKaydet(gruplar: AntrenmanGrubu[]): void {
  kaydet(STORAGE_KEYS.ANTRENMAN_GRUPLARI, gruplar);
}

export function antrenmanGrubuBul(id: string | undefined | null): AntrenmanGrubu | null {
  if (!id) return null;
  return antrenmanGruplariGetir().find(g => g.id === id) || null;
}

/**
 * Aynı ad + aynı branşta grup varsa onu döndürür; yoksa yeni ekler.
 * @param brans - Boş bırakılırsa eski davranış (branşsız grup); yeni UI her zaman branş gönderir.
 */
export function antrenmanGrubuEkle(ad: string, brans?: string): AntrenmanGrubu | null {
  const trimmed = ad.trim();
  if (!trimmed) return null;
  const bransNorm = (brans || '').trim();
  const gruplar = antrenmanGruplariGetir();
  const mevcut = gruplar.find(
    g =>
      g.ad.toLowerCase() === trimmed.toLowerCase() &&
      (g.brans || '').trim().toLowerCase() === bransNorm.toLowerCase()
  );
  if (mevcut) return mevcut;
  const yeni: AntrenmanGrubu = {
    id: `ag_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    ad: trimmed,
    ...(bransNorm ? { brans: bransNorm } : {}),
  };
  gruplar.push(yeni);
  antrenmanGruplariKaydet(gruplar);
  return yeni;
}

/**
 * Grubu siler; o gruba atanmış sporcuların atamasını kaldırır.
 */
export function antrenmanGrubuSil(id: string): void {
  const gruplar = antrenmanGruplariGetir().filter(g => g.id !== id);
  antrenmanGruplariKaydet(gruplar);
  const sporcular = oku<Sporcu[]>(STORAGE_KEYS.SPORCULAR, []);
  let degisti = false;
  for (const s of sporcular) {
    if (s.antrenmanGrubuId === id) {
      s.antrenmanGrubuId = undefined;
      degisti = true;
    }
  }
  if (degisti) {
    kaydet(STORAGE_KEYS.SPORCULAR, sporcular);
    sporcuCacheTemizle();
  }
}

/** Eski `tffGruplari.kucukGrup` → merkezi grup + temiz tffGruplari */
function sporcuLegacyKucukGrupMigrate(s: Sporcu): Sporcu {
  const legacy = (s.tffGruplari as { kucukGrup?: string } | undefined)?.kucukGrup?.trim();
  const tff = s.tffGruplari ? { ...s.tffGruplari } : {};
  delete (tff as { kucukGrup?: string }).kucukGrup;

  let antrenmanGrubuId = s.antrenmanGrubuId;
  if (!antrenmanGrubuId && legacy) {
    const sporcuBrans = (s.sporBilgileri?.brans || '').trim();
    const mevcut = antrenmanGruplariGetir().find(
      g =>
        g.ad.toLowerCase() === legacy.toLowerCase() &&
        (g.brans || '').trim().toLowerCase() === sporcuBrans.toLowerCase()
    );
    const yeni = mevcut || antrenmanGrubuEkle(legacy, sporcuBrans || undefined);
    if (yeni) antrenmanGrubuId = yeni.id;
  }

  return { ...s, tffGruplari: tff, antrenmanGrubuId };
}

// ========== SPORCU İŞLEMLERİ ==========

/**
 * Tüm sporcuları getir
 * KRİTİK DÜZELTME: Cache kaldırıldı - farklı portlarda farklı modül instance'ları cache'i paylaşmıyor
 * Her zaman localStorage'dan okuyoruz, böylece tüm portlarda aynı veri görünür
 */
export function sporculariGetir(): Sporcu[] {
  const rawData = localStorage.getItem(STORAGE_KEYS.SPORCULAR);

  // localStorage boşsa, sessionStorage'dan kontrol et (senkronizasyon için)
  if (!rawData || rawData.trim() === '[]' || rawData.trim() === '') {
    try {
      const sessionData = sessionStorage.getItem(STORAGE_KEYS.SPORCULAR);
      if (sessionData && sessionData.trim() !== '[]' && sessionData.trim() !== '') {
        localStorage.setItem(STORAGE_KEYS.SPORCULAR, sessionData);
        const base = normalizeAdSoyadFields(oku<Sporcu[]>(STORAGE_KEYS.SPORCULAR, []));
        return finalizeSporcularList(base);
      }
    } catch (e) {
      // sessionStorage erişim hatası - sessizce devam et
    }
  }

  const base = normalizeAdSoyadFields(oku<Sporcu[]>(STORAGE_KEYS.SPORCULAR, []));
  return finalizeSporcularList(base);
}

function finalizeSporcularList(rawList: Sporcu[]): Sporcu[] {
  let anyLegacy = false;
  const list = rawList.map(s => {
    if ((s.tffGruplari as { kucukGrup?: string } | undefined)?.kucukGrup) {
      anyLegacy = true;
    }
    return sporcuLegacyKucukGrupMigrate(s);
  });
  if (anyLegacy) {
    kaydet(STORAGE_KEYS.SPORCULAR, list);
  }
  return list;
}

/**
 * Sporcu cache'ini temizle (yeni kayıt/güncelleme/silme işlemlerinden sonra çağrılmalı)
 * KRİTİK DÜZELTME: Cache kaldırıldı, bu fonksiyon artık gerekli değil ama geriye dönük uyumluluk için boş bırakıldı
 */
export function sporcuCacheTemizle(): void {
  // Cache kaldırıldı, artık temizleme gerekmiyor
}

/**
 * Sporcu kaydet
 */
export function sporcuKaydet(sporcu: Partial<Sporcu> & { id?: number }): Sporcu {
  const sporcular = sporculariGetir();
  const normalizedSporcu = normalizeAdSoyadFields(sporcu);

  if (normalizedSporcu.id) {
    // Güncelleme
    const index = sporcular.findIndex(s => s.id === normalizedSporcu.id);
    if (index > -1) {
      const merged = { ...sporcular[index], ...normalizedSporcu } as Record<string, unknown>;
      if (
        normalizedSporcu.silinmeBilgisi === undefined &&
        Object.prototype.hasOwnProperty.call(normalizedSporcu, 'silinmeBilgisi')
      ) {
        delete merged.silinmeBilgisi;
      }
      if (
        normalizedSporcu.yenidenKatilmaTarihi === undefined &&
        Object.prototype.hasOwnProperty.call(normalizedSporcu, 'yenidenKatilmaTarihi')
      ) {
        delete merged.yenidenKatilmaTarihi;
      }
      sporcular[index] = sporcuLegacyKucukGrupMigrate(merged as unknown as Sporcu);
      kaydet(STORAGE_KEYS.SPORCULAR, sporcular);
      sporcuCacheTemizle();
      const updated = sporcular[index] as Sporcu;
      if (API_ENABLED) {
        void apiPost('/sporcular', updated).catch(err =>
          notifyApiSyncFailure('Sporcu güncelleme', err)
        );
      }
      return updated;
    }
    // id var ama listede yok: sessiz fallthrough yerine yeni kayıt
    console.warn(
      '[SOY-BIS] sporcuKaydet: id listede yok, yeni kayıt olarak ekleniyor:',
      normalizedSporcu.id
    );
    const yeniden: Partial<Sporcu> & { id?: number } = { ...normalizedSporcu };
    delete yeniden.id;
    return sporcuKaydet(yeniden);
  } else {
    // Yeni kayıt
    // MySQL sporcular.id / aidatlar.sporcuId kolonları INT: Date.now() değerleri taşar (2147483647).
    // Aidat kayıtlarıyla aynı INT-güvenli ID üreticiyi kullan.
    const yeniId = generateDbSafeId(sporcular.map(s => Number(s.id || 0)));
    const kayitTarihi = sporcu.kayitTarihi || new Date().toISOString(); // Kayıt tarihi: Verilen varsa onu kullan, yoksa şimdiki zaman

    // Önce spread yap, sonra ID'yi override et (spread ile ID undefined olabilir)
    const yeniSporcu: Sporcu = {
      durum: 'Aktif',
      temelBilgiler: normalizedSporcu.temelBilgiler || { adSoyad: '' },
      sporBilgileri: normalizedSporcu.sporBilgileri || {},
      iletisim: normalizedSporcu.iletisim || {},
      veliBilgileri: normalizedSporcu.veliBilgileri || {
        veli1: {},
        veli2: {},
      },
      odemeBilgileri:
        normalizedSporcu.odemeBilgileri ||
        ({
          aylikUcret: 0,
          burslu: false,
          odemeGunu: null,
        } as Sporcu['odemeBilgileri']),
      ekUcretler: normalizedSporcu.ekUcretler || {
        esofman: { tutar: 0, odendi: false },
        forma: { tutar: 0, odendi: false },
        yagmurluk: { tutar: 0, odendi: false },
        diger: { tutar: 0, odendi: false },
      },
      kayitOdemeDurumu: normalizedSporcu.kayitOdemeDurumu || 'alinmadi',
      fiziksel: normalizedSporcu.fiziksel || {},
      saglik: normalizedSporcu.saglik || {},
      tffGruplari: normalizedSporcu.tffGruplari || {},
      belgeler: normalizedSporcu.belgeler || {},
      kayitTarihi: kayitTarihi, // Kayıt tarihi set ediliyor
      ...normalizedSporcu, // Spread önce (kayitTarihi override edilebilir)
      id: yeniId, // ID sonra (kesinlikle set edilsin)
    };
    const yeniSporcuTemiz = sporcuLegacyKucukGrupMigrate(yeniSporcu);
    sporcular.push(yeniSporcuTemiz);

    // ID kontrolü - eğer yeniSporcu.id hala undefined veya yeniId ile eşleşmiyorsa düzelt
    if (!yeniSporcuTemiz.id || yeniSporcuTemiz.id !== yeniId) {
      yeniSporcuTemiz.id = yeniId;
      sporcular[sporcular.length - 1] = yeniSporcuTemiz;
    }

    // LocalStorage'a kaydet
    kaydet(STORAGE_KEYS.SPORCULAR, sporcular);
    sporcuCacheTemizle();

    if (API_ENABLED) {
      void apiPost('/sporcular', yeniSporcuTemiz).catch(err =>
        notifyApiSyncFailure('Sporcu ekleme', err)
      );
    }

    return yeniSporcuTemiz;
  }
}

/**
 * Sporcu arşivle (ayrıldı): kayıt ve aidat/yoklama geçmişi korunur; operasyonel listeden düşer.
 * @param kaynak - kendi: öğrenci/veli; yonetici: okul kaydı
 */
export function sporcuAyrildi(id: number, kaynak: 'kendi' | 'yonetici'): void {
  const sporcu = sporcuBul(id);
  if (!sporcu) {
    console.warn('sporcuAyrildi: Sporcu bulunamadı:', id);
    return;
  }
  sporcuKaydet({
    ...sporcu,
    id,
    durum: 'Ayrıldı',
    silinmeBilgisi: { tarih: new Date().toISOString(), kaynak },
    yenidenKatilmaTarihi: undefined,
  });
}

/** Arşivden çıkar: Aktif yap, ayrılış bilgisini kaldır; ödeme günü dönüş günü olur; mümkünse dönüş ayı aidat borcu yazılır. */
export function sporcuTekrarAktifEt(id: number): void {
  const sporcu = sporcuBul(id);
  if (!sporcu) {
    console.warn('sporcuTekrarAktifEt: Sporcu bulunamadı:', id);
    return;
  }
  if (sporcu.durum !== 'Ayrıldı') {
    console.warn('sporcuTekrarAktifEt: Sporcu arşivli (Ayrıldı) değil:', id);
    return;
  }

  const now = new Date();
  const odemeGunu = now.getDate();
  const { ay: buAy, yil: buYil } = suAnkiDonem(now);

  const odemeBilgileri = {
    ...sporcu.odemeBilgileri,
    odemeGunu,
  };

  sporcuKaydet({
    ...sporcu,
    id,
    durum: 'Aktif',
    silinmeBilgisi: undefined,
    yenidenKatilmaTarihi: now.toISOString(),
    odemeBilgileri,
  });

  const guncel = sporcuBul(id);
  if (!guncel || guncel.odemeBilgileri?.burslu) {
    return;
  }
  const aylikUcret = guncel.odemeBilgileri?.aylikUcret || 0;
  if (aylikUcret <= 0) {
    return;
  }

  const aidatlar = aidatlariGetir();
  const buDonemBorcVar = aidatlar.some(
    a => a.sporcuId === id && a.donemAy === buAy && a.donemYil === buYil && a.islem_turu === 'Aidat'
  );
  if (buDonemBorcVar) {
    return;
  }

  try {
    aidatKaydet({
      sporcuId: id,
      tutar: aylikUcret,
      tarih: new Date(buYil, buAy - 1, odemeGunu).toISOString(),
      donemAy: buAy,
      donemYil: buYil,
      aciklama: `${ayAdi(buAy)} ${buYil} Aylık Aidat (Yeniden kayıt)`,
      tip: 'yeniden_katilma',
      islem_turu: 'Aidat',
      odemeDurumu: 'Ödenmedi',
    } as Aidat);
  } catch (e) {
    console.warn('sporcuTekrarAktifEt: Dönüş ayı aidat borcu oluşturulamadı:', e);
  }
}

/**
 * @deprecated Eski davranış kaldırıldı. `sporcuAyrildi` kullanın.
 * Geriye dönük çağrılar için yönetici kaynaklı arşiv.
 */
export function sporcuSil(id: number): void {
  sporcuAyrildi(id, 'yonetici');
}

/**
 * Sporcu bul
 */
export function sporcuBul(id: number): Sporcu | null {
  return sporculariGetir().find(s => s.id === id) || null;
}

/**
 * TC ile sporcu kontrol
 */
export function tcKontrol(tc: string, excludeId: number | null = null): boolean {
  if (tc === TC_GECICI_YER_TUTUCU) {
    return false;
  }
  const sporcular = sporculariGetir();
  return sporcular.some(
    s =>
      s.temelBilgiler?.tcKimlik === tc &&
      s.durum !== 'Ayrıldı' &&
      (excludeId ? s.id !== excludeId : true)
  );
}

// ========== AİDAT İŞLEMLERİ ==========

/**
 * Tüm aidatları getir
 */
export function aidatlariGetir(): Aidat[] {
  return oku<Aidat[]>(STORAGE_KEYS.AIDATLAR, []);
}

/**
 * Aidat kaydet
 */
export function aidatKaydet(aidat: Partial<Aidat> & { id?: number }): Aidat {
  const aidatlar = aidatlariGetir();
  const requestedId = Number(aidat.id ?? 0);
  const aidatId = isValidDbIntId(requestedId)
    ? requestedId
    : generateDbSafeId(aidatlar.map(a => Number(a.id || 0)));

  // KRİTİK KONTROL: Borç kayıtları için kayıt tarihi kontrolü
  // Eğer borç kaydı (Aidat veya Malzeme) oluşturuluyorsa ve dönem, sporcunun kayıt tarihinden önceki bir ay ise → İZİN VERME
  const isBorc =
    aidat.islem_turu === 'Aidat' ||
    aidat.islem_turu === 'Malzeme' ||
    (!aidat.islem_turu && (aidat.tutar || 0) > 0);

  if (aidat.sporcuId && isBorc) {
    const sporcu = sporcuBul(aidat.sporcuId);

    if (sporcu && sporcu.kayitTarihi && aidat.donemAy && aidat.donemYil) {
      const kayitTarihi = new Date(sporcu.kayitTarihi);
      if (!isNaN(kayitTarihi.getTime())) {
        const kayitAy = kayitTarihi.getMonth() + 1;
        const kayitYil = kayitTarihi.getFullYear();
        const donemAyFarki = (aidat.donemYil - kayitYil) * 12 + (aidat.donemAy - kayitAy);

        // Eğer dönem, kayıt ayından önceki bir ay ise → HATA
        if (donemAyFarki < 0) {
          throw new Error(
            `Kayıt tarihinden (${kayitAy}/${kayitYil}) önceki bir ay (${aidat.donemAy}/${aidat.donemYil}) için borç kaydı oluşturulamaz!`
          );
        }
      }
    }
  }

  const yeniAidat: Aidat = {
    id: aidatId,
    kayitTarihi: aidat.kayitTarihi || new Date().toISOString(),
    sporcuId: aidat.sporcuId || 0,
    donemAy: aidat.donemAy || 1,
    donemYil: aidat.donemYil || new Date().getFullYear(),
    tutar: aidat.tutar || 0,
    odemeDurumu: aidat.odemeDurumu || 'Ödenmedi',
    ...aidat,
  } as Aidat;

  aidatlar.push(yeniAidat);
  kaydet(STORAGE_KEYS.AIDATLAR, aidatlar);

  if (API_ENABLED) {
    void apiPost('/aidatlar', yeniAidat).catch(error => {
      console.error('Aidat backend kaydı başarısız:', error);
      toast(
        'Ödeme yerelde kaydedildi ancak sunucuya yazılamadı. Lütfen bağlantıyı kontrol edin.',
        'warning'
      );
    });
  }

  return yeniAidat;
}

/**
 * Aidat sil
 */
export function aidatSil(id: number): void {
  const aidatlar = aidatlariGetir().filter(a => a.id !== id);
  kaydet(STORAGE_KEYS.AIDATLAR, aidatlar);

  if (API_ENABLED) {
    void apiDelete(`/aidatlar/${id}`).catch(err => notifyApiSyncFailure('Aidat silme', err));
  }
}

/**
 * Sporcunun aidatlarını getir
 */
export function sporcuAidatlari(sporcuId: number): Aidat[] {
  return aidatlariGetir().filter(a => a.sporcuId === sporcuId);
}

/**
 * Dönem aidatlarını getir
 */
export function donemAidatlari(ay: number, yil: number): Aidat[] {
  return aidatlariGetir().filter(a => a.donemAy === ay && a.donemYil === yil);
}

/**
 * Otomatik aylık aidat yenileme - Kayıt tarihindeki gün geldiğinde otomatik borç kaydı oluştur
 *
 * MANTIK:
 * - Öğrenci hangi günde kayıt olmuşsa, her ayın o günü geldiğinde otomatik borçlandırılır
 * - Örnekler:
 *   * 12 Kasım'da kayıt → 12 Aralık, 12 Ocak, 12 Şubat... her ayın 12'sinde borçlandırılır
 *   * 5 Ocak'ta kayıt → 5 Şubat, 5 Mart, 5 Nisan... her ayın 5'inde borçlandırılır
 *   * 28 Şubat'ta kayıt → 28 Mart, 28 Nisan, 28 Mayıs... her ayın 28'inde borçlandırılır
 */
export function otomatikAidatYenile(): void {
  const sporcular = sporculariGetir().filter(s => s.durum === 'Aktif' && !s.odemeBilgileri?.burslu);
  const aidatlar = aidatlariGetir();
  const bugun = new Date();
  const { ay: buAy, yil: buYil } = suAnkiDonem(bugun);
  const bugunGunu = bugun.getDate();

  let yeniAidatSayisi = 0;

  sporcular.forEach(sporcu => {
    if (!sporcu.kayitTarihi || !sporcu.odemeBilgileri?.aylikUcret) {
      return;
    }

    const kayitTarihi = new Date(sporcu.kayitTarihi);
    if (isNaN(kayitTarihi.getTime())) {
      return;
    }

    const odemeGunu = sporcu.odemeBilgileri.odemeGunu || kayitTarihi.getDate();
    const aylikUcret = sporcu.odemeBilgileri.aylikUcret;
    const kayitAy = kayitTarihi.getMonth() + 1;
    const kayitYil = kayitTarihi.getFullYear();
    const ayFarki = (buYil - kayitYil) * 12 + (buAy - kayitAy);

    // Gelecek ay kayıt olacaksa borç oluşturma
    if (ayFarki < 0) {
      return;
    }

    // Kayıt ayı kontrolü: Ödeme günü geçmediyse borç oluşturma
    if (ayFarki === 0 && bugunGunu < odemeGunu) {
      return;
    }

    // Sonraki aylar için: Ödeme günü kontrolü
    if (ayFarki === 1 && bugunGunu < odemeGunu) {
      return;
    }

    // Bu ay için aidat kaydı var mı kontrol et
    const buAyAidatlari = aidatlar.filter(
      a =>
        a.sporcuId === sporcu.id &&
        a.donemAy === buAy &&
        a.donemYil === buYil &&
        a.islem_turu === 'Aidat'
    );

    if (buAyAidatlari.length === 0) {
      try {
        aidatKaydet({
          sporcuId: sporcu.id,
          tutar: aylikUcret,
          tarih: new Date(buYil, buAy - 1, odemeGunu).toISOString(),
          donemAy: buAy,
          donemYil: buYil,
          aciklama: `${ayAdi(buAy)} ${buYil} Aylık Aidat (Otomatik)`,
          tip: 'aylik',
          islem_turu: 'Aidat',
          odemeDurumu: 'Ödenmedi',
        } as any);
        yeniAidatSayisi++;
      } catch (error) {
        // Hata durumunda sessizce devam et
      }
    }
  });
}

/**
 * Geçmiş aylardan oluşturulmuş hatalı borç kayıtlarını temizle
 * Yeni kayıt olan sporcular için kayıt tarihinden önceki aylardan borç oluşturulmamalı
 * Bu fonksiyon mevcut hatalı kayıtları temizler
 */
export function gecmisAyBorclariniTemizle(): { temizlenen: number; hata: number } {
  let temizlenen = 0;
  let hata = 0;

  try {
    const sporcular = sporculariGetir();
    const aidatlar = aidatlariGetir();

    // Her sporcu için kontrol et
    sporcular.forEach(sporcu => {
      if (!sporcu.kayitTarihi || !sporcu.id) return;

      const kayitTarihi = new Date(sporcu.kayitTarihi);
      if (isNaN(kayitTarihi.getTime())) return; // Geçersiz tarih

      const kayitAy = kayitTarihi.getMonth() + 1;
      const kayitYil = kayitTarihi.getFullYear();

      // Sporcuya ait tüm aidat kayıtlarını kontrol et
      const sporcuAidatlari = aidatlar.filter(a => a.sporcuId === sporcu.id);

      sporcuAidatlari.forEach(aidat => {
        // Sadece borç kayıtlarını kontrol et (Aidat veya Malzeme veya islem_turu yok ama pozitif tutar)
        const isBorc =
          aidat.islem_turu === 'Aidat' ||
          aidat.islem_turu === 'Malzeme' ||
          (!aidat.islem_turu && (aidat.tutar || 0) > 0);
        if (!isBorc) {
          return; // Tahsilat kayıtları atlanır
        }

        // Dönem bilgisi yoksa atla
        if (!aidat.donemAy || !aidat.donemYil) return;

        // Kayıt tarihinden önceki aylar için oluşturulmuş borç kayıtlarını bul
        // Dönem ay ve yıl karşılaştırması yap
        const donemAyFarki = (aidat.donemYil - kayitYil) * 12 + (aidat.donemAy - kayitAy);

        // Eğer aidat dönemi, kayıt ayından önceki bir ay ise → Hatalı kayıt, sil
        // NOT: Kayıt ayı için borç kaydı olabilir (ilk ay aidatı), onu silme
        if (donemAyFarki < 0) {
          try {
            aidatSil(aidat.id!);
            temizlenen++;
          } catch (error) {
            hata++;
          }
        }
      });
    });

    if (temizlenen > 0) {
      toast(`${temizlenen} geçmiş ay borcu temizlendi.`, 'success');
    }
  } catch (error) {
    console.error('❌ Geçmiş ay borçları temizlenirken hata:', error);
    toast('Geçmiş ay borçları temizlenirken bir hata oluştu!', 'error');
  }

  return { temizlenen, hata };
}

// ========== YOKLAMA İŞLEMLERİ ==========

/**
 * Tüm yoklamaları getir
 */
export function yoklamalariGetir(): Yoklama[] {
  return oku<Yoklama[]>(STORAGE_KEYS.YOKLAMALAR, []);
}

/**
 * Yoklama kaydet/güncelle
 */
export function yoklamaKaydet(
  tarih: string,
  grup: string,
  sporcuId: number,
  durum: 'var' | 'yok' | 'izinli' | 'gec-geldi',
  options: { skipApi?: boolean } = {}
): void {
  let yoklamalar = yoklamalariGetir();
  let kayit = yoklamalar.find(y => y.tarih === tarih && y.grup === grup);

  if (!kayit) {
    kayit = {
      id: Date.now() + Math.floor(Math.random() * 1000), // ID çakışma riskini azalt
      tarih: tarih,
      grup: grup,
      sporcular: [],
    };
    yoklamalar.push(kayit);
  }

  const mevcutSporcu = kayit.sporcular.find(s => s.id === sporcuId);
  const eskiDurum = mevcutSporcu?.durum ?? 'yok';

  const sporcuIndex = kayit.sporcular.findIndex(s => s.id === sporcuId);
  if (sporcuIndex > -1) {
    const sporcu = kayit.sporcular[sporcuIndex];
    if (sporcu) {
      sporcu.durum = durum;
    }
  } else {
    kayit.sporcular.push({ id: sporcuId, durum: durum });
  }

  kaydet(STORAGE_KEYS.YOKLAMALAR, yoklamalar);

  if (API_ENABLED && !options.skipApi) {
    void apiPost('/yoklama', {
      tarih,
      grup,
      sporcuId,
      eskiDurum,
      yeniDurum: durum,
    } as Record<string, unknown>).catch(err => notifyApiSyncFailure('Yoklama senkronu', err));
  }
}

/**
 * Toplu yoklama kaydet
 */
export function topluYoklamaKaydet(
  tarih: string,
  grup: string,
  sporcuIds: number[],
  durum: 'var' | 'yok' | 'izinli' | 'gec-geldi'
): void {
  sporcuIds.forEach(id => yoklamaKaydet(tarih, grup, id, durum));
}

/**
 * Tarih ve grup için yoklama getir
 */
export function yoklamaBul(tarih: string, grup: string): Yoklama | null {
  return yoklamalariGetir().find(y => y.tarih === tarih && y.grup === grup) || null;
}

// ========== GİDER İŞLEMLERİ ==========

/**
 * Tüm giderleri getir
 */
export function giderleriGetir(): Gider[] {
  return oku<Gider[]>(STORAGE_KEYS.GIDERLER, []);
}

/**
 * Gider kaydet
 */
export function giderKaydet(gider: Partial<Gider> & { id?: number }): Gider {
  const giderler = giderleriGetir();

  const yeniGider: Gider = {
    id: gider.id || Date.now() + Math.floor(Math.random() * 1000), // ID çakışma riskini azalt
    kayitTarihi: gider.kayitTarihi || new Date().toISOString(),
    baslik: gider.baslik || '',
    kategori: gider.kategori || '',
    miktar: gider.miktar || 0,
    tarih: gider.tarih || bugunISO(),
    ...gider,
  } as Gider;

  giderler.push(yeniGider);
  kaydet(STORAGE_KEYS.GIDERLER, giderler);

  if (API_ENABLED) {
    void apiPost('/giderler', yeniGider).catch(err => notifyApiSyncFailure('Gider kaydı', err));
  }

  return yeniGider;
}

/**
 * Gider sil
 */
export function giderSil(id: number): void {
  const giderler = giderleriGetir().filter(g => g.id !== id);
  kaydet(STORAGE_KEYS.GIDERLER, giderler);

  if (API_ENABLED) {
    void apiDelete(`/giderler/${id}`).catch(err => notifyApiSyncFailure('Gider silme', err));
  }
}

/**
 * Dönem giderlerini getir
 */
export function donemGiderleri(ay: number, yil: number): Gider[] {
  return giderleriGetir().filter(g => {
    const tarih = new Date(g.tarih);
    return tarih.getMonth() + 1 === ay && tarih.getFullYear() === yil;
  });
}

// ========== ANTRENÖR İŞLEMLERİ ==========

/**
 * Tüm antrenörleri getir
 */
export function antrenorleriGetir(): Antrenor[] {
  return normalizeAdSoyadFields(oku<Antrenor[]>(STORAGE_KEYS.ANTRENORLER, []));
}

/**
 * Antrenör kaydet
 */
export function antrenorKaydet(antrenor: Partial<Antrenor> & { id?: number }): Antrenor {
  const antrenorler = antrenorleriGetir();
  const normalizedAntrenor = normalizeAdSoyadFields(antrenor);

  if (normalizedAntrenor.id) {
    // Güncelleme
    const index = antrenorler.findIndex(a => a.id === normalizedAntrenor.id);
    if (index > -1) {
      antrenorler[index] = { ...antrenorler[index], ...normalizedAntrenor } as Antrenor;
    }
  } else {
    // Yeni kayıt
    const yeniAntrenor: Antrenor = {
      id: Date.now() + Math.floor(Math.random() * 1000), // ID çakışma riskini azalt
      kayitTarihi: new Date().toISOString(),
      durum: 'Aktif',
      adSoyad: normalizedAntrenor.adSoyad || '',
      ...normalizedAntrenor,
    };
    antrenorler.push(yeniAntrenor);
    kaydet(STORAGE_KEYS.ANTRENORLER, antrenorler);

    if (API_ENABLED) {
      void apiPost('/antrenorler', yeniAntrenor).catch(err =>
        notifyApiSyncFailure('Antrenör ekleme', err)
      );
    }

    return yeniAntrenor;
  }

  kaydet(STORAGE_KEYS.ANTRENORLER, antrenorler);
  const updated = antrenorler.find(a => a.id === normalizedAntrenor.id) as Antrenor;
  if (API_ENABLED) {
    void apiPost('/antrenorler', updated).catch(err =>
      notifyApiSyncFailure('Antrenör güncelleme', err)
    );
  }
  return updated;
}

/**
 * Antrenör sil
 */
export function antrenorSil(id: number): void {
  const antrenorler = antrenorleriGetir().filter(a => a.id !== id);
  kaydet(STORAGE_KEYS.ANTRENORLER, antrenorler);

  if (API_ENABLED) {
    void apiDelete(`/antrenorler/${id}`).catch(err => notifyApiSyncFailure('Antrenör silme', err));
  }
}

/**
 * Antrenör bul
 */
export function antrenorBul(id: number): Antrenor | null {
  return antrenorleriGetir().find(a => a.id === id) || null;
}

// ========== YEDEKLEME İŞLEMLERİ ==========

/**
 * Tüm verileri yedekle
 */
export function yedekOlustur(): BackupData {
  const yedek: BackupData = {
    versiyon: '3.0.0',
    tarih: new Date().toISOString(),
    veriler: {
      sporcular: sporculariGetir(),
      aidatlar: aidatlariGetir(),
      yoklamalar: yoklamalariGetir(),
      giderler: giderleriGetir(),
      antrenorler: antrenorleriGetir(),
      antrenmanGruplari: antrenmanGruplariGetir(),
    },
  };

  return yedek;
}

/**
 * Yedeği dosya olarak indir
 */
export function yedekIndir(): void {
  const yedek = yedekOlustur();
  const blob = new Blob([JSON.stringify(yedek, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
      link.download = `SOYBIS360_Yedek_${new Date().toLocaleDateString('tr-TR').replace(/\./g, '-')}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  toast('Yedek dosyası indirildi!', 'success');
}

/**
 * Yedekten geri yükle
 */
export function yedekYukle(yedek: BackupData): boolean {
  try {
    if (!yedek || !yedek.veriler) {
      throw new Error('Geçersiz yedek dosyası');
    }

    const { sporcular, aidatlar, yoklamalar, giderler, antrenorler, antrenmanGruplari } = yedek.veriler;

    if (sporcular) kaydet(STORAGE_KEYS.SPORCULAR, sporcular);
    if (aidatlar) kaydet(STORAGE_KEYS.AIDATLAR, aidatlar);
    if (yoklamalar) kaydet(STORAGE_KEYS.YOKLAMALAR, yoklamalar);
    if (giderler) kaydet(STORAGE_KEYS.GIDERLER, giderler);
    if (antrenorler) kaydet(STORAGE_KEYS.ANTRENORLER, antrenorler);
    if (antrenmanGruplari && antrenmanGruplari.length >= 0) {
      kaydet(STORAGE_KEYS.ANTRENMAN_GRUPLARI, antrenmanGruplari);
    }

    // API modunda backend'i de aynı yedek ile güncelliyoruz.
    if (API_ENABLED) {
      void apiPost('/backup/restore', yedek).catch(err =>
        notifyApiSyncFailure('Yedek sunucuya geri yükleme', err)
      );
    }

    toast('Veriler başarıyla geri yüklendi!', 'success');
    return true;
  } catch (error) {
    console.error('Geri yükleme hatası:', error);
    toast(
      'Geri yükleme başarısız: ' + (error instanceof Error ? error.message : 'Bilinmeyen hata'),
      'error'
    );
    return false;
  }
}

/**
 * Dosyadan yedek yükle
 */
export function dosyadanYukle(file: File): Promise<BackupData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = function (e) {
      try {
        const yedek = JSON.parse(e.target?.result as string) as BackupData;
        resolve(yedek);
      } catch (error) {
        reject(new Error('Dosya okunamadı veya geçersiz format'));
      }
    };

    reader.onerror = function () {
      reject(new Error('Dosya okuma hatası'));
    };

    reader.readAsText(file);
  });
}

// ========== KULLANICI İŞLEMLERİ ==========

/**
 * Tüm kullanıcıları getir
 */
export function kullanicilariGetir(): User[] {
  return normalizeAdSoyadFields(oku<User[]>(STORAGE_KEYS.KULLANICILAR, []));
}

/**
 * Kullanıcı kaydet
 */
export async function kullaniciKaydet(
  kullanici: UserWithPassword & { id?: number }
): Promise<User> {
  const kullanicilar = kullanicilariGetir();
  const normalizedKullanici = normalizeAdSoyadFields(kullanici);

  // Şifreyi hash'le
  if (normalizedKullanici.sifre && !normalizedKullanici.sifre.startsWith('$')) {
    normalizedKullanici.sifreHash = await sifreHash(normalizedKullanici.sifre);
    delete normalizedKullanici.sifre; // Düz metin şifreyi sil
  }

  if (normalizedKullanici.id) {
    // Güncelleme
    const index = kullanicilar.findIndex(k => k.id === normalizedKullanici.id);
    if (index > -1) {
      const mevcutKullanici = kullanicilar[index];
      if (mevcutKullanici) {
        // Şifre değiştirilmediyse eski hash'i koru
        if (!normalizedKullanici.sifreHash) {
          normalizedKullanici.sifreHash = mevcutKullanici.sifreHash;
        }
        kullanicilar[index] = { ...mevcutKullanici, ...normalizedKullanici } as User;
      }
    }
  } else {
    // Yeni kayıt
    const yeniKullanici: User = {
      id: Date.now() + Math.floor(Math.random() * 1000), // ID çakışma riskini azalt
      olusturmaTarihi: new Date().toISOString(),
      kullaniciAdi: normalizedKullanici.kullaniciAdi || '',
      adSoyad: normalizedKullanici.adSoyad || '',
      rol: normalizedKullanici.rol || 'Antrenör',
      aktif: normalizedKullanici.aktif !== undefined ? normalizedKullanici.aktif : true,
      ...normalizedKullanici,
      sifreHash: normalizedKullanici.sifreHash,
    } as User;
    kullanicilar.push(yeniKullanici);
    kaydet(STORAGE_KEYS.KULLANICILAR, kullanicilar);
    if (API_ENABLED) {
      void apiPost('/kullanicilar', yeniKullanici).catch(err =>
        notifyApiSyncFailure('Kullanıcı ekleme', err)
      );
    }
    return yeniKullanici;
  }

  kaydet(STORAGE_KEYS.KULLANICILAR, kullanicilar);
  const updated = kullanicilar.find(k => k.id === normalizedKullanici.id) as User;
  if (API_ENABLED) {
    void apiPost('/kullanicilar', updated).catch(err =>
      notifyApiSyncFailure('Kullanıcı güncelleme', err)
    );
  }
  return updated;
}

/**
 * Kullanıcı sil
 */
export function kullaniciSil(id: number): void {
  const kullanicilar = kullanicilariGetir().filter(k => k.id !== id);
  kaydet(STORAGE_KEYS.KULLANICILAR, kullanicilar);

  if (API_ENABLED) {
    void apiDelete(`/kullanicilar/${id}`).catch(err =>
      notifyApiSyncFailure('Kullanıcı silme', err)
    );
  }
}

/**
 * Kullanıcı bul
 */
export function kullaniciBul(id: number): User | null {
  return kullanicilariGetir().find(k => k.id === id) || null;
}

/**
 * Kullanıcı adı ile kullanıcı bul
 */
export function kullaniciAdiIleBul(kullaniciAdi: string): User | null {
  return kullanicilariGetir().find(k => k.kullaniciAdi === kullaniciAdi) || null;
}

/**
 * Şifre doğrula (kullanıcı için)
 */
export async function kullaniciSifreDogrula(
  kullaniciAdi: string,
  girilenSifre: string
): Promise<User | null> {
  const kullanici = kullaniciAdiIleBul(kullaniciAdi);
  if (!kullanici) {
    return null;
  }

  const hash = (await sifreHash(girilenSifre)).toLowerCase();
  const kayitHash = (kullanici.sifreHash || '').toLowerCase();
  if (hash === kayitHash) {
    return kullanici;
  }

  return null;
}

/**
 * Varsayılan admin kullanıcısını oluştur (ilk çalıştırmada)
 */
export async function varsayilanAdminOlustur(): Promise<void> {
  const kullanicilar = kullanicilariGetir();

  // Zaten kullanıcı varsa oluşturma
  if (kullanicilar.length > 0) return;

  // Varsayılan admin oluştur
  const admin: UserWithPassword = {
    kullaniciAdi: 'admin',
    sifre: '1234', // Hash'lenecek
    rol: 'Yönetici',
    adSoyad: 'Sistem Yöneticisi',
    email: '',
    aktif: true,
  };

  await kullaniciKaydet(admin);
}

/**
 * Sistemi sıfırla
 */
export async function sistemSifirla(kullaniciAdi: string, sifre: string): Promise<boolean> {
  if (API_ENABLED) {
    try {
      const hash = await sifreHash(sifre);
      const resp = await apiPost<{ ok?: boolean; error?: string }>('/system/reset', {
        kullaniciAdi,
        sifreHash: hash,
      });

      if (resp && resp.ok === true) {
        // Local cleanup aşağıda aynı blokta yapılacak.
      } else {
        toast((resp?.error as string) || 'Sistem sıfırlama başarısız!', 'error');
        return false;
      }
    } catch (error) {
      console.error('API system/reset hatası:', error);
      toast('Sistem sıfırlanırken bir hata oluştu!', 'error');
      return false;
    }
  } else {
    const kullanici = await kullaniciSifreDogrula(kullaniciAdi, sifre);
    if (!kullanici) {
      toast('Kullanıcı adı veya şifre hatalı!', 'error');
      return false;
    }
    if (kullanici.rol !== 'Yönetici') {
      toast('Bu işlem için Yönetici yetkisi gereklidir!', 'error');
      return false;
    }
  }

  try {
    // STORAGE_KEYS'deki key'leri temizle (kullanıcılar hariç)
    Object.values(STORAGE_KEYS).forEach(key => {
      if (key !== STORAGE_KEYS.KULLANICILAR) {
        sil(key);
      }
    });

    // Eski key'leri de temizle (migration için)
    const eskiKeyler = ['sporcular', 'aidatlar', 'yoklamalar', 'giderler', 'antrenorler'];
    eskiKeyler.forEach(eskiKey => {
      if (localStorage.getItem(eskiKey)) {
        localStorage.removeItem(eskiKey);
      }
    });

    // SOYBIS ile başlayan tüm key'leri temizle (eski versiyonlar için)
    const tumKeyler: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('SOYBIS_') || key.startsWith('soybis_'))) {
        tumKeyler.push(key);
      }
    }
    tumKeyler.forEach(key => {
      if (key !== STORAGE_KEYS.KULLANICILAR) {
        localStorage.removeItem(key);
      }
    });

    toast('Sistem sıfırlandı! Tüm veriler temizlendi.', 'success');
    return true;
  } catch (error) {
    console.error('Sistem sıfırlama hatası:', error);
    toast('Sistem sıfırlanırken bir hata oluştu!', 'error');
    return false;
  }
}

/**
 * Depolama istatistiklerini getir
 */
export function istatistikler(): StorageStats {
  const sporcular = sporculariGetir();
  const aidatlar = aidatlariGetir();
  const yoklamalar = yoklamalariGetir();
  const giderler = giderleriGetir();

  // Toplam boyut hesapla
  let toplamBoyut = 0;
  Object.values(STORAGE_KEYS).forEach(key => {
    const data = localStorage.getItem(key);
    if (data) {
      toplamBoyut += new Blob([data]).size;
    }
  });

  return {
    sporcuSayisi: sporcular.length,
    odemeSayisi: aidatlar.length,
    yoklamaSayisi: yoklamalar.length,
    giderSayisi: giderler.length,
    depolamaKB: Math.round((toplamBoyut / 1024) * 100) / 100,
  };
}

/**
 * Eski verileri temizle (migration)
 * Eski key yapısından yenisine geçiş
 */
export function veriMigration(): void {
  // Shared DB modunda "local key migration" gereksiz ve riskli (backend cache'i zaten doğru).
  if (API_ENABLED) return;

  // Eski keyler
  const eskiKeyler = ['sporcular', 'aidatlar', 'yoklamalar', 'giderler'];

  eskiKeyler.forEach(eskiKey => {
    const eskiVeri = oku<unknown>(eskiKey, null);
    if (eskiVeri) {
      // Yeni key'e taşı
      const upperKey = eskiKey.toUpperCase() as keyof typeof STORAGE_KEYS;
      const yeniKey = STORAGE_KEYS[upperKey];
      if (yeniKey) {
        kaydet(yeniKey, eskiVeri);
        sil(eskiKey);
        console.log(`Migration: ${eskiKey} -> ${yeniKey}`);
      }
    }
  });
}

/**
 * Sunucu oturumu doğrulandıktan sonra uygulama verisi localStorage anahtarlarını siler.
 * Ardından apiCacheWarmup ile sunucudan doldurulmalıdır.
 */
function clearServerSyncedLocalCache(): void {
  if (typeof window === 'undefined') return;
  const keys: string[] = [
    STORAGE_KEYS.SPORCULAR,
    STORAGE_KEYS.AIDATLAR,
    STORAGE_KEYS.YOKLAMALAR,
    STORAGE_KEYS.GIDERLER,
    STORAGE_KEYS.ANTRENORLER,
    STORAGE_KEYS.AYARLAR,
    STORAGE_KEYS.KULLANICILAR,
    STORAGE_KEYS.BASLANGIC_BAKIYESI,
    STORAGE_KEYS.ANTRENMAN_GRUPLARI,
  ];
  keys.forEach(k => {
    try {
      localStorage.removeItem(k);
    } catch {
      // ignore
    }
  });
}

/**
 * Oturum açıkken yerel uygulama önbelleğini sunucu verisiyle değiştirir (önce temizler, sonra warmup).
 * @returns Warmup tamamen başarılıysa true
 */
export async function syncLocalCacheFromServerAfterAuth(): Promise<boolean> {
  if (!API_ENABLED) return true;
  clearServerSyncedLocalCache();
  return apiCacheWarmup();
}

/**
 * Sistem başlatma - Varsayılan admin oluştur
 */
export async function sistemBaslat(): Promise<void> {
  if (!API_ENABLED) {
    await varsayilanAdminOlustur();
    return;
  }

  // Backend'i bootstrap et (default admin oluştur)
  await apiPost('/system/init', {});

  // Sayfa yenilemede cookie ile login zaten açıksa cache'i doldur.
  try {
    await apiGet('/auth/me');
    const warmed = await syncLocalCacheFromServerAfterAuth();
    if (!warmed) {
      toast(
        'Sunucu verisi yüklenemedi; liste boş görünebilir. Bağlantıyı kontrol edip sayfayı yenileyin.',
        'warning'
      );
    }
  } catch {
    // Login yoksa cache warmup atlanır.
  }
}

/**
 * Backend'den tüm verileri alıp localStorage'a cache olarak basar.
 * Not: Bu fonksiyon sync Storage API'lerini (mevcut kodu) değiştirmemek için kullanılır.
 */
export async function apiCacheWarmup(): Promise<boolean> {
  if (!API_ENABLED) return true;
  if (typeof window === 'undefined') return true;

  try {
    const safeWriteArrayCache = <T>(key: string, remoteData: T[]): void => {
      // Ağ/senkron kopmalarında backend geçici olarak boş dönebilir.
      // Bu durumda local'de veri varken boş liste ile üstüne yazmayız.
      try {
        const localRaw = localStorage.getItem(key);
        const localParsed = localRaw ? (JSON.parse(localRaw) as unknown) : null;
        const localArray = Array.isArray(localParsed) ? (localParsed as T[]) : [];
        const remoteArray = Array.isArray(remoteData) ? remoteData : [];

        if (remoteArray.length === 0 && localArray.length > 0) {
          console.warn(
            `[SOY-BIS API] Warmup sırasında ${key} için boş uzak veri geldi; local cache korunuyor.`
          );
          return;
        }

        localStorage.setItem(key, JSON.stringify(remoteArray));
      } catch {
        localStorage.setItem(key, JSON.stringify(Array.isArray(remoteData) ? remoteData : []));
      }
    };

    // SessionStorage rol bilgisi ile admin endpoint'lerini koşullu çekiyoruz.
    // Böylece Antrenör/Muhasebe girişlerinde /kullanicilar endpoint 403 verip tüm warmup bozulmuyor.
    let rol: string | null = null;
    try {
      const oturum = sessionStorage.getItem('soybis_oturum');
      if (oturum) {
        const parsed = JSON.parse(oturum) as { rol?: string };
        rol = parsed.rol ?? null;
      }
    } catch {
      // ignore
    }

    const [sporcular, aidatlar, yoklamalar, giderler, antrenorler, ayarlar, baslangicBakiyesi] =
      await Promise.all([
        apiGet<Sporcu[]>('/sporcular'),
        apiGet<Aidat[]>('/aidatlar'),
        apiGet<Yoklama[]>('/yoklamalar'),
        apiGet<Gider[]>('/giderler'),
        apiGet<Antrenor[]>('/antrenorler'),
        apiGet<Ayarlar>('/ayarlar'),
        apiGet<{ nakit: number; banka: number; tarih: string }>('/baslangic_bakiyesi'),
      ]);

    let kullanicilar: User[] = [];
    if (rol === 'Yönetici') {
      try {
        kullanicilar = await apiGet<User[]>('/kullanicilar');
      } catch {
        kullanicilar = [];
      }
    }

    // Cache'i localStorage'a yazarken "boş liste ile ezme" koruması uygula.
    safeWriteArrayCache(STORAGE_KEYS.SPORCULAR, sporcular);
    safeWriteArrayCache(STORAGE_KEYS.AIDATLAR, aidatlar);
    safeWriteArrayCache(STORAGE_KEYS.YOKLAMALAR, yoklamalar);
    safeWriteArrayCache(STORAGE_KEYS.GIDERLER, giderler);
    safeWriteArrayCache(STORAGE_KEYS.ANTRENORLER, antrenorler);
    safeWriteArrayCache(STORAGE_KEYS.KULLANICILAR, kullanicilar);
    localStorage.setItem(STORAGE_KEYS.AYARLAR, JSON.stringify(ayarlar ?? {}));
    localStorage.setItem(
      STORAGE_KEYS.BASLANGIC_BAKIYESI,
      JSON.stringify(baslangicBakiyesi ?? { nakit: 0, banka: 0, tarih: bugunISO() })
    );
    return true;
  } catch (error) {
    console.warn('API cache warmup hatası:', error);
    return false;
  }
}

// Export STORAGE_KEYS for backward compatibility
export { STORAGE_KEYS };

// Global erişim için (backward compatibility)
if (typeof window !== 'undefined') {
  (window as unknown as { Storage: Record<string, unknown> }).Storage = {
    KEYS: STORAGE_KEYS,
    kaydet,
    oku,
    sil,
    sporculariGetir,
    sporcuKaydet,
    sporcuAyrildi,
    sporcuTekrarAktifEt,
    sporcuSil,
    sporcuBul,
    tcKontrol,
    aidatlariGetir,
    aidatKaydet,
    aidatSil,
    sporcuAidatlari,
    donemAidatlari,
    yoklamalariGetir,
    yoklamaKaydet,
    topluYoklamaKaydet,
    yoklamaBul,
    giderleriGetir,
    giderKaydet,
    giderSil,
    donemGiderleri,
    antrenorleriGetir,
    antrenorKaydet,
    antrenorSil,
    antrenorBul,
    antrenmanGruplariGetir,
    antrenmanGruplariKaydet,
    antrenmanGrubuEkle,
    antrenmanGrubuSil,
    antrenmanGrubuBul,
    yedekOlustur,
    yedekIndir,
    yedekYukle,
    dosyadanYukle,
    sistemSifirla,
    istatistikler,
    veriMigration,
    sistemBaslat,
    kullanicilariGetir,
    kullaniciKaydet,
    kullaniciSil,
    kullaniciBul,
    kullaniciAdiIleBul,
    kullaniciSifreDogrula,
    sifreHash,
  };
}
