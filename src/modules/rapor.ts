/**
 * SOY-BIS - Rapor Modülü (rapor.ts)
 * Raporlama ve export işlemleri - TypeScript Version
 */

import * as Helpers from '../utils/helpers';
import * as Storage from '../utils/storage';
import type { Sporcu } from '../types';
import {
  applyHtml2PdfAvoidSpacers,
  buildExcelHeaderRows,
  buildReportDocumentMeta,
  PDF_EXPORT_MARGIN_MM,
  pdfExportRootWidthMm,
  PDF_HTML2PDF_PAGE_BREAK,
  createPdfExportLoadingOverlay,
  detachPdfExportUi,
  HTML2PDF_CANVAS_SCALE,
  preloadLogoForPdf,
  reportEscapeHtml,
  REPORT_PDF_STYLES,
  stylePdfExportCaptureRoot,
  yieldUntilPaint,
  runWithHtml2CanvasWillReadFrequentlyPatch,
} from '../utils/reportExport';

// Global window objesi için type declaration
declare global {
  interface Window {
    XLSX?: {
      utils: {
        book_new: () => XLSXWorkbook;
        aoa_to_sheet: (data: unknown[][]) => XLSXWorksheet;
        book_append_sheet: (workbook: XLSXWorkbook, worksheet: XLSXWorksheet, name: string) => void;
      };
      writeFile: (workbook: XLSXWorkbook, filename: string) => void;
    };
  }
}

interface DevamRaporuResult {
  yoklamaSayisi: number;
  ortalamaDevam: number;
  enYuksekDevam: number;
  enDusukDevam: number;
  sonYoklamalar: Array<{
    tarih: string;
    grup: string;
    toplam: number;
    varOlan: number;
    devamsiz: number;
  }>;
}

interface GiderOzetResult {
  toplamGider: number;
  giderSayisi: number;
  turOzetleri: { [key: string]: number };
  enBuyukGider: number;
}

interface XLSXWorkbook {
  SheetNames: string[];
  Sheets: { [key: string]: XLSXWorksheet };
}

interface XLSXWorksheet {
  [key: string]: unknown;
}

/**
 * Modülü başlat
 */
export function init(): void {
  console.log('✅ [Rapor] Modül başlatılıyor...');
  // Yetki kontrolü - Raporlar sadece Yönetici ve Muhasebe
  if (
    typeof window !== 'undefined' &&
    window.Auth &&
    !window.Auth?.yetkiKontrol('rapor_gorebilir')
  ) {
    const raporView = Helpers.$('#raporlar');
    if (raporView) {
      (raporView as HTMLElement).style.display = 'none';
    }
    return;
  }

  // Varsayılan değerleri set et
  varsayilanDegerleriSetEt();

  eventleri();
  guncelle();
  console.log('✅ [Rapor] Modül başlatıldı');
}

/**
 * Varsayılan değerleri set et
 */
export function varsayilanDegerleriSetEt(): void {
  const raporTuruSelect = Helpers.$('#raporTuru') as HTMLSelectElement | null;
  const raporDonemiSelect = Helpers.$('#raporDonemi') as HTMLSelectElement | null;

  if (raporTuruSelect) {
    raporTuruSelect.value = 'genel'; // Varsayılan: Genel Özet
  }

  if (raporDonemiSelect) {
    raporDonemiSelect.value = 'buay'; // Varsayılan: Bu Ay
  }
}

/**
 * Eventleri bağla
 */
function eventleri(): void {
  const raporTuru = Helpers.$('#raporTuru') as HTMLSelectElement | null;
  const raporDonemi = Helpers.$('#raporDonemi') as HTMLSelectElement | null;
  const pdfBtn = Helpers.$('#pdfIndir');
  const excelBtn = Helpers.$('#excelIndir');
  const yazdirBtn = Helpers.$('#yazdir');

  if (raporTuru) {
    raporTuru.addEventListener('change', guncelle);
  }
  if (raporDonemi) {
    raporDonemi.addEventListener('change', guncelle);
  }
  if (pdfBtn) {
    pdfBtn.addEventListener('click', () => indir('pdf'));
  }
  if (excelBtn) {
    excelBtn.addEventListener('click', () => indir('excel'));
  }
  if (yazdirBtn) {
    yazdirBtn.addEventListener('click', yazdir);
  }
}

/**
 * Raporu güncelle
 */
export function guncelle(): void {
  console.log('🔄 [Rapor] guncelle() çağrıldı');

  try {
    const raporTuruSelect = Helpers.$('#raporTuru') as HTMLSelectElement | null;
    const raporTuru = raporTuruSelect?.value || 'genel';
    const container = Helpers.$('#raporIcerik');
    if (!container) {
      console.warn('⚠️ [Rapor] guncelle - container bulunamadı');
      return;
    }

    container.innerHTML = '';

    // Başlık oluştur
    const baslik = document.createElement('h2');
    baslik.style.cssText =
      'color: var(--dark); margin-bottom: 2rem; border-bottom: 2px solid var(--accent); padding-bottom: 0.5rem;';

    switch (raporTuru) {
      case 'genel':
        baslik.innerHTML = '<i class="fa-solid fa-chart-pie"></i> Genel Özet Raporu';
        container.appendChild(baslik);
        genelRapor(container);
        break;
      case 'aidat':
        baslik.innerHTML = '<i class="fa-solid fa-wallet"></i> Aidat Raporu';
        container.appendChild(baslik);
        aidatRaporu(container);
        break;
      case 'devam':
        baslik.innerHTML = '<i class="fa-solid fa-clipboard-check"></i> Devam Raporu';
        container.appendChild(baslik);
        devamRaporu(container);
        break;
      case 'sporcu':
        baslik.innerHTML = '<i class="fa-solid fa-users"></i> Sporcu Analiz Raporu';
        container.appendChild(baslik);
        sporcuRaporu(container);
        break;
      case 'finans':
        baslik.innerHTML = '<i class="fa-solid fa-chart-line"></i> Finansal Rapor';
        container.appendChild(baslik);
        finansRaporu(container);
        break;
    }
  } catch (error) {
    console.error('❌ [Rapor] guncelle hatası:', error);
    if (typeof Helpers !== 'undefined' && Helpers.toast) {
      Helpers.toast('Rapor güncellenirken hata oluştu!', 'error');
    }
  }
}

/**
 * Genel rapor
 */
function genelRapor(container: HTMLElement): void {
  const sporcular = Storage.sporculariGetir();
  const aidatlar = Storage.aidatlariGetir();
  const giderler = Storage.giderleriGetir();
  const yoklamalar = Storage.yoklamalariGetir();

  // Toplam Gelir - YENİ MANTIK: Sadece negatif tutarları topla (tahsilatlar)
  const toplamGelir = aidatlar
    .filter(a => (a.tutar || 0) < 0 || a.islem_turu === 'Tahsilat')
    .reduce((t, a) => t + Math.abs(a.tutar || 0), 0); // Mutlak değer al
  const toplamGider = giderler.reduce((t, g) => t + g.miktar, 0);
  const netKar = toplamGelir - toplamGider;

  // Ortalama devam hesapla
  let toplamDevam = 0;
  let devamSayisi = 0;
  yoklamalar.forEach(y => {
    const varOlan = y.sporcular.filter(s => s.durum === 'var').length;
    const toplam = y.sporcular.length;
    if (toplam > 0) {
      toplamDevam += (varOlan / toplam) * 100;
      devamSayisi++;
    }
  });
  const ortalamaDevam = devamSayisi > 0 ? Math.round(toplamDevam / devamSayisi) : 0;

  // Güvenli: XSS koruması için escapeHtml kullan
  const html = `
    <div class="rapor-grid">
      <div class="rapor-card">
        <h3><i class="fa-solid fa-users"></i> Sporcu İstatistikleri</h3>
        <ul class="rapor-list">
          <li><span class="rapor-label">Toplam Sporcu</span> <span class="rapor-deger">${sporcular.length}</span></li>
          <li><span class="rapor-label">Aktif Sporcu</span> <span class="rapor-deger">${sporcular.filter(s => s.durum === 'Aktif').length}</span></li>
          <li><span class="rapor-label">Burslu Sporcu</span> <span class="rapor-deger">${sporcular.filter(s => s.odemeBilgileri?.burslu).length}</span></li>
        </ul>
      </div>
      <div class="rapor-card">
        <h3><i class="fa-solid fa-money-bill-wave"></i> Finansal Özet</h3>
        <ul class="rapor-list">
          <li><span class="rapor-label">Toplam Gelir</span> <span class="rapor-deger financial-positive">${Helpers.paraFormat(toplamGelir)} TL</span></li>
          <li><span class="rapor-label">Toplam Gider</span> <span class="rapor-deger financial-negative">${Helpers.paraFormat(toplamGider)} TL</span></li>
          <li><span class="rapor-label">Net Kar</span> <span class="rapor-deger" style="color: ${netKar >= 0 ? 'var(--success)' : 'var(--danger)'}">${Helpers.paraFormat(netKar)} TL</span></li>
        </ul>
      </div>
      <div class="rapor-card">
        <h3><i class="fa-solid fa-chart-line"></i> Performans</h3>
        <ul class="rapor-list">
          <li><span class="rapor-label">Ortalama Devam</span> <span class="rapor-deger">%${ortalamaDevam}</span></li>
          <li><span class="rapor-label">Yoklama Kaydı</span> <span class="rapor-deger">${yoklamalar.length} gün</span></li>
          <li><span class="rapor-label">Ödeme İşlemi</span> <span class="rapor-deger">${aidatlar.length} adet</span></li>
        </ul>
      </div>
    </div>
  `;
  container.insertAdjacentHTML('beforeend', html);
}

/**
 * Aidat raporu
 */
function aidatRaporu(container: HTMLElement): void {
  const sporcular = Storage.sporculariGetir();
  const aidatlar = Storage.aidatlariGetir();
  // const { ay, yil } = Helpers.suAnkiDonem(); // Kullanılmıyor, kaldırıldı

  const aktifSporcular = sporcular.filter(s => s.durum === 'Aktif' && !s.odemeBilgileri?.burslu);
  const beklenen = aktifSporcular.reduce((t, s) => t + (s.odemeBilgileri?.aylikUcret || 0), 0);

  // Toplam Tahsilat - YENİ MANTIK: Sadece negatif tutarları topla (tahsilatlar)
  const tahsilat = aidatlar
    .filter(a => (a.tutar || 0) < 0 || a.islem_turu === 'Tahsilat')
    .reduce((t, a) => t + Math.abs(a.tutar || 0), 0); // Mutlak değer al

  // Toplam Borç - YENİ MANTIK: Sadece pozitif tutarları topla (borçlar)
  const toplamBorc = aidatlar
    .filter(a => (a.tutar || 0) > 0 && (a.islem_turu === 'Aidat' || a.islem_turu === 'Malzeme'))
    .reduce((t, a) => t + (a.tutar || 0), 0);

  // Borçlu sporcuları bul - YENİ MANTIK: Sporcu bakiyesini hesapla
  const borcluSporcular = aktifSporcular.filter(s => {
    const sporcuAidatlari = aidatlar.filter(a => a.sporcuId === s.id);
    // Bakiye = Tüm tutarların toplamı (pozitif + negatif)
    const bakiye = sporcuAidatlari.reduce((t, a) => t + (a.tutar || 0), 0);
    return bakiye > 0; // Pozitif bakiye = borçlu
  });

  // Güvenli: XSS koruması için escapeHtml kullan
  const html = `
    <div class="rapor-grid">
      <div class="rapor-card">
        <h3><i class="fa-solid fa-chart-bar"></i> Aidat Özeti</h3>
        <ul class="rapor-list">
          <li><span class="rapor-label">Toplam Borç</span> <span class="rapor-deger">${Helpers.paraFormat(toplamBorc)} TL</span></li>
          <li><span class="rapor-label">Tahsil Edilen</span> <span class="rapor-deger financial-positive">${Helpers.paraFormat(tahsilat)} TL</span></li>
          <li><span class="rapor-label">Kalan Borç</span> <span class="rapor-deger financial-negative">${Helpers.paraFormat(Math.max(0, toplamBorc - tahsilat))} TL</span></li>
          <li><span class="rapor-label">Tahsilat Oranı</span> <span class="rapor-deger">%${Helpers.yuzdeHesapla(tahsilat, beklenen)}</span></li>
        </ul>
      </div>
      <div class="rapor-card" style="grid-column: span 2;">
        <h3><i class="fa-solid fa-exclamation-triangle"></i> Borçlu Sporcular (${borcluSporcular.length})</h3>
        <div style="max-height: 300px; overflow-y: auto;">
          <ul class="rapor-list">
            ${
              borcluSporcular.length > 0
                ? borcluSporcular
                    .map(s => {
                      const odenen = aidatlar
                        .filter(a => a.sporcuId === s.id)
                        .reduce((t, a) => t + a.tutar, 0);
                      const borc = (s.odemeBilgileri?.aylikUcret || 0) - odenen;
                      // Güvenli: XSS koruması için escapeHtml kullan
                      const adSoyad = Helpers.escapeHtml(s.temelBilgiler?.adSoyad || '-');
                      const brans = Helpers.escapeHtml(s.sporBilgileri?.brans || '-');
                      const grup = Helpers.escapeHtml(s.tffGruplari?.anaGrup || '-');
                      return `
                <li style="display: flex; justify-content: space-between;">
                  <div>
                    <strong>${adSoyad}</strong>
                    <small style="color: var(--muted); margin-left: 10px;">${brans} - ${grup}</small>
                  </div>
                  <span class="financial-negative" style="font-weight: bold;">${Helpers.paraFormat(borc)} TL</span>
                </li>
              `;
                    })
                    .join('')
                : '<li style="text-align: center; color: var(--success); font-weight: bold;">🎉 Borçlu sporcu bulunmuyor!</li>'
            }
          </ul>
        </div>
      </div>
    </div>
  `;
  container.insertAdjacentHTML('beforeend', html);
}

/**
 * Devam raporu
 */
function devamRaporu(container: HTMLElement): void {
  if (typeof window === 'undefined' || !window.Yoklama) {
    Helpers.toast('Yoklama modülü yüklenemedi!', 'error');
    return;
  }

  const rapor = window.Yoklama.devamRaporu?.() as DevamRaporuResult | undefined;

  if (!rapor) {
    Helpers.toast('Devam raporu oluşturulamadı!', 'error');
    return;
  }

  // Güvenli: XSS koruması için escapeHtml kullan
  const html = `
    <div class="rapor-grid">
      <div class="rapor-card">
        <h3><i class="fa-solid fa-calendar-check"></i> Devam İstatistikleri</h3>
        <ul class="rapor-list">
          <li><span class="rapor-label">Yoklama Alınan Gün</span> <span class="rapor-deger">${rapor.yoklamaSayisi}</span></li>
          <li><span class="rapor-label">Ortalama Devam</span> <span class="rapor-deger">%${rapor.ortalamaDevam}</span></li>
          <li><span class="rapor-label">En Yüksek Devam</span> <span class="rapor-deger financial-positive">%${rapor.enYuksekDevam}</span></li>
          <li><span class="rapor-label">En Düşük Devam</span> <span class="rapor-deger financial-negative">%${rapor.enDusukDevam}</span></li>
        </ul>
      </div>
      <div class="rapor-card" style="grid-column: span 2;">
        <h3><i class="fa-solid fa-list"></i> Son Yoklamalar</h3>
        <div style="max-height: 300px; overflow-y: auto;">
          <ul class="rapor-list">
            ${
              rapor.sonYoklamalar.length > 0
                ? rapor.sonYoklamalar
                    .map(
                      (y: {
                        tarih: string;
                        grup: string;
                        toplam: number;
                        varOlan: number;
                        devamsiz: number;
                      }) => {
                        const oran = Helpers.yuzdeHesapla(y.varOlan, y.toplam);
                        const grup = Helpers.escapeHtml(y.grup === 'all' ? 'Tüm Gruplar' : y.grup);
                        return `
                <li style="display: flex; justify-content: space-between;">
                  <div>
                    <strong>${Helpers.tarihFormat(y.tarih)}</strong>
                    <small style="color: var(--muted); margin-left: 10px;">${grup}</small>
                  </div>
                  <span class="rapor-deger">%${oran} (${y.varOlan}/${y.toplam})</span>
                </li>
              `;
                      }
                    )
                    .join('')
                : '<li style="text-align: center; color: var(--muted);">Henüz yoklama kaydı yok</li>'
            }
          </ul>
        </div>
      </div>
    </div>
  `;
  container.insertAdjacentHTML('beforeend', html);
}

/**
 * Sporcu raporu
 */
function sporcuRaporu(container: HTMLElement): void {
  const sporcular = Storage.sporculariGetir();

  // Branş dağılımı
  const branslar: { [key: string]: Sporcu[] } = {};
  sporcular.forEach(s => {
    const brans = s.sporBilgileri?.brans || 'Belirsiz';
    if (!branslar[brans]) {
      branslar[brans] = [];
    }
    branslar[brans].push(s);
  });

  // Yaş grubu dağılımı
  const yasGruplari: { [key: string]: Sporcu[] } = {};
  sporcular.forEach(s => {
    const grup = s.tffGruplari?.anaGrup || 'Belirsiz';
    if (!yasGruplari[grup]) {
      yasGruplari[grup] = [];
    }
    yasGruplari[grup].push(s);
  });

  // Güvenli: XSS koruması için escapeHtml kullan
  const html = `
    <div class="rapor-grid">
      <div class="rapor-card">
        <h3><i class="fa-solid fa-user-group"></i> Sporcu Dağılımı</h3>
        <ul class="rapor-list">
          <li><span class="rapor-label">Toplam Sporcu</span> <span class="rapor-deger">${sporcular.length}</span></li>
          <li><span class="rapor-label">Aktif Sporcu</span> <span class="rapor-deger financial-positive">${sporcular.filter(s => s.durum === 'Aktif').length}</span></li>
          <li><span class="rapor-label">Pasif Sporcu</span> <span class="rapor-deger financial-negative">${sporcular.filter(s => s.durum === 'Pasif').length}</span></li>
          <li><span class="rapor-label">Ayrıldı (arşiv)</span> <span class="rapor-deger">${sporcular.filter(s => s.durum === 'Ayrıldı').length}</span></li>
          <li><span class="rapor-label">Burslu Sporcu</span> <span class="rapor-deger">${sporcular.filter(s => s.odemeBilgileri?.burslu).length}</span></li>
        </ul>
      </div>
      <div class="rapor-card">
        <h3><i class="fa-solid fa-medal"></i> Branş Dağılımı</h3>
        <ul class="rapor-list">
          ${Object.entries(branslar)
            .map(([brans, liste]) => {
              const bransEscaped = Helpers.escapeHtml(brans);
              return `<li><span class="rapor-label">${bransEscaped}</span> <span class="rapor-deger">${liste.length}</span></li>`;
            })
            .join('')}
        </ul>
      </div>
      <div class="rapor-card">
        <h3><i class="fa-solid fa-child"></i> Yaş Grupları</h3>
        <ul class="rapor-list">
          ${Object.entries(yasGruplari)
            .sort()
            .map(([grup, liste]) => {
              const grupEscaped = Helpers.escapeHtml(grup);
              return `<li><span class="rapor-label">${grupEscaped}</span> <span class="rapor-deger">${liste.length}</span></li>`;
            })
            .join('')}
        </ul>
      </div>
    </div>
  `;
  container.insertAdjacentHTML('beforeend', html);
}

/**
 * Finansal rapor
 */
function finansRaporu(container: HTMLElement): void {
  const aidatlar = Storage.aidatlariGetir();

  if (typeof window === 'undefined' || !window.Gider) {
    Helpers.toast('Gider modülü yüklenemedi!', 'error');
    return;
  }

  const giderOzeti: GiderOzetResult | undefined = window.Gider.ozet?.();

  if (!giderOzeti) {
    Helpers.toast('Gider özeti alınamadı!', 'error');
    return;
  }

  // Toplam Gelir - YENİ MANTIK: Sadece negatif tutarları topla (tahsilatlar)
  const toplamGelir = aidatlar
    .filter(a => (a.tutar || 0) < 0 || a.islem_turu === 'Tahsilat')
    .reduce((t, a) => t + Math.abs(a.tutar || 0), 0); // Mutlak değer al
  const netKar = toplamGelir - giderOzeti.toplamGider;
  const karMarji = toplamGelir > 0 ? Math.round((netKar / toplamGelir) * 100) : 0;

  // Güvenli: XSS koruması için escapeHtml kullan
  const html = `
    <div class="rapor-grid">
      <div class="rapor-card">
        <h3><i class="fa-solid fa-chart-line"></i> Finansal Özet</h3>
        <ul class="rapor-list">
          <li><span class="rapor-label">Toplam Gelir</span> <span class="rapor-deger financial-positive">${Helpers.paraFormat(toplamGelir)} TL</span></li>
          <li><span class="rapor-label">Toplam Gider</span> <span class="rapor-deger financial-negative">${Helpers.paraFormat(giderOzeti.toplamGider)} TL</span></li>
          <li><span class="rapor-label">Net Kar/Zarar</span> <span class="rapor-deger" style="color: ${netKar >= 0 ? 'var(--success)' : 'var(--danger)'}; font-weight: bold;">${Helpers.paraFormat(netKar)} TL</span></li>
          <li><span class="rapor-label">Kar Marjı</span> <span class="rapor-deger" style="color: ${karMarji >= 0 ? 'var(--success)' : 'var(--danger)'}">${karMarji}%</span></li>
        </ul>
      </div>
      <div class="rapor-card" style="grid-column: span 2;">
        <h3><i class="fa-solid fa-chart-pie"></i> Gider Dağılımı</h3>
        <ul class="rapor-list">
          ${
            Object.entries(giderOzeti.turOzetleri).length > 0
              ? Object.entries(giderOzeti.turOzetleri)
                  .map(([tur, tutar]) => {
                    const turEscaped = Helpers.escapeHtml(tur);
                    return `
                  <li style="display: flex; justify-content: space-between;">
                    <span class="rapor-label">${turEscaped}</span>
                    <span class="rapor-deger financial-negative">${Helpers.paraFormat(tutar)} TL</span>
                  </li>
                `;
                  })
                  .join('')
              : '<li style="text-align: center; color: var(--muted);">Henüz gider kaydı yok</li>'
          }
        </ul>
      </div>
    </div>
  `;
  container.insertAdjacentHTML('beforeend', html);
}

/**
 * Raporu indir
 * @param tip - pdf veya excel
 */
export function indir(tip: 'pdf' | 'excel'): void {
  const raporIcerik = Helpers.$('#raporIcerik');
  if (!raporIcerik) return;

  if (tip === 'pdf') {
    pdfIndir(raporIcerik);
  } else if (tip === 'excel') {
    excelIndir(raporIcerik);
  }
}

/**
 * PDF olarak indir - Profesyonel, uluslararası standartlara uygun PDF
 */
function pdfIndir(raporIcerik: HTMLElement): void {
  if (typeof window === 'undefined' || typeof (window as any).html2pdf === 'undefined') {
    Helpers.toast('PDF kütüphanesi yüklenemedi!', 'error');
    return;
  }

  // Rapor bilgilerini topla
  const raporBaslik = raporIcerik.querySelector('h2')?.textContent?.trim() || 'Genel Rapor';
  const baslikTemiz = raporBaslik.replace(/<[^>]*>/g, '');
  const docMeta = buildReportDocumentMeta();
  const logoSrc = Helpers.soybisLogoUrl();

  // Mevcut DOM'u kopyala ve temizle
  const raporClone = raporIcerik.cloneNode(true) as HTMLElement;

  // Görünmez elementleri kaldır
  raporClone
    .querySelectorAll('.btn, button, .no-print, i.fa-solid, i.fa-regular, i.fa-brands')
    .forEach(el => {
      el.remove();
    });

  // Başlıktan icon'u temizle
  raporClone.querySelectorAll('h2, h3').forEach(h => {
    const icons = h.querySelectorAll('i');
    icons.forEach(i => i.remove());
  });

  // Rapor kartlarını işle - Daha güvenilir yöntem
  const kartlar: Array<{
    baslik: string;
    veriler: Array<{ label: string; deger: string; tip?: 'positive' | 'negative' | 'normal' }>;
  }> = [];

  raporClone.querySelectorAll('.rapor-card').forEach(kart => {
    const baslikElement = kart.querySelector('h3');
    if (!baslikElement) return;

    const baslik = baslikElement.textContent?.trim() || 'Bölüm';
    const veriler: Array<{
      label: string;
      deger: string;
      tip?: 'positive' | 'negative' | 'normal';
    }> = [];

    // .rapor-list li elementlerini işle
    kart.querySelectorAll('.rapor-list li').forEach(item => {
      const labelEl = item.querySelector('.rapor-label');
      const degerEl = item.querySelector('.rapor-deger');

      if (labelEl && degerEl) {
        const label = labelEl.textContent?.replace(':', '').trim() || '';
        const deger = degerEl.textContent?.trim() || '';

        // Finansal class kontrolü
        let tip: 'positive' | 'negative' | 'normal' = 'normal';
        if (
          degerEl.classList.contains('financial-positive') ||
          degerEl.classList.contains('text-success')
        ) {
          tip = 'positive';
        } else if (
          degerEl.classList.contains('financial-negative') ||
          degerEl.classList.contains('text-danger')
        ) {
          tip = 'negative';
        }

        if (label && deger) {
          veriler.push({ label, deger, tip });
        }
      } else {
        // Alternatif: Eğer label/deger yoksa, text'i parse et
        const text = item.textContent?.trim() || '';
        if (text && text.length > 5) {
          // "Label: Değer" formatını parse et
          const match = text.match(/^(.+?):\s*(.+)$/);
          if (match) {
            veriler.push({ label: match[1].trim(), deger: match[2].trim(), tip: 'normal' });
          }
        }
      }
    });

    if (veriler.length > 0) {
      kartlar.push({ baslik, veriler });
    }
  });

  // Debug log
  console.log('📊 PDF Veri Toplama:', {
    kartSayisi: kartlar.length,
    toplamVeri: kartlar.reduce((sum, k) => sum + k.veriler.length, 0),
    kartlar: kartlar.map(k => ({ baslik: k.baslik, veriSayisi: k.veriler.length })),
  });

  // Eğer hiç kart bulunamadıysa, içeriği direkt al
  if (kartlar.length === 0) {
    console.warn('⚠️ PDF: Rapor kartları bulunamadı, alternatif yöntem deneniyor...');
    const allText = raporIcerik.textContent || '';
    if (allText.trim().length > 50) {
      kartlar.push({
        baslik: baslikTemiz,
        veriler: [{ label: 'Rapor İçeriği', deger: allText.substring(0, 1000), tip: 'normal' }],
      });
    }
  }

  // Eğer kartlar boşsa, mevcut DOM'u direkt kullan
  if (kartlar.length === 0) {
    console.warn('⚠️ PDF: Veri toplama başarısız, DOM direkt kullanılıyor...');
    // Mevcut içeriği direkt kullan
    const tempDiv = document.createElement('div');
    tempDiv.style.width = pdfExportRootWidthMm(PDF_EXPORT_MARGIN_MM);
    tempDiv.style.background = '#ffffff';
    tempDiv.style.overflow = 'visible';
    tempDiv.style.padding = '20mm 15mm';
    tempDiv.style.fontFamily = "'Segoe UI', 'Helvetica Neue', Arial, sans-serif";
    tempDiv.style.fontSize = '10pt';
    tempDiv.style.color = '#1a202c';
    tempDiv.style.lineHeight = '1.6';
    stylePdfExportCaptureRoot(tempDiv);

    // Header ekle
    const header = document.createElement('div');
    header.style.borderBottom = '4px solid #c45c3e';
    header.style.paddingBottom = '15px';
    header.style.marginBottom = '25px';
    header.innerHTML = `
      <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; padding-bottom: 12px; border-bottom: 3px solid #0f172a;">
        <div style="display: flex; align-items: center; gap: 14px;">
          <img src="${logoSrc}" alt="SOYBIS" width="52" height="52" style="object-fit: contain;" crossorigin="anonymous" />
          <div>
            <div style="font-size: 11pt; font-weight: 700; letter-spacing: 0.04em; color: #0f172a;">SOYBIS</div>
            <div style="font-size: 8.5pt; color: #475569;">Spor Okulları Yönetim Bilgi Sistemi</div>
          </div>
        </div>
        <div style="border: 1px solid #cbd5e1; border-radius: 4px; padding: 8px 12px; background: #f8fafc; font-size: 7.5pt; line-height: 1.5; color: #334155;">
          <div><strong style="color:#0f172a;">Belge no</strong> ${reportEscapeHtml(docMeta.referenceId)}</div>
          <div><strong style="color:#0f172a;">Tarih</strong> ${reportEscapeHtml(docMeta.dateDisplayTr)}</div>
          <div><strong style="color:#0f172a;">UTC</strong> ${reportEscapeHtml(docMeta.iso8601Utc)}</div>
        </div>
      </div>
      <div style="margin-top: 12px;">
        <div style="font-size: 15pt; font-weight: 700; color: #0f172a;">${reportEscapeHtml(baslikTemiz)}</div>
      </div>
    `;
    tempDiv.appendChild(header);

    // İçeriği ekle
    tempDiv.appendChild(raporClone);

    // Footer ekle
    const footer = document.createElement('div');
    footer.style.marginTop = '30px';
    footer.style.paddingTop = '15px';
    footer.style.borderTop = '1px solid #e2e8f0';
    footer.style.textAlign = 'center';
    footer.style.fontSize = '8pt';
    footer.style.color = '#718096';
    footer.innerHTML = `
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px;font-size:7.5pt;color:#64748b;border-top:1px solid #cbd5e1;padding-top:12px;margin-top:16px;">
        <div><strong style="color:#0f172a;">SOYBIS</strong> · Yalnızca kurum içi kullanım / Internal use only</div>
        <div style="font-family:ui-monospace,monospace;font-size:7pt;">${reportEscapeHtml(docMeta.iso8601Utc)}</div>
      </div>
    `;
    tempDiv.appendChild(footer);

    document.body.appendChild(tempDiv);
    const pdfOverlay = createPdfExportLoadingOverlay();
    document.body.appendChild(pdfOverlay);

    void (async () => {
      await yieldUntilPaint();
      await preloadLogoForPdf(logoSrc);
      await yieldUntilPaint();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          void (async () => {
            applyHtml2PdfAvoidSpacers(tempDiv);
            const w = Math.max(1, tempDiv.scrollWidth || 794);
            const h = Math.max(1, tempDiv.scrollHeight || 1200);
            const opt = {
              margin: 0,
              filename: `SOYBIS_Report_${baslikTemiz.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`,
              image: { type: 'jpeg', quality: 0.98 },
              html2canvas: {
                scale: HTML2PDF_CANVAS_SCALE,
                useCORS: true,
                letterRendering: true,
                logging: false,
                width: w,
                height: h,
                windowWidth: w,
                windowHeight: h,
              },
              jsPDF: {
                unit: 'mm',
                format: 'a4',
                orientation: 'portrait',
                compress: true,
              },
              pagebreak: { ...PDF_HTML2PDF_PAGE_BREAK },
            };

            await yieldUntilPaint();

            try {
              await runWithHtml2CanvasWillReadFrequentlyPatch(() =>
                (window as any).html2pdf().set(opt).from(tempDiv).save()
              );
              detachPdfExportUi(tempDiv, pdfOverlay);
              Helpers.toast('PDF başarıyla indirildi!', 'success');
            } catch (error: unknown) {
              console.error('PDF oluşturma hatası:', error);
              detachPdfExportUi(tempDiv, pdfOverlay);
              Helpers.toast('PDF oluşturulurken hata oluştu!', 'error');
            }
          })();
        });
      });
    })();
    return;
  }

  const pdfHTML = `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${reportEscapeHtml(baslikTemiz)} — SOYBIS</title>
  <style>${REPORT_PDF_STYLES}</style>
</head>
<body>
  <div class="pdf-page">
    <div class="pdf-letterhead">
      <div class="pdf-letterhead-row">
        <div class="pdf-brand">
          <div class="pdf-logo-box">
            <img src="${logoSrc}" alt="SOYBIS" width="52" height="52" loading="eager" crossorigin="anonymous" />
          </div>
          <div>
            <div class="pdf-org-name">SOYBIS</div>
            <div class="pdf-org-tagline">Spor Okulları Yönetim Bilgi Sistemi</div>
          </div>
        </div>
        <div class="pdf-doc-control">
          <div><strong>Belge no</strong> ${reportEscapeHtml(docMeta.referenceId)}</div>
          <div><strong>Oluşturma</strong> ${reportEscapeHtml(docMeta.dateDisplayTr)}</div>
          <div><strong>Saat</strong> ${reportEscapeHtml(docMeta.timeDisplayTr)}</div>
          <div><strong>Saat dilimi</strong> ${reportEscapeHtml(docMeta.timezoneLabel)}</div>
          <div><strong>UTC</strong> ${reportEscapeHtml(docMeta.iso8601Utc)}</div>
        </div>
      </div>
      <div class="pdf-report-title-block">
        <div class="pdf-h1">${reportEscapeHtml(baslikTemiz)}</div>
        <div class="pdf-h1-sub">Yönetim özeti · Bilgilendirme amaçlıdır · Management summary · For information purposes only</div>
      </div>
    </div>
    <div class="pdf-content">
      ${kartlar
        .map(
          kart => `
        <div class="pdf-section">
          <div class="pdf-h2">${reportEscapeHtml(kart.baslik)}</div>
          <table class="pdf-table">
            <thead>
              <tr>
                <th>Alan / Field</th>
                <th>Değer / Value</th>
              </tr>
            </thead>
            <tbody>
              ${kart.veriler
                .map(
                  v => `
                <tr>
                  <td class="pdf-td-label">${reportEscapeHtml(v.label)}</td>
                  <td class="pdf-td-value ${v.tip === 'positive' ? 'positive' : v.tip === 'negative' ? 'negative' : ''}">${reportEscapeHtml(v.deger)}</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        </div>
      `
        )
        .join('')}
    </div>
    <div class="pdf-footer">
      <div class="pdf-footer-left">
        <div class="pdf-footer-title">SOYBIS · Sürüm 3.x</div>
        <div>Gizlilik: yalnızca yetkili kullanıcılar ve kurum içi kullanım. / Confidential: internal use only.</div>
        <div class="pdf-footer-iso">${reportEscapeHtml(docMeta.iso8601Utc)}</div>
      </div>
      <div class="pdf-footer-right">
        <div><strong>Sayfa</strong> 1 / 1</div>
        <div>${reportEscapeHtml(docMeta.dateDisplayTr)}</div>
      </div>
    </div>
  </div>
</body>
</html>
  `;

  // Geçici container oluştur
  const tempDiv = document.createElement('div');
  tempDiv.style.width = pdfExportRootWidthMm(PDF_EXPORT_MARGIN_MM);
  tempDiv.style.background = '#ffffff';
  tempDiv.style.overflow = 'visible';
  tempDiv.innerHTML = pdfHTML;
  stylePdfExportCaptureRoot(tempDiv);
  document.body.appendChild(tempDiv);
  const pdfOverlay = createPdfExportLoadingOverlay();
  document.body.appendChild(pdfOverlay);

  void (async () => {
    await yieldUntilPaint();
    await preloadLogoForPdf(logoSrc);
    await yieldUntilPaint();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        void (async () => {
          applyHtml2PdfAvoidSpacers(tempDiv, PDF_EXPORT_MARGIN_MM);

          const height = Math.max(1, tempDiv.scrollHeight || tempDiv.offsetHeight || 1200);
          const width = Math.max(1, tempDiv.scrollWidth || tempDiv.offsetWidth || 794);

          console.log('📄 PDF oluşturuluyor...', {
            width,
            height,
            kartSayisi: kartlar.length,
            innerHTMLLength: tempDiv.innerHTML.length,
          });

          const opt = {
            margin: [...PDF_EXPORT_MARGIN_MM],
            filename: `SOYBIS_Report_${baslikTemiz.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: {
              scale: HTML2PDF_CANVAS_SCALE,
              useCORS: true,
              letterRendering: true,
              logging: false,
              width,
              height,
              windowWidth: width,
              windowHeight: height,
            },
            jsPDF: {
              unit: 'mm',
              format: 'a4',
              orientation: 'portrait',
              compress: true,
            },
            pagebreak: { ...PDF_HTML2PDF_PAGE_BREAK },
          };

          await yieldUntilPaint();

          try {
            await runWithHtml2CanvasWillReadFrequentlyPatch(() =>
              (window as any).html2pdf().set(opt).from(tempDiv).save()
            );
            detachPdfExportUi(tempDiv, pdfOverlay);
            Helpers.toast('PDF başarıyla indirildi!', 'success');
          } catch (error: unknown) {
            console.error('PDF oluşturma hatası:', error);
            detachPdfExportUi(tempDiv, pdfOverlay);
            Helpers.toast('PDF oluşturulurken hata oluştu!', 'error');
          }
        })();
      });
    });
  })();
}

/**
 * Excel olarak indir
 */
function excelIndir(raporIcerik: HTMLElement): void {
  if (typeof window === 'undefined' || typeof window.XLSX === 'undefined') {
    Helpers.toast('Excel kütüphanesi yüklenemedi!', 'error');
    return;
  }

  const workbook = window.XLSX.utils.book_new();
  const raporBaslik = raporIcerik.querySelector('h2');
  const baslikText = raporBaslik?.textContent?.trim() || 'RAPOR';
  const baslikTemizExcel = baslikText.replace(/<[^>]*>/g, '');
  const data: unknown[][] = [...buildExcelHeaderRows(baslikTemizExcel)];

  raporIcerik.querySelectorAll('.rapor-card').forEach(card => {
    const baslikElement = card.querySelector('h3');
    const baslik = baslikElement?.textContent?.trim() || 'Bölüm';
    const baslikTextClean = baslik.replace(/<[^>]*>/g, '');
    data.push(['Bölüm / Section', baslikTextClean, '', '']);

    card.querySelectorAll('.rapor-list li').forEach(item => {
      const labelElement = item.querySelector('.rapor-label');
      const valueElement = item.querySelector('.rapor-deger');
      if (labelElement && valueElement) {
        const label = labelElement.textContent?.replace(':', '').trim() || '';
        const value = valueElement.textContent?.trim() || '';
        if (label || value) {
          data.push([label, value, '', '']);
        }
      } else {
        const satir = item.textContent?.replace(/\s+/g, ' ').trim() || '';
        if (satir) {
          data.push([satir, '', '', '']);
        }
      }
    });
    data.push([]);
  });

  const worksheet = window.XLSX.utils.aoa_to_sheet(data);
  worksheet['!cols'] = [{ wch: 44 }, { wch: 36 }, { wch: 10 }, { wch: 6 }];
  window.XLSX.utils.book_append_sheet(workbook, worksheet, 'Rapor');
  window.XLSX.writeFile(
    workbook,
    `SOYBIS_Rapor_${new Date().toLocaleDateString('tr-TR').replace(/\./g, '-')}.xlsx`
  );

  Helpers.toast('Excel dosyası indirildi!', 'success');
}

/**
 * Yazdır
 */
export function yazdir(): void {
  window.print();
}

// Public API
if (typeof window !== 'undefined') {
  (window as unknown as { Rapor: Record<string, unknown> }).Rapor = {
    init,
    guncelle,
    indir,
    yazdir,
    varsayilanDegerleriSetEt,
  };
}
