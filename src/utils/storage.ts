/**
 * SOY-BIS - Veri Depolama Modülü (storage.ts)
 * LocalStorage yönetimi, yedekleme ve geri yükleme - TypeScript Version
 */

import type { Sporcu, Aidat, Yoklama, Gider, Antrenor, User, Ayarlar } from '../types';
import { STORAGE_KEYS } from '../types';
import { toast, bugunISO, suAnkiDonem, ayAdi } from './helpers';
import { apiDelete, apiGet, apiPost } from '../services/apiClient';

// Hostingte env gömülmese bile shared DB modunun zorunlu çalışması için true.
const API_ENABLED = true;

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
        void apiPost('/ayarlar', data as unknown as Record<string, unknown>).catch(() => {});
      }
      if (key === STORAGE_KEYS.BASLANGIC_BAKIYESI) {
        void apiPost('/baslangic_bakiyesi', data as unknown as Record<string, unknown>).catch(
          () => {}
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
        return oku<Sporcu[]>(STORAGE_KEYS.SPORCULAR, []);
      }
    } catch (e) {
      // sessionStorage erişim hatası - sessizce devam et
    }
  }

  return oku<Sporcu[]>(STORAGE_KEYS.SPORCULAR, []);
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

  if (sporcu.id) {
    // Güncelleme
    const index = sporcular.findIndex(s => s.id === sporcu.id);
    if (index > -1) {
      sporcular[index] = { ...sporcular[index], ...sporcu } as Sporcu;
      kaydet(STORAGE_KEYS.SPORCULAR, sporcular);
      sporcuCacheTemizle();
      const updated = sporcular[index] as Sporcu;
      if (API_ENABLED) {
        void apiPost('/sporcular', updated).catch(() => {});
      }
      return updated;
    }
  } else {
    // Yeni kayıt
    // KRİTİK DÜZELTME: ID çakışma riskini azaltmak için Date.now() + rastgele sayı kullan
    const yeniId = Date.now() + Math.floor(Math.random() * 1000);
    const kayitTarihi = sporcu.kayitTarihi || new Date().toISOString(); // Kayıt tarihi: Verilen varsa onu kullan, yoksa şimdiki zaman

    // Önce spread yap, sonra ID'yi override et (spread ile ID undefined olabilir)
    const yeniSporcu: Sporcu = {
      durum: 'Aktif',
      temelBilgiler: sporcu.temelBilgiler || { adSoyad: '' },
      sporBilgileri: sporcu.sporBilgileri || {},
      iletisim: sporcu.iletisim || {},
      veliBilgileri: sporcu.veliBilgileri || {
        veli1: {},
        veli2: {},
      },
      odemeBilgileri:
        sporcu.odemeBilgileri ||
        ({
          aylikUcret: 0,
          burslu: false,
          odemeGunu: null,
        } as Sporcu['odemeBilgileri']),
      ekUcretler: sporcu.ekUcretler || {
        esofman: { tutar: 0, odendi: false },
        forma: { tutar: 0, odendi: false },
        yagmurluk: { tutar: 0, odendi: false },
        diger: { tutar: 0, odendi: false },
      },
      kayitOdemeDurumu: sporcu.kayitOdemeDurumu || 'alinmadi',
      fiziksel: sporcu.fiziksel || {},
      saglik: sporcu.saglik || {},
      tffGruplari: sporcu.tffGruplari || {},
      belgeler: sporcu.belgeler || {},
      kayitTarihi: kayitTarihi, // Kayıt tarihi set ediliyor
      ...sporcu, // Spread önce (kayitTarihi override edilebilir)
      id: yeniId, // ID sonra (kesinlikle set edilsin)
    };
    sporcular.push(yeniSporcu);

    // ID kontrolü - eğer yeniSporcu.id hala undefined veya yeniId ile eşleşmiyorsa düzelt
    if (!yeniSporcu.id || yeniSporcu.id !== yeniId) {
      yeniSporcu.id = yeniId;
      sporcular[sporcular.length - 1] = yeniSporcu;
    }

    // LocalStorage'a kaydet
    kaydet(STORAGE_KEYS.SPORCULAR, sporcular);
    sporcuCacheTemizle();

    if (API_ENABLED) {
      void apiPost('/sporcular', yeniSporcu).catch(() => {});
    }

    return yeniSporcu;
  }

  // Güncelleme durumunda localStorage'a kaydet
  kaydet(STORAGE_KEYS.SPORCULAR, sporcular);
  const updated = sporcular.find(s => s.id === sporcu.id) as Sporcu;
  if (API_ENABLED) {
    void apiPost('/sporcular', updated).catch(() => {});
  }
  return updated;
}

/**
 * Sporcu sil
 * Sporcu ve ilişkili tüm verileri (aidat, yoklama) siler
 * NOT: Finansal bakiye güncellemesi yapılmıyor (aidat kayıtları silinmeden önce
 * finansal etkisi hesaplanıp bakiyeden düşülmeli - şu anki mantık korunuyor)
 * @param id - Silinecek sporcu ID'si
 */
export function sporcuSil(id: number): void {
  try {
    // Sporcu ID kontrolü
    if (!id || id <= 0) {
      console.warn('sporcuSil: Geçersiz sporcu ID:', id);
      return;
    }

    // Sporcu listesinden kaldır
    const sporcular = sporculariGetir().filter(s => s.id !== id);

    // Kayıt başarısız olursa hata fırlatma, sadece log
    const sporcuKayitBasarili = kaydet(STORAGE_KEYS.SPORCULAR, sporcular);
    if (!sporcuKayitBasarili) {
      console.error('sporcuSil: Sporcu kaydı silinemedi (LocalStorage hatası)');
      // Devam et, diğer temizlik işlemlerini yap
    }

    // İlişkili aidat kayıtlarını temizle
    // Aidat kayıtlarını filtrele (sporcu ID'si eşleşmeyenler)
    const aidatlar = aidatlariGetir().filter(a => a.sporcuId !== id);
    const aidatKayitBasarili = kaydet(STORAGE_KEYS.AIDATLAR, aidatlar);
    if (!aidatKayitBasarili) {
      console.error('sporcuSil: Aidat kayıtları silinemedi (LocalStorage hatası)');
      // Devam et, diğer temizlik işlemlerini yap
    }

    // Yoklamalardaki referansları temizle
    const yoklamalar = yoklamalariGetir();
    yoklamalar.forEach(y => {
      // Sporcu referansını yoklamadan kaldır
      y.sporcular = y.sporcular.filter(s => s.id !== id);
    });

    // Boş yoklamaları da temizle (hiç sporcu kalmadıysa)
    const temizlenmisYoklamalar = yoklamalar.filter(y => y.sporcular.length > 0);
    const yoklamaKayitBasarili = kaydet(STORAGE_KEYS.YOKLAMALAR, temizlenmisYoklamalar);
    if (!yoklamaKayitBasarili) {
      console.error('sporcuSil: Yoklama kayıtları güncellenemedi (LocalStorage hatası)');
    }

    if (API_ENABLED) {
      void apiDelete(`/sporcular/${id}`).catch(() => {});
    }
  } catch (error) {
    // Hata durumunda sistemi çökertme, sadece log
    console.error('sporcuSil: Beklenmeyen hata:', error);
    // Kullanıcıya bilgi ver (toast kullanılamaz çünkü bu utility fonksiyonu)
    // Ana modülde hata yönetimi yapılmalı
  }
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
  const sporcular = sporculariGetir();
  return sporcular.some(
    s => s.temelBilgiler?.tcKimlik === tc && (excludeId ? s.id !== excludeId : true)
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
    id: aidat.id || Date.now() + Math.floor(Math.random() * 1000), // ID çakışma riskini azalt
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
    void apiPost('/aidatlar', yeniAidat).catch(() => {});
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
    void apiDelete(`/aidatlar/${id}`).catch(() => {});
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
    } as Record<string, unknown>).catch(() => {});
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
    void apiPost('/giderler', yeniGider).catch(() => {});
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
    void apiDelete(`/giderler/${id}`).catch(() => {});
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
  return oku<Antrenor[]>(STORAGE_KEYS.ANTRENORLER, []);
}

/**
 * Antrenör kaydet
 */
export function antrenorKaydet(antrenor: Partial<Antrenor> & { id?: number }): Antrenor {
  const antrenorler = antrenorleriGetir();

  if (antrenor.id) {
    // Güncelleme
    const index = antrenorler.findIndex(a => a.id === antrenor.id);
    if (index > -1) {
      antrenorler[index] = { ...antrenorler[index], ...antrenor } as Antrenor;
    }
  } else {
    // Yeni kayıt
    const yeniAntrenor: Antrenor = {
      id: Date.now() + Math.floor(Math.random() * 1000), // ID çakışma riskini azalt
      kayitTarihi: new Date().toISOString(),
      durum: 'Aktif',
      adSoyad: antrenor.adSoyad || '',
      ...antrenor,
    };
    antrenorler.push(yeniAntrenor);
    kaydet(STORAGE_KEYS.ANTRENORLER, antrenorler);

    if (API_ENABLED) {
      void apiPost('/antrenorler', yeniAntrenor).catch(() => {});
    }

    return yeniAntrenor;
  }

  kaydet(STORAGE_KEYS.ANTRENORLER, antrenorler);
  const updated = antrenorler.find(a => a.id === antrenor.id) as Antrenor;
  if (API_ENABLED) {
    void apiPost('/antrenorler', updated).catch(() => {});
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
    void apiDelete(`/antrenorler/${id}`).catch(() => {});
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
  link.download = `SOYBIS_Yedek_${new Date().toLocaleDateString('tr-TR').replace(/\./g, '-')}.json`;
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

    const { sporcular, aidatlar, yoklamalar, giderler, antrenorler } = yedek.veriler;

    if (sporcular) kaydet(STORAGE_KEYS.SPORCULAR, sporcular);
    if (aidatlar) kaydet(STORAGE_KEYS.AIDATLAR, aidatlar);
    if (yoklamalar) kaydet(STORAGE_KEYS.YOKLAMALAR, yoklamalar);
    if (giderler) kaydet(STORAGE_KEYS.GIDERLER, giderler);
    if (antrenorler) kaydet(STORAGE_KEYS.ANTRENORLER, antrenorler);

    // API modunda backend'i de aynı yedek ile güncelliyoruz.
    if (API_ENABLED) {
      void apiPost('/backup/restore', yedek).catch(() => {});
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
  return oku<User[]>(STORAGE_KEYS.KULLANICILAR, []);
}

/**
 * Kullanıcı kaydet
 */
export async function kullaniciKaydet(
  kullanici: UserWithPassword & { id?: number }
): Promise<User> {
  const kullanicilar = kullanicilariGetir();

  // Şifreyi hash'le
  if (kullanici.sifre && !kullanici.sifre.startsWith('$')) {
    kullanici.sifreHash = await sifreHash(kullanici.sifre);
    delete kullanici.sifre; // Düz metin şifreyi sil
  }

  if (kullanici.id) {
    // Güncelleme
    const index = kullanicilar.findIndex(k => k.id === kullanici.id);
    if (index > -1) {
      const mevcutKullanici = kullanicilar[index];
      if (mevcutKullanici) {
        // Şifre değiştirilmediyse eski hash'i koru
        if (!kullanici.sifreHash) {
          kullanici.sifreHash = mevcutKullanici.sifreHash;
        }
        kullanicilar[index] = { ...mevcutKullanici, ...kullanici } as User;
      }
    }
  } else {
    // Yeni kayıt
    const yeniKullanici: User = {
      id: Date.now() + Math.floor(Math.random() * 1000), // ID çakışma riskini azalt
      olusturmaTarihi: new Date().toISOString(),
      kullaniciAdi: kullanici.kullaniciAdi || '',
      adSoyad: kullanici.adSoyad || '',
      rol: kullanici.rol || 'Antrenör',
      aktif: kullanici.aktif !== undefined ? kullanici.aktif : true,
      ...kullanici,
      sifreHash: kullanici.sifreHash,
    } as User;
    kullanicilar.push(yeniKullanici);
    kaydet(STORAGE_KEYS.KULLANICILAR, kullanicilar);
    if (API_ENABLED) {
      void apiPost('/kullanicilar', yeniKullanici).catch(() => {});
    }
    return yeniKullanici;
  }

  kaydet(STORAGE_KEYS.KULLANICILAR, kullanicilar);
  const updated = kullanicilar.find(k => k.id === kullanici.id) as User;
  if (API_ENABLED) {
    void apiPost('/kullanicilar', updated).catch(() => {});
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
    void apiDelete(`/kullanicilar/${id}`).catch(() => {});
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

  const hash = await sifreHash(girilenSifre);
  if (hash === kullanici.sifreHash) {
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
    await apiCacheWarmup();
  } catch {
    // Login yoksa cache warmup atlanır.
  }
}

/**
 * Backend'den tüm verileri alıp localStorage'a cache olarak basar.
 * Not: Bu fonksiyon sync Storage API'lerini (mevcut kodu) değiştirmemek için kullanılır.
 */
export async function apiCacheWarmup(): Promise<void> {
  if (!API_ENABLED) return;
  if (typeof window === 'undefined') return;

  try {
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

    // Cache'i direkt localStorage'a yazıyoruz (kaydet/kayıt fonksiyonları API'ye yazmasın diye).
    localStorage.setItem(STORAGE_KEYS.SPORCULAR, JSON.stringify(sporcular));
    localStorage.setItem(STORAGE_KEYS.AIDATLAR, JSON.stringify(aidatlar));
    localStorage.setItem(STORAGE_KEYS.YOKLAMALAR, JSON.stringify(yoklamalar));
    localStorage.setItem(STORAGE_KEYS.GIDERLER, JSON.stringify(giderler));
    localStorage.setItem(STORAGE_KEYS.ANTRENORLER, JSON.stringify(antrenorler));
    localStorage.setItem(STORAGE_KEYS.KULLANICILAR, JSON.stringify(kullanicilar));
    localStorage.setItem(STORAGE_KEYS.AYARLAR, JSON.stringify(ayarlar ?? {}));
    localStorage.setItem(
      STORAGE_KEYS.BASLANGIC_BAKIYESI,
      JSON.stringify(baslangicBakiyesi ?? { nakit: 0, banka: 0, tarih: bugunISO() })
    );
  } catch (error) {
    console.warn('API cache warmup hatası:', error);
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
