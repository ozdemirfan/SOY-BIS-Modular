/**
 * SOY-BIS - Rapor Modülü (rapor.ts)
 * Raporlama ve export işlemleri - TypeScript Version
 */

import * as Helpers from '../utils/helpers';
import * as Storage from '../utils/storage';
import * as AidatMod from './aidat';
import type { Aidat, Gider, Sporcu, Yoklama } from '../types';
import {
  buildExcelHeaderRows,
  buildReportDocumentMeta,
  PDF_EXPORT_MARGIN_MM,
  pdfExportRootWidthMm,
  PDF_HTML2PDF_PAGE_BREAK,
  getHtml2PdfCanvasScale,
  reportEscapeHtml,
  REPORT_PDF_STYLES,
  runPdfExportWithRuntime,
  stylePdfExportCaptureRoot,
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

let raporEventleriBaglandi = false;

/** `#raporDonemi` → tek ay / yıl / tümü */
type RaporDonemSpec =
  | { tip: 'ay'; ay: number; yil: number }
  | { tip: 'yil'; yil: number }
  | { tip: 'tum' };

function raporDonemindenSpec(raporDonemi: string): RaporDonemSpec {
  const now = new Date();
  const buAy = now.getMonth() + 1;
  const buYil = now.getFullYear();
  if (raporDonemi === 'tumZaman') return { tip: 'tum' };
  if (raporDonemi === 'buYil') return { tip: 'yil', yil: buYil };
  if (raporDonemi === 'gecenay') {
    const d = new Date(buYil, buAy - 2, 1);
    return { tip: 'ay', ay: d.getMonth() + 1, yil: d.getFullYear() };
  }
  return { tip: 'ay', ay: buAy, yil: buYil };
}

function raporDonemEtiketi(raporDonemi: string): string {
  const spec = raporDonemindenSpec(raporDonemi);
  if (spec.tip === 'tum') return 'Tüm zamanlar';
  if (spec.tip === 'yil') return `${spec.yil} yılı (12 ay toplamı)`;
  return `${Helpers.ayAdi(spec.ay)} ${spec.yil}`;
}

/** Gelir satırları: dönemAy/Yıl veya tarih alanlarına göre */
function aidatlariRaporDonemineGore(aidatlar: Aidat[], raporDonemi: string): Aidat[] {
  const spec = raporDonemindenSpec(raporDonemi);
  if (spec.tip === 'tum') return aidatlar;

  const ayYilaUygun = (a: Aidat, ay: number, yil: number): boolean => {
    if (a.donemAy != null && a.donemYil != null) {
      return a.donemAy === ay && a.donemYil === yil;
    }
    const raw = a.tarih || a.odemeTarihi || a.kayitTarihi;
    if (!raw) return false;
    const dt = new Date(raw);
    if (Number.isNaN(dt.getTime())) return false;
    return dt.getMonth() + 1 === ay && dt.getFullYear() === yil;
  };

  const yilaUygun = (a: Aidat, yil: number): boolean => {
    if (a.donemYil != null) return a.donemYil === yil;
    const raw = a.tarih || a.odemeTarihi || a.kayitTarihi;
    if (!raw) return false;
    const dt = new Date(raw);
    return !Number.isNaN(dt.getTime()) && dt.getFullYear() === yil;
  };

  if (spec.tip === 'ay') {
    return aidatlar.filter(a => ayYilaUygun(a, spec.ay, spec.yil));
  }
  return aidatlar.filter(a => yilaUygun(a, spec.yil));
}

function giderleriRaporDonemineGore(giderler: Gider[], raporDonemi: string): Gider[] {
  const spec = raporDonemindenSpec(raporDonemi);
  if (spec.tip === 'tum') return giderler;

  const yilaUygun = (g: Gider, yil: number): boolean => {
    const raw = g.tarih || g.kayitTarihi;
    if (!raw) return false;
    const dt = new Date(raw);
    return !Number.isNaN(dt.getTime()) && dt.getFullYear() === yil;
  };

  const ayYilaUygun = (g: Gider, ay: number, yil: number): boolean => {
    const raw = g.tarih || g.kayitTarihi;
    if (!raw) return false;
    const dt = new Date(raw);
    return (
      !Number.isNaN(dt.getTime()) && dt.getMonth() + 1 === ay && dt.getFullYear() === yil
    );
  };

  if (spec.tip === 'ay') {
    return giderler.filter(g => ayYilaUygun(g, spec.ay, spec.yil));
  }
  return giderler.filter(g => yilaUygun(g, spec.yil));
}

/** Yoklama `devamRaporu(baslangic, bitis)` ile uyumlu YYYY-MM-DD aralığı */
function raporDonemindenYoklamaTarihAraligi(
  raporDonemi: string
): { baslangic: string | null; bitis: string | null } {
  const spec = raporDonemindenSpec(raporDonemi);
  if (spec.tip === 'tum') return { baslangic: null, bitis: null };
  if (spec.tip === 'yil') {
    return {
      baslangic: `${spec.yil}-01-01`,
      bitis: `${spec.yil}-12-31`,
    };
  }
  const { ay, yil } = spec;
  const pad = (n: number) => String(n).padStart(2, '0');
  const sonGun = new Date(yil, ay, 0).getDate();
  return {
    baslangic: `${yil}-${pad(ay)}-01`,
    bitis: `${yil}-${pad(ay)}-${pad(sonGun)}`,
  };
}

function yoklamalariRaporDonemineGore(
  yoklamalar: Yoklama[],
  raporDonemi: string
): Yoklama[] {
  const spec = raporDonemindenSpec(raporDonemi);
  if (spec.tip === 'tum') return yoklamalar;

  const yilaUygun = (tarihStr: string, yil: number): boolean => {
    const dt = new Date(tarihStr);
    return !Number.isNaN(dt.getTime()) && dt.getFullYear() === yil;
  };

  const ayYilaUygun = (tarihStr: string, ay: number, yil: number): boolean => {
    const dt = new Date(tarihStr);
    return (
      !Number.isNaN(dt.getTime()) &&
      dt.getMonth() + 1 === ay &&
      dt.getFullYear() === yil
    );
  };

  if (spec.tip === 'ay') {
    return yoklamalar.filter(y => ayYilaUygun(y.tarih, spec.ay, spec.yil));
  }
  return yoklamalar.filter(y => yilaUygun(y.tarih, spec.yil));
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
  if (raporEventleriBaglandi) return;

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

  raporEventleriBaglandi = true;
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

    const raporDonemiSelect = Helpers.$('#raporDonemi') as HTMLSelectElement | null;
    const raporDonemi = raporDonemiSelect?.value || 'buay';

    switch (raporTuru) {
      case 'genel':
        baslik.innerHTML = '<i class="fa-solid fa-chart-pie"></i> Genel Özet Raporu';
        container.appendChild(baslik);
        genelRapor(container, raporDonemi);
        break;
      case 'aidat':
        baslik.innerHTML = '<i class="fa-solid fa-wallet"></i> Aidat Raporu';
        container.appendChild(baslik);
        aidatRaporu(container, raporDonemi);
        break;
      case 'devam':
        baslik.innerHTML = '<i class="fa-solid fa-clipboard-check"></i> Devam Raporu';
        container.appendChild(baslik);
        devamRaporu(container, raporDonemi);
        break;
      case 'sporcu':
        baslik.innerHTML = '<i class="fa-solid fa-users"></i> Sporcu Analiz Raporu';
        container.appendChild(baslik);
        sporcuRaporu(container);
        break;
      case 'finans':
        baslik.innerHTML = '<i class="fa-solid fa-chart-line"></i> Finansal Rapor';
        container.appendChild(baslik);
        finansRaporu(container, raporDonemi);
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
function genelRapor(container: HTMLElement, raporDonemi: string): void {
  const sporcular = Storage.sporculariGetir();
  const aidatlar = aidatlariRaporDonemineGore(Storage.aidatlariGetir(), raporDonemi);
  const giderler = giderleriRaporDonemineGore(Storage.giderleriGetir(), raporDonemi);
  const yoklamalar = yoklamalariRaporDonemineGore(Storage.yoklamalariGetir(), raporDonemi);

  // Toplam Gelir - YENİ MANTIK: Sadece negatif tutarları topla (tahsilatlar)
  const toplamGelir = aidatlar
    .filter(a => (a.tutar || 0) < 0 || a.islem_turu === 'Tahsilat')
    .reduce((t, a) => t + Math.abs(a.tutar || 0), 0); // Mutlak değer al
  const toplamGider = giderler.reduce((t, g) => t + g.miktar, 0);
  const netKar = toplamGelir - toplamGider;

  const donemAciklama = Helpers.escapeHtml(raporDonemEtiketi(raporDonemi));

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
    <p class="rapor-donem-badge" style="margin: -1rem 0 1.25rem; color: var(--muted); font-size: 0.95rem;"><i class="fa-solid fa-calendar"></i> Dönem: <strong>${donemAciklama}</strong></p>
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
 * Aidat raporu — Aidat ekranındaki `aidatDonemKpiOzet` / `aidatDonemTabloHesap` ile aynı motor.
 */
function aidatRaporu(container: HTMLElement, raporDonemi: string): void {
  const sporcular = Storage.sporculariGetir();
  const aidatlar = Storage.aidatlariGetir();
  const aktifSporcular = sporcular.filter(s => s.durum === 'Aktif' && !s.odemeBilgileri?.burslu);
  const beklenenAylikToplam = aktifSporcular.reduce(
    (t, s) => t + (s.odemeBilgileri?.aylikUcret || 0),
    0
  );

  const spec = raporDonemindenSpec(raporDonemi);
  const donemEtiket = Helpers.escapeHtml(raporDonemEtiketi(raporDonemi));

  let beklenenToplam = 0;
  let tahsilat = 0;
  let kalanBorcToplam = 0;
  let tahsilatOraniPayda = 0;
  let borcluSatirlari: Array<{ sporcu: Sporcu; kalanBorc: number }> = [];

  if (spec.tip === 'tum') {
    const ucretli = sporcular.filter(s => s.id != null && !s.odemeBilgileri?.burslu);
    for (const s of ucretli) {
      const fin = Helpers.finansalHesapla(aidatlar, s.id!);
      beklenenToplam += fin.toplamBorc;
      tahsilat += fin.toplamTahsilat;
      kalanBorcToplam += fin.kalanBorc;
      if (fin.kalanBorc > 0) {
        borcluSatirlari.push({ sporcu: s, kalanBorc: fin.kalanBorc });
      }
    }
    borcluSatirlari.sort((a, b) => b.kalanBorc - a.kalanBorc);
    tahsilatOraniPayda = beklenenToplam > 0 ? beklenenToplam : beklenenAylikToplam;
  } else if (spec.tip === 'yil') {
    const yil = spec.yil;
    const yilData = AidatMod.aidatYilOzetVeBorclular(yil);
    beklenenToplam = yilData.beklenen;
    tahsilat = yilData.tahsilat;
    kalanBorcToplam = yilData.kalan;
    borcluSatirlari = yilData.borclular.map(row => ({
      sporcu: row.sporcu,
      kalanBorc: row.borc,
    }));
    tahsilatOraniPayda = beklenenToplam > 0 ? beklenenToplam : beklenenAylikToplam;
  } else {
    const kpi = AidatMod.aidatDonemKpiOzet(spec.ay, spec.yil);
    beklenenToplam = kpi.beklenen;
    tahsilat = kpi.tahsilat;
    kalanBorcToplam = kpi.kalan;
    borcluSatirlari = AidatMod.aidatDonemBorcluDetaylari(spec.ay, spec.yil).map(row => ({
      sporcu: row.sporcu,
      kalanBorc: row.borc,
    }));
    tahsilatOraniPayda = beklenenToplam > 0 ? beklenenToplam : beklenenAylikToplam;
  }

  const tahsilatOrani = Helpers.yuzdeHesapla(tahsilat, tahsilatOraniPayda);

  const html = `
    <p class="rapor-donem-badge" style="margin: 0 0 1.25rem; color: var(--muted); font-size: 0.95rem;"><i class="fa-solid fa-calendar"></i> Dönem: <strong>${donemEtiket}</strong> — Aidat modülü ile aynı hesap</p>
    <div class="rapor-grid">
      <div class="rapor-card">
        <h3><i class="fa-solid fa-chart-bar"></i> Aidat Özeti</h3>
        <ul class="rapor-list">
          <li><span class="rapor-label">Beklenen / Tahakkuk</span> <span class="rapor-deger">${Helpers.paraFormat(beklenenToplam)} TL</span></li>
          <li><span class="rapor-label">Tahsil Edilen</span> <span class="rapor-deger financial-positive">${Helpers.paraFormat(tahsilat)} TL</span></li>
          <li><span class="rapor-label">Kalan Borç</span> <span class="rapor-deger financial-negative">${Helpers.paraFormat(kalanBorcToplam)} TL</span></li>
          <li><span class="rapor-label">Tahsilat Oranı</span> <span class="rapor-deger">%${tahsilatOrani}</span></li>
        </ul>
      </div>
      <div class="rapor-card" style="grid-column: span 2;">
        <h3><i class="fa-solid fa-exclamation-triangle"></i> Borçlu Sporcular (${borcluSatirlari.length})</h3>
        <div style="max-height: 300px; overflow-y: auto;">
          <ul class="rapor-list">
            ${
              borcluSatirlari.length > 0
                ? borcluSatirlari
                    .map(({ sporcu: s, kalanBorc }) => {
                      const adSoyad = Helpers.escapeHtml(s.temelBilgiler?.adSoyad || '-');
                      const brans = Helpers.escapeHtml(s.sporBilgileri?.brans || '-');
                      const grup = Helpers.escapeHtml(s.tffGruplari?.anaGrup || '-');
                      return `
                <li style="display: flex; justify-content: space-between;">
                  <div>
                    <strong>${adSoyad}</strong>
                    <small style="color: var(--muted); margin-left: 10px;">${brans} - ${grup}</small>
                  </div>
                  <span class="financial-negative" style="font-weight: bold;">${Helpers.paraFormat(kalanBorc)} TL</span>
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
function devamRaporu(container: HTMLElement, raporDonemi: string): void {
  if (typeof window === 'undefined' || !window.Yoklama) {
    Helpers.toast('Yoklama modülü yüklenemedi!', 'error');
    return;
  }

  const { baslangic, bitis } = raporDonemindenYoklamaTarihAraligi(raporDonemi);
  const rapor = window.Yoklama.devamRaporu?.(baslangic, bitis) as DevamRaporuResult | undefined;

  if (!rapor) {
    Helpers.toast('Devam raporu oluşturulamadı!', 'error');
    return;
  }

  const donemEtiket = Helpers.escapeHtml(raporDonemEtiketi(raporDonemi));

  // Güvenli: XSS koruması için escapeHtml kullan
  const html = `
    <p class="rapor-donem-badge" style="margin: 0 0 1.25rem; color: var(--muted); font-size: 0.95rem;"><i class="fa-solid fa-calendar"></i> Dönem: <strong>${donemEtiket}</strong></p>
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
function finansRaporu(container: HTMLElement, raporDonemi: string): void {
  const aidatlar = aidatlariRaporDonemineGore(Storage.aidatlariGetir(), raporDonemi);

  if (typeof window === 'undefined' || !window.Gider) {
    Helpers.toast('Gider modülü yüklenemedi!', 'error');
    return;
  }

  const giderHam = Storage.giderleriGetir();
  const giderFiltreli = giderleriRaporDonemineGore(giderHam, raporDonemi);
  const toplamGiderDeger = giderFiltreli.reduce((t, g) => t + g.miktar, 0);

  const turOzetleri: { [key: string]: number } = {};
  giderFiltreli.forEach(g => {
    const k = g.kategori || 'Diğer';
    turOzetleri[k] = (turOzetleri[k] || 0) + g.miktar;
  });

  // Toplam Gelir - YENİ MANTIK: Sadece negatif tutarları topla (tahsilatlar)
  const toplamGelir = aidatlar
    .filter(a => (a.tutar || 0) < 0 || a.islem_turu === 'Tahsilat')
    .reduce((t, a) => t + Math.abs(a.tutar || 0), 0); // Mutlak değer al
  const netKar = toplamGelir - toplamGiderDeger;
  const karMarji = toplamGelir > 0 ? Math.round((netKar / toplamGelir) * 100) : 0;

  const donemEtiket = Helpers.escapeHtml(raporDonemEtiketi(raporDonemi));

  // Güvenli: XSS koruması için escapeHtml kullan
  const html = `
    <p class="rapor-donem-badge" style="margin: 0 0 1.25rem; color: var(--muted); font-size: 0.95rem;"><i class="fa-solid fa-calendar"></i> Dönem: <strong>${donemEtiket}</strong></p>
    <div class="rapor-grid">
      <div class="rapor-card">
        <h3><i class="fa-solid fa-chart-line"></i> Finansal Özet</h3>
        <ul class="rapor-list">
          <li><span class="rapor-label">Toplam Gelir</span> <span class="rapor-deger financial-positive">${Helpers.paraFormat(toplamGelir)} TL</span></li>
          <li><span class="rapor-label">Toplam Gider</span> <span class="rapor-deger financial-negative">${Helpers.paraFormat(toplamGiderDeger)} TL</span></li>
          <li><span class="rapor-label">Net Kar/Zarar</span> <span class="rapor-deger" style="color: ${netKar >= 0 ? 'var(--success)' : 'var(--danger)'}; font-weight: bold;">${Helpers.paraFormat(netKar)} TL</span></li>
          <li><span class="rapor-label">Kar Marjı</span> <span class="rapor-deger" style="color: ${karMarji >= 0 ? 'var(--success)' : 'var(--danger)'}">${karMarji}%</span></li>
        </ul>
      </div>
      <div class="rapor-card" style="grid-column: span 2;">
        <h3><i class="fa-solid fa-chart-pie"></i> Gider Dağılımı</h3>
        <ul class="rapor-list">
          ${
            Object.entries(turOzetleri).length > 0
              ? Object.entries(turOzetleri)
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

interface RaporSatir {
  label: string;
  deger: string;
  tip?: 'positive' | 'negative' | 'normal';
}

interface RaporKart {
  baslik: string;
  veriler: RaporSatir[];
}

interface RaporExportData {
  baslikTemiz: string;
  logoSrc: string;
  docMeta: ReturnType<typeof buildReportDocumentMeta>;
  kartlar: RaporKart[];
}

function collectRaporExportData(raporIcerik: HTMLElement): RaporExportData {
  const raporBaslik = raporIcerik.querySelector('h2')?.textContent?.trim() || 'Genel Rapor';
  const baslikTemiz = raporBaslik.replace(/<[^>]*>/g, '');
  const docMeta = buildReportDocumentMeta();
  const logoSrc = Helpers.soybisLogoUrl();
  const raporClone = raporIcerik.cloneNode(true) as HTMLElement;

  raporClone
    .querySelectorAll('.btn, button, .no-print, i.fa-solid, i.fa-regular, i.fa-brands')
    .forEach(el => {
      el.remove();
    });

  raporClone.querySelectorAll('h2, h3').forEach(h => {
    h.querySelectorAll('i').forEach(i => i.remove());
  });

  const kartlar: RaporKart[] = [];
  raporClone.querySelectorAll('.rapor-card').forEach(kart => {
    const baslikElement = kart.querySelector('h3');
    if (!baslikElement) return;

    const baslik = baslikElement.textContent?.trim() || 'Bölüm';
    const veriler: RaporSatir[] = [];

    kart.querySelectorAll('.rapor-list li').forEach(item => {
      const labelEl = item.querySelector('.rapor-label');
      const degerEl = item.querySelector('.rapor-deger');

      if (labelEl && degerEl) {
        const label = labelEl.textContent?.replace(':', '').trim() || '';
        const deger = degerEl.textContent?.trim() || '';
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
        return;
      }

      const text = item.textContent?.trim() || '';
      if (text && text.length > 5) {
        const match = text.match(/^(.+?):\s*(.+)$/);
        if (match) {
          veriler.push({ label: match[1].trim(), deger: match[2].trim(), tip: 'normal' });
        }
      }
    });

    if (veriler.length > 0) {
      kartlar.push({ baslik, veriler });
    }
  });

  if (kartlar.length === 0) {
    const allText = (raporIcerik.textContent || '').replace(/\s+/g, ' ').trim();
    if (allText.length > 20) {
      kartlar.push({
        baslik: baslikTemiz,
        veriler: [{ label: 'Rapor İçeriği', deger: allText.substring(0, 1200), tip: 'normal' }],
      });
    }
  }

  return {
    baslikTemiz,
    logoSrc,
    docMeta,
    kartlar,
  };
}

function buildRaporPrintableMarkup(data: RaporExportData): string {
  const { baslikTemiz, logoSrc, docMeta, kartlar } = data;
  return `
  <div class="pdf-page">
    <div class="pdf-letterhead">
      <div class="pdf-letterhead-row">
        <div class="pdf-brand">
          <div class="pdf-logo-box">
            <img src="${logoSrc}" alt="SOYBIS 360°" width="52" height="52" loading="eager" crossorigin="anonymous" />
          </div>
          <div>
            <div class="pdf-org-name">SOYBIS 360°</div>
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
        <div class="pdf-h1-sub">SOYBIS Resmi Rapor Formatı</div>
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
                <th>Alan</th>
                <th>Değer</th>
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
        <div class="pdf-footer-title">SOYBIS 360° · Sürüm 3.x</div>
        <div>Gizlilik: yalnızca yetkili kullanıcılar ve kurum içi kullanım. · ${reportEscapeHtml(docMeta.iso8601Utc)}</div>
      </div>
      <div class="pdf-footer-right">
        <div><strong>Sayfa</strong> 1 / 1</div>
        <div>${reportEscapeHtml(docMeta.dateDisplayTr)}</div>
      </div>
    </div>
  </div>
`;
}

function buildRaporPrintableDocument(data: RaporExportData, title: string): string {
  return `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${reportEscapeHtml(title)}</title>
  <style>${REPORT_PDF_STYLES}</style>
</head>
<body>
  ${buildRaporPrintableMarkup(data)}
</body>
</html>
`;
}

/**
 * PDF olarak indir - Profesyonel, uluslararası standartlara uygun PDF
 */
function pdfIndir(raporIcerik: HTMLElement): void {
  if (typeof window === 'undefined' || typeof (window as any).html2pdf === 'undefined') {
    Helpers.toast('PDF kütüphanesi yüklenemedi!', 'error');
    return;
  }

  const data = collectRaporExportData(raporIcerik);
  const { baslikTemiz, logoSrc, kartlar } = data;

  console.log('📊 PDF Veri Toplama:', {
    kartSayisi: kartlar.length,
    toplamVeri: kartlar.reduce((sum, k) => sum + k.veriler.length, 0),
    kartlar: kartlar.map(k => ({ baslik: k.baslik, veriSayisi: k.veriler.length })),
  });

  const tempDiv = document.createElement('div');
  tempDiv.style.width = pdfExportRootWidthMm(PDF_EXPORT_MARGIN_MM);
  tempDiv.style.background = '#ffffff';
  tempDiv.style.overflow = 'visible';
  tempDiv.innerHTML = `<style>${REPORT_PDF_STYLES}</style>${buildRaporPrintableMarkup(data)}`;
  stylePdfExportCaptureRoot(tempDiv);
  void (async () => {
    try {
      await runPdfExportWithRuntime({
        tempDiv,
        logoSrc,
        marginMm: [...PDF_EXPORT_MARGIN_MM],
        buildOptions: (width, height) => ({
          margin: [...PDF_EXPORT_MARGIN_MM],
          filename: `SOYBIS360_Report_${baslikTemiz.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: {
            scale: getHtml2PdfCanvasScale(),
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
        }),
      });
      Helpers.toast('PDF başarıyla indirildi!', 'success');
    } catch (error: unknown) {
      console.error('PDF oluşturma hatası:', error);
      Helpers.toast('PDF oluşturulurken hata oluştu!', 'error');
    }
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
    `SOYBIS360_Rapor_${new Date().toLocaleDateString('tr-TR').replace(/\./g, '-')}.xlsx`
  );

  Helpers.toast('Excel dosyası indirildi!', 'success');
}

/**
 * Yazdır
 */
export function yazdir(): void {
  const raporIcerik = Helpers.$('#raporIcerik') as HTMLElement | null;
  if (!raporIcerik) {
    window.print();
    return;
  }

  const data = collectRaporExportData(raporIcerik);
  const printHTML = buildRaporPrintableDocument(data, `${data.baslikTemiz} — Yazdır`);

  const printFrame = document.createElement('iframe');
  printFrame.setAttribute('aria-hidden', 'true');
  printFrame.tabIndex = -1;
  printFrame.style.cssText = [
    'position:fixed',
    'right:0',
    'bottom:0',
    'width:0',
    'height:0',
    'border:0',
    'opacity:0',
    'pointer-events:none',
  ].join(';');
  document.body.appendChild(printFrame);

  const cleanup = (): void => {
    if (printFrame.parentNode) {
      printFrame.parentNode.removeChild(printFrame);
    }
  };

  const printDoc = printFrame.contentDocument;
  const printWin = printFrame.contentWindow;
  if (!printDoc || !printWin) {
    cleanup();
    Helpers.toast('Yazdırma başlatılamadı.', 'error');
    return;
  }

  printDoc.open();
  printDoc.write(printHTML);
  printDoc.close();

  const waitForPrintableReady = async (): Promise<void> => {
    try {
      const images = Array.from(printDoc.images || []);
      if (images.length === 0) return;
      await Promise.all(
        images.map(
          img =>
            new Promise<void>(resolve => {
              if (img.complete) {
                resolve();
                return;
              }
              img.addEventListener('load', () => resolve(), { once: true });
              img.addEventListener('error', () => resolve(), { once: true });
            })
        )
      );
    } catch {
      // Yazdırmayı engelleme.
    }
  };

  const triggerPrint = (): void => {
    void (async () => {
      await waitForPrintableReady();
      setTimeout(() => {
        try {
          printWin.focus();
          printWin.print();
          // Yazdırma diyaloğu sonrası iframe'i temizle.
          setTimeout(cleanup, 1200);
        } catch {
          cleanup();
          Helpers.toast('Yazdırma başlatılamadı.', 'error');
        }
      }, 120);
    })();
  };

  if (printDoc.readyState === 'complete') {
    triggerPrint();
  } else {
    printFrame.addEventListener('load', triggerPrint, { once: true });
    setTimeout(triggerPrint, 700);
  }
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
