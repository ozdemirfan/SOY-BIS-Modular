/**
 * SOY-BIS - Gider Modülü (gider.ts)
 * Gider yönetimi işlemleri - TypeScript Version
 */

import * as Helpers from '../utils/helpers';
import * as Storage from '../utils/storage';
import * as Validation from '../utils/validation';
import type { Gider, Session } from '../types';

// Global window objesi için type declaration
declare global {
  interface Window {
    Auth?: {
      yetkiKontrol: (yetki: string) => boolean;
      isAdmin: () => boolean;
      aktifKullanici: () => Session | null;
    };
    Dashboard?: {
      guncelle: () => void;
      malzemeModalKapatF?: () => void;
      malzemeKaydet?: () => void;
    };
    Rapor?: {
      init?: () => void;
      guncelle?: () => void;
      indir?: (tip: 'pdf' | 'excel') => void;
      yazdir?: () => void;
    };
    Gider?: {
      init: () => void;
      kaydet: () => void;
      sil: (id: number) => void;
      listeyiGuncelle: () => void;
      ozet: (ay?: number | null, yil?: number | null) => GiderOzetResult;
      aylikTrend: (aySayisi?: number) => AylikTrendResult[];
    };
  }
}

interface GiderOzetResult {
  toplamGider: number;
  giderSayisi: number;
  turOzetleri: { [key: string]: number };
  enBuyukGider: number;
}

interface AylikTrendResult {
  donem: string;
  ay: number;
  yil: number;
  toplam: number;
  sayi: number;
}

/**
 * Modülü başlat
 */
export function init(): void {
  console.log('✅ [Gider] Modül başlatılıyor...');
  // Yetki kontrolü - Gider sadece Yönetici ve Muhasebe
  if (
    typeof window !== 'undefined' &&
    window.Auth &&
    !window.Auth?.yetkiKontrol('gider_gorebilir')
  ) {
    const giderView = Helpers.$('#giderler');
    if (giderView) {
      (giderView as HTMLElement).style.display = 'none';
    }
    return;
  }

  formEventleri();
  listeyiGuncelle();
  console.log('✅ [Gider] Modül başlatıldı');
}

/**
 * Form eventlerini bağla
 */
function formEventleri(): void {
  const form = Helpers.$('#giderEkleForm');
  const tarihInput = Helpers.$('#giderTarih') as HTMLInputElement | null;
  const tutarInput = Helpers.$('#giderTutar') as HTMLInputElement | null;

  // 1. EKSİK OLAN TARİH AYARI (Burası silindiği için tarih gelmiyordu)
  if (tarihInput) {
    tarihInput.valueAsDate = new Date(); // Bugünü otomatik seç
  }

  // 2. PARA FORMATLAMA (Yazarken otomatik nokta koyması için)
  if (tutarInput) {
    tutarInput.addEventListener('input', function (this: HTMLInputElement) {
      // Helpers modülündeki formatlayıcıyı çağır
      Helpers.paraFormatInput(this);
    });
  }

  // 3. KAYDETME SORUNU (Garanti Çözüm)
  // Önce ID ile butonu arayalım
  let btn = document.getElementById('giderKaydetBtn');

  // Eğer ID ile bulamazsak, formun içindeki "Kaydet" (primary) butonunu bulalım
  if (!btn && form) {
    btn = form.querySelector('button.btn-primary');
  }

  if (btn) {
    // Butonu bulduysak, tipini 'button' yap (Form submit olmasın diye)
    btn.setAttribute('type', 'button');

    // Tıklama olayını ekle
    btn.onclick = function (e) {
      e.preventDefault();
      kaydet();
    };
  }

  // Eğer buton hiç yoksa ama form varsa (Enter'a basınca çalışması için)
  if (form) {
    form.onsubmit = function (e) {
      e.preventDefault();
      // Eğer buton olayını yukarıda bağladıysak burayı boş geçebiliriz
      // ama garanti olsun diye, sadece buton bulunamadıysa kaydet'i çağır
      if (!btn) kaydet();
    };
  }

  // Ödeme kaynağını varsayılan olarak "Nakit Kasa" yap
  const giderOdemeYontemi = Helpers.$('#giderOdemeYontemi') as HTMLSelectElement | null;
  if (giderOdemeYontemi) {
    giderOdemeYontemi.value = 'Nakit Kasa';
  }

  // Tutar için para formatı
  if (tutarInput) {
    tutarInput.addEventListener('input', function (this: HTMLInputElement) {
      Helpers.paraFormatInput(this);
    });
  }
}

/**
 * Gider kaydet
 * Form verilerini alır, doğrular ve gider kaydı oluşturur
 */
export function kaydet(): void {
  try {
    // Form elementlerini al
    const turSelect = Helpers.$('#giderTur') as HTMLSelectElement | null;
    const tutarInput = Helpers.$('#giderTutar') as HTMLInputElement | null;
    const tarihInput = Helpers.$('#giderTarih') as HTMLInputElement | null;
    const aciklamaInput = Helpers.$('#giderAciklama') as HTMLTextAreaElement | null;
    const giderOdemeYontemi = Helpers.$('#giderOdemeYontemi') as HTMLSelectElement | null;

    // Form elementleri kontrolü
    if (!turSelect || !tutarInput || !tarihInput || !aciklamaInput) {
      Helpers.toast('Form alanları bulunamadı!', 'error');
      return;
    }

    // Form değerlerini al
    const tur = turSelect.value.trim();
    const tutarStr = tutarInput.value.trim();
    const tarih = tarihInput.value.trim();
    const aciklama = aciklamaInput.value.trim();

    // Validasyon
    const errors: Record<string, string> = {};
    let hasError = false;

    // Validasyon: Gider türü kontrolü
    if (!tur || tur === '') {
      errors.giderTur = 'Lütfen gider türü seçin!';
      hasError = true;
    }

    // Validasyon: Tutar kontrolü
    // paraCoz fonksiyonu ondalık sayıları destekliyor (parseFloat kullanıyor)
    const tutar = Helpers.paraCoz(tutarStr);

    // Negatif tutar kontrolü - gider negatif olamaz
    if (tutar < 0) {
      errors.giderTutar = 'Gider tutarı negatif olamaz!';
      hasError = true;
    }

    // Sıfır tutar kontrolü - gider sıfır olamaz
    if (tutar === 0 || isNaN(tutar)) {
      errors.giderTutar = 'Geçerli bir tutar girin! (0 TL olamaz)';
      hasError = true;
    }

    // Validasyon: Tarih kontrolü
    if (!tarih || tarih === '') {
      errors.giderTarih = 'Lütfen tarih seçin!';
      hasError = true;
    }

    if (hasError) {
      Validation.hatalariGoster(errors);
      Helpers.toast('Lütfen hatalı alanları düzeltin.', 'error');
      return;
    }

    // Geçersiz tarih kontrolü
    const tarihObj = new Date(tarih);
    if (isNaN(tarihObj.getTime())) {
      Helpers.toast('Geçerli bir tarih seçin!', 'error');
      tarihInput.focus();
      return;
    }

    // Ödeme kaynağını al (varsayılan: Eski kayıtlar için uyumluluk)
    const yontem = giderOdemeYontemi?.value || 'Banka Hesabı';

    // Gider objesi oluştur
    const gider: Partial<Gider> = {
      baslik: tur,
      kategori: tur,
      miktar: tutar, // Ondalık sayı desteği var (parseFloat ile)
      tarih: tarih,
      aciklama: aciklama,
      yontem: yontem, // Nakit Kasa veya Banka Hesabı
      kayitTarihi: Helpers.bugunISO(),
    };

    // Gider kaydını oluştur
    try {
      Storage.giderKaydet(gider);
    } catch (storageError) {
      // Storage hatası durumunda kullanıcıya bilgi ver
      console.error('Gider kaydetme hatası:', storageError);
      Helpers.toast('Gider kaydedilirken bir hata oluştu!', 'error');
      return; // Hata durumunda işlemi durdur
    }

    // Başarı mesajı göster
    Helpers.toast(`${Helpers.paraFormat(tutar)} TL tutarında "${tur}" gideri eklendi!`, 'success');

    // Formu sıfırla
    const form = Helpers.$('#giderEkleForm');
    if (form && form instanceof HTMLFormElement) {
      form.reset();
    }

    // Tarihi bugüne ayarla
    if (tarihInput) {
      tarihInput.value = Helpers.bugunISO();
    }

    // Ödeme kaynağını varsayılan olarak "Nakit Kasa" yap
    if (giderOdemeYontemi) {
      giderOdemeYontemi.value = 'Nakit Kasa';
    }

    // Listeyi güncelle
    listeyiGuncelle();

    // Dashboard ve Rapor modüllerini güncelle (hata durumunda sistemi çökertme)
    try {
      if (
        typeof window !== 'undefined' &&
        window.Dashboard &&
        typeof window.Dashboard.guncelle === 'function'
      ) {
        window.Dashboard.guncelle?.();
      }
      if (
        typeof window !== 'undefined' &&
        window.Rapor &&
        typeof window.Rapor.guncelle === 'function'
      ) {
        window.Rapor.guncelle?.();
      }
    } catch (updateError) {
      // Güncelleme hatası kritik değil, sadece log
      console.error('Dashboard güncelleme hatası:', updateError);
      // Kullanıcıya bilgi verme (kritik olmayan hata)
    }
  } catch (error) {
    // Beklenmeyen hata durumunda sistemi çökertme
    console.error('Gider kaydet: Beklenmeyen hata:', error);
    Helpers.toast('Gider kaydedilirken bir hata oluştu!', 'error');
  }
}

/**
 * Gider sil
 * @param id - Gider ID
 */
export function sil(id: number): void {
  if (!Helpers.onay('Bu gider kaydını silmek istediğinizden emin misiniz?')) {
    return;
  }

  Storage.giderSil(id);
  Helpers.toast('Gider kaydı silindi!', 'success');

  listeyiGuncelle();

  // Dashboard ve Rapor modüllerini güncelle
  try {
    if (
      typeof window !== 'undefined' &&
      window.Dashboard &&
      typeof window.Dashboard.guncelle === 'function'
    ) {
      window.Dashboard.guncelle?.();
    }
    if (
      typeof window !== 'undefined' &&
      window.Rapor &&
      typeof window.Rapor.guncelle === 'function'
    ) {
      window.Rapor.guncelle?.();
    }
  } catch (e) {
    console.error('Dashboard güncelleme hatası:', e);
  }
}

/**
 * Listeyi güncelle
 */
export function listeyiGuncelle(): void {
  console.log('🔄 [Gider] listeyiGuncelle() çağrıldı');

  try {
    const tbody = Helpers.$('#giderTableBody');
    const tableContainer = Helpers.$('.table-container');
    if (!tbody) {
      console.warn('⚠️ [Gider] listeyiGuncelle - tbody bulunamadı');
      return;
    }

    // Skeleton loader göster
    if (tableContainer && tbody.children.length === 0) {
      Helpers.showSkeleton('.table-container', 'table', { rows: 5, cols: 5 });
    }

    const giderler = Storage.giderleriGetir();

    tbody.innerHTML = '';

    if (giderler.length === 0) {
      Helpers.showEmptyState(
        '#giderEmptyState',
        'Henüz gider kaydı bulunmuyor',
        'İlk gider kaydını eklemek için yukarıdaki formu kullanın.',
        { icon: 'fa-receipt' }
      );
      // Skeleton'ı gizle
      if (tableContainer) {
        Helpers.hideSkeleton('.table-container');
      }
      return;
    }

    Helpers.hideEmptyState('#giderEmptyState');

    // Skeleton'ı gizle
    if (tableContainer) {
      Helpers.hideSkeleton('.table-container');
    }

    // Tarihe göre sırala (yeniden eskiye)
    const siraliGiderler = Helpers.sirala(giderler, 'tarih', 'desc');

    siraliGiderler.forEach((gider: Gider) => {
      // Gider interface'inde `baslik` ve `kategori` var, ama eski kodda `tur` kullanılıyor
      // Backward compatibility için `kategori` veya `baslik` kullan
      const tur = gider.baslik || gider.kategori || '-';
      const turBadge = Helpers.createBadge('info', Helpers.escapeHtml(tur));
      // Güvenli: XSS koruması için escapeHtml kullan
      const aciklama = Helpers.escapeHtml(gider.aciklama || '-');

      // Mobil kart görünümü için labels ekle
      const tr = Helpers.createTableRow(
        [
          Helpers.tarihFormat(gider.tarih),
          turBadge,
          aciklama,
          `<span class="financial-negative">${Helpers.paraFormat(gider.miktar)} TL</span>`,
          `<div class="action-buttons">
        <button class="btn btn-small btn-icon btn-danger" onclick="window.Gider?.sil(${gider.id})" title="Sil">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>`,
        ],
        {
          labels: ['Tarih', 'Tür', 'Açıklama', 'Tutar', ''],
        }
      );
      tbody.appendChild(tr);
    });
  } catch (error) {
    console.error('❌ [Gider] listeyiGuncelle hatası:', error);
    if (typeof Helpers !== 'undefined' && Helpers.toast) {
      Helpers.toast('Gider listesi güncellenirken hata oluştu!', 'error');
    }
  }
}

/**
 * Gider özeti
 * @param ay - Ay (opsiyonel)
 * @param yil - Yıl (opsiyonel)
 * @returns Özet
 */
export function ozet(ay: number | null = null, yil: number | null = null): GiderOzetResult {
  let giderler = Storage.giderleriGetir();

  // Dönem filtresi
  if (ay !== null && yil !== null) {
    giderler = giderler.filter(g => {
      const tarih = new Date(g.tarih);
      return tarih.getMonth() + 1 === ay && tarih.getFullYear() === yil;
    });
  }

  // Türlere göre grupla (baslik veya kategori kullan)
  const turlerine: { [key: string]: Gider[] } = {};
  giderler.forEach(g => {
    const tur = g.baslik || g.kategori || 'Diğer';
    if (!turlerine[tur]) {
      turlerine[tur] = [];
    }
    turlerine[tur].push(g);
  });

  const turOzetleri: { [key: string]: number } = {};

  for (const [tur, liste] of Object.entries(turlerine)) {
    turOzetleri[tur] = liste.reduce((t, g) => t + g.miktar, 0);
  }

  // Toplam
  const toplamGider = giderler.reduce((t, g) => t + g.miktar, 0);

  return {
    toplamGider,
    giderSayisi: giderler.length,
    turOzetleri,
    enBuyukGider: giderler.length > 0 ? Math.max(...giderler.map(g => g.miktar)) : 0,
  };
}

/**
 * Aylık gider trendi
 * @param aySayisi - Kaç ay geriye gidilecek
 * @returns Aylık giderler
 */
export function aylikTrend(aySayisi: number = 6): AylikTrendResult[] {
  const giderler = Storage.giderleriGetir();
  const bugun = new Date();
  const sonuclar: AylikTrendResult[] = [];

  for (let i = aySayisi - 1; i >= 0; i--) {
    const tarih = new Date(bugun.getFullYear(), bugun.getMonth() - i, 1);
    const ay = tarih.getMonth() + 1;
    const yil = tarih.getFullYear();

    const aylikGiderler = giderler.filter(g => {
      const gTarih = new Date(g.tarih);
      return gTarih.getMonth() + 1 === ay && gTarih.getFullYear() === yil;
    });

    sonuclar.push({
      donem: `${Helpers.ayAdi(ay)} ${yil}`,
      ay,
      yil,
      toplam: aylikGiderler.reduce((t, g) => t + g.miktar, 0),
      sayi: aylikGiderler.length,
    });
  }

  return sonuclar;
}

// Public API
if (typeof window !== 'undefined') {
  (window as unknown as { Gider: Record<string, unknown> }).Gider = {
    init,
    kaydet,
    sil,
    listeyiGuncelle,
    ozet,
    aylikTrend,
  };
}
