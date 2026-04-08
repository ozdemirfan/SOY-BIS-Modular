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
export const PDF_EXPORT_MARGIN_MM: [number, number, number, number] = [12, 12, 12, 12];

const A4_WIDTH_MM = 210;

/** jsPDF inner genişlik (mm) — html2pdf klon konteyneri bu genişlikte; kaynak da aynı olmalı yoksa sol/sağ kesilir */
export function pdfInnerContentWidthMm(
  marginMm: [number, number, number, number] = PDF_EXPORT_MARGIN_MM
): number {
  return A4_WIDTH_MM - marginMm[1] - marginMm[3];
}

/** Geçici PDF kökü için width (örn. tempDiv.style.width) */
export function pdfExportRootWidthMm(
  marginMm: [number, number, number, number] = PDF_EXPORT_MARGIN_MM
): string {
  return `${pdfInnerContentWidthMm(marginMm)}mm`;
}

/** html2pdf yakalama kökü — görünür konumda olmalı; sola taşımak html2canvas’ta beyaz PDF üretebilir */
const PDF_EXPORT_CAPTURE_Z = 99998;

/** 2 yerine biraz düşük — süre kısalır, metin/tablolar hâlâ net */
export const HTML2PDF_CANVAS_SCALE = 1.5;

/** Mobilde donmayı azaltmak için daha hafif ölçek kullan */
export function getHtml2PdfCanvasScale(): number {
  if (typeof window !== 'undefined' && window.innerWidth <= 768) {
    return 1.15;
  }
  return HTML2PDF_CANVAS_SCALE;
}

/**
 * Geçici PDF kökü: görünür koordinatta tutulur (en stabil html2canvas yakalama yolu).
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
export async function runWithHtml2CanvasWillReadFrequentlyPatch<T>(
  fn: () => Promise<T>
): Promise<T> {
  if (typeof HTMLCanvasElement === 'undefined') {
    return fn();
  }
  const proto = HTMLCanvasElement.prototype;
  // Native prototype method; `this` is always set via .call/.apply below (monkey-patch).
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const orig = proto.getContext;
  proto.getContext = function (this: HTMLCanvasElement, contextId: string, ...rest: unknown[]) {
    if (contextId === '2d') {
      const base = rest[0] && typeof rest[0] === 'object' ? { ...(rest[0] as object) } : {};
      return orig.call(this, '2d', {
        ...base,
        willReadFrequently: true,
      } as CanvasRenderingContext2DSettings);
    }
    return orig.apply(this, [contextId, ...rest] as Parameters<typeof orig>);
  } as typeof orig;
  try {
    return await fn();
  } finally {
    proto.getContext = orig;
  }
}

/** Küçük ve hızlı yükleme kartı; tam opak perdeyle PDF kökünü tamamen gizler. */
export function createPdfExportLoadingOverlay(): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'pdf-export-loading-overlay pdf-export-loading-overlay--quiet';
  overlay.setAttribute('aria-live', 'off');
  overlay.setAttribute('aria-hidden', 'true');
  const card = document.createElement('div');
  card.className = 'pdf-export-loading-overlay__card';
  card.textContent = 'PDF indiriliyor...';
  overlay.style.cssText = [
    'position:fixed',
    'top:16px',
    'right:16px',
    `z-index:${PDF_EXPORT_CAPTURE_Z + 1}`,
    'pointer-events:none',
    'display:flex',
    'align-items:flex-start',
    'justify-content:flex-end',
    'background:transparent',
  ].join(';');
  card.style.cssText = [
    'padding:8px 12px',
    'border-radius:10px',
    'background:rgba(15,23,42,0.92)',
    'border:1px solid rgba(148,163,184,0.4)',
    'color:#e2e8f0',
    'font:600 12px/1.2 "Inter","Segoe UI",Arial,sans-serif',
    'letter-spacing:0.01em',
    'box-shadow:0 8px 24px rgba(2,6,23,0.35)',
  ].join(';');
  overlay.appendChild(card);
  return overlay;
}

export interface PdfExportRuntime {
  mount: HTMLElement;
  cleanup: (root: HTMLElement) => void;
}

/**
 * PDF render için izole host + loading overlay oluşturur.
 * Ana uygulama DOM'u ile PDF geçici kökü çakışmaz.
 */
export function createPdfExportRuntime(): PdfExportRuntime {
  let frame: HTMLIFrameElement | null = null;
  let mount: HTMLElement = document.body;

  if (typeof document !== 'undefined') {
    frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.tabIndex = -1;
    /* 0×0 iframe içinde mm/px genişlik çözülmez, scrollHeight küçük kalır → PDF eksik sayfa.
       A4 içerik genişliğine yakın sabit genişlik + yüksek viewport ile tam düzen. */
    frame.style.cssText = [
      'position:fixed',
      'left:-12000px',
      'top:0',
      'width:800px',
      'height:50000px',
      'opacity:0',
      'pointer-events:none',
      'border:0',
      'z-index:-1',
      'overflow:hidden',
    ].join(';');
    document.body.appendChild(frame);

    const doc = frame.contentDocument;
    if (doc?.body) {
      doc.open();
      doc.write(
        '<!doctype html><html><head><meta charset="utf-8">' +
          '<style>html,body{margin:0;padding:0;width:100%;min-height:100%;}</style>' +
          '</head><body></body></html>'
      );
      doc.close();
      mount = doc.body;
    }
  }

  const overlay = createPdfExportLoadingOverlay();
  document.body.appendChild(overlay);

  return {
    mount,
    cleanup: (root: HTMLElement) => {
      detachPdfExportUi(root, overlay);
      if (frame?.parentNode) frame.parentNode.removeChild(frame);
    },
  };
}

export function detachPdfExportUi(root: HTMLElement, overlay: HTMLElement | null): void {
  if (overlay?.parentNode) overlay.parentNode.removeChild(overlay);
  if (root.parentNode) root.parentNode.removeChild(root);
}

/**
 * jsPDF çıktısındaki sondaki boş sayfaları güvenli şekilde temizler.
 * html2pdf bazı kenar durumlarda içeriği taşımasa da ekstra sayfa ekleyebiliyor.
 */
export function pruneTrailingBlankPdfPages(pdf: any): void {
  try {
    if (!pdf?.internal?.getNumberOfPages || typeof pdf.deletePage !== 'function') return;
    const pages = pdf.internal?.pages;
    if (!Array.isArray(pages)) return;

    const isBlankPage = (pageOps: unknown): boolean => {
      if (!Array.isArray(pageOps) || pageOps.length === 0) return true;
      const raw = pageOps.join('\n');
      const compact = raw.replace(/\s+/g, '');
      /* Çok kısa stream = gerçekten boş. Eskiden 140+ karakter şartı son sayfayı (kısa footer)
         “boş” sanıp siliyordu → rapor eksik kalıyordu. */
      if (compact.length < 40) return true;
      return !/\b(Tj|TJ|Do|BT|ET)\b/.test(raw);
    };

    let count = pdf.internal.getNumberOfPages();
    while (count > 1) {
      const lastPageOps = pages[count];
      if (!isBlankPage(lastPageOps)) break;
      pdf.deletePage(count);
      count -= 1;
    }
  } catch {
    // Sessiz geç: PDF üretimini bozma
  }
}

/**
 * Ortak html2pdf kaydetme zinciri.
 * Not: Eskiden tek sayfaya sığan içerik için 2+ sayfayı toplu silme vardı; scrollHeight
 * hatalı ölçülünce tüm ek sayfalar gidiyor, rapor eksik kalıyordu. Sadece sondaki gerçekten
 * boş sayfalar {@link pruneTrailingBlankPdfPages} ile alınır.
 */
export async function runHtml2PdfSave(source: HTMLElement, opt: unknown): Promise<void> {
  await runWithHtml2CanvasWillReadFrequentlyPatch(() => {
    const html2pdfFactory = (window as any).html2pdf;
    const worker = html2pdfFactory().set(opt).from(source).toPdf();
    return worker
      .get('pdf')
      .then((pdf: any) => {
        pruneTrailingBlankPdfPages(pdf);
      })
      .then(() => worker.save());
  });
}

export interface RunPdfExportWithRuntimeParams {
  tempDiv: HTMLElement;
  logoSrc: string;
  marginMm: [number, number, number, number];
  buildOptions: (width: number, height: number) => unknown;
}

/**
 * Ortak PDF export yaşam döngüsü:
 * - izole host + overlay
 * - paint/preload senkronizasyonu
 * - page-break spacer
 * - html2pdf save
 * - cleanup
 */
export async function runPdfExportWithRuntime(params: RunPdfExportWithRuntimeParams): Promise<void> {
  const { tempDiv, logoSrc, marginMm, buildOptions } = params;
  const runtime = createPdfExportRuntime();
  runtime.mount.appendChild(tempDiv);

  try {
    await yieldUntilPaint();
    await preloadLogoForPdf(logoSrc);
    await yieldUntilPaint();

    await new Promise<void>((resolve, reject) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          void (async () => {
            try {
              const onePageLimitPx = pdfInnerPageHeightPx(marginMm);
              void tempDiv.offsetHeight;
              let contentHeightPx = Math.max(tempDiv.scrollHeight, tempDiv.offsetHeight);
              if (contentHeightPx > onePageLimitPx + 8) {
                applyHtml2PdfAvoidSpacers(tempDiv, marginMm);
              }

              await yieldUntilPaint();
              void tempDiv.offsetHeight;
              contentHeightPx = Math.max(tempDiv.scrollHeight, tempDiv.offsetHeight);

              const width = Math.max(1, tempDiv.scrollWidth || tempDiv.offsetWidth || 794);
              const height = Math.max(1, contentHeightPx || 1200);
              const opt = buildOptions(width, height);

              await runHtml2PdfSave(tempDiv, opt);
              resolve();
            } catch (error) {
              reject(error);
            }
          })();
        });
      });
    });
  } finally {
    runtime.cleanup(tempDiv);
  }
}

/**
 * Kurumsal PDF — sade üst bilgi, belge meta kutusu, tablo odaklı içerik (ISO benzeri düzen).
 */
export const REPORT_PDF_STYLES = `
@page { size: A4; margin: 0; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: 'Inter', 'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 10pt;
  line-height: 1.5;
  color: #000000;
  background: #ffffff;
}
.pdf-page {
  width: 100%;
  max-width: 100%;
  min-height: auto;
  background: #ffffff;
  display: flex;
  flex-direction: column;
}
/* Üst bilgi — kompakt; fazla dikey “boş blok” olmasın */
.pdf-letterhead {
  padding: 10mm 16mm 7mm 16mm;
  border-bottom: 1px solid #cbd5e1;
  background: #ffffff;
  page-break-inside: avoid;
  break-inside: avoid;
}
.pdf-letterhead-row {
  display: flex;
  justify-content: flex-start;
  align-items: flex-start;
  gap: 10px;
  flex-wrap: wrap;
}
.pdf-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1;
}
.pdf-logo-box {
  width: 42px;
  height: 42px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.pdf-logo-box img {
  max-width: 42px;
  max-height: 42px;
  width: auto;
  height: auto;
  object-fit: contain;
  display: block;
}
.pdf-org-name {
  font-size: 11.5pt;
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
  display: none;
}
.pdf-doc-control strong {
  display: inline-block;
  min-width: 88px;
  color: #0f172a;
  font-weight: 600;
}
.pdf-report-title-block {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #e2e8f0;
}
.pdf-h1 {
  font-size: 15pt;
  font-weight: 700;
  color: #000000;
  letter-spacing: -0.02em;
  line-height: 1.2;
}
.pdf-h1-sub {
  font-size: 8.5pt;
  color: #000000;
  margin-top: 2px;
  font-weight: 500;
  line-height: 1.35;
}
.pdf-content {
  padding: 9mm 16mm 6mm 16mm;
  flex: 0 0 auto;
}
/* Bölüm başlığı + tablo/özet birlikte kalsın (yazdırma / html2pdf) */
.pdf-section {
  margin-bottom: 22px;
  page-break-inside: auto;
  break-inside: auto;
  -webkit-region-break-inside: auto;
  orphans: 4;
  widows: 4;
}
.pdf-h2 {
  font-size: 11pt;
  font-weight: 700;
  color: #000000;
  text-transform: none;
  letter-spacing: 0.01em;
  margin-bottom: 8px;
  padding-bottom: 4px;
  border-bottom: 1px solid #e2e8f0;
  page-break-after: avoid;
  break-after: avoid-page;
  page-break-inside: avoid;
  break-inside: avoid-page;
}
.pdf-table {
  width: 100%;
  border-collapse: collapse;
  border-spacing: 0;
  font-size: 9.8pt;
  border: none !important;
  /* Düz çizgisel tablo — yuvarlatma/kutu görünümü yok */
  border-radius: 0 !important;
  box-shadow: none !important;
  /* Bölüm başlığı ile birlikte kalsın; html2pdf avoid listesinde tabloyu ayrı verme (başlık yetim kalır) */
  page-break-inside: auto;
  break-inside: auto;
}
.pdf-table thead {
  display: table-header-group;
}
.pdf-table thead th {
  background: transparent !important;
  color: #000000;
  font-weight: 600;
  text-align: left;
  padding: 8px 10px;
  border: none !important;
  border-top: 1px solid #111111 !important;
  border-bottom: 1px solid #111111 !important;
  font-size: 8.7pt;
  text-transform: none;
  letter-spacing: 0.02em;
  border-radius: 0 !important;
  box-shadow: none !important;
}
.pdf-table thead th:last-child {
  text-align: right;
}
.pdf-table td {
  padding: 8px 10px;
  border: none !important;
  /* Tek yatay çizgi (satırlar arası çift çizgi oluşmasın) */
  border-bottom: 1px solid #111111 !important;
  color: #000000 !important;
  vertical-align: top;
  border-radius: 0 !important;
  box-shadow: none !important;
  background: #ffffff !important;
}
.pdf-table tr {
  page-break-inside: avoid;
  break-inside: avoid;
  border-radius: 0 !important;
  box-shadow: none !important;
  background: #ffffff !important;
}
.pdf-table tbody tr:nth-child(even) { background: #ffffff !important; }
.pdf-table tbody tr:last-child td {
  border-bottom: 1px solid #111111 !important;
}
.pdf-td-label {
  font-weight: 600;
  color: #000000;
  width: 46%;
}
.pdf-td-value {
  color: #000000;
  font-weight: 500;
  text-align: right;
}
.pdf-td-value.positive { color: #000000; font-weight: 600; }
.pdf-td-value.negative { color: #000000; font-weight: 600; }
.pdf-stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}
.pdf-stat-card {
  border: none;
  border-radius: 0;
  padding: 2px 0 8px 0;
  background: transparent;
  border-bottom: 1px solid #e2e8f0;
}
.pdf-stat-label {
  font-size: 8pt;
  color: #000000;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 6px;
  font-weight: 600;
}
.pdf-stat-value {
  font-size: 16pt;
  font-weight: 700;
  color: #000000;
  line-height: 1.2;
}
.pdf-stat-value.positive { color: #000000; }
.pdf-stat-value.negative { color: #000000; }
.pdf-footer {
  margin-top: 4mm;
  padding: 2.5mm 16mm;
  border-top: 1px solid #cbd5e1;
  background: #ffffff;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  font-size: 7.5pt;
  color: #64748b;
  flex-wrap: wrap;
  page-break-inside: avoid;
  break-inside: avoid;
  page-break-before: avoid;
  break-before: avoid-page;
  page-break-after: avoid;
  break-after: avoid-page;
}
.pdf-footer-left { max-width: 65%; line-height: 1.55; page-break-inside: avoid; break-inside: avoid; }
.pdf-footer-right { text-align: right; line-height: 1.55; white-space: nowrap; page-break-inside: avoid; break-inside: avoid; }
.pdf-footer-title { font-weight: 700; color: #0f172a; margin-bottom: 4px; font-size: 8pt; }
.pdf-footer-iso { font-family: ui-monospace, monospace; font-size: 7pt; color: #94a3b8; margin-top: 4px; }
.pdf-footer-left > div,
.pdf-footer-right > div {
  page-break-inside: avoid;
  break-inside: avoid;
}
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
export function pdfInnerPageHeightPx(
  marginMm: [number, number, number, number] = [0, 0, 0, 0]
): number {
  const k = 72 / 25.4;
  const innerH = 297 - marginMm[0] - marginMm[2];
  return Math.floor(((innerH * k) / 72) * 96);
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
  const selector = '.pdf-letterhead, .pdf-h2';
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

      // Son kısımda boş sayfa üretmemek için:
      // Eğer eklenecek spacer root'un sonuna çok yakınsa atla.
      const rootTotalH = Math.max(root.scrollHeight, root.offsetHeight);
      if (top + padH >= rootTotalH - 12) continue;

      const pad = document.createElement('div');
      pad.className = 'html2pdf__avoid-spacer';
      pad.setAttribute('aria-hidden', 'true');
      pad.style.cssText = 'display:block;margin:0;padding:0;border:0;clear:both;flex-shrink:0;';
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
    ['SOYBIS 360°', 'Spor Okulları Yönetim Bilgi Sistemi', '', ''],
    ['Belge referansı', meta.referenceId, '', ''],
    ['Rapor başlığı', reportTitle.replace(/<[^>]*>/g, ''), '', ''],
    ['Oluşturulma (yerel)', `${meta.dateDisplayTr} ${meta.timeDisplayTr}`, '', ''],
    ['Oluşturulma (UTC)', meta.iso8601Utc, '', ''],
    ['Saat dilimi', meta.timezoneLabel, '', ''],
    [],
  ];
}
