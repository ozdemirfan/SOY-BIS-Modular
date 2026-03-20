/**
 * SOY-BIS - Bildirim/Hatırlatma Modülü (notification.ts)
 * Otomatik hatırlatma ve bildirim yönetimi - TypeScript Version
 */

import type { Sporcu } from '../types';
import { STORAGE_KEYS, oku, kaydet, sporculariGetir, aidatlariGetir } from '../utils/storage';
import { AYLAR, suAnkiDonem, paraFormat, toast } from '../utils/helpers';

// Notification Types
interface NotificationMethods {
  sms: boolean;
  email: boolean;
  whatsapp: boolean;
  inApp: boolean;
}

interface NotificationTiming {
  daysBefore: number;
  onDueDate: boolean;
  daysAfter: number;
}

interface MessageTemplates {
  sms: string;
  email: string;
  whatsapp: string;
}

interface NotificationSettings {
  enabled: boolean;
  methods: NotificationMethods;
  timing: NotificationTiming;
  messageTemplates: MessageTemplates;
}

interface Hatirlatma {
  sporcu: Sporcu;
  tip: 'yaklasan' | 'bugun' | 'gecikmis';
  mesaj: string;
  oncelik: 'info' | 'warning' | 'danger';
}

interface Ayarlar {
  notificationSettings?: NotificationSettings;
  [key: string]: unknown;
}

// Hatırlatma ayarları (varsayılan)
let settings: NotificationSettings = {
  enabled: true,
  methods: {
    sms: false,
    email: true,
    whatsapp: false,
    inApp: true,
  },
  timing: {
    daysBefore: 3, // Ödeme gününden kaç gün önce hatırlat
    onDueDate: true, // Ödeme gününde hatırlat
    daysAfter: 5, // Ödeme gününden kaç gün sonra hatırlat (gecikme)
  },
  messageTemplates: {
    sms: 'Sayın {adSoyad}, {ay} ayı aidat ödemeniz ({tutar} TL) yaklaşıyor. Ödeme tarihi: {tarih}',
    email:
      'Sayın {adSoyad},\n\n{ay} ayı aidat ödemeniz ({tutar} TL) yaklaşıyor.\nÖdeme tarihi: {tarih}\n\nTeşekkürler.',
    whatsapp:
      'Merhaba {adSoyad}! 👋\n\n{ay} ayı aidat ödemeniz ({tutar} TL) yaklaşıyor.\nÖdeme tarihi: {tarih}\n\nTeşekkürler! 🙏',
  },
};

/**
 * Modülü başlat
 */
export function init(): void {
  // Ayarları yükle
  ayarlariYukle();

  // Günlük kontrol (her gün çalışır)
  gunlukKontrol();
}

/**
 * Ayarları LocalStorage'dan yükle
 */
function ayarlariYukle(): void {
  const saved = oku<Ayarlar>(STORAGE_KEYS.AYARLAR, {});
  if (saved.notificationSettings) {
    settings = { ...settings, ...saved.notificationSettings };
  }
}

/**
 * Ayarları kaydet
 */
function ayarlariKaydet(): void {
  const ayarlar = oku<Ayarlar>(STORAGE_KEYS.AYARLAR, {});
  ayarlar.notificationSettings = settings;
  kaydet(STORAGE_KEYS.AYARLAR, ayarlar);
}

/**
 * Günlük hatırlatma kontrolü
 */
function gunlukKontrol(): Hatirlatma[] {
  if (!settings.enabled) return [];

  const bugun = new Date();
  const { ay: buAy, yil: buYil } = suAnkiDonem();
  const bugunGunu = bugun.getDate();

  const sporcular = sporculariGetir().filter(
    s => s.durum === 'Aktif' && !(s.odemeBilgileri?.burslu === true)
  );

  const hatirlatilacaklar: Hatirlatma[] = [];

  sporcular.forEach(sporcu => {
    const aylikUcret = sporcu.odemeBilgileri?.aylikUcret || 0;
    if (aylikUcret === 0) return;

    // Bu ay için ödemeleri kontrol et
    const aidatlar = aidatlariGetir();
    const donemOdemeleri = aidatlar.filter(
      a => a.sporcuId === sporcu.id && a.donemAy === buAy && a.donemYil === buYil
    );

    // YENİ MANTIK: Borç ve tahsilat ayrı hesapla
    const donemBorclari = donemOdemeleri
      .filter(
        a =>
          (a.tutar || 0) > 0 &&
          (a.islem_turu === 'Aidat' || a.islem_turu === 'Malzeme' || !a.islem_turu)
      )
      .reduce((t, a) => t + (a.tutar || 0), 0);

    const donemTahsilatlari = donemOdemeleri
      .filter(a => (a.tutar || 0) < 0 || a.islem_turu === 'Tahsilat')
      .reduce((t, a) => t + Math.abs(a.tutar || 0), 0);

    // Eski kayıtlar için uyumluluk: Negatif tutarlar tahsilat olarak kabul edilir
    const eskiNegatifTahsilat = donemOdemeleri
      .filter(a => !a.islem_turu && (a.tutar || 0) < 0)
      .reduce((t, a) => t + Math.abs(a.tutar || 0), 0);

    const odenen = donemTahsilatlari + eskiNegatifTahsilat;

    // Borç = Bu dönem borçları - Bu dönem tahsilatları
    // Eğer borç kaydı yoksa, aylık ücretten tahsilatları çıkar
    const toplamBorcBuDonem = donemBorclari > 0 ? donemBorclari : aylikUcret;
    const borc = Math.max(0, toplamBorcBuDonem - odenen);

    // Ödeme günü belirleme: Manuel ayarlanmışsa onu kullan, yoksa kayıt tarihindeki günü kullan
    let odemeGunu: number | null = null;
    if (sporcu.odemeBilgileri?.odemeGunu) {
      odemeGunu = sporcu.odemeBilgileri.odemeGunu;
    } else if (sporcu.kayitTarihi) {
      const kayitTarihi = new Date(sporcu.kayitTarihi);
      odemeGunu = kayitTarihi.getDate();
    }
    // Ödeme günü yoksa bu sporcuyu atla
    if (odemeGunu === null) return null;
    const gunFarki = odemeGunu - bugunGunu;

    // Hatırlatma durumları (sadece borçlu olanlar için)
    if (borc > 0) {
      if (gunFarki === settings.timing.daysBefore && gunFarki > 0) {
        // Ödeme gününden X gün önce
        hatirlatilacaklar.push({
          sporcu,
          tip: 'yaklasan',
          mesaj: `${gunFarki} gün sonra ödeme günü (${odemeGunu} ${AYLAR[buAy - 1]})`,
          oncelik: 'info',
        });
      } else if (gunFarki === 0 && settings.timing.onDueDate) {
        // Ödeme günü
        hatirlatilacaklar.push({
          sporcu,
          tip: 'bugun',
          mesaj: 'Bugün ödeme günü!',
          oncelik: 'warning',
        });
      } else if (gunFarki < 0 && Math.abs(gunFarki) === settings.timing.daysAfter) {
        // Gecikmiş ödeme
        hatirlatilacaklar.push({
          sporcu,
          tip: 'gecikmis',
          mesaj: `${Math.abs(gunFarki)} gün gecikmiş`,
          oncelik: 'danger',
        });
      }
    }
  });

  return hatirlatilacaklar;
}

/**
 * Hatırlatılacakları getir (Dashboard için)
 */
export function hatirlatilacaklariGetir(): Hatirlatma[] {
  return gunlukKontrol();
}

interface MesajData {
  adSoyad?: string;
  ay?: string;
  tutar?: number;
  tarih?: string;
}

/**
 * Mesaj şablonunu doldur
 */
export function mesajDoldur(template: string, data: MesajData): string {
  let mesaj = template;
  mesaj = mesaj.replace(/{adSoyad}/g, data.adSoyad || '');
  mesaj = mesaj.replace(/{ay}/g, data.ay || '');
  mesaj = mesaj.replace(/{tutar}/g, paraFormat(data.tutar || 0));
  mesaj = mesaj.replace(/{tarih}/g, data.tarih || '');
  return mesaj;
}

/**
 * SMS hatırlatma gönder (gelecekte entegrasyon için)
 */
function smsGonder(sporcu: Sporcu, mesaj: string): boolean {
  // SMS Gateway entegrasyonu için hazır
  // Entegrasyon: Netgsm, İleti Merkezi, Twilio, vb.
  const veliTel = sporcu.veliBilgileri?.veli1?.telefon || sporcu.iletisim?.telefon;

  if (!veliTel) {
    console.warn('SMS gönderilemedi: Veli telefonu bulunamadı', sporcu.temelBilgiler?.adSoyad);
    return false;
  }

  // Şu an için console'a yazdır (gerçek entegrasyon için hazır)
  console.log('📱 SMS Gönderiliyor:', {
    alici: sporcu.temelBilgiler?.adSoyad,
    telefon: veliTel,
    mesaj: mesaj,
  });

  // Gerçek SMS Gateway entegrasyonu buraya eklenecek:
  // Örnek: Netgsm API çağrısı
  // fetch('https://api.netgsm.com.tr/sms/send', {
  //     method: 'POST',
  //     body: JSON.stringify({ username, password, gsmno: veliTel, message: mesaj })
  // });

  return true;
}

/**
 * Email hatırlatma gönder (gelecekte entegrasyon için)
 */
function emailGonder(sporcu: Sporcu, mesaj: string): void {
  // TODO: Email entegrasyonu (EmailJS, SMTP)
  console.log('Email gönderilecek:', sporcu.iletisim?.email, mesaj);
}

/**
 * WhatsApp hatırlatma gönder (gelecekte entegrasyon için)
 */
function whatsappGonder(sporcu: Sporcu, mesaj: string): void {
  // TODO: WhatsApp Business API entegrasyonu
  console.log('WhatsApp gönderilecek:', sporcu.iletisim?.telefon, mesaj);
}

type NotificationMethod = 'sms' | 'email' | 'whatsapp' | 'inApp';

/**
 * Toplu hatırlatma gönder
 */
export function topluHatirlatmaGonder(
  sporcular: Sporcu[],
  method: NotificationMethod = 'inApp',
  donemAy?: number,
  donemYil?: number
): void {
  console.log(`📨 topluHatirlatmaGonder() çağrıldı: ${sporcular.length} sporcu, method: ${method}`);

  if (!settings.enabled) {
    toast('Hatırlatma sistemi kapalı!', 'warning');
    return;
  }

  const { ay: buAy, yil: buYil } = suAnkiDonem();
  const kullanilacakAy = donemAy || buAy;
  const kullanilacakYil = donemYil || buYil;
  const ayAdi = AYLAR[kullanilacakAy - 1] || '';
  console.log(`📅 Dönem: ${kullanilacakAy}/${kullanilacakYil} (${ayAdi})`);

  const aidatlar = aidatlariGetir();
  let gonderilenSayisi = 0;
  let atlananSayisi = 0;

  // Önce borcu olan sporcuları filtrele
  const borcluSporcular: Sporcu[] = [];

  sporcular.forEach(sporcu => {
    const aylikUcret = sporcu.odemeBilgileri?.aylikUcret || 0;
    if (aylikUcret === 0) return;

    // Bu dönem için ödemeleri kontrol et
    const donemOdemeleri = aidatlar.filter(
      a =>
        a.sporcuId === sporcu.id && a.donemAy === kullanilacakAy && a.donemYil === kullanilacakYil
    );

    // YENİ MANTIK: Borç ve tahsilat ayrı hesapla
    const donemBorclari = donemOdemeleri
      .filter(
        a =>
          (a.tutar || 0) > 0 &&
          (a.islem_turu === 'Aidat' || a.islem_turu === 'Malzeme' || !a.islem_turu)
      )
      .reduce((t, a) => t + (a.tutar || 0), 0);

    const donemTahsilatlari = donemOdemeleri
      .filter(a => (a.tutar || 0) < 0 || a.islem_turu === 'Tahsilat')
      .reduce((t, a) => t + Math.abs(a.tutar || 0), 0);

    // Eski kayıtlar için uyumluluk
    const eskiNegatifTahsilat = donemOdemeleri
      .filter(a => !a.islem_turu && (a.tutar || 0) < 0)
      .reduce((t, a) => t + Math.abs(a.tutar || 0), 0);

    const odenen = donemTahsilatlari + eskiNegatifTahsilat;

    // Borç = Bu dönem borçları - Bu dönem tahsilatları
    const toplamBorcBuDonem = donemBorclari > 0 ? donemBorclari : aylikUcret;
    const borc = Math.max(0, toplamBorcBuDonem - odenen);

    // Sadece borcu olanları ekle
    if (borc > 0) {
      borcluSporcular.push(sporcu);
    } else {
      console.log(
        `⏭️ SMS atlandı: ${sporcu.temelBilgiler?.adSoyad} - Borcu yok (Ödenen: ${odenen}, Beklenen: ${toplamBorcBuDonem}, Kalan: ${borc})`
      );
      atlananSayisi++;
    }
  });

  // Borcu olmayan sporcu varsa uyarı ver
  if (borcluSporcular.length === 0) {
    toast(
      `Gönderilebilecek borçlu sporcu bulunamadı! ${atlananSayisi} sporcu atlandı. Tüm sporcuların borcu ödenmiş olabilir.`,
      'warning'
    );
    return;
  }

  console.log(`📊 Özet: ${borcluSporcular.length} borçlu sporcu bulundu, ${atlananSayisi} atlandı`);

  // Borcu olan sporculara mesaj gönder
  borcluSporcular.forEach(sporcu => {
    const aylikUcret = sporcu.odemeBilgileri?.aylikUcret || 0;
    // Ödeme günü belirleme: Manuel ayarlanmışsa onu kullan, yoksa kayıt tarihindeki günü kullan
    let odemeGunu: number | null = null;
    if (sporcu.odemeBilgileri?.odemeGunu) {
      odemeGunu = sporcu.odemeBilgileri.odemeGunu;
    } else if (sporcu.kayitTarihi) {
      const kayitTarihi = new Date(sporcu.kayitTarihi);
      odemeGunu = kayitTarihi.getDate();
    }
    // Ödeme günü yoksa bu sporcuyu atla
    if (odemeGunu === null) return;
    const tarih = `${odemeGunu} ${ayAdi} ${buYil}`;

    // Gerçek borç hesapla (mesajda gösterilecek)
    const donemOdemeleri = aidatlar.filter(
      a =>
        a.sporcuId === sporcu.id && a.donemAy === kullanilacakAy && a.donemYil === kullanilacakYil
    );
    const donemBorclari = donemOdemeleri
      .filter(
        a =>
          (a.tutar || 0) > 0 &&
          (a.islem_turu === 'Aidat' || a.islem_turu === 'Malzeme' || !a.islem_turu)
      )
      .reduce((t, a) => t + (a.tutar || 0), 0);
    const donemTahsilatlari = donemOdemeleri
      .filter(a => (a.tutar || 0) < 0 || a.islem_turu === 'Tahsilat')
      .reduce((t, a) => t + Math.abs(a.tutar || 0), 0);
    const toplamBorcBuDonem = donemBorclari > 0 ? donemBorclari : aylikUcret;
    const kalanBorc = Math.max(0, toplamBorcBuDonem - donemTahsilatlari);

    console.log(
      `✅ SMS gönderilecek: ${sporcu.temelBilgiler?.adSoyad} - Kalan Borç: ${kalanBorc} TL`
    );

    const data: MesajData = {
      adSoyad: sporcu.temelBilgiler?.adSoyad || '',
      ay: ayAdi,
      tutar: kalanBorc, // Gerçek borç miktarı
      tarih: tarih,
    };

    let mesaj = '';
    if (method === 'sms' && settings.methods.sms) {
      mesaj = mesajDoldur(settings.messageTemplates.sms, data);
      if (smsGonder(sporcu, mesaj)) {
        gonderilenSayisi++;
      }
    } else if (method === 'email' && settings.methods.email) {
      mesaj = mesajDoldur(settings.messageTemplates.email, data);
      emailGonder(sporcu, mesaj);
      gonderilenSayisi++;
    } else if (method === 'whatsapp' && settings.methods.whatsapp) {
      mesaj = mesajDoldur(settings.messageTemplates.whatsapp, data);
      whatsappGonder(sporcu, mesaj);
      gonderilenSayisi++;
    }
  });

  console.log(
    `📊 Özet: ${gonderilenSayisi} SMS gönderildi, ${atlananSayisi} atlandı (toplam: ${sporcular.length})`
  );

  if (gonderilenSayisi > 0) {
    toast(
      `${gonderilenSayisi} borçlu sporcuya SMS gönderildi! (${atlananSayisi} sporcu atlandı - Konsolu kontrol edin)`,
      'success'
    );
  } else {
    toast(
      `Gönderilebilecek borçlu sporcu bulunamadı! ${atlananSayisi} sporcu atlandı. Tüm sporcuların borcu ödenmiş olabilir.`,
      'warning'
    );
  }
}

/**
 * Ayarları güncelle
 */
export function ayarlariGuncelle(yeniAyarlar: Partial<NotificationSettings>): void {
  if (!yeniAyarlar) return;

  // Nested object'leri de merge et
  if (yeniAyarlar.methods) {
    settings.methods = { ...settings.methods, ...yeniAyarlar.methods };
  }
  if (yeniAyarlar.timing) {
    settings.timing = { ...settings.timing, ...yeniAyarlar.timing };
  }
  if (yeniAyarlar.messageTemplates) {
    settings.messageTemplates = { ...settings.messageTemplates, ...yeniAyarlar.messageTemplates };
  }
  if (yeniAyarlar.enabled !== undefined) {
    settings.enabled = yeniAyarlar.enabled;
  }

  ayarlariKaydet();

  // UI'ı güncelle (eğer App modülü yüklüyse)
  try {
    if (
      typeof window !== 'undefined' &&
      (window as unknown as { App: { hatirlatmaAyarlariGoster?: () => void } | undefined }).App
        ?.hatirlatmaAyarlariGoster
    ) {
      (
        window as unknown as { App: { hatirlatmaAyarlariGoster: () => void } }
      ).App.hatirlatmaAyarlariGoster();
    }
  } catch (e) {
    console.warn('UI güncelleme hatası:', e);
  }

  // Başarı mesajı
  toast('Ayarlar kaydedildi!', 'success');
}

/**
 * Ayarları getir
 */
export function ayarlariGetir(): NotificationSettings {
  return { ...settings };
}

// Global erişim için (backward compatibility)
if (typeof window !== 'undefined') {
  (window as unknown as { Notification: Record<string, unknown> }).Notification = {
    init,
    hatirlatilacaklariGetir,
    topluHatirlatmaGonder,
    ayarlariGuncelle,
    ayarlariGetir,
    mesajDoldur,
  };
}
