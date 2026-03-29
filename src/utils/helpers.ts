/**
 * SOY-BIS - Yardımcı Fonksiyonlar (helpers.ts)
 * Genel amaçlı yardımcı fonksiyonlar - TypeScript Version
 */

// Log seviyesi kontrolü (production'da console.log'ları kapatmak için)
// Development: 'debug', Production: 'error' (sadece hatalar gösterilir)
const LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error' =
  typeof process !== 'undefined' && process.env?.NODE_ENV === 'production' ? 'error' : 'debug';

/**
 * Güvenli log fonksiyonu - Production'da sadece hatalar gösterilir
 */
export function log(level: 'debug' | 'info' | 'warn' | 'error', ...args: unknown[]): void {
  // Production'da sadece error ve warn göster
  if (LOG_LEVEL === 'error' && (level === 'debug' || level === 'info')) {
    return;
  }
  // Development'da tüm loglar gösterilir
  if (typeof console !== 'undefined' && console[level]) {
    console[level](...args);
  }
}

// Constants
export const AYLAR = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
] as const;

export const YAS_GRUPLARI = [
  'U7',
  'U8',
  'U9',
  'U10',
  'U11',
  'U12',
  'U13',
  'U14',
  'U15',
  'U16',
  'U17',
  'U18',
  'U19',
  'U21',
] as const;

/**
 * Para formatı (2000 -> 2.000)
 * @param sayi - Formatlanacak sayı (number, string, null veya undefined)
 * @param kisaFormat - Büyük sayılar için kısa format kullan (örn: 1.5M, 2.3K)
 * @returns Formatlanmış para string'i
 */
export function paraFormat(sayi: number | string | null | undefined, kisaFormat = false): string {
  // Null/undefined kontrolü - güvenli varsayılan değer döndür
  if (sayi === null || sayi === undefined) return '0';

  // String ise sayıya çevir (Türkçe format desteği: nokta binlik, virgül ondalık)
  const num =
    typeof sayi === 'string' ? parseFloat(sayi.replace(/\./g, '').replace(',', '.')) : sayi;

  // NaN kontrolü - geçersiz sayılar için güvenli varsayılan
  if (isNaN(num)) return '0';

  // Büyük rakamlar için kısa format (dashboard kartları için)
  if (kisaFormat && num >= 1000000) {
    const milyon = num / 1000000;
    return milyon.toFixed(1).replace('.', ',') + 'M';
  } else if (kisaFormat && num >= 1000) {
    const bin = num / 1000;
    return bin.toFixed(1).replace('.', ',') + 'K';
  }

  // Türkçe locale formatı kullan (binlik ayırıcı: nokta)
  return num.toLocaleString('tr-TR');
}

/**
 * SOYBIS logosu (`public/logo.png` → `/logo.png`).
 * PDF/html2canvas için tam URL; aynı kökende CORS sorunu olmaz.
 */
export function soybisLogoUrl(): string {
  if (typeof window === 'undefined' || !window.location?.origin) {
    return '/logo.png';
  }
  return `${window.location.origin}/logo.png`;
}

/**
 * Input için para formatı (yazarken)
 * Kullanıcı yazarken otomatik olarak binlik ayırıcı ekler
 * @param input - Formatlanacak input elementi
 */
export function paraFormatInput(input: HTMLInputElement): void {
  try {
    // Sadece rakamları al (nokta ve virgül hariç)
    let val = input.value.replace(/\D/g, '');

    // Binlik ayırıcı ekle (her 3 hanede bir nokta)
    if (val) {
      val = val.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }

    input.value = val;
  } catch (error) {
    // Hata durumunda input değerini koru, sistemi çökertme
    console.error('Para format hatası:', error);
  }
}

/**
 * Para string'ini sayıya çevir (2.000,50 -> 2000.50)
 * ÖNEMLİ: parseInt yerine parseFloat kullanılıyor (ondalık sayılar için)
 * @param str - Çevrilecek para string'i (örn: "2.000,50" veya "2000.50")
 * @returns Sayısal değer (ondalık destekli)
 */
export function paraCoz(str: string | null | undefined): number {
  // Null/undefined/boş string kontrolü
  if (!str || str.trim() === '') return 0;

  try {
    // String'i temizle: binlik noktaları kaldır, ondalık virgülü noktaya çevir
    const temizStr = str
      .toString()
      .replace(/\./g, '') // Binlik noktaları kaldır (2.000 -> 2000)
      .replace(',', '.'); // Ondalık virgülü noktaya çevir (2000,50 -> 2000.50)

    // parseFloat kullan (ondalık sayılar için) - parseInt yerine
    const sayi = parseFloat(temizStr);

    // NaN kontrolü - geçersiz sayılar için 0 döndür
    if (isNaN(sayi)) {
      console.warn('paraCoz: Geçersiz sayı formatı:', str);
      return 0;
    }

    return sayi;
  } catch (error) {
    // Hata durumunda güvenli varsayılan değer döndür
    console.error('paraCoz hatası:', error, 'Girdi:', str);
    return 0;
  }
}

/**
 * Tarih formatla (ISO -> TR)
 * ISO formatındaki tarihi Türkçe formatına çevirir (DD.MM.YYYY)
 * @param isoDate - ISO formatında tarih string'i
 * @returns Formatlanmış tarih veya "-" (geçersiz tarih için)
 */
export function tarihFormat(isoDate: string | null | undefined): string {
  // Null/undefined kontrolü
  if (!isoDate) return '-';

  try {
    const date = new Date(isoDate);

    // Geçersiz tarih kontrolü
    if (isNaN(date.getTime())) {
      console.warn('tarihFormat: Geçersiz tarih:', isoDate);
      return '-';
    }

    // Türkçe locale formatı kullan
    return date.toLocaleDateString('tr-TR');
  } catch (error) {
    // Hata durumunda güvenli varsayılan değer
    console.error('tarihFormat hatası:', error);
    return '-';
  }
}

/**
 * Bugünün ISO formatında tarihi
 * YYYY-MM-DD formatında bugünün tarihini döndürür
 * @returns ISO formatında tarih string'i
 */
export function bugunISO(): string {
  try {
    return new Date().toISOString().split('T')[0] || '';
  } catch (error) {
    // Hata durumunda boş string döndür (sistem çökmesini önle)
    console.error('bugunISO hatası:', error);
    return '';
  }
}

/**
 * Doğum tarihinden yaş hesapla
 * @param dogumTarihi - Doğum tarihi (ISO format veya Date string)
 * @returns Hesaplanan yaş (yıl cinsinden)
 */
export function yasHesapla(dogumTarihi: string | null | undefined): number {
  // Null/undefined kontrolü
  if (!dogumTarihi) {
    return 0;
  }

  try {
    // Tarih formatı kontrolü: YYYY-MM-DD formatında olmalı ve yıl 4 haneli olmalı
    const tarihRegex = /^(\d{4})-(\d{2})-(\d{2})$/;
    const match = dogumTarihi.match(tarihRegex);

    if (!match) {
      console.warn('yasHesapla: Geçersiz tarih formatı (YYYY-MM-DD olmalı):', dogumTarihi);
      return 0;
    }

    const yil = parseInt(match[1], 10);
    const ay = parseInt(match[2], 10);
    const gun = parseInt(match[3], 10);

    // Yıl kontrolü: 1900-2100 arası olmalı (makul bir aralık)
    if (yil < 1900 || yil > 2100) {
      console.warn('yasHesapla: Yıl aralığı dışında (1900-2100 olmalı):', dogumTarihi, 'Yıl:', yil);
      return 0;
    }

    // Ay kontrolü: 1-12 arası olmalı
    if (ay < 1 || ay > 12) {
      console.warn('yasHesapla: Ay aralığı dışında (1-12 olmalı):', dogumTarihi, 'Ay:', ay);
      return 0;
    }

    // Gün kontrolü: 1-31 arası olmalı (daha detaylı kontrol Date objesi ile yapılacak)
    if (gun < 1 || gun > 31) {
      console.warn('yasHesapla: Gün aralığı dışında (1-31 olmalı):', dogumTarihi, 'Gün:', gun);
      return 0;
    }

    // Date objesi oluştur (ay 0-indexed olduğu için ay-1 kullan)
    const dogum = new Date(yil, ay - 1, gun);
    const bugun = new Date();

    // Geçersiz tarih kontrolü (örneğin 31 Şubat gibi)
    if (dogum.getFullYear() !== yil || dogum.getMonth() !== ay - 1 || dogum.getDate() !== gun) {
      console.warn('yasHesapla: Geçersiz tarih (31 Şubat gibi):', dogumTarihi);
      return 0;
    }

    // Gelecek tarih kontrolü
    if (dogum > bugun) {
      console.warn('yasHesapla: Gelecek tarih:', dogumTarihi);
      return 0;
    }

    // Yaş hesaplama: yıl farkı
    let yas = bugun.getFullYear() - dogum.getFullYear();
    const ayFarki = bugun.getMonth() - dogum.getMonth();

    // Henüz doğum günü gelmemişse yaşı 1 azalt
    if (ayFarki < 0 || (ayFarki === 0 && bugun.getDate() < dogum.getDate())) {
      yas--;
    }

    // Negatif yaş kontrolü (güvenlik)
    if (yas < 0) {
      console.warn('yasHesapla: Negatif yaş hesaplandı:', dogumTarihi, 'Yaş:', yas);
      return 0;
    }

    return yas;
  } catch (error) {
    // Hata durumunda güvenli varsayılan değer
    console.error('yasHesapla hatası:', error);
    return 0;
  }
}

/**
 * Yaşa göre TFF yaş grubu belirle
 * @param yas - Sporcu yaşı
 * @returns TFF yaş grubu kodu (örn: "U7", "U21+")
 */
export function yasGrubuBelirle(yas: number): string {
  // Negatif yaş kontrolü
  if (yas < 0) {
    console.warn('yasGrubuBelirle: Negatif yaş:', yas);
    return 'U7'; // Güvenli varsayılan
  }

  // Minimum yaş kontrolü
  if (yas < 7) return 'U7';

  // Maksimum yaş kontrolü
  if (yas > 21) return 'U21+';

  // Normal yaş grubu (U7-U21 arası)
  return 'U' + yas;
}

/**
 * Doğum tarihinden yaş grubu hesapla
 * @param dogumTarihi - Doğum tarihi
 * @returns TFF yaş grubu kodu
 */
export function yasGrubuHesapla(dogumTarihi: string | null | undefined): string {
  try {
    const yas = yasHesapla(dogumTarihi);
    return yasGrubuBelirle(yas);
  } catch (error) {
    // Hata durumunda güvenli varsayılan değer
    console.error('yasGrubuHesapla hatası:', error);
    return 'U7';
  }
}

/**
 * Benzersiz ID üret
 * Date.now() + rastgele string kombinasyonu kullanır
 * NOT: Aynı milisaniyede iki çağrı olursa çakışma riski var (nadir)
 * @returns Benzersiz ID string'i
 */
export function benzersizId(): string {
  try {
    return Date.now() + Math.random().toString(36).substr(2, 9);
  } catch (error) {
    // Hata durumunda alternatif ID üret
    console.error('benzersizId hatası:', error);
    return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
  }
}

/**
 * Debounce fonksiyonu
 * Fonksiyon çağrılarını belirli bir süre geciktirir (performans optimizasyonu)
 * Örnek: Arama input'unda her tuş vuruşunda API çağrısı yapmak yerine,
 * kullanıcı yazmayı bıraktıktan sonra çağrı yapar
 * @param func - Geciktirilecek fonksiyon
 * @param wait - Bekleme süresi (milisaniye)
 * @returns Geciktirilmiş fonksiyon wrapper'ı
 */
export function debounce<T extends (...args: unknown[]) => void>(
  func: T,
  wait = 300
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      try {
        if (timeout) clearTimeout(timeout);
        timeout = null;
        func(...args);
      } catch (error) {
        // Hata durumunda sistemi çökertme
        console.error('Debounce fonksiyon hatası:', error);
      }
    };

    // Önceki timeout'u iptal et
    if (timeout) clearTimeout(timeout);

    // Yeni timeout başlat
    timeout = setTimeout(later, wait);
  };
}

/**
 * DOM elementi oluştur
 * Güvenli DOM elementi oluşturma (XSS korumalı)
 * @param tag - HTML tag adı (örn: "div", "button")
 * @param attributes - Element özellikleri (className, dataset, onclick vb.)
 * @param content - Element içeriği (string veya HTMLElement)
 * @param allowHtml - HTML içerik kullanılsın mı? (false = textContent kullan, XSS korumalı)
 * @returns Oluşturulan DOM elementi
 */
export function createElement(
  tag: string,
  attributes: Record<string, string | object> = {},
  content: string | HTMLElement = '',
  allowHtml = false
): HTMLElement {
  try {
    const element = document.createElement(tag);

    // Özellikleri ekle
    for (const [key, value] of Object.entries(attributes)) {
      if (key === 'className') {
        element.className = String(value);
      } else if (key === 'dataset') {
        // Data attribute'ları ekle
        if (typeof value === 'object' && value !== null) {
          for (const [dataKey, dataValue] of Object.entries(value)) {
            element.dataset[dataKey] = String(dataValue);
          }
        }
      } else if (key.startsWith('on')) {
        // Event listener ekle (onclick, onchange vb.)
        const eventType = key.substring(2).toLowerCase();
        if (typeof value === 'function') {
          element.addEventListener(eventType, value as EventListener);
        }
      } else {
        // Diğer attribute'ları ekle
        element.setAttribute(key, String(value));
      }
    }

    // İçerik ekle
    if (typeof content === 'string') {
      if (allowHtml) {
        // HTML içerik kullan (icon'lar, badge'ler gibi güvenli içerikler için)
        // NOT: Kullanıcı girdileri için allowHtml=false kullanılmalı!
        element.innerHTML = content;
      } else {
        // Güvenlik: textContent kullan (kullanıcı girdileri için XSS korumalı)
        element.textContent = content;
      }
    } else if (content instanceof HTMLElement) {
      // HTMLElement ise direkt ekle
      element.appendChild(content);
    }

    return element;
  } catch (error) {
    // Hata durumunda boş div döndür (sistem çökmesini önle)
    console.error('createElement hatası:', error);
    const fallback = document.createElement('div');
    fallback.textContent = 'Element oluşturulamadı';
    return fallback;
  }
}

/**
 * DOM elementi seç
 * @param selector - CSS selector string'i
 * @returns Bulunan element veya null
 */
export function $(selector: string): HTMLElement | null {
  try {
    return document.querySelector(selector);
  } catch (error) {
    // Geçersiz selector hatası
    console.error('$ selector hatası:', error, 'Selector:', selector);
    return null;
  }
}

/**
 * Tüm DOM elementlerini seç
 * @param selector - CSS selector string'i
 * @returns Bulunan elementler NodeList
 */
export function $$(selector: string): NodeListOf<HTMLElement> {
  try {
    return document.querySelectorAll(selector);
  } catch (error) {
    // Geçersiz selector hatası - boş NodeList döndür
    console.error('$$ selector hatası:', error, 'Selector:', selector);
    return document.querySelectorAll(''); // Boş NodeList
  }
}

type ToastType = 'success' | 'error' | 'warning' | 'info';

/**
 * Toast bildirimi göster
 * Kullanıcıya geçici bildirim mesajı gösterir
 * @param message - Gösterilecek mesaj
 * @param type - Bildirim tipi (success, error, warning, info)
 * @param duration - Gösterim süresi (milisaniye)
 */
export function toast(message: string, type: ToastType = 'info', duration = 3000): void {
  try {
    console.log('🔔 [Toast] Toast çağrıldı:', { message, type, duration });
    const container = $('#toastContainer');
    if (!container) {
      console.warn('❌ [Toast] #toastContainer bulunamadı');
      return;
    }
    console.log('✅ [Toast] Container bulundu:', container);

    // Icon mapping
    const icons: Record<ToastType, string> = {
      success: 'fa-check-circle',
      error: 'fa-times-circle',
      warning: 'fa-exclamation-triangle',
      info: 'fa-info-circle',
    };

    // HTML içerik kullan (icon'lar için güvenli)
    // Mesaj escape edilmiş (XSS korumalı)
    const toastEl = createElement(
      'div',
      { className: `toast toast-${type}` },
      `
            <i class="fa-solid ${icons[type]} toast-icon"></i>
            <span class="toast-message">${escapeHtml(message)}</span>
            <button class="toast-close">&times;</button>
        `,
      true
    );

    container.appendChild(toastEl);

    // Kapat butonuna tıklama event'i ekle
    const closeBtn = toastEl.querySelector('.toast-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        try {
          toastEl.remove();
        } catch (error) {
          console.error('Toast kapatma hatası:', error);
        }
      });
    }

    // Otomatik kapat (belirtilen süre sonra)
    setTimeout(() => {
      try {
        if (toastEl.parentNode) {
          toastEl.style.animation = 'toastSlide 0.3s ease reverse';
          setTimeout(() => {
            try {
              toastEl.remove();
            } catch (error) {
              console.error('Toast otomatik kapatma hatası:', error);
            }
          }, 300);
        }
      } catch (error) {
        console.error('Toast timeout hatası:', error);
      }
    }, duration);
  } catch (error) {
    // Hata durumunda console'a yaz (sistem çökmesini önle)
    console.error('toast hatası:', error);
    console.log('Toast mesajı:', message);
  }
}

/**
 * Onay modalı göster
 * Kullanıcıdan onay almak için basit confirm dialog
 * @param message - Gösterilecek onay mesajı
 * @returns Kullanıcı onayladı mı? (true/false)
 */
export function onay(message: string): boolean {
  try {
    return confirm(message);
  } catch (error) {
    // Hata durumunda güvenli varsayılan (onay verme)
    console.error('onay hatası:', error);
    return false;
  }
}

/**
 * Prompt göster
 * Kullanıcıdan metin girdisi almak için
 * @param message - Gösterilecek prompt mesajı
 * @param defaultValue - Varsayılan değer
 * @returns Kullanıcı girdisi veya null (iptal edildiyse)
 */
export function girdi(message: string, defaultValue = ''): string | null {
  try {
    return prompt(message, defaultValue);
  } catch (error) {
    // Hata durumunda null döndür
    console.error('girdi hatası:', error);
    return null;
  }
}

/**
 * Yüzde hesapla
 * @param kisim - Hesaplanacak kısım
 * @param toplam - Toplam değer
 * @returns Yüzde değeri (0-100 arası, yuvarlanmış)
 */
export function yuzdeHesapla(kisim: number, toplam: number): number {
  try {
    // Sıfıra bölme kontrolü
    if (toplam === 0) return 0;

    // Negatif değer kontrolü
    if (kisim < 0 || toplam < 0) {
      console.warn('yuzdeHesapla: Negatif değer:', { kisim, toplam });
      return 0;
    }

    return Math.round((kisim / toplam) * 100);
  } catch (error) {
    // Hata durumunda güvenli varsayılan
    console.error('yuzdeHesapla hatası:', error);
    return 0;
  }
}

/**
 * String'i slug'a çevir
 * URL-friendly string oluşturur (Türkçe karakter desteği)
 * @param str - Çevrilecek string
 * @returns Slug string (örn: "merhaba-dunya")
 */
export function slugify(str: string): string {
  try {
    if (!str || str.trim() === '') return '';

    return str
      .toLowerCase()
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ı/g, 'i')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  } catch (error) {
    // Hata durumunda boş string döndür
    console.error('slugify hatası:', error);
    return '';
  }
}

/**
 * Dizi'yi grupla
 * Diziyi belirli bir key'e göre gruplar
 * @param array - Gruplanacak dizi
 * @param key - Gruplama key'i (string veya fonksiyon)
 * @returns Gruplanmış obje (Record<string, T[]>)
 */
export function grupla<T>(array: T[], key: string | ((item: T) => string)): Record<string, T[]> {
  try {
    return array.reduce(
      (acc, item) => {
        // Key fonksiyon ise çağır, değilse obje property'si olarak al
        const groupKey =
          typeof key === 'function' ? key(item) : String((item as Record<string, unknown>)[key]);

        // Grup yoksa oluştur, varsa ekle
        (acc[groupKey] = acc[groupKey] || []).push(item);
        return acc;
      },
      {} as Record<string, T[]>
    );
  } catch (error) {
    // Hata durumunda boş obje döndür
    console.error('grupla hatası:', error);
    return {};
  }
}

/**
 * Dizi'yi sırala
 * Diziyi belirli bir key'e göre sıralar
 * @param array - Sıralanacak dizi
 * @param key - Sıralama key'i (string veya fonksiyon)
 * @param order - Sıralama yönü (asc: artan, desc: azalan)
 * @returns Sıralanmış dizi (orijinal dizi değişmez)
 */
export function sirala<T>(
  array: T[],
  key: string | ((item: T) => string | number | null | undefined),
  order: 'asc' | 'desc' = 'asc'
): T[] {
  try {
    return [...array].sort((a, b) => {
      // Key değerlerini al
      const valA =
        typeof key === 'function'
          ? key(a)
          : (a as Record<string, string | number | null | undefined>)[key];
      const valB =
        typeof key === 'function'
          ? key(b)
          : (b as Record<string, string | number | null | undefined>)[key];

      // Null/undefined değerleri handle et
      if (valA == null && valB == null) return 0;
      if (valA == null) return order === 'asc' ? 1 : -1;
      if (valB == null) return order === 'asc' ? -1 : 1;

      // Sıralama
      if (valA < valB) return order === 'asc' ? -1 : 1;
      if (valA > valB) return order === 'asc' ? 1 : -1;
      return 0;
    });
  } catch (error) {
    // Hata durumunda orijinal diziyi döndür (sıralama yapılmaz)
    console.error('sirala hatası:', error);
    return [...array];
  }
}

/**
 * Ay adını getir
 * @param ayIndex - Ay numarası (1-12)
 * @returns Ay adı (örn: "Ocak") veya boş string
 */
export function ayAdi(ayIndex: number): string {
  try {
    // Geçerli aralık kontrolü
    if (ayIndex < 1 || ayIndex > 12) {
      console.warn('ayAdi: Geçersiz ay index:', ayIndex);
      return '';
    }

    return AYLAR[ayIndex - 1] || '';
  } catch (error) {
    console.error('ayAdi hatası:', error);
    return '';
  }
}

/**
 * Şu anki ay ve yılı getir
 * @param tarih - Tarih objesi (opsiyonel, yoksa bugün kullanılır)
 * @returns Ay ve yıl bilgisi {ay: number, yil: number}
 */
export function suAnkiDonem(tarih: Date | null = null): { ay: number; yil: number } {
  try {
    const date = tarih || new Date();

    // Geçersiz tarih kontrolü
    if (isNaN(date.getTime())) {
      console.warn('suAnkiDonem: Geçersiz tarih, bugün kullanılıyor');
      const bugun = new Date();
      return {
        ay: bugun.getMonth() + 1,
        yil: bugun.getFullYear(),
      };
    }

    return {
      ay: date.getMonth() + 1, // Ay 0-11 arası, +1 ile 1-12 yapıyoruz
      yil: date.getFullYear(),
    };
  } catch (error) {
    // Hata durumunda bugünün tarihini kullan
    console.error('suAnkiDonem hatası:', error);
    const bugun = new Date();
    return {
      ay: bugun.getMonth() + 1,
      yil: bugun.getFullYear(),
    };
  }
}

/**
 * Gelecek ay ve yılı hesapla
 * @param donemAy - Mevcut ay (1-12)
 * @param donemYil - Mevcut yıl
 * @returns Gelecek ay ve yıl bilgisi {ay: number, yil: number}
 */
export function gelecekDonem(donemAy: number, donemYil: number): { ay: number; yil: number } {
  try {
    // Geçerli aralık kontrolü
    if (donemAy < 1 || donemAy > 12) {
      console.warn('gelecekDonem: Geçersiz ay:', donemAy);
      return { ay: 1, yil: donemYil };
    }

    let gelecekAy = donemAy + 1;
    let gelecekYil = donemYil;

    // Yıl değişimi kontrolü (Aralık -> Ocak)
    if (gelecekAy > 12) {
      gelecekAy = 1;
      gelecekYil = donemYil + 1;
    }

    return {
      ay: gelecekAy,
      yil: gelecekYil,
    };
  } catch (error) {
    console.error('gelecekDonem hatası:', error);
    // Hata durumunda güvenli varsayılan
    return { ay: donemAy, yil: donemYil };
  }
}

/**
 * Tarih objesini ISO string'e çevir (YYYY-MM-DD)
 * @param tarih - Tarih objesi veya string
 * @returns ISO formatında tarih string'i (YYYY-MM-DD)
 */
export function tarihISO(tarih: Date | string | null | undefined): string {
  try {
    // Null/undefined kontrolü - bugünü kullan
    if (!tarih) return bugunISO();

    // Date objesi veya string'den Date oluştur
    const date = tarih instanceof Date ? tarih : new Date(tarih);

    // Geçersiz tarih kontrolü
    if (isNaN(date.getTime())) {
      console.warn('tarihISO: Geçersiz tarih, bugün kullanılıyor');
      return bugunISO();
    }

    // YYYY-MM-DD formatına çevir
    const yil = date.getFullYear();
    const ay = String(date.getMonth() + 1).padStart(2, '0');
    const gun = String(date.getDate()).padStart(2, '0');
    return `${yil}-${ay}-${gun}`;
  } catch (error) {
    // Hata durumunda bugünün tarihini döndür
    console.error('tarihISO hatası:', error);
    return bugunISO();
  }
}

/**
 * Skeleton loader oluştur - Stat Card
 * Yükleme animasyonu için placeholder kart oluşturur
 * @param count - Oluşturulacak kart sayısı
 * @returns HTML string
 */
export function skeletonStatCard(count = 1): string {
  try {
    let html = '';
    for (let i = 0; i < count; i++) {
      html += `
                <div class="skeleton-stat-card">
                    <div class="skeleton skeleton-stat-icon"></div>
                    <div class="skeleton-stat-content">
                        <div class="skeleton skeleton-stat-value"></div>
                        <div class="skeleton skeleton-stat-label"></div>
                    </div>
                </div>
            `;
    }
    return html;
  } catch (error) {
    console.error('skeletonStatCard hatası:', error);
    return '';
  }
}

/**
 * Skeleton loader oluştur - Table
 * Yükleme animasyonu için placeholder tablo oluşturur
 * @param rows - Satır sayısı
 * @param cols - Sütun sayısı
 * @returns HTML string
 */
export function skeletonTable(rows = 5, cols = 7): string {
  try {
    let html = '<table class="skeleton-table">';
    html += '<thead><tr>';
    for (let i = 0; i < cols; i++) {
      html += '<th><div class="skeleton skeleton-text" style="height: 16px;"></div></th>';
    }
    html += '</tr></thead><tbody>';
    for (let r = 0; r < rows; r++) {
      html += '<tr>';
      for (let c = 0; c < cols; c++) {
        const widthClass =
          c === 0
            ? 'skeleton-table-cell-medium'
            : c === cols - 1
              ? 'skeleton-table-cell-short'
              : 'skeleton-table-cell';
        html += `<td><div class="skeleton ${widthClass}"></div></td>`;
      }
      html += '</tr>';
    }
    html += '</tbody></table>';
    return html;
  } catch (error) {
    console.error('skeletonTable hatası:', error);
    return '';
  }
}

/**
 * Skeleton loader oluştur - Chart
 * Yükleme animasyonu için placeholder grafik oluşturur
 * @returns HTML string
 */
export function skeletonChart(): string {
  try {
    const barCount = 12;
    const bars = Array.from({ length: barCount }, () => {
      // %30-100 arası rastgele yükseklik
      const height = 30 + Math.random() * 70;
      return `<div class="skeleton skeleton-chart-bar" style="height: ${height}%;"></div>`;
    }).join('');

    return `
            <div class="skeleton-chart">
                <div class="skeleton-chart-bars">
                    ${bars}
                </div>
            </div>
        `;
  } catch (error) {
    console.error('skeletonChart hatası:', error);
    return '';
  }
}

/**
 * Skeleton loader oluştur - List
 * Yükleme animasyonu için placeholder liste oluşturur
 * @param count - Liste elemanı sayısı
 * @returns HTML string
 */
export function skeletonList(count = 5): string {
  try {
    let html = '<div class="skeleton-list">';
    for (let i = 0; i < count; i++) {
      html += `
                <div class="skeleton-list-item">
                    <div class="skeleton skeleton-list-avatar"></div>
                    <div class="skeleton-list-content">
                        <div class="skeleton skeleton-list-title"></div>
                        <div class="skeleton skeleton-list-subtitle"></div>
                    </div>
                </div>
            `;
    }
    html += '</div>';
    return html;
  } catch (error) {
    console.error('skeletonList hatası:', error);
    return '';
  }
}

type SkeletonType = 'stat' | 'table' | 'chart' | 'list';

interface SkeletonOptions {
  count?: number;
  rows?: number;
  cols?: number;
}

/**
 * Skeleton loader'ı göster
 * Belirtilen container'a skeleton loader ekler
 * @param containerSelector - Container CSS selector'ı
 * @param type - Skeleton tipi
 * @param options - Skeleton seçenekleri (count, rows, cols)
 */
export function showSkeleton(
  containerSelector: string,
  type: SkeletonType,
  options: SkeletonOptions = {}
): void {
  try {
    const container = $(containerSelector);
    if (!container) {
      console.warn('showSkeleton: Container bulunamadı:', containerSelector);
      return;
    }

    // Skeleton HTML'i oluştur
    let skeletonHTML = '';
    switch (type) {
      case 'stat':
        skeletonHTML = skeletonStatCard(options.count || 4);
        break;
      case 'table':
        skeletonHTML = skeletonTable(options.rows || 5, options.cols || 7);
        break;
      case 'chart':
        skeletonHTML = skeletonChart();
        break;
      case 'list':
        skeletonHTML = skeletonList(options.count || 5);
        break;
    }

    // Skeleton container oluştur veya güncelle
    let skeletonContainer = container.querySelector('.skeleton-container') as HTMLElement | null;
    if (!skeletonContainer) {
      skeletonContainer = document.createElement('div');
      skeletonContainer.className = 'skeleton-container';
      container.insertBefore(skeletonContainer, container.firstChild);
    }

    skeletonContainer.innerHTML = skeletonHTML;
    skeletonContainer.style.display = 'block';
  } catch (error) {
    // Hata durumunda sistemi çökertme
    console.error('showSkeleton hatası:', error);
  }
}

/**
 * Skeleton loader'ı gizle
 * @param containerSelector - Container CSS selector'ı
 */
export function hideSkeleton(containerSelector: string): void {
  try {
    const container = $(containerSelector);
    if (!container) return;

    const skeletonContainer = container.querySelector('.skeleton-container') as HTMLElement | null;
    if (skeletonContainer) {
      skeletonContainer.style.display = 'none';
      skeletonContainer.innerHTML = '';
    }
  } catch (error) {
    console.error('hideSkeleton hatası:', error);
  }
}

type BadgeType = 'success' | 'danger' | 'warning' | 'info';

/**
 * Badge oluştur (tekrarlayan badge kodlarını önlemek için)
 * @param type - Badge tipi
 * @param text - Badge metni
 * @returns HTML string (XSS korumalı)
 */
export function createBadge(type: BadgeType, text: string): string {
  try {
    // Güvenli: XSS koruması için escapeHtml kullan
    // Ancak text zaten HTML içeriyorsa (badge içinde badge gibi) escape etme
    const safeText = text && text.includes('<') ? text : escapeHtml(text);
    return `<span class="badge badge-${type}">${safeText}</span>`;
  } catch (error) {
    console.error('createBadge hatası:', error);
    return `<span class="badge badge-${type}">Badge</span>`;
  }
}

/**
 * Durum badge'i oluştur (Aktif/Pasif için)
 * @param durum - Sporcu durumu
 * @returns HTML string
 */
export function createDurumBadge(durum: 'Aktif' | 'Pasif' | 'Ayrıldı'): string {
  try {
    if (durum === 'Aktif') return createBadge('success', 'Aktif');
    if (durum === 'Ayrıldı') return createBadge('info', 'Ayrıldı');
    return createBadge('danger', 'Pasif');
  } catch (error) {
    console.error('createDurumBadge hatası:', error);
    return createBadge('info', durum);
  }
}

interface EmptyStateOptions {
  icon?: string;
  customClass?: string;
}

/**
 * Empty state göster
 * Boş durum mesajı gösterir (veri yoksa)
 * @param containerId - Container element ID'si
 * @param title - Başlık
 * @param message - Mesaj
 * @param options - Seçenekler (icon, customClass)
 */
export function showEmptyState(
  containerId: string,
  title: string,
  message: string,
  options: EmptyStateOptions = {}
): void {
  try {
    const container = $(containerId);
    if (!container) {
      console.warn('showEmptyState: Container bulunamadı:', containerId);
      return;
    }

    const icon = options.icon || 'fa-inbox';

    container.style.display = 'block';
    if (container.classList) {
      container.classList.add('show');
    }

    // H3 ve p elementlerini güncelle veya oluştur
    let titleEl = container.querySelector('h3');
    let messageEl = container.querySelector('p');

    if (!titleEl) {
      titleEl = document.createElement('h3');
      container.insertBefore(titleEl, container.firstChild);
    }
    // XSS koruması: textContent kullan
    titleEl.textContent = title;

    if (!messageEl) {
      messageEl = document.createElement('p');
      container.appendChild(messageEl);
    }
    // XSS koruması: textContent kullan
    messageEl.textContent = message;

    // Icon güncelle
    const iconEl = container.querySelector('i');
    if (iconEl) {
      iconEl.className = `fa-solid ${icon}`;
    }
  } catch (error) {
    console.error('showEmptyState hatası:', error);
  }
}

/**
 * Empty state gizle
 * @param containerId - Container element ID'si
 */
export function hideEmptyState(containerId: string): void {
  try {
    const container = $(containerId);
    if (!container) return;

    container.style.display = 'none';
    if (container.classList) {
      container.classList.remove('show');
    }
  } catch (error) {
    console.error('hideEmptyState hatası:', error);
  }
}

interface TableRowCell {
  content: string;
  label?: string;
  className?: string;
}

interface TableRowOptions {
  className?: string;
  dataset?: Record<string, string>;
  labels?: string[];
}

/**
 * Tablo satırı oluştur (Mobil kart görünümü destekli)
 * @param cells - Hücre içerikleri (string veya TableRowCell objesi)
 * @param options - Seçenekler (className, dataset, labels)
 * @returns Oluşturulan tablo satırı (tr elementi)
 */
export function createTableRow(
  cells: (string | TableRowCell)[],
  options: TableRowOptions = {}
): HTMLTableRowElement {
  try {
    const tr = document.createElement('tr');

    // Class name ekle
    if (options.className) {
      tr.className = options.className;
    }

    // Data attribute'ları ekle
    if (options.dataset) {
      Object.entries(options.dataset).forEach(([key, value]) => {
        tr.dataset[key] = value;
      });
    }

    // Labels array'i varsa data-label ekle (mobil kart görünümü için)
    const labels = options.labels || [];

    // Hücreleri oluştur
    cells.forEach((cellContent, index) => {
      const td = document.createElement('td');

      // Obje formatı destekle: {content, label, className}
      if (typeof cellContent === 'object' && cellContent !== null && 'content' in cellContent) {
        // NOT: innerHTML kullanılıyor - content güvenli olmalı (XSS riski)
        td.innerHTML = cellContent.content;
        if (cellContent.label) td.setAttribute('data-label', cellContent.label);
        if (cellContent.className) td.className = cellContent.className;
      } else {
        // String içerik - innerHTML kullanılıyor (XSS riski var, ama mevcut mantık korunuyor)
        td.innerHTML = String(cellContent);
        // Labels array'den label al
        if (labels[index]) {
          td.setAttribute('data-label', labels[index]);
        }
      }

      tr.appendChild(td);
    });

    return tr;
  } catch (error) {
    // Hata durumunda boş satır döndür
    console.error('createTableRow hatası:', error);
    return document.createElement('tr');
  }
}

/**
 * Telefon numarasını formatla (5XX XXX XX XX)
 * @param telefon - Formatlanacak telefon numarası
 * @returns Formatlanmış telefon veya "-" (geçersiz için)
 */
export function telefonFormat(telefon: string | null | undefined): string {
  try {
    if (!telefon) return '-';

    // Sadece rakamları al
    const cleaned = telefon.replace(/\D/g, '');

    // 10 haneli cep telefonu kontrolü
    if (cleaned.length === 10) {
      return cleaned.replace(/(\d{3})(\d{3})(\d{2})(\d{2})/, '$1 $2 $3 $4');
    }

    // Formatlanamazsa orijinal değeri döndür
    return telefon;
  } catch (error) {
    console.error('telefonFormat hatası:', error);
    return telefon || '-';
  }
}

/**
 * HTML içeriğini güvenli hale getir (XSS koruması)
 * HTML tag'lerini escape eder, XSS saldırılarını önler
 * @param text - Escape edilecek metin
 * @returns Escape edilmiş güvenli HTML string
 */
export function escapeHtml(text: string | null | undefined): string {
  try {
    if (text === null || text === undefined) return '';

    // textContent kullanarak otomatik escape yapılır
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  } catch (error) {
    // Hata durumunda boş string döndür
    console.error('escapeHtml hatası:', error);
    return '';
  }
}

// Event listener yönetimi için Map (memory leak önleme)
interface EventListenerInfo {
  element: HTMLElement;
  event: string;
  handler: EventListener;
  options: AddEventListenerOptions;
}

const eventListeners = new Map<string, EventListenerInfo>();

/**
 * Güvenli event listener ekle (duplicate önleme ve cleanup desteği)
 * Aynı element'e aynı event için birden fazla listener eklenmesini önler
 * @param element - Event listener eklenecek element
 * @param event - Event tipi (örn: "click", "change")
 * @param handler - Event handler fonksiyonu
 * @param options - Event listener seçenekleri
 * @returns Listener key'i (kaldırmak için) veya null
 */
export function safeAddEventListener(
  element: HTMLElement | null,
  event: string,
  handler: EventListener,
  options: AddEventListenerOptions = {}
): string | null {
  try {
    if (!element) return null;

    // Unique key oluştur (duplicate kontrolü için)
    const elementId =
      element.id || element.className || element.tagName + Math.random().toString(36).substr(2, 9);
    const key = `${elementId}_${event}_${handler.name || 'anonymous'}`;

    // Önceki listener'ı kaldır (duplicate önleme)
    if (eventListeners.has(key)) {
      const oldInfo = eventListeners.get(key);
      if (oldInfo) {
        oldInfo.element.removeEventListener(oldInfo.event, oldInfo.handler, oldInfo.options);
      }
    }

    // Yeni listener ekle
    element.addEventListener(event, handler, options);
    eventListeners.set(key, { element, event, handler, options });

    return key;
  } catch (error) {
    // Hata durumunda null döndür
    console.error('safeAddEventListener hatası:', error);
    return null;
  }
}

/**
 * Event listener'ı güvenli şekilde kaldır
 * @param key - Listener key'i (safeAddEventListener'dan dönen)
 */
export function safeRemoveEventListener(key: string): void {
  try {
    if (!eventListeners.has(key)) return;

    const info = eventListeners.get(key);
    if (info) {
      info.element.removeEventListener(info.event, info.handler, info.options);
      eventListeners.delete(key);
    }
  } catch (error) {
    console.error('safeRemoveEventListener hatası:', error);
  }
}

/**
 * Element'e bağlı tüm listener'ları temizle
 * @param element - Listener'ları temizlenecek element
 */
export function removeAllListeners(element: HTMLElement | null): void {
  try {
    if (!element) return;

    // Bu element'e ait tüm listener key'lerini bul
    const keysToRemove: string[] = [];
    eventListeners.forEach((value, key) => {
      if (value.element === element) {
        keysToRemove.push(key);
      }
    });

    // Tüm listener'ları kaldır
    keysToRemove.forEach(key => safeRemoveEventListener(key));
  } catch (error) {
    console.error('removeAllListeners hatası:', error);
  }
}

/**
 * Tüm event listener'ları temizle (sayfa kapatılırken)
 * Memory leak önleme için kullanılır
 */
export function cleanupAllListeners(): void {
  try {
    eventListeners.forEach((_value, key) => {
      safeRemoveEventListener(key);
    });
  } catch (error) {
    console.error('cleanupAllListeners hatası:', error);
  }
}

// Global erişim için (backward compatibility)
if (typeof window !== 'undefined') {
  (window as unknown as { Helpers: any }).Helpers = {
    AYLAR,
    YAS_GRUPLARI,
    paraFormat,
    paraFormatInput,
    paraCoz,
    tarihFormat,
    bugunISO,
    tarihISO,
    yasHesapla,
    yasGrubuBelirle,
    yasGrubuHesapla,
    benzersizId,
    debounce,
    createElement,
    $,
    $$,
    toast,
    onay,
    girdi,
    yuzdeHesapla,
    slugify,
    grupla,
    sirala,
    ayAdi,
    suAnkiDonem,
    skeletonStatCard,
    skeletonTable,
    skeletonChart,
    skeletonList,
    showSkeleton,
    hideSkeleton,
    createBadge,
    createDurumBadge,
    showEmptyState,
    hideEmptyState,
    createTableRow,
    telefonFormat,
    escapeHtml,
    safeAddEventListener,
    safeRemoveEventListener,
    removeAllListeners,
    cleanupAllListeners,
  };
}

/**
 * Finansal hesaplama helper fonksiyonu
 * Borç ve tahsilat hesaplama mantığını merkezileştirir
 */
export interface FinansalHesaplama {
  /** Brüt borç tahakkuku (Aidat + boş tür + Malzeme; pozitif satırlar) */
  toplamBorc: number;
  /** Tahakkuk kalemi: Aidat ve türü belirtilmemiş borç satırları */
  tahakkukAidat: number;
  /** Tahakkuk kalemi: Malzeme borç satırları */
  tahakkukMalzeme: number;
  toplamTahsilat: number;
  /** Net ödenecek tutar (outstanding) */
  kalanBorc: number;
  fazlaOdeme: number;
}

/**
 * Gelecek aylar için oluşturulan borç kayıtlarını filtrele
 * KRİTİK: Gelecek aylar için oluşturulan borç kayıtları (zam sonrası) mevcut borç hesaplamalarına dahil edilmemeli
 * @param aidat - Aidat kaydı
 * @param buAy - Mevcut ay (1-12)
 * @param buYil - Mevcut yıl
 * @returns true ise kayıt dahil edilmeli, false ise hariç tutulmalı
 */
export function gelecekAylarFiltresi(
  aidat: {
    donemAy?: number;
    donemYil?: number;
    islem_turu?: string;
    tutar?: number;
    [key: string]: any;
  },
  buAy: number,
  buYil: number
): boolean {
  // Gelecek ay kontrolü: donemYil > buYil veya (donemYil === buYil && donemAy > buAy)
  if (aidat.donemYil && aidat.donemAy) {
    const gelecekAyMi =
      aidat.donemYil > buYil || (aidat.donemYil === buYil && aidat.donemAy > buAy);
    if (gelecekAyMi) {
      // Gelecek ay ise ve Aidat borcu ise hariç tut (sadece tahsil edilecek aidat, mevcut borç değil)
      // Tip kontrolü: 'zam' tipindeki kayıtlar veya islem_turu='Aidat' olan pozitif tutarlar
      const isAidatBorcu =
        (aidat.islem_turu === 'Aidat' || !aidat.islem_turu) && (aidat.tutar || 0) > 0;
      const isZamKaydi = aidat.tip === 'zam';
      if (isAidatBorcu || isZamKaydi) {
        return false; // Gelecek ay Aidat borçlarını hariç tut
      }
    }
  }
  return true; // Diğer kayıtları dahil et (geçmiş/mevcut ay borçları, tahsilatlar, malzeme borçları)
}

/**
 * Sporcu için finansal hesaplama yapar
 * @param aidatlar - Tüm aidat kayıtları
 * @param sporcuId - Sporcu ID
 * @param donemAy - Dönem ayı (opsiyonel, tüm dönemler için null)
 * @param donemYil - Dönem yılı (opsiyonel, tüm dönemler için null)
 * @returns Finansal hesaplama sonucu
 */
export function finansalHesapla(
  aidatlar: Array<{
    sporcuId?: number;
    tutar?: number;
    islem_turu?: string;
    donemAy?: number;
    donemYil?: number;
  }>,
  sporcuId: number,
  donemAy?: number | null,
  donemYil?: number | null
): FinansalHesaplama {
  // Sporcuya ait aidatları filtrele
  let filtrelenmisAidatlar = aidatlar.filter(a => a.sporcuId === sporcuId);

  // Dönem filtresi varsa uygula
  if (donemAy && donemYil) {
    filtrelenmisAidatlar = filtrelenmisAidatlar.filter(
      a => a.donemAy === donemAy && a.donemYil === donemYil
    );

    // KRİTİK: Seçilen dönem mevcut ay veya geçmiş ay ise, gelecek aylar için borç kayıtlarını hariç tut
    // Gelecek aylar için oluşturulan borç kayıtları (zam sonrası) mevcut borç hesaplamalarına dahil edilmemeli
    const bugun = new Date();
    const buAy = bugun.getMonth() + 1;
    const buYil = bugun.getFullYear();

    // Seçilen dönem mevcut ay veya geçmiş ay ise, gelecek aylar filtresini uygula
    const secilenDonemGecmisMi = donemYil < buYil || (donemYil === buYil && donemAy <= buAy);
    if (secilenDonemGecmisMi) {
      // Mevcut ay veya geçmiş ay için ödeme alınırken, gelecek ayın zamlı aidatlarını hariç tut
      filtrelenmisAidatlar = filtrelenmisAidatlar.filter(a => gelecekAylarFiltresi(a, buAy, buYil));
    }
  } else {
    // Dönem filtresi yoksa, gelecek aylar için borç kayıtlarını hariç tut
    // KRİTİK: Gelecek aylar için oluşturulan borç kayıtları (zam sonrası) mevcut borç hesaplamalarına dahil edilmemeli
    const bugun = new Date();
    const buAy = bugun.getMonth() + 1;
    const buYil = bugun.getFullYear();

    filtrelenmisAidatlar = filtrelenmisAidatlar.filter(a => gelecekAylarFiltresi(a, buAy, buYil));
  }

  type AidatSatir = (typeof filtrelenmisAidatlar)[0];
  const borcTahakkukuSatiri = (a: AidatSatir) =>
    (a.tutar || 0) > 0 &&
    (a.islem_turu === 'Aidat' || a.islem_turu === 'Malzeme' || !a.islem_turu);

  /** Ödenmemiş borç satırları — kalan borç bu tutar üzerinden düşer (Ödendi satırları ödeme geçmişinde kapatılmış sayılır) */
  const borcTahakkukuAcik = (a: AidatSatir) =>
    borcTahakkukuSatiri(a) && (a as { odemeDurumu?: string }).odemeDurumu !== 'Ödendi';

  // Brüt tahakkuk (Aidat + Malzeme + tür yok) — raporlarda "ne kesildi"
  const tahakkukMalzeme = filtrelenmisAidatlar
    .filter(a => borcTahakkukuSatiri(a) && a.islem_turu === 'Malzeme')
    .reduce((t, a) => t + (a.tutar || 0), 0);
  const tahakkukAidat = filtrelenmisAidatlar
    .filter(a => borcTahakkukuSatiri(a) && a.islem_turu !== 'Malzeme')
    .reduce((t, a) => t + (a.tutar || 0), 0);
  const toplamBorc = tahakkukAidat + tahakkukMalzeme;

  // Açık borç tutarı (Ödendi işaretli satırlar düşülür — çift kayıt veya yalnızca işaretli kapanış)
  const acikBorcToplam = filtrelenmisAidatlar.filter(borcTahakkukuAcik).reduce((t, a) => t + (a.tutar || 0), 0);

  // Tahsilatları hesapla (negatif tutarlar veya islem_turu='Tahsilat')
  const toplamTahsilat = filtrelenmisAidatlar
    .filter(a => (a.tutar || 0) < 0 || a.islem_turu === 'Tahsilat')
    .reduce((t, a) => t + Math.abs(a.tutar || 0), 0);

  // Kalan borç: açık borç − tahsilat; fazla: tahsilat − brüt tahakkuk (uluslararası ödeme fazlası tanımı)
  const kalanBorc = Math.max(0, acikBorcToplam - toplamTahsilat);
  const fazlaOdeme = Math.max(0, toplamTahsilat - toplamBorc);

  return {
    toplamBorc,
    tahakkukAidat,
    tahakkukMalzeme,
    toplamTahsilat,
    kalanBorc,
    fazlaOdeme,
  };
}

/**
 * Logger utility - Production'da console.log'ları gizler
 * Development'ta tüm loglar görünür, production'da sadece error'lar
 */
const isDevelopment =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.includes('dev'));

export const Logger = {
  log: function (...args: unknown[]): void {
    if (isDevelopment) {
      console.log(...args);
    }
  },
  warn: function (...args: unknown[]): void {
    if (isDevelopment) {
      console.warn(...args);
    }
  },
  error: function (...args: unknown[]): void {
    // Error'lar her zaman loglanmalı
    console.error(...args);
  },
  info: function (...args: unknown[]): void {
    if (isDevelopment) {
      console.info(...args);
    }
  },
  debug: function (...args: unknown[]): void {
    if (isDevelopment) {
      console.debug(...args);
    }
  },
};
