/**
 * İndirilebilir raporlar — kurumsal / uluslararası düzen (belge kontrolü, tipografi, meta veri).
 * PDF html2canvas çıktısı için tek kaynak CSS ve yardımcılar.
 */

/** PDF/HTML içine güvenli metin */
export function reportEscapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface ReportDocumentMeta {
  referenceId: string;
  dateDisplayTr: string;
  timeDisplayTr: string;
  iso8601Utc: string;
  timezoneLabel: string;
}

export function buildReportDocumentMeta(date: Date = new Date()): ReportDocumentMeta {
  const referenceId = `DOC-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}-${String(date.getTime()).slice(-6)}`;
  const dateDisplayTr = date.toLocaleDateString('tr-TR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
  const timeDisplayTr = date.toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const iso8601Utc = date.toISOString();
  const timezoneLabel =
    typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local'
      : 'Local';

  return {
    referenceId,
    dateDisplayTr,
    timeDisplayTr,
    iso8601Utc,
    timezoneLabel,
  };
}

/**
 * html2pdf/jsPDF kenar boşluğu [üst, sol, alt, sağ] mm.
 * Çok sayfalı PDF’de 2. sayfa ve sonrasının üstten yapışık görünmesini engeller (Word üst kenar hissi).
 * 1. sayfada letterhead’e ekstra padding eklemek yerine buradan verilir.
 */
export const PDF_EXPORT_MARGIN_MM: [number, number, number, number] = [20, 17, 20, 17];

const A4_WIDTH_MM = 210;

/** jsPDF inner genişlik (mm) — html2pdf klon konteyneri bu genişlikte; kaynak da aynı olmalı yoksa sol/sağ kesilir */
export function pdfInnerContentWidthMm(
  marginMm: [number, number, number, number] = PDF_EXPORT_MARGIN_MM
): number {
  return A4_WIDTH_MM - marginMm[1] - marginMm[3];
}

/** Geçici PDF kökü için width (örn. tempDiv.style.width) */
export function pdfExportRootWidthMm(marginMm: [number, number, number, number] = PDF_EXPORT_MARGIN_MM): string {
  return `${pdfInnerContentWidthMm(marginMm)}mm`;
}

/** html2pdf yakalama kökü — görünür konumda olmalı; sola taşımak html2canvas’ta beyaz PDF üretebilir */
const PDF_EXPORT_CAPTURE_Z = 99998;

/** 2 yerine biraz düşük — süre kısalır, metin/tablolar hâlâ net */
export const HTML2PDF_CANVAS_SCALE = 1.5;

/**
 * Geçici PDF kökünü önceki davranışla hizala (sol üst, üst katman). Genişlik/arka plan çağırandan sonra.
 */
export function stylePdfExportCaptureRoot(el: HTMLElement): void {
  el.style.position = 'fixed';
  el.style.top = '0';
  el.style.left = '0';
  el.style.zIndex = String(PDF_EXPORT_CAPTURE_Z);
  el.style.pointerEvents = 'none';
  el.setAttribute('aria-hidden', 'true');
}

/**
 * Örtü ve PDF kökü DOM’a eklendikten sonra çağırın: tarayıcı önce örtüyü boyar,
 * ağır html2canvas işi başlamadan ekranda içerik “donmuş” gibi görünmez.
 */
export function yieldUntilPaint(): Promise<void> {
  return new Promise(resolve => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(resolve, 0);
      });
    });
  });
}

/**
 * html2canvas sık getImageData kullanır; Chrome `getContext('2d', { willReadFrequently: true })` önerir.
 * Yalnızca bu promise süresince prototype yamalanır (Chart.js vb. sürekli etkilenmez).
 */
export async function runWithHtml2CanvasWillReadFrequentlyPatch<T>(fn: () => Promise<T>): Promise<T> {
  if (typeof HTMLCanvasElement === 'undefined') {
    return fn();
  }
  const proto = HTMLCanvasElement.prototype;
  const orig = proto.getContext;
  proto.getContext = function (
    this: HTMLCanvasElement,
    contextId: string,
    ...rest: unknown[]
  ) {
    if (contextId === '2d') {
      const base =
        rest[0] && typeof rest[0] === 'object' ? { ...(rest[0] as object) } : {};
      return orig.call(this, '2d', { ...base, willReadFrequently: true } as CanvasRenderingContext2DSettings);
    }
    return orig.apply(this, [contextId, ...rest] as Parameters<typeof orig>);
  } as typeof orig;
  try {
    return await fn();
  } finally {
    proto.getContext = orig;
  }
}

/** Hafif karartma + ortada kart; tam ekran beyaz flaşı vermez, arka plan seçilir biçimde görünür kalır */
export function createPdfExportLoadingOverlay(): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'pdf-export-loading-overlay';
  overlay.setAttribute('aria-live', 'polite');
  overlay.setAttribute('aria-label', 'PDF hazırlanıyor');
  overlay.style.cssText = [
    'position:fixed',
    'inset:0',
    `z-index:${PDF_EXPORT_CAPTURE_Z + 1}`,
    'background:rgba(15,23,42,0.38)',
    'backdrop-filter:saturate(1.1) blur(2px)',
    '-webkit-backdrop-filter:saturate(1.1) blur(2px)',
    'pointer-events:auto',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'padding:24px',
    'box-sizing:border-box',
  ].join(';');

  const card = document.createElement('div');
  card.style.cssText = [
    'background:#ffffff',
    'border-radius:12px',
    'box-shadow:0 25px 50px -12px rgba(0,0,0,0.22)',
    'padding:22px 28px',
    'max-width:min(340px,100%)',
    'text-align:center',
    'user-select:none',
  ].join(';');

  const title = document.createElement('div');
  title.textContent = 'PDF hazırlanıyor…';
  title.style.cssText =
    'font:600 15px system-ui,"Segoe UI",sans-serif;color:#0f172a;letter-spacing:0.02em;line-height:1.4';

  const sub = document.createElement('div');
  sub.textContent = 'Sayfa görünür; indirme bitince kapanır.';
  sub.style.cssText = 'font:13px system-ui,"Segoe UI",sans-serif;color:#64748b;margin-top:8px;line-height:1.45';

  card.appendChild(title);
  card.appendChild(sub);
  overlay.appendChild(card);
  return overlay;
}

export function detachPdfExportUi(root: HTMLElement, overlay: HTMLElement | null): void {
  if (overlay?.parentNode) overlay.parentNode.removeChild(overlay);
  if (root.parentNode) root.parentNode.removeChild(root);
}

/**
 * Kurumsal PDF — sade üst bilgi, belge meta kutusu, tablo odaklı içerik (ISO benzeri düzen).
 */
export const REPORT_PDF_STYLES = `
@page { size: A4; margin: 0; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: 'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 10pt;
  line-height: 1.45;
  color: #0f172a;
  background: #ffffff;
}
.pdf-page {
  width: 100%;
  max-width: 100%;
  min-height: 297mm;
  background: #ffffff;
  display: flex;
  flex-direction: column;
}
/* Üst bilgi — kompakt; fazla dikey “boş blok” olmasın */
.pdf-letterhead {
  padding: 12mm 16mm 8mm 16mm;
  border-bottom: 3px solid #0f172a;
  background: #ffffff;
  page-break-inside: avoid;
  break-inside: avoid;
}
.pdf-letterhead-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  flex-wrap: wrap;
}
.pdf-brand {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
  flex: 1;
}
.pdf-logo-box {
  width: 52px;
  height: 52px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.pdf-logo-box img {
  max-width: 52px;
  max-height: 52px;
  width: auto;
  height: auto;
  object-fit: contain;
  display: block;
}
.pdf-org-name {
  font-size: 11pt;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #0f172a;
  line-height: 1.2;
}
.pdf-org-tagline {
  font-size: 8.5pt;
  color: #475569;
  margin-top: 2px;
  font-weight: 400;
}
.pdf-doc-control {
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  padding: 8px 12px;
  background: #f8fafc;
  min-width: 200px;
  font-size: 7.5pt;
  line-height: 1.5;
  color: #334155;
}
.pdf-doc-control strong {
  display: inline-block;
  min-width: 88px;
  color: #0f172a;
  font-weight: 600;
}
.pdf-report-title-block {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid #e2e8f0;
}
.pdf-h1 {
  font-size: 14pt;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.02em;
  line-height: 1.2;
}
.pdf-h1-sub {
  font-size: 8.5pt;
  color: #64748b;
  margin-top: 2px;
  font-weight: 400;
  line-height: 1.35;
}
.pdf-content {
  padding: 10mm 16mm 12mm 16mm;
  flex: 1;
}
/* Bölüm başlığı + tablo/özet birlikte kalsın (yazdırma / html2pdf) */
.pdf-section {
  margin-bottom: 22px;
  page-break-inside: avoid;
  break-inside: avoid-page;
  -webkit-region-break-inside: avoid;
  orphans: 4;
  widows: 4;
}
.pdf-h2 {
  font-size: 10.5pt;
  font-weight: 700;
  color: #0f172a;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 10px;
  padding-bottom: 6px;
  border-bottom: 1px solid #cbd5e1;
  page-break-after: avoid;
  break-after: avoid-page;
}
.pdf-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 9.5pt;
  border: 1px solid #e2e8f0;
  /* Bölüm başlığı ile birlikte kalsın; html2pdf avoid listesinde tabloyu ayrı verme (başlık yetim kalır) */
  page-break-inside: avoid;
  break-inside: avoid;
}
.pdf-table thead {
  display: table-header-group;
}
.pdf-table thead th {
  background: #f1f5f9;
  color: #0f172a;
  font-weight: 600;
  text-align: left;
  padding: 10px 12px;
  border-bottom: 1px solid #cbd5e1;
  font-size: 8.5pt;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.pdf-table td {
  padding: 10px 12px;
  border-bottom: 1px solid #f1f5f9;
  vertical-align: top;
}
.pdf-table tbody tr:nth-child(even) { background: #fafbfc; }
.pdf-table tbody tr:last-child td { border-bottom: none; }
.pdf-td-label {
  font-weight: 600;
  color: #334155;
  width: 42%;
}
.pdf-td-value { color: #0f172a; font-weight: 500; }
.pdf-td-value.positive { color: #15803d; font-weight: 600; }
.pdf-td-value.negative { color: #b91c1c; font-weight: 600; }
.pdf-stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}
.pdf-stat-card {
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  padding: 14px 14px;
  background: #fafbfc;
}
.pdf-stat-label {
  font-size: 8pt;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 6px;
  font-weight: 600;
}
.pdf-stat-value {
  font-size: 16pt;
  font-weight: 700;
  color: #0f172a;
  line-height: 1.2;
}
.pdf-stat-value.positive { color: #15803d; }
.pdf-stat-value.negative { color: #b91c1c; }
.pdf-footer {
  margin-top: auto;
  padding: 8mm 16mm;
  border-top: 1px solid #cbd5e1;
  background: #f8fafc;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  font-size: 7.5pt;
  color: #64748b;
  flex-wrap: wrap;
}
.pdf-footer-left { max-width: 65%; line-height: 1.55; }
.pdf-footer-right { text-align: right; line-height: 1.55; white-space: nowrap; }
.pdf-footer-title { font-weight: 700; color: #0f172a; margin-bottom: 4px; font-size: 8pt; }
.pdf-footer-iso { font-family: ui-monospace, monospace; font-size: 7pt; color: #94a3b8; margin-top: 4px; }
@media print {
  .pdf-section { page-break-inside: avoid; break-inside: avoid; }
  .pdf-h2 { page-break-after: avoid; }
  .pdf-letterhead, .pdf-footer { page-break-inside: avoid; }
}
`;

/**
 * css/legacy kapalı: eklenti CSS break-inside ile manuel {@link applyHtml2PdfAvoidSpacers} çakışmasın.
 * Spacer yüksekliği {@link PDF_EXPORT_MARGIN_MM} ile html2pdf inner sayfa yüksekliğine uyarlanmalı.
 * @see node_modules/html2pdf.js/src/plugin/pagebreaks.js
 */
export const PDF_HTML2PDF_PAGE_BREAK = {
  mode: [] as string[],
  avoid: [] as string[],
};

/** jsPDF A4 iç yüksekliği (mm); html2pdf setPageSize.inner.px.height ile aynı formül */
export function pdfInnerPageHeightPx(marginMm: [number, number, number, number] = [0, 0, 0, 0]): number {
  const k = 72 / 25.4;
  const innerH = 297 - marginMm[0] - marginMm[2];
  return Math.floor((innerH * k) / 72 * 96);
}

/**
 * Tek sayfaya sığan bloklar (letterhead, bölüm, footer) sayfa sınırında bölünüyorsa,
 * bloktan önce yükseklik dolgusu ekler (html2pdf’nin canvas dilimlemesiyle uyumlu).
 * Üstteki dolgu alttaki blokları kaydırdığı için tek geçiş yetmez; ta ki stabil olana kadar tekrarlanır.
 */
export function applyHtml2PdfAvoidSpacers(
  root: HTMLElement,
  marginMm: [number, number, number, number] = PDF_EXPORT_MARGIN_MM
): void {
  const pxPageHeight = pdfInnerPageHeightPx(marginMm);
  const selector = '.pdf-letterhead, .pdf-section, .pdf-footer';
  const maxPasses = 24;

  for (let pass = 0; pass < maxPasses; pass++) {
    const rootRect = root.getBoundingClientRect();
    const blocks = Array.from(root.querySelectorAll(selector)) as HTMLElement[];
    let inserted = false;

    for (const el of blocks) {
      const rect = el.getBoundingClientRect();
      let top = rect.top - rootRect.top + root.scrollTop;
      const bottom = rect.bottom - rootRect.top + root.scrollTop;
      if (top < 0) top = 0;
      const h = bottom - top;
      const startPage = Math.floor(top / pxPageHeight);
      const endPage = Math.floor(bottom / pxPageHeight);
      if (startPage === endPage) continue;
      if (h > pxPageHeight) continue;

      const topMod = ((top % pxPageHeight) + pxPageHeight) % pxPageHeight;
      let padH = pxPageHeight - topMod;
      if (padH <= 0 || padH > pxPageHeight || !Number.isFinite(padH)) continue;

      const pad = document.createElement('div');
      pad.className = 'html2pdf__avoid-spacer';
      pad.setAttribute('aria-hidden', 'true');
      pad.style.cssText =
        'display:block;margin:0;padding:0;border:0;clear:both;flex-shrink:0;';
      pad.style.height = `${padH}px`;
      el.parentNode?.insertBefore(pad, el);
      inserted = true;
      break;
    }

    if (!inserted) break;
  }
}

/** html2canvas öncesi logo yüklemesi (PDF’de kırık ikon yerine gerçek görsel) */
export function preloadLogoForPdf(src: string): Promise<void> {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = src;
  });
}

/** Excel üst bilgi satırları — belge özeti (kurumsal export) */
export function buildExcelHeaderRows(reportTitle: string): unknown[][] {
  const meta = buildReportDocumentMeta();
  return [
    ['SOYBIS', 'Spor Okulları Yönetim Bilgi Sistemi', '', ''],
    ['Belge referansı', meta.referenceId, '', ''],
    ['Rapor başlığı', reportTitle.replace(/<[^>]*>/g, ''), '', ''],
    ['Oluşturulma (yerel)', `${meta.dateDisplayTr} ${meta.timeDisplayTr}`, '', ''],
    ['Oluşturulma (UTC)', meta.iso8601Utc, '', ''],
    ['Saat dilimi', meta.timezoneLabel, '', ''],
    [],
  ];
}
