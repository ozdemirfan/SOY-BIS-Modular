/**
 * SOY-BIS - Sporcu Modülü (sporcu.ts)
 * Sporcu kayıt, listeleme ve yönetim işlemleri
 *
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║                           DOSYA YAPISI                                     ║
 * ╠════════════════════════════════════════════════════════════════════════════╣
 * ║  BÖLÜM 1: IMPORTS & TYPES              (Satır ~10-80)                      ║
 * ║  BÖLÜM 2: STATE & CONFIGURATION        (Satır ~83-170)                     ║
 * ║  BÖLÜM 3: INITIALIZATION               (Satır ~172-215)                    ║
 * ║  BÖLÜM 4: EVENT LISTENERS              (Satır ~219-760)                    ║
 * ║           - Accordion Events                                               ║
 * ║           - Input Kısıtlamaları                                            ║
 * ║           - Form Events                                                    ║
 * ║           - Filtre Events                                                  ║
 * ║  BÖLÜM 5: SORTING & EXPORT             (Satır ~765-1025)                   ║
 * ║  BÖLÜM 6: LIST ACTIONS                 (Satır ~1028-1125)                  ║
 * ║  BÖLÜM 7: AUTO CALCULATIONS            (Satır ~1126-1470)                  ║
 * ║  BÖLÜM 8: VALIDATION & FORM DATA       (Satır ~1473-1720)                  ║
 * ║  BÖLÜM 9: KAYDET (SAVE) OPERATIONS     (Satır ~1724-2050)                  ║
 * ║  BÖLÜM 10: FORM HELPERS                (Satır ~2053-2455)                  ║
 * ║           - formuTemizle                                                   ║
 * ║           - duzenle                                                        ║
 * ║  BÖLÜM 11: CRUD OPERATIONS             (Satır ~2456-2490)                  ║
 * ║  BÖLÜM 12: WIZARD                      (Satır ~2490-2710)                  ║
 * ║  BÖLÜM 13: DURUM & SORTING             (Satır ~2713-2845)                  ║
 * ║  BÖLÜM 14: LIST RENDERING              (Satır ~2849-3145)                  ║
 * ║  BÖLÜM 15: API EXPORTS                 (Satır ~3147-3165)                  ║
 * ║  BÖLÜM 16: FINANSAL HESAPLAMALAR       (Satır ~3167-3355)                  ║
 * ║  BÖLÜM 17: MALZEME YÖNETİMİ            (Satır ~3355-3540)                  ║
 * ║  BÖLÜM 18: FORM RE-BINDING             (Satır ~3539-3690)                  ║
 * ║  BÖLÜM 19: TARİH ALANLARI              (Satır ~3693-3925)                  ║
 * ║  BÖLÜM 20: ESKİ KAYIT                  (Satır ~3925-4145)                  ║
 * ║  BÖLÜM 21: BUTTON STATE                (Satır ~4147-4190)                  ║
 * ║  BÖLÜM 22: SPORCU RAPOR                (Satır ~4193-5960)                  ║
 * ║  BÖLÜM 23: TOPLU ZAM                   (Satır ~5961-6550)                  ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * TOPLAM: 70 fonksiyon, ~6300 satır
 *
 * @module Sporcu
 * @version 3.0
 */

// ============================================================================
// BÖLÜM 1: IMPORTS & TYPES
// ============================================================================

import * as Storage from '../utils/storage';
import * as Helpers from '../utils/helpers';
import {
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
import * as Validation from '../utils/validation';
import { Sporcu, type AntrenmanGrubu } from '../types';
import type { Session } from '../types';
import { sporcuGuncelDonemAidatBorclu } from './aidat';

/**
 * Sporcu Modülü Constants
 * Magic numbers ve configuration değerleri burada tanımlanır
 */
const SPORCU_CONSTANTS = {
  // Pagination
  DEFAULT_PAGE_SIZE: 50,

  // Timing (milliseconds)
  RENDER_DELAY: 100,
  VIEW_UPDATE_DELAY: 300,
  LIST_UPDATE_DELAY: 500,
  DEBOUNCE_DELAY: 300,
  TOAST_DURATION: 5000,
  ANIMATION_DELAY: 250,

  // Responsive Breakpoints
  MOBILE_BREAKPOINT: 768,

  // Date Validation
  MIN_YEAR: 1900,
  MAX_YEAR: 2100,
  MIN_AGE: 3,
  MAX_AGE: 100,

  // Wizard
  TOTAL_WIZARD_STEPS: 3,

  // Table
  TABLE_WIDTH_PERCENT: 100,
  TABLE_MARGIN_TOP: 20,
} as const;

// Global window types (temporary until all modules are migrated)
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
    Yoklama?: {
      init?: () => void;
      listeyiGuncelle?: () => void;
      durumKaydet?: (sporcuId: number, durum: 'var' | 'yok' | 'izinli') => void;
      topluYoklama?: (durum: 'var' | 'yok') => void;
      devamRaporu?: (baslangic?: string | null, bitis?: string | null) => unknown;
      sporcuDevamRaporu?: (sporcuId: number) => unknown;
    };
    Sporcu?: {
      init?: () => void;
      kaydet?: () => void;
      duzenle?: (id: number) => void;
      sil?: (id: number) => void;
      tekrarAktifEt?: (id: number) => void;
      durumDegistir?: (id: number) => void;
      formuTemizle?: () => void;
      listeyiGuncelle?: () => void;
      aktifSporcuSayisi?: () => number;
      yasGrubunaGore?: (yasGrubu: string) => Sporcu[];
      sporcuMalzemeEkleModalKapat?: () => void;
      sporcuMalzemeKaydet?: () => void;
      raporGoster?: (sporcuId: number) => void;
      antrenmanGruplariUiYenile?: () => void;
    };
    App?: {
      viewGoster: (view: string, ilkBaslatma?: boolean) => void;
    };
  }
}

// ============================================================================
// BÖLÜM 2: STATE & CONFIGURATION
// ============================================================================
// Bu bölümde modülün tüm state değişkenleri tanımlanır.
// NOT: İleride bu değişkenler tek bir SporcuState objesi altında toplanabilir.
// ============================================================================

// Güncellenen sporcu ID'si
let guncellenecekId: number | null = null;

// Sorting state
interface SortConfig {
  field: 'adSoyad' | 'tcKimlik' | 'brans' | 'yasGrubu' | 'telefon' | 'aylikUcret' | 'durum' | null;
  direction: 'asc' | 'desc';
}

let currentSort: SortConfig = { field: null, direction: 'asc' };

// Pagination state
interface PaginationConfig {
  pageSize: number;
  currentPage: number;
  totalPages: number;
}

let pagination: PaginationConfig = {
  pageSize: SPORCU_CONSTANTS.DEFAULT_PAGE_SIZE,
  currentPage: 1,
  totalPages: 1,
};

// Filter Cache (performans optimizasyonu için)
interface FilterCache {
  lastSporcularHash: string | null;
  cachedResults: {
    searchTerm: string;
    bransFiltre: string;
    durumFiltre: string;
    antrenmanGrubuFiltre: string;
    filtrelenmis: Sporcu[];
  } | null;
}

let filterCache: FilterCache = {
  lastSporcularHash: null,
  cachedResults: null,
};

/**
 * Sporcular dizisinin hash'ini oluştur (değişiklik kontrolü için)
 * Not: Sadece uzunluk+ID yeterli değil — Ayrıldı↔Aktif gibi durum değişince hash değişmeli;
 * aksi halde filterCache eski filtrelenmiş listeyi kullanır (F5 beklentisi).
 */
function hashSporcular(sporcular: Sporcu[]): string {
  if (sporcular.length === 0) return 'empty';
  const firstId = sporcular[0]?.id || 0;
  const lastId = sporcular[sporcular.length - 1]?.id || 0;
  let sig = 0;
  for (const s of sporcular) {
    sig = (((sig * 31 + (Number(s.id) || 0)) | 0) >>> 0) % 2147483647;
    const d = s.durum || '';
    for (let i = 0; i < d.length; i++) {
      sig = (((sig * 31 + d.charCodeAt(i)) | 0) >>> 0) % 2147483647;
    }
    const ag = s.antrenmanGrubuId || '';
    for (let i = 0; i < ag.length; i++) {
      sig = (((sig * 31 + ag.charCodeAt(i)) | 0) >>> 0) % 2147483647;
    }
  }
  return `${sporcular.length}_${firstId}_${lastId}_${sig}`;
}

function sporcuAntrenmanAdi(sporcu: Sporcu): string {
  const id = sporcu.antrenmanGrubuId;
  if (!id) return '';
  return Storage.antrenmanGrubuBul(id)?.ad || '';
}

/**
 * Branşsız (eski) gruplar her sporcuda; branşlı gruplar yalnızca aynı branştaki sporcuda.
 * Sporcunun branşı boşsa branşlı gruplar listelenmez (önce branş seçilmeli).
 */
function antrenmanGrubuBransEslesirMi(grup: AntrenmanGrubu, sporcuBrans: string): boolean {
  const gb = (grup.brans || '').trim().toLowerCase();
  const sb = sporcuBrans.trim().toLowerCase();
  if (!gb) return true;
  if (!sb) return false;
  return gb === sb;
}

function antrenmanGruplariFormIcin(sporcuBrans: string): AntrenmanGrubu[] {
  const tum = Storage.antrenmanGruplariGetir();
  return tum
    .filter(g => antrenmanGrubuBransEslesirMi(g, sporcuBrans))
    .sort((a, b) => String(a.ad || '').localeCompare(String(b.ad || ''), 'tr'));
}

function antrenmanGruplariListeFiltreIcin(): AntrenmanGrubu[] {
  return Storage.antrenmanGruplariGetir()
    .slice()
    .sort((a, b) => {
      const ba = (a.brans || '').localeCompare(b.brans || '', 'tr');
      if (ba !== 0) return ba;
      return String(a.ad || '').localeCompare(String(b.ad || ''), 'tr');
    });
}

/**
 * Sporcunun mevcut antrenmanGrubuId değeri, branş filtresine göre üretilen listede yoksa <select> seçimi düşer (grup yok sanılır).
 * Silinmiş veya uyuşmayan kayıt için de tek satır eklenir.
 */
function antrenmanGruplarSecimListesineEkle(
  gruplar: AntrenmanGrubu[],
  secilenId: string | undefined
): AntrenmanGrubu[] {
  const id = (secilenId || '').trim();
  if (!id || id === '__none__') return gruplar.slice();
  if (gruplar.some(g => g.id === id)) return gruplar.slice();
  const o = Storage.antrenmanGrubuBul(id);
  if (o) {
    return [...gruplar, o].sort((a, b) =>
      String(a.ad || '').localeCompare(String(b.ad || ''), 'tr')
    );
  }
  return [
    ...gruplar,
    { id, ad: 'Tanımsız grup (silinmiş veya eksik)' },
  ].sort((a, b) => String(a.ad || '').localeCompare(String(b.ad || ''), 'tr'));
}

/** Form ve liste filtresindeki antrenman grubu seçeneklerini doldurur */
function antrenmanGrubuSecenekleriniDoldur(preserveFormSelection?: string): void {
  const formSel = Helpers.$('#antrenmanGrubuSelect') as HTMLSelectElement | null;
  const filtreSel = Helpers.$('#antrenmanGrubuFiltre') as HTMLSelectElement | null;
  const formBransEl = Helpers.$('#brans') as HTMLSelectElement | null;
  const formBrans = (formBransEl?.value || '').trim();
  const listeBransEl = Helpers.$('#bransFiltre') as HTMLSelectElement | null;
  const listeBrans = (listeBransEl?.value || '').trim();
  /** Form: branş seçiliyse o branşa uygun gruplar; seçili değilken tüm merkezi gruplar (Ayarlar’dan eklenenler görünsün) */
  const gruplarFormBase = formBrans
    ? antrenmanGruplariFormIcin(formBrans)
    : antrenmanGruplariListeFiltreIcin();
  const formPrev =
    preserveFormSelection !== undefined ? preserveFormSelection : formSel?.value || '';
  const gruplarForm = antrenmanGruplarSecimListesineEkle(gruplarFormBase, formPrev);
  /** Liste: branş seçiliyse yalnızca o branşa (ve branşsız) uygun gruplar; yoksa tüm gruplar */
  const gruplarFiltreBase = listeBrans
    ? antrenmanGruplariFormIcin(listeBrans)
    : antrenmanGruplariListeFiltreIcin();
  const filtrePrevRaw = filtreSel?.value || '';
  const gruplarFiltre = antrenmanGruplarSecimListesineEkle(
    gruplarFiltreBase,
    filtrePrevRaw === '__none__' ? '' : filtrePrevRaw
  );

  if (formSel) {
    const prev =
      preserveFormSelection !== undefined ? preserveFormSelection : formSel.value;
    formSel.innerHTML = '<option value="">— Grup seçilmedi —</option>';
    for (const g of gruplarForm) {
      const opt = document.createElement('option');
      opt.value = g.id;
      opt.textContent = g.brans ? `${g.ad} (${g.brans})` : g.ad;
      formSel.appendChild(opt);
    }
    if (prev && gruplarForm.some(g => g.id === prev)) {
      formSel.value = prev;
    } else {
      formSel.value = '';
    }
  }

  if (filtreSel) {
    const prev = filtreSel.value;
    filtreSel.innerHTML =
      '<option value="">Tüm Gruplar</option><option value="__none__">Grubu yok</option>';
    for (const g of gruplarFiltre) {
      const opt = document.createElement('option');
      opt.value = g.id;
      opt.textContent = g.brans ? `${g.ad} (${g.brans})` : g.ad;
      filtreSel.appendChild(opt);
    }
    if (prev === '__none__' || prev === '' || gruplarFiltre.some(g => g.id === prev)) {
      filtreSel.value = prev;
    } else {
      filtreSel.value = '';
    }
  }
}

// AbortController for event listener cleanup
let formAbortController: AbortController | null = null;
let quickAmountAbortController: AbortController | null = null;
let accordionAbortController: AbortController | null = null;

// Form submit handler'ı sakla (duplicate listener önlemek için)
let formSubmitHandler: ((e: Event) => void) | null = null;
let kaydetBtnHandler: ((e: Event) => void) | null = null;
let delegationHandler: ((e: Event) => void) | null = null;

// Rapor ekranı için event handler referansları (zombie event önleme)
let raporViewportResizeListener: (() => void) | null = null;
let raporWindowResizeListener: (() => void) | null = null;
let raporButtonResizeHandler: (() => void) | null = null;
let raporGeriBtnHandler: ((e: Event) => void) | null = null;
let raporYazdirBtnHandler: ((e: Event) => void) | null = null;
let raporOverlayClickHandler: ((e: Event) => void) | null = null;
let isRaporEventsInitialized = false;
let savedScrollPosition = 0;

// Wizard state
let currentWizardStep = 1;
const totalWizardSteps = SPORCU_CONSTANTS.TOTAL_WIZARD_STEPS;

// Malzemeler listesi (dinamik)
interface Malzeme {
  id: string;
  ad: string;
  tutar: number;
  odendi?: boolean; // Ödeme durumu (opsiyonel)
}

let malzemeler: Malzeme[] = [];
let malzemeCounter = 0;

// ============================================================================
// BÖLÜM 3: INITIALIZATION
// ============================================================================

/** Kayıt formunda branş değişince antrenman grubu listesini o branşa göre yeniler */
function bransDegisinceAntrenmanGrubuBagla(): void {
  const brans = Helpers.$('#brans') as HTMLSelectElement | null;
  if (!brans || brans.dataset.antrenmanGrupBound === '1') return;
  brans.dataset.antrenmanGrupBound = '1';
  brans.addEventListener('change', () => {
    const sel = Helpers.$('#antrenmanGrubuSelect') as HTMLSelectElement | null;
    const prev = sel?.value || '';
    antrenmanGrubuSecenekleriniDoldur(prev);
  });
}

/**
 * Modülü başlat
 * Tüm event listener'ları bağlar ve listeyi günceller.
 */
export function init(): void {
  console.log('✅ [Sporcu] Modül başlatılıyor...');
  // Yetki kontrolü - Sporcu kayıt sadece Yönetici
  if (window.Auth && !window.Auth.yetkiKontrol('sporcu_ekleyebilir')) {
    const sporcuKayitView = Helpers.$('#sporcu-kayit');
    if (sporcuKayitView) {
      sporcuKayitView.style.display = 'none';
    }
  }

  formEventleri();
  bransDegisinceAntrenmanGrubuBagla();
  filtreEventleri();
  autoYasGrubuHesaplama();
  paraFormatiEventleri();
  bursDurumuEventleri();
  inputKisitlamalari();
  accordionEventleri(); // Accordion açılma/kapanma işlevleri
  wizardInit(); // Wizard mantığını başlat
  malzemeEventleri(); // Malzeme ekleme/silme eventleri
  finansalOzetHesapla(); // Canlı özet hesaplama
  listeyiGuncelle();

  // Tarih alanlarını oluştur (HTML'de yoksa)
  // Birden fazla deneme yap (form yüklenene kadar bekle)
  let denemeSayisiInit = 0;
  const maxDenemeInit = 10;
  const tarihAlanlariniOlusturIntervalInit = setInterval(() => {
    denemeSayisiInit++;
    const form = Helpers.$('#sporcuKayitForm') as HTMLFormElement | null;
    const dogumTarihi = Helpers.$('#dogumTarihi') as HTMLInputElement | null;

    if (form && dogumTarihi) {
      console.log('✅ [Sporcu] Init: Form ve dogumTarihi bulundu, tarih alanları oluşturuluyor...');
      tarihAlanlariniOlustur();
      clearInterval(tarihAlanlariniOlusturIntervalInit);
    } else if (denemeSayisiInit >= maxDenemeInit) {
      clearInterval(tarihAlanlariniOlusturIntervalInit);
      console.warn(
        `⚠️ [Sporcu] Init: Tarih alanları oluşturulamadı (${denemeSayisiInit} deneme): Form=${!!form}, dogumTarihi=${!!dogumTarihi}`
      );
    }
  }, 200);

  console.log('✅ [Sporcu] Modül başlatıldı');
}

// ============================================================================
// BÖLÜM 4: EVENT LISTENERS
// ============================================================================
// Bu bölümde tüm event listener'lar tanımlanır:
// - Accordion Events: Form bölümlerini açma/kapama
// - Input Kısıtlamaları: Telefon, TC vb. için karakter kısıtlaması
// - Form Events: Submit, validation, quick amount buttons
// - Filtre Events: Arama, branş filtresi, durum filtresi
// ============================================================================

/**
 * Accordion açılma/kapanma işlevleri - Event Delegation kullanarak
 */
function accordionEventleri(): void {
  // Eski listener'ı iptal et
  if (accordionAbortController) {
    accordionAbortController.abort();
  }

  // Yeni AbortController oluştur
  accordionAbortController = new AbortController();
  const signal = accordionAbortController.signal;

  // Event delegation kullan - document üzerinde dinle, sonra accordion-header'ı kontrol et
  document.addEventListener(
    'click',
    function (e: MouseEvent): void {
      const target = e.target as HTMLElement;
      const accordionHeader = target.closest('.accordion-header') as HTMLElement | null;

      if (!accordionHeader) {
        return; // Accordion header'a tıklanmadı
      }

      e.preventDefault();
      e.stopPropagation();

      const accordionSection = accordionHeader.closest('.accordion-section') as HTMLElement | null;

      if (!accordionSection) {
        return;
      }

      const isActive = accordionSection.classList.contains('active');

      // Aynı accordion'u aç/kapa
      if (isActive) {
        accordionSection.classList.remove('active');
      } else {
        accordionSection.classList.add('active');
      }
    },
    { signal }
  );
}

/**
 * Input kısıtlamaları - sadece rakam girişi
 */
function inputKisitlamalari(): void {
  // Sadece rakam girilecek alanlar
  const sadeceSayiAlanlari = [
    '#tcKimlik', // TC Kimlik
    '#telefon', // Sporcu telefon
    '#veli1Tel', // Veli 1 telefon
    '#veli2Tel', // Veli 2 telefon
    '#formaNo', // Forma no
    '#boy', // Boy
    '#kilo', // Kilo
    '#ayakNo', // Ayak no
  ];

  sadeceSayiAlanlari.forEach(selector => {
    const input = Helpers.$(selector) as HTMLInputElement | null;
    if (input) {
      // Yazarken sadece rakam kabul et
      input.addEventListener('input', function () {
        const inputEl = this as HTMLInputElement;
        inputEl.value = inputEl.value.replace(/[^0-9]/g, '');
      });

      // Yapıştırma işleminde de sadece rakamları al
      input.addEventListener('paste', function (e) {
        e.preventDefault();
        const inputEl = this as HTMLInputElement;
        const clipboardData = e.clipboardData || (window as any).clipboardData;
        const pastedText = clipboardData.getData('text');
        inputEl.value = pastedText.replace(/[^0-9]/g, '');
      });

      // Tuşa basıldığında kontrol
      input.addEventListener('keypress', function (e) {
        // Sadece rakamlar, backspace, delete, tab, enter, ok tuşları
        if (
          !/[0-9]/.test(e.key) &&
          !['Backspace', 'Delete', 'Tab', 'Enter', 'ArrowLeft', 'ArrowRight'].includes(e.key)
        ) {
          e.preventDefault();
        }
      });
    }
  });

  // Telefon alanları için özel formatlama (5XX XXX XX XX)
  const telefonAlanlari = ['#telefon', '#veli1Tel', '#veli2Tel'];
  telefonAlanlari.forEach(selector => {
    const input = Helpers.$(selector) as HTMLInputElement | null;
    if (input) {
      input.addEventListener('input', function () {
        const inputEl = this as HTMLInputElement;
        // Sadece rakamları al
        let val = inputEl.value.replace(/[^0-9]/g, '');

        // Max 10 karakter
        if (val.length > 10) {
          val = val.substring(0, 10);
        }

        // Formatla: 5XX XXX XX XX
        if (val.length > 3 && val.length <= 6) {
          val = val.substring(0, 3) + ' ' + val.substring(3);
        } else if (val.length > 6 && val.length <= 8) {
          val = val.substring(0, 3) + ' ' + val.substring(3, 6) + ' ' + val.substring(6);
        } else if (val.length > 8) {
          val =
            val.substring(0, 3) +
            ' ' +
            val.substring(3, 6) +
            ' ' +
            val.substring(6, 8) +
            ' ' +
            val.substring(8);
        }

        inputEl.value = val;
      });

      // Placeholder güncelle
      input.placeholder = '5XX XXX XX XX';
    }
  });

  // TC Kimlik için max 11 karakter
  const tcInput = Helpers.$('#tcKimlik') as HTMLInputElement | null;
  if (tcInput) {
    tcInput.addEventListener('input', function () {
      const inputEl = this as HTMLInputElement;
      if (inputEl.value.length > 11) {
        inputEl.value = inputEl.value.substring(0, 11);
      }
    });
  }
}

/**
 * Form eventlerini bağla
 */
// Event handler referansları (zombie event önleme için)
let isFormEventsInitialized = false;

function formEventleri(): void {
  const form = Helpers.$('#sporcuKayitForm') as HTMLFormElement | null;
  if (!form) {
    console.warn('⚠️ Sporcu formu bulunamadı: #sporcuKayitForm');
    return;
  }

  // İlk kez çağrılıyorsa veya form değiştiyse event'leri temizle
  if (isFormEventsInitialized && formSubmitHandler) {
    form.removeEventListener('submit', formSubmitHandler);
    formSubmitHandler = null;
  }

  // Yeni handler oluştur ve sakla
  formSubmitHandler = function (e: Event) {
    e.preventDefault();

    // Görünmez required alanların validasyonunu devre dışı bırak
    // HTML5 validasyonu görünmez alanları kontrol edemez
    const wasRequiredMap = new Map<HTMLElement, boolean>();

    try {
      const allRequiredFields = form.querySelectorAll('[required]');

      // Aktif wizard adımını bul
      const activeStep = form.querySelector('.wizard-step-content.active');

      allRequiredFields.forEach(field => {
        const fieldEl = field as HTMLElement;

        // Sadece aktif step dışındaki alanları kontrol et
        const isInActiveStep = activeStep?.contains(fieldEl);

        if (!isInActiveStep) {
          wasRequiredMap.set(fieldEl, true);
          fieldEl.removeAttribute('required');
          // HTML5 validasyon için setCustomValidity yalnızca input/select/textarea'da var.
          (fieldEl as any).setCustomValidity?.('');
        }
      });

      // Form validasyonunu kontrol et
      if (!form.checkValidity()) {
        // Geçersiz alanları bul ve göster (sadece görünür olanlar)
        const invalidFields = Array.from(form.querySelectorAll(':invalid')).filter(field => {
          const fieldEl = field as HTMLElement;
          return (
            fieldEl.offsetParent !== null &&
            fieldEl.style.display !== 'none' &&
            !fieldEl.hasAttribute('hidden') &&
            (activeStep ? activeStep.contains(fieldEl) : true)
          );
        });

        if (invalidFields.length > 0) {
          const firstInvalid = invalidFields[0] as HTMLElement;
          firstInvalid.focus();
          firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
          Helpers.toast('Lütfen tüm zorunlu alanları doldurun.', 'error');
          return;
        }
      }

      // Kaydetme işlemini yap
      kaydet();
    } catch (error) {
      console.error('Form submit hatası:', error);
      Helpers.toast('Form kaydedilemedi!', 'error');
    } finally {
      // Her durumda required attribute'ları geri ekle
      wasRequiredMap.forEach((wasRequired, fieldEl) => {
        if (wasRequired) {
          fieldEl.setAttribute('required', '');
        }
      });
    }
  };

  form.addEventListener('submit', formSubmitHandler);
  isFormEventsInitialized = true;

  // Kaydet butonuna da direkt click handler ekle (form submit çalışmazsa yedek)
  const kaydetBtn = Helpers.$('#kaydetBtn') as HTMLButtonElement | null;
  if (!kaydetBtn) {
    // Alternatif selector'ları dene
    const altBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement | null;
    if (altBtn) {
      // Eğer daha önce listener eklenmişse, önce kaldır
      if (kaydetBtnHandler) {
        altBtn.removeEventListener('click', kaydetBtnHandler);
      }
      kaydetBtnHandler = function (e: Event) {
        e.preventDefault();
        e.stopPropagation();
        // Validasyon kontrolü
        if (!form.checkValidity()) {
          form.reportValidity();
          Helpers.toast('Lütfen tüm zorunlu alanları doldurun.', 'error');
          return;
        }
        kaydet();
      };
      altBtn.addEventListener('click', kaydetBtnHandler);
    } else {
      console.warn('⚠️ Kaydet butonu bulunamadı: #kaydetBtn ve alternatifler');
    }
  } else {
    // Eğer daha önce listener eklenmişse, önce kaldır
    if (kaydetBtnHandler) {
      kaydetBtn.removeEventListener('click', kaydetBtnHandler);
    }

    // Yeni handler oluştur ve sakla
    kaydetBtnHandler = function (e: Event) {
      e.preventDefault();
      e.stopPropagation();
      // Validasyon kontrolü - kullanıcıya net geri bildirim
      if (!form.checkValidity()) {
        form.reportValidity();
        Helpers.toast('Lütfen tüm zorunlu alanları doldurun.', 'error');
        return;
      }
      kaydet();
    };

    kaydetBtn.addEventListener('click', kaydetBtnHandler);

    // Buton disabled mı kontrol et
    if (kaydetBtn.disabled) {
      console.warn('⚠️ Kaydet butonu disabled durumda!');
    }
  }

  // Formu temizle butonu
  const temizleBtn = Helpers.$('#formuTemizleBtn');
  if (temizleBtn) {
    temizleBtn.addEventListener('click', formuTemizle);
  }

  // Validation icon kontrolü - sadece dolu ve geçerli alanlarda göster
  const formInputs = form.querySelectorAll('input, select, textarea');
  formInputs.forEach(input => {
    const inputElement = input as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

    inputElement.addEventListener('blur', () => {
      const inputEl = inputElement;
      // Önce tüm validation class'larını kaldır
      inputEl.classList.remove('validated-success', 'error');

      const value = inputEl.value ? inputEl.value.trim() : '';
      const isRequired = inputEl.hasAttribute('required');

      // Boş alan kontrolü
      if (!value) {
        if (isRequired) {
          // Zorunlu alan boşsa kırmızı göster
          inputEl.classList.add('error');
          const errorEl = document.getElementById(inputEl.id + 'Error');
          if (errorEl) {
            errorEl.textContent = 'Bu alan zorunludur.';
          }
        }
        return;
      }

      // Değer varsa validation kontrolü yap
      let isValid = true;
      let errorMessage = '';

      // Alan tipine göre özel validation
      if (inputEl.id === 'tcKimlik') {
        const tcResult = Validation.tcKimlikDogrula(value);
        isValid = tcResult.valid;
        errorMessage = tcResult.message;
      } else if (inputEl.id === 'email' && value) {
        const emailResult = Validation.emailDogrula(value);
        isValid = emailResult.valid;
        errorMessage = emailResult.message;
      } else if (
        (inputEl.id === 'telefon' || inputEl.id === 'veli1Tel' || inputEl.id === 'veli2Tel') &&
        value
      ) {
        const telResult = Validation.telefonDogrula(value);
        isValid = telResult.valid;
        errorMessage = telResult.message;
      } else if (inputEl.id === 'adSoyad') {
        const adResult = Validation.adSoyadDogrula(value);
        isValid = adResult.valid;
        errorMessage = adResult.message;
      } else if (inputEl.id === 'dogumTarihi') {
        const tarihResult = Validation.tarihDogrula(value, {
          required: true,
          minYas: SPORCU_CONSTANTS.MIN_AGE,
          maxYas: SPORCU_CONSTANTS.MAX_AGE,
        });
        isValid = tarihResult.valid;
        errorMessage = tarihResult.message;
      } else {
        // HTML5 validation kontrolü
        isValid = inputElement.checkValidity();
      }

      // Sonuçları uygula
      if (isValid) {
        inputEl.classList.add('validated-success');
        const errorEl = document.getElementById(inputEl.id + 'Error');
        if (errorEl) {
          errorEl.textContent = '';
        }
      } else {
        inputEl.classList.add('error');
        const errorEl = document.getElementById(inputEl.id + 'Error');
        if (errorEl && errorMessage) {
          errorEl.textContent = errorMessage;
        }
      }
    });

    inputElement.addEventListener('input', () => {
      const inputEl = inputElement;
      // Yazarken validation class'larını kaldır (sadece blur'da göster)
      inputEl.classList.remove('validated-success', 'error');
      const errorEl = document.getElementById(inputEl.id + 'Error');
      if (errorEl) {
        errorEl.textContent = '';
      }
    });
  });

  // Kayıt ödeme durumu değiştiğinde ödeme yöntemi alanını göster/gizle
  const kayitOdemeAlindiRadio = Helpers.$('#kayitOdemeAlindi') as HTMLInputElement | null;
  const kayitOdemeAlinmadiRadio = Helpers.$('#kayitOdemeAlinmadi') as HTMLInputElement | null;
  const kayitOdemeYontemiGroup = Helpers.$('#kayitOdemeYontemiGroup') as HTMLElement | null;

  const odemeYontemiGuncelle = () => {
    if (kayitOdemeYontemiGroup) {
      if (kayitOdemeAlindiRadio?.checked) {
        kayitOdemeYontemiGroup.style.display = 'block';
        const kayitOdemeYontemiSelect = Helpers.$('#kayitOdemeYontemi') as HTMLSelectElement | null;
        if (kayitOdemeYontemiSelect) {
          kayitOdemeYontemiSelect.required = true;
        }
      } else {
        kayitOdemeYontemiGroup.style.display = 'none';
        const kayitOdemeYontemiSelect = Helpers.$('#kayitOdemeYontemi') as HTMLSelectElement | null;
        if (kayitOdemeYontemiSelect) {
          kayitOdemeYontemiSelect.required = false;
        }
      }
    }
    // İlk Ay Ödeme ve Kalan Borç değerlerini güncelle
    finansalOzetHesapla();
  };

  if (kayitOdemeAlindiRadio) {
    kayitOdemeAlindiRadio.addEventListener('change', odemeYontemiGuncelle);
  }
  if (kayitOdemeAlinmadiRadio) {
    kayitOdemeAlinmadiRadio.addEventListener('change', odemeYontemiGuncelle);
  }

  // İlk yüklemede kontrol et
  odemeYontemiGuncelle();

  // Quick amount butonları - Hazır ücret butonları
  // Eski listener'ı iptal et
  if (quickAmountAbortController) {
    quickAmountAbortController.abort();
  }

  // Yeni AbortController oluştur
  quickAmountAbortController = new AbortController();
  const quickSignal = quickAmountAbortController.signal;

  // Event delegation kullan (dinamik içerik için daha güvenli)
  document.addEventListener(
    'click',
    function (e) {
      const target = e.target as HTMLElement;
      const btn = target.closest('.btn-quick-amount') as HTMLElement | null;

      if (btn) {
        e.preventDefault();
        e.stopPropagation();

        const amount = parseFloat(btn.getAttribute('data-amount') || '0');
        const aylikUcretInput = Helpers.$('#aylikUcret') as HTMLInputElement | null;

        if (aylikUcretInput && amount > 0) {
          // Para formatı ile değeri ayarla
          aylikUcretInput.value = Helpers.paraFormat(amount);
          // Input formatını uygula
          Helpers.paraFormatInput(aylikUcretInput);
          // Aktif buton görünümü için
          document.querySelectorAll('.btn-quick-amount').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          // Finansal özeti güncelle
          finansalOzetHesapla();
          // Input'a focus ver
          aylikUcretInput.focus();
        }
      }
    },
    { signal: quickSignal }
  );
}

/**
 * Filtre eventlerini bağla
 */
// Filtre event handler referansları (zombie event önleme için)
let searchBoxHandler: ((e: Event) => void) | null = null;
let bransFiltreHandler: ((e: Event) => void) | null = null;
let durumFiltreHandler: ((e: Event) => void) | null = null;
let antrenmanGrubuFiltreHandler: ((e: Event) => void) | null = null;
let isFiltreEventsInitialized = false;

function filtreEventleri(): void {
  const searchBox = Helpers.$('#searchBox') as HTMLInputElement | null;
  const bransFiltre = Helpers.$('#bransFiltre') as HTMLSelectElement | null;
  const durumFiltre = Helpers.$('#durumFiltre') as HTMLSelectElement | null;
  const antrenmanGrubuFiltre = Helpers.$('#antrenmanGrubuFiltre') as HTMLSelectElement | null;

  // Önce mevcut event listener'ları temizle (zombie event önleme)
  if (isFiltreEventsInitialized) {
    if (searchBox && searchBoxHandler) {
      searchBox.removeEventListener('input', searchBoxHandler);
      searchBoxHandler = null;
    }
    if (bransFiltre && bransFiltreHandler) {
      bransFiltre.removeEventListener('change', bransFiltreHandler);
      bransFiltreHandler = null;
    }
    if (durumFiltre && durumFiltreHandler) {
      durumFiltre.removeEventListener('change', durumFiltreHandler);
      durumFiltreHandler = null;
    }
    if (antrenmanGrubuFiltre && antrenmanGrubuFiltreHandler) {
      antrenmanGrubuFiltre.removeEventListener('change', antrenmanGrubuFiltreHandler);
      antrenmanGrubuFiltreHandler = null;
    }
  }

  // Yeni event handler'ları oluştur
  if (searchBox) {
    // Debounced handler'ı bir kez oluştur ve sakla
    searchBoxHandler = Helpers.debounce(() => {
      // Cache'i temizle (arama değişti)
      filterCache.cachedResults = null;
      filterCache.lastSporcularHash = '';
      listeyiGuncelle();
    }, SPORCU_CONSTANTS.DEBOUNCE_DELAY);
    searchBox.addEventListener('input', searchBoxHandler);
  }

  if (bransFiltre) {
    bransFiltreHandler = function (this: HTMLSelectElement) {
      // Select'i geçici olarak devre dışı bırak
      this.disabled = true;
      // Cache'i temizle (filtre değişti)
      filterCache.cachedResults = null;
      filterCache.lastSporcularHash = '';
      requestAnimationFrame(() => {
        antrenmanGrubuSecenekleriniDoldur();
        listeyiGuncelle();
        requestAnimationFrame(() => {
          this.disabled = false;
        });
      });
    };
    bransFiltre.addEventListener('change', bransFiltreHandler);
  }

  if (durumFiltre) {
    durumFiltreHandler = function (this: HTMLSelectElement) {
      // Select'i geçici olarak devre dışı bırak
      this.disabled = true;
      // Cache'i temizle (filtre değişti)
      filterCache.cachedResults = null;
      filterCache.lastSporcularHash = '';
      requestAnimationFrame(() => {
        listeyiGuncelle();
        requestAnimationFrame(() => {
          this.disabled = false;
        });
      });
    };
    durumFiltre.addEventListener('change', durumFiltreHandler);
  }

  if (antrenmanGrubuFiltre) {
    antrenmanGrubuFiltreHandler = function (this: HTMLSelectElement) {
      this.disabled = true;
      filterCache.cachedResults = null;
      filterCache.lastSporcularHash = '';
      requestAnimationFrame(() => {
        listeyiGuncelle();
        requestAnimationFrame(() => {
          this.disabled = false;
        });
      });
    };
    antrenmanGrubuFiltre.addEventListener('change', antrenmanGrubuFiltreHandler);
  }

  isFiltreEventsInitialized = true;

  // Branş filtresini doldur
  bransFiltresiDoldur();
  antrenmanGrubuSecenekleriniDoldur();

  // Event delegation: Sporcu listesi butonları için (edit, delete, toggle-status)
  const listContainer = Helpers.$('#sporcuListesi');
  if (listContainer) {
    // Eğer daha önce listener eklenmişse kaldır (duplicate önlemek için)
    listContainer.removeEventListener('click', handleSporcuListAction);
    listContainer.addEventListener('click', handleSporcuListAction);
  }

  // Sorting: Tablo başlıklarına sıralama event'leri ekle
  // DOM hazır olduktan sonra çağrılmalı
  setTimeout(() => {
    initSorting();
  }, SPORCU_CONSTANTS.RENDER_DELAY);

  // Export butonları
  initExportButtons();
}

// ============================================================================
// BÖLÜM 5: SORTING & EXPORT
// ============================================================================
// Bu bölümde tablo sıralama ve dışa aktarma (CSV, Yazdır) işlemleri yer alır.
// ============================================================================

/**
 * Liste kart görünümünde tablo başlığı olmadığı için sütun tıklama ile sıralama yok.
 * Varsayılan sıralama `currentSort` + `listeyiGuncelle` içindeki `sortSporcular` ile sürüyor.
 */
function initSorting(): void {}

/**
 * Export butonlarını başlat
 */
function initExportButtons(): void {
  const tableToolbar = document.querySelector('#sporcu-listesi .table-toolbar');
  if (!tableToolbar) return;

  // Export butonları container'ı oluştur (eğer yoksa)
  let exportContainer = Helpers.$('#sporcuExportButtons');
  if (!exportContainer) {
    exportContainer = document.createElement('div');
    exportContainer.id = 'sporcuExportButtons';
    exportContainer.className = 'export-buttons';
    exportContainer.style.display = 'flex';
    exportContainer.style.gap = '0.5rem';
    exportContainer.style.marginLeft = 'auto';

    // CSV Export butonu
    const csvBtn = document.createElement('button');
    csvBtn.className = 'btn btn-small btn-success';
    csvBtn.innerHTML = '<i class="fa-solid fa-file-csv"></i> CSV İndir';
    csvBtn.title = 'Sporcu listesini CSV formatında indir';
    csvBtn.setAttribute('data-export-type', 'csv');
    exportContainer.appendChild(csvBtn);

    // Print butonu
    const printBtn = document.createElement('button');
    printBtn.className = 'btn btn-small';
    printBtn.innerHTML = '<i class="fa-solid fa-print"></i> Yazdır';
    printBtn.title = 'Sporcu listesini yazdır';
    printBtn.setAttribute('data-export-type', 'print');
    exportContainer.appendChild(printBtn);

    // Toolbar'a ekle
    tableToolbar.appendChild(exportContainer);
  }

  // Event'leri ekle
  exportContainer.querySelectorAll('[data-export-type]').forEach(btn => {
    const button = btn as HTMLButtonElement;
    button.addEventListener('click', () => {
      const exportType = button.getAttribute('data-export-type');
      if (exportType === 'csv') {
        exportToCSV();
      } else if (exportType === 'print') {
        printList();
      }
    });
  });
}

/**
 * Sporcu listesini CSV formatında indir
 */
function exportToCSV(): void {
  const sporcular = Storage.sporculariGetir();
  if (sporcular.length === 0) {
    Helpers.toast('İndirilecek sporcu bulunamadı.', 'warning');
    return;
  }

  // CSV başlıkları
  const headers = [
    'Ad Soyad',
    'TC Kimlik',
    'Branş',
    'Yaş Grubu',
    'Telefon',
    'Aylık Ücret',
    'Durum',
  ];

  // CSV satırları
  const rows = sporcular.map(s => {
    const adSoyad = s.temelBilgiler?.adSoyad || '';
    const tcKimlik = s.temelBilgiler?.tcKimlik || '';
    const brans = s.sporBilgileri?.brans || '';
    const yasGrubu = s.tffGruplari?.anaGrup || '';
    const telefon = s.iletisim?.telefon || '';
    const ucret = s.odemeBilgileri?.burslu
      ? 'BURSLU'
      : Helpers.paraFormat(s.odemeBilgileri?.aylikUcret || 0) + ' TL';
    const durum = s.durum || '';

    return [adSoyad, tcKimlik, brans, yasGrubu, telefon, ucret, durum];
  });

  // CSV içeriğini oluştur
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')),
  ].join('\n');

  // BOM ekle (UTF-8 için Excel uyumluluğu)
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

  // İndirme linki oluştur
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `sporcu-listesi_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  Helpers.toast('CSV dosyası indirildi.', 'success');
}

/**
 * Sporcu listesini yazdır
 * - Masaüstü: önce yeni sekme; çoğu mobil tarayıcı boş pencereyi engellediği için dar ekranda doğrudan gizli iframe kullanılır.
 * - Popup null ise iframe yedek (pop-up engeli).
 */
function printList(): void {
  const sporcular = Storage.sporculariGetir();
  if (sporcular.length === 0) {
    Helpers.toast('Yazdırılacak sporcu bulunamadı.', 'warning');
    return;
  }

  // HTML içeriğini oluştur
  const printContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Sporcu Listesi - Yazdır</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1 { text-align: center; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; font-weight: bold; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        @media print {
          body { margin: 0; padding: 10px; }
          @page { margin: 1cm; }
        }
      </style>
    </head>
    <body>
      <h1>Sporcu Listesi</h1>
      <p><strong>Tarih:</strong> ${new Date().toLocaleDateString('tr-TR')}</p>
      <p><strong>Toplam Sporcu:</strong> ${sporcular.length}</p>
      <table>
        <thead>
          <tr>
            <th>Ad Soyad</th>
            <th>TC Kimlik</th>
            <th>Branş</th>
            <th>Yaş Grubu</th>
            <th>Telefon</th>
            <th>Aylık Ücret</th>
            <th>Durum</th>
          </tr>
        </thead>
        <tbody>
          ${sporcular
            .map(s => {
              const adSoyad = s.temelBilgiler?.adSoyad || '';
              const tcKimlik = s.temelBilgiler?.tcKimlik || '';
              const brans = s.sporBilgileri?.brans || '';
              const yasGrubu = s.tffGruplari?.anaGrup || '';
              const telefon = s.iletisim?.telefon || '';
              const ucret = s.odemeBilgileri?.burslu
                ? 'BURSLU'
                : Helpers.paraFormat(s.odemeBilgileri?.aylikUcret || 0) + ' TL';
              const durum = s.durum || '';

              return `
              <tr>
                <td>${adSoyad}</td>
                <td>${tcKimlik}</td>
                <td>${brans}</td>
                <td>${yasGrubu}</td>
                <td>${telefon}</td>
                <td>${ucret}</td>
                <td>${durum}</td>
              </tr>
            `;
            })
            .join('')}
        </tbody>
      </table>
    </body>
    </html>
  `;

  const isMobileWidth = window.innerWidth <= SPORCU_CONSTANTS.MOBILE_BREAKPOINT;
  const printDelay = isMobileWidth ? 450 : SPORCU_CONSTANTS.ANIMATION_DELAY;

  const writeAndPrint = (target: Window): void => {
    const doc = target.document;
    doc.open();
    doc.write(printContent);
    doc.close();
    setTimeout(() => {
      try {
        target.focus();
        target.print();
      } catch {
        Helpers.toast('Yazdırma başlatılamadı.', 'error');
      }
    }, printDelay);
  };

  const printWithIframe = (): void => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.title = 'Yazdırma';
    iframe.style.cssText =
      'position:fixed;left:0;top:0;width:100%;height:100%;border:0;opacity:0;pointer-events:none;z-index:-1;';
    document.body.appendChild(iframe);
    const cw = iframe.contentWindow;
    if (!cw) {
      iframe.remove();
      Helpers.toast('Yazdırma açılamadı.', 'error');
      return;
    }
    writeAndPrint(cw);
    const removeIframe = (): void => {
      iframe.remove();
    };
    cw.addEventListener('afterprint', removeIframe);
    setTimeout(removeIframe, 120000);
  };

  if (isMobileWidth) {
    printWithIframe();
    return;
  }

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    printWithIframe();
    return;
  }

  writeAndPrint(printWindow);
}

// ============================================================================
// BÖLÜM 6: LIST ACTIONS
// ============================================================================
// Bu bölümde liste butonları (düzenle, sil, durum değiştir) işlemleri yer alır.
// Event delegation kullanılarak tek bir listener ile yönetilir.
// ============================================================================

/**
 * Sporcu listesi action button handler (Event Delegation)
 */
function handleSporcuListAction(e: Event): void {
  const target = e.target as HTMLElement;

  // Icon'a tıklandığında da çalışması için closest kullan
  // Sadece sporcu listesi butonlarını yakala (aidat modülü butonlarını değil)
  const button = target.closest('#sporcuListesi button[data-action]') as HTMLButtonElement | null;

  if (!button) {
    // Eğer button bulunamadıysa, belki aidat modülü butonu olabilir - ignore et
    return;
  }

  // Rapor butonu kontrolü - sadece btn-rapor class'ına sahip butonları işle
  if (button.classList.contains('btn-rapor') || button.getAttribute('data-action') === 'rapor') {
    e.preventDefault();
    e.stopPropagation();

    const sporcuIdStr = button.getAttribute('data-sporcu-id');
    if (!sporcuIdStr) {
      console.warn('⚠️ [Sporcu] handleSporcuListAction - Rapor butonu için sporcuId bulunamadı');
      return;
    }

    const sporcuId = parseInt(sporcuIdStr, 10);
    if (isNaN(sporcuId)) {
      console.warn('⚠️ [Sporcu] handleSporcuListAction - Geçersiz sporcuId:', sporcuIdStr);
      return;
    }

    console.log('📊 [Sporcu] handleSporcuListAction - Rapor butonu tıklandı, sporcuId:', sporcuId);

    if (window.Sporcu && typeof window.Sporcu.raporGoster === 'function') {
      window.Sporcu.raporGoster(sporcuId);
    } else {
      console.error('❌ [Sporcu] handleSporcuListAction - window.Sporcu.raporGoster bulunamadı!', {
        hasWindowSporcu: !!window.Sporcu,
        hasRaporGoster: window.Sporcu ? typeof window.Sporcu.raporGoster === 'function' : false,
      });
      Helpers.toast('Rapor fonksiyonu bulunamadı!', 'error');
    }
    return;
  }

  // Diğer butonlar için normal işlem
  e.preventDefault();
  e.stopPropagation();

  const action = button.getAttribute('data-action');
  const sporcuIdStr = button.getAttribute('data-sporcu-id');

  if (!action || !sporcuIdStr) {
    console.warn('⚠️ [Sporcu] handleSporcuListAction - action veya sporcuId bulunamadı', {
      action,
      sporcuIdStr,
    });
    return;
  }

  const sporcuId = parseInt(sporcuIdStr, 10);
  if (isNaN(sporcuId)) {
    console.warn('⚠️ [Sporcu] handleSporcuListAction - Geçersiz sporcuId:', sporcuIdStr);
    return;
  }

  console.log('🖱️ [Sporcu] handleSporcuListAction - Buton tıklandı', { action, sporcuId });

  // Action'a göre ilgili fonksiyonu çağır
  switch (action) {
    case 'edit':
      if (window.Sporcu && typeof window.Sporcu.duzenle === 'function') {
        window.Sporcu.duzenle(sporcuId);
      }
      break;
    case 'rapor':
      console.log(
        '📊 [Sporcu] handleSporcuListAction - rapor butonu tıklandı, sporcuId:',
        sporcuId
      );
      if (window.Sporcu && typeof window.Sporcu.raporGoster === 'function') {
        window.Sporcu.raporGoster(sporcuId);
      } else {
        console.error(
          '❌ [Sporcu] handleSporcuListAction - window.Sporcu.raporGoster bulunamadı!',
          {
            hasWindowSporcu: !!window.Sporcu,
            hasRaporGoster: window.Sporcu ? typeof window.Sporcu.raporGoster === 'function' : false,
          }
        );
        Helpers.toast('Rapor fonksiyonu bulunamadı!', 'error');
      }
      break;
    case 'delete':
      if (window.Sporcu && typeof window.Sporcu.sil === 'function') {
        window.Sporcu.sil(sporcuId);
      }
      break;
    case 'toggle-status':
      if (window.Sporcu && typeof window.Sporcu.durumDegistir === 'function') {
        window.Sporcu.durumDegistir(sporcuId);
      }
      break;
    case 'reactivate':
      if (window.Sporcu && typeof window.Sporcu.tekrarAktifEt === 'function') {
        window.Sporcu.tekrarAktifEt(sporcuId);
      }
      break;
  }
}

/**
 * Otomatik yaş grubu hesaplama eventi
 */
function autoYasGrubuHesaplama(): void {
  const dogumTarihiInput = Helpers.$('#dogumTarihi') as HTMLInputElement | null;
  const kayitTarihiInput = Helpers.$('#kayitTarihi') as HTMLInputElement | null;
  const yasGrubuEl = Helpers.$('#autoYasGrubu');

  // Doğum tarihi input kontrolü
  if (dogumTarihiInput && yasGrubuEl) {
    // Input event: Girilen değeri kontrol et ve 4 haneli yıl sınırlaması uygula
    dogumTarihiInput.addEventListener('input', function () {
      const value = this.value;

      if (value && value.length > 0) {
        // YYYY-MM-DD formatını kontrol et
        const tarihRegex = /^(\d{4})-(\d{2})-(\d{2})$/;
        const match = value.match(tarihRegex);

        if (match) {
          // Format doğru, yıl kontrolü yap
          const yil = match[1];
          if (yil.length > 4) {
            // Yıl 4 haneden fazlaysa, sadece ilk 4 haneyi al
            const corrected = `${yil.substring(0, 4)}-${match[2]}-${match[3]}`;
            this.value = corrected;
          }
        } else {
          // Format henüz tamamlanmamış, ama yıl kısmını kontrol et
          // YYYY-MM-DD formatında olmayan değerler için
          const yilMatch = value.match(/^(\d+)/);
          if (yilMatch && yilMatch[1].length > 4) {
            // Yıl 4 haneden fazlaysa, sadece ilk 4 haneyi al
            const yil = yilMatch[1].substring(0, 4);
            const rest = value.substring(yilMatch[1].length);
            const corrected = yil + rest;
            this.value = corrected;
          }

          // Eğer sadece rakamlar varsa ve 8 karakter veya daha fazlaysa, formatla
          const digitsOnly = value.replace(/[^\d]/g, '');
          if (digitsOnly.length >= 8) {
            // YYYYMMDD formatında ise, YYYY-MM-DD formatına çevir
            const formatted = `${digitsOnly.substring(0, 4)}-${digitsOnly.substring(4, 6)}-${digitsOnly.substring(6, 8)}`;
            this.value = formatted;
          }
        }
      }
    });

    // Blur event: Sadece alan kaybedildiğinde kontrol yap ve yaş grubunu hesapla
    dogumTarihiInput.addEventListener('blur', function () {
      if (this.value) {
        // Son kontrol: YYYY-MM-DD formatında olmalı ve yıl 4 haneli olmalı
        const tarihRegex = /^(\d{4})-(\d{2})-(\d{2})$/;
        const match = this.value.match(tarihRegex);

        // Sadece tam formatlanmış tarihler için kontrol yap (10 karakter)
        if (match && this.value.length === 10) {
          const yil = parseInt(match[1], 10);
          const ay = parseInt(match[2], 10);
          const gun = parseInt(match[3], 10);

          // Yıl kontrolü: MIN_YEAR-MAX_YEAR arası olmalı (tarayıcı eksik yılları 0 ile dolduruyor)
          if (yil < SPORCU_CONSTANTS.MIN_YEAR || yil > SPORCU_CONSTANTS.MAX_YEAR) {
            // Geçersiz yıl (örn: 0002, 0020, 0201 gibi)
            this.value = '';
            yasGrubuEl.textContent = 'Hesaplanacak';
            Helpers.toast(
              `Lütfen geçerli bir yıl girin (${SPORCU_CONSTANTS.MIN_YEAR}-${SPORCU_CONSTANTS.MAX_YEAR} arası, 4 haneli)`,
              'warning'
            );
            return;
          }

          // Ay ve gün kontrolü: Geçerli aralıklarda olmalı
          if (ay < 1 || ay > 12 || gun < 1 || gun > 31) {
            // Geçersiz ay veya gün
            this.value = '';
            yasGrubuEl.textContent = 'Hesaplanacak';
            Helpers.toast('Lütfen geçerli bir tarih girin (ay: 1-12, gün: 1-31)', 'warning');
            return;
          }

          // Date objesi ile geçerlilik kontrolü (örn: 31 Şubat gibi)
          const testDate = new Date(yil, ay - 1, gun);
          if (
            testDate.getFullYear() !== yil ||
            testDate.getMonth() !== ay - 1 ||
            testDate.getDate() !== gun
          ) {
            // Geçersiz tarih (örn: 31 Şubat)
            this.value = '';
            yasGrubuEl.textContent = 'Hesaplanacak';
            Helpers.toast('Lütfen geçerli bir tarih girin (örn: 31 Şubat geçersiz)', 'warning');
            return;
          }

          // Geçerli tarih, yaş grubunu hesapla
          const yasGrubu = Helpers.yasGrubuHesapla(this.value);
          yasGrubuEl.textContent = yasGrubu;
        } else if (this.value.length > 0 && this.value.length < 10) {
          // Henüz tam formatlanmamış, kontrol yapma (kullanıcı yazıyor)
          yasGrubuEl.textContent = 'Hesaplanacak';
          return;
        } else if (this.value.length >= 10 && !match) {
          // Tam formatlanmış ama format yanlış
          this.value = '';
          yasGrubuEl.textContent = 'Hesaplanacak';
          Helpers.toast(
            'Lütfen geçerli bir tarih girin (YYYY-MM-DD formatında, yıl 4 haneli olmalı)',
            'warning'
          );
        }
      } else {
        yasGrubuEl.textContent = 'Hesaplanacak';
      }
    });
  }

  // Kayıt tarihi input kontrolü
  if (kayitTarihiInput) {
    // Mevcut ay kısıtlamasını güncelle (her form açılışında)
    const bugun = new Date();
    const mevcutAyinIlkGunu = new Date(bugun.getFullYear(), bugun.getMonth(), 1);
    const minDateStr = mevcutAyinIlkGunu.toISOString().split('T')[0];
    const maxDateStr = bugun.toISOString().split('T')[0];
    kayitTarihiInput.min = minDateStr;
    kayitTarihiInput.max = maxDateStr;

    // Yeni kayıt için otomatik bugünün tarihini set et
    if (!guncellenecekId && !kayitTarihiInput.value) {
      kayitTarihiInput.value = maxDateStr;
    }

    // Event listener'ları sadece bir kez ekle (memory leak önleme)
    if (!kayitTarihiInput.hasAttribute('data-kayit-tarihi-listener')) {
      kayitTarihiInput.setAttribute('data-kayit-tarihi-listener', 'true');

      // Input event: Formatlama yap ve yıl/ay tamamlandığında anında kontrol yap
      kayitTarihiInput.addEventListener('input', function () {
        const value = this.value;

        if (value && value.length > 0) {
          const bugun = new Date();
          const mevcutAy = bugun.getMonth();
          const mevcutYil = bugun.getFullYear();
          const maxDateStr = bugun.toISOString().split('T')[0];
          const ayIsimleri = [
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
          ];

          // YYYY-MM-DD formatını kontrol et
          const tarihRegex = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/;
          const match = value.match(tarihRegex);

          if (match) {
            const yil = parseInt(match[1], 10);
            const ay = match[2] ? parseInt(match[2], 10) : null;

            // Yıl kontrolü: 4 karakter tamamlandığında ve ay henüz yazılmamışsa (örn: 2025, 2027)
            // NOT: Mevcut yıl yazıldığında kontrol yapma, ay yazılmasını bekle
            if (match[1].length === 4 && !isNaN(yil) && !match[2]) {
              if (yil < mevcutYil) {
                // Geçmiş yıl - o yılın herhangi bir ayı seçilemez
                this.value = maxDateStr;
                Helpers.toast(
                  `Geçmiş ay (${yil}) seçilemez. Sadece mevcut ay (${ayIsimleri[mevcutAy]} ${mevcutYil}) içinde bir tarih seçebilirsiniz.`,
                  'warning',
                  5000
                );
                return;
              } else if (yil > mevcutYil) {
                // Gelecek yıl - o yılın herhangi bir ayı seçilemez
                this.value = maxDateStr;
                Helpers.toast(
                  `Gelecek ay (${yil}) seçilemez. Sadece mevcut ay (${ayIsimleri[mevcutAy]} ${mevcutYil}) içinde bir tarih seçebilirsiniz.`,
                  'warning',
                  5000
                );
                return;
              }
              // Mevcut yıl yazıldıysa, ay yazılmasını bekle (kontrol yapma)
            }

            // Ay kontrolü: Yıl mevcut yıl ve ay 2 karakter tamamlandığında (örn: 2026-01, 2026-02)
            if (
              yil === mevcutYil &&
              ay !== null &&
              !isNaN(ay) &&
              match[2] &&
              match[2].length === 2
            ) {
              if (ay < 1 || ay > 12) {
                // Geçersiz ay
                return;
              }

              const secilenAy = ay - 1; // 0-11 arası
              if (secilenAy < mevcutAy) {
                // Geçmiş ay
                this.value = maxDateStr;
                Helpers.toast(
                  `Geçmiş ay (${ayIsimleri[secilenAy]} ${yil}) seçilemez. Sadece mevcut ay (${ayIsimleri[mevcutAy]} ${mevcutYil}) içinde bir tarih seçebilirsiniz.`,
                  'warning',
                  5000
                );
                return;
              } else if (secilenAy > mevcutAy) {
                // Gelecek ay
                this.value = maxDateStr;
                Helpers.toast(
                  `Gelecek ay (${ayIsimleri[secilenAy]} ${yil}) seçilemez. Sadece mevcut ay (${ayIsimleri[mevcutAy]} ${mevcutYil}) içinde bir tarih seçebilirsiniz.`,
                  'warning',
                  5000
                );
                return;
              }
              // Mevcut ay yazıldıysa, devam et (kontrol yapma)
            }
          }

          // Formatlama: Yıl 4 haneden fazlaysa düzelt
          if (match && match[1].length > 4) {
            const corrected = `${match[1].substring(0, 4)}-${match[2] || ''}${match[3] ? '-' + match[3] : ''}`;
            this.value = corrected;
            return;
          }

          // Formatlama: Henüz formatlanmamış ama yıl kısmı 4 haneden fazlaysa
          if (!match) {
            const yilMatch = value.match(/^(\d+)/);
            if (yilMatch && yilMatch[1].length > 4) {
              const yil = yilMatch[1].substring(0, 4);
              const rest = value.substring(yilMatch[1].length);
              const corrected = yil + rest;
              this.value = corrected;
              return;
            }

            // Eğer sadece rakamlar varsa ve 8 karakter veya daha fazlaysa, formatla
            const digitsOnly = value.replace(/[^\d]/g, '');
            if (digitsOnly.length >= 8) {
              const formatted = `${digitsOnly.substring(0, 4)}-${digitsOnly.substring(4, 6)}-${digitsOnly.substring(6, 8)}`;
              this.value = formatted;
              return;
            }
          }
        }
      });

      // Blur event: Sadece alan kaybedildiğinde kontrol yap (change event çok erken tetiklenebilir)
      kayitTarihiInput.addEventListener('blur', function () {
        if (this.value) {
          // Son kontrol: YYYY-MM-DD formatında olmalı ve yıl 4 haneli olmalı
          const tarihRegex = /^(\d{4})-(\d{2})-(\d{2})$/;
          const match = this.value.match(tarihRegex);

          // Sadece tam formatlanmış tarihler için kontrol yap (10 karakter)
          if (match && this.value.length === 10) {
            const yil = parseInt(match[1], 10);
            const ay = parseInt(match[2], 10);
            const gun = parseInt(match[3], 10);
            const secilenTarih = new Date(yil, ay - 1, gun);
            const bugun = new Date();
            const mevcutAy = bugun.getMonth();
            const mevcutYil = bugun.getFullYear();
            const maxDateStr = bugun.toISOString().split('T')[0];
            const ayIsimleri = [
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
            ];

            // Mevcut ay kontrolü: Sadece mevcut ay içinde bir tarih seçilebilir
            if (secilenTarih.getMonth() !== mevcutAy || secilenTarih.getFullYear() !== mevcutYil) {
              // Mevcut ay dışında bir tarih seçilmişse, bugünün tarihine ayarla
              const secilenAy = secilenTarih.getMonth();
              const secilenYil = secilenTarih.getFullYear();

              let toastMesaji = '';
              if (secilenYil < mevcutYil || (secilenYil === mevcutYil && secilenAy < mevcutAy)) {
                toastMesaji = `Geçmiş ay (${ayIsimleri[secilenAy]} ${secilenYil}) seçilemez. Sadece mevcut ay (${ayIsimleri[mevcutAy]} ${mevcutYil}) içinde bir tarih seçebilirsiniz.`;
              } else {
                toastMesaji = `Gelecek ay (${ayIsimleri[secilenAy]} ${secilenYil}) seçilemez. Sadece mevcut ay (${ayIsimleri[mevcutAy]} ${mevcutYil}) içinde bir tarih seçebilirsiniz.`;
              }

              this.value = maxDateStr;
              Helpers.toast(toastMesaji, 'warning', 5000);
              return;
            }

            // Yıl kontrolü: MIN_YEAR-MAX_YEAR arası olmalı (tarayıcı eksik yılları 0 ile dolduruyor)
            if (yil < SPORCU_CONSTANTS.MIN_YEAR || yil > SPORCU_CONSTANTS.MAX_YEAR) {
              // Geçersiz yıl (örn: 0002, 0020, 0201 gibi)
              this.value = '';
              Helpers.toast(
                `Lütfen geçerli bir yıl girin (${SPORCU_CONSTANTS.MIN_YEAR}-${SPORCU_CONSTANTS.MAX_YEAR} arası, 4 haneli)`,
                'warning'
              );
              return;
            }

            // Ay ve gün kontrolü: Geçerli aralıklarda olmalı
            if (ay < 1 || ay > 12 || gun < 1 || gun > 31) {
              // Geçersiz ay veya gün
              this.value = '';
              Helpers.toast('Lütfen geçerli bir tarih girin (ay: 1-12, gün: 1-31)', 'warning');
              return;
            }

            // Date objesi ile geçerlilik kontrolü (örn: 31 Şubat gibi)
            const testDate = new Date(yil, ay - 1, gun);
            if (
              testDate.getFullYear() !== yil ||
              testDate.getMonth() !== ay - 1 ||
              testDate.getDate() !== gun
            ) {
              // Geçersiz tarih (örn: 31 Şubat)
              this.value = '';
              Helpers.toast('Lütfen geçerli bir tarih girin (örn: 31 Şubat geçersiz)', 'warning');
              return;
            }
          } else if (this.value.length > 0 && this.value.length < 10) {
            // Henüz tam formatlanmamış, kontrol yapma (kullanıcı yazıyor)
            return;
          } else if (this.value.length >= 10 && !match) {
            // Tam formatlanmış ama format yanlış
            this.value = '';
            Helpers.toast(
              'Lütfen geçerli bir tarih girin (YYYY-MM-DD formatında, yıl 4 haneli olmalı)',
              'warning'
            );
          }
        }
      });
    }
  }
}

/**
 * Para formatı eventleri
 */
function paraFormatiEventleri(): void {
  // Aylık ücret
  const aylikUcretInput = Helpers.$('#aylikUcret') as HTMLInputElement | null;
  if (aylikUcretInput) {
    aylikUcretInput.addEventListener('input', function () {
      Helpers.paraFormatInput(this);
    });
  }

  // Ek ücretler için para formatı
  const ekUcretInputs = ['#esofmanUcreti', '#formaUcreti', '#yagmurlukUcreti', '#digerUcret'];
  ekUcretInputs.forEach(selector => {
    const input = Helpers.$(selector) as HTMLInputElement | null;
    if (input) {
      input.addEventListener('input', function () {
        Helpers.paraFormatInput(this);
      });
    }
  });
}

/**
 * Burs durumu eventleri
 */
function bursDurumuEventleri(): void {
  const bursDurumuSelect = Helpers.$('#bursDurumu') as HTMLSelectElement | null;
  const aylikUcretInput = Helpers.$('#aylikUcret') as HTMLInputElement | null;

  if (bursDurumuSelect && aylikUcretInput) {
    bursDurumuSelect.addEventListener('change', function () {
      if (this.value === 'burslu') {
        aylikUcretInput.dataset.oldValue = aylikUcretInput.value;
        aylikUcretInput.value = '0';
        aylikUcretInput.disabled = true;
      } else {
        if (aylikUcretInput.value === '0' && aylikUcretInput.dataset.oldValue) {
          aylikUcretInput.value = aylikUcretInput.dataset.oldValue;
        } else if (aylikUcretInput.value === '0') {
          aylikUcretInput.value = '';
        }
        aylikUcretInput.disabled = false;
      }
    });
  }
}

/**
 * Branş filtresini doldur
 */
function bransFiltresiDoldur(): void {
  const bransFiltre = Helpers.$('#bransFiltre') as HTMLSelectElement | null;
  if (!bransFiltre) return;

  const sporcular = Storage.sporculariGetir();
  const branslar = [...new Set(sporcular.map(s => s.sporBilgileri?.brans).filter(Boolean))];

  // Branş listesini güvenli şekilde oluştur (XSS korumalı)
  bransFiltre.innerHTML = '<option value="">Tüm Branşlar</option>';
  branslar.forEach(brans => {
    if (brans) {
      // XSS koruması: escapeHtml kullan (branş adı kullanıcı girdisi olabilir)
      const guvenliBrans = Helpers.escapeHtml(brans);
      bransFiltre.innerHTML += `<option value="${guvenliBrans}">${guvenliBrans}</option>`;
    }
  });
}

/**
 * Tarih yıl validasyonu helper fonksiyonu
 * @param tarihStr - Validasyon yapılacak tarih string'i
 * @param fieldName - Hata mesajında kullanılacak alan adı
 * @param inputElement - Focus verilecek input elementi
 * @returns Geçerli ise true, değilse false
 */
function validateTarihYili(
  tarihStr: string,
  fieldName: string,
  inputElement: HTMLInputElement
): boolean {
  if (!tarihStr) return true;

  const tarihRegex = /^(\d{4})-(\d{2})-(\d{2})$/;
  const match = tarihStr.match(tarihRegex);
  if (match) {
    const yil = parseInt(match[1], 10);
    if (yil < SPORCU_CONSTANTS.MIN_YEAR || yil > SPORCU_CONSTANTS.MAX_YEAR) {
      Helpers.toast(
        `${fieldName} yılı geçersiz (${SPORCU_CONSTANTS.MIN_YEAR}-${SPORCU_CONSTANTS.MAX_YEAR} arası, 4 haneli olmalı)`,
        'error'
      );
      inputElement.focus();
      return false;
    }
  }
  return true;
}

/**
 * Form verilerini topla ve kontrol et
 * @returns Form verileri veya null (hata durumunda)
 */
interface FormData {
  adSoyad: string;
  tcKimlik: string;
  dogumTarihi: string;
  cinsiyet: string;
  brans: string;
  telefon: string;
  email: string;
  veli1Ad: string;
  veli1Tel: string;
  veli1Yakinlik: string;
  aylikUcret: string;
  bursDurumu: 'burslu' | 'standart';
  kayitTarihi: string;
}

function collectAndValidateFormData(): FormData | null {
  // Form verilerini topla
  const adSoyadInput = Helpers.$('#adSoyad') as HTMLInputElement | null;
  const tcKimlikInput = Helpers.$('#tcKimlik') as HTMLInputElement | null;
  const dogumTarihiInput = Helpers.$('#dogumTarihi') as HTMLInputElement | null;
  const cinsiyetSelect = Helpers.$('#cinsiyet') as HTMLSelectElement | null;
  const bransSelect = Helpers.$('#brans') as HTMLSelectElement | null;
  const telefonInput = Helpers.$('#telefon') as HTMLInputElement | null;
  const emailInput = Helpers.$('#email') as HTMLInputElement | null;
  const veli1AdInput = Helpers.$('#veli1Ad') as HTMLInputElement | null;
  const veli1TelInput = Helpers.$('#veli1Tel') as HTMLInputElement | null;
  const veli1YakinlikSelect = Helpers.$('#veli1Yakinlik') as HTMLSelectElement | null;
  const aylikUcretInput = Helpers.$('#aylikUcret') as HTMLInputElement | null;
  const bursDurumuBursluRadio = Helpers.$('#bursDurumuBurslu') as HTMLInputElement | null;
  const bursDurumuStandartRadio = Helpers.$('#bursDurumuStandart') as HTMLInputElement | null;
  const kayitTarihiInput = Helpers.$('#kayitTarihi') as HTMLInputElement | null;

  // Form alanlarını kontrol et
  const eksikAlanlar: string[] = [];
  if (!adSoyadInput) eksikAlanlar.push('adSoyadInput');
  if (!dogumTarihiInput) eksikAlanlar.push('dogumTarihiInput');
  if (!cinsiyetSelect) eksikAlanlar.push('cinsiyetSelect');
  if (!bransSelect) eksikAlanlar.push('bransSelect');
  if (!telefonInput) eksikAlanlar.push('telefonInput');
  if (!emailInput) eksikAlanlar.push('emailInput');
  if (!veli1AdInput) eksikAlanlar.push('veli1AdInput');
  if (!veli1TelInput) eksikAlanlar.push('veli1TelInput');
  if (!veli1YakinlikSelect) eksikAlanlar.push('veli1YakinlikSelect');
  if (!aylikUcretInput) eksikAlanlar.push('aylikUcretInput');
  if (!bursDurumuBursluRadio && !bursDurumuStandartRadio) {
    eksikAlanlar.push('bursDurumuRadio');
  }

  if (eksikAlanlar.length > 0) {
    Helpers.toast('Form alanları eksik!', 'error');
    return null;
  }

  // Burs durumunu al
  const bursDurumu = bursDurumuBursluRadio && bursDurumuBursluRadio.checked ? 'burslu' : 'standart';

  // Tarih kontrolleri
  if (!validateTarihYili(dogumTarihiInput.value, 'Doğum tarihi', dogumTarihiInput)) {
    return null;
  }

  if (
    kayitTarihiInput &&
    !validateTarihYili(kayitTarihiInput.value, 'Kayıt tarihi', kayitTarihiInput)
  ) {
    return null;
  }

  const antrenmanGrubuSelect = Helpers.$('#antrenmanGrubuSelect') as HTMLSelectElement | null;
  const agId = (antrenmanGrubuSelect?.value || '').trim();
  const bransVal = (bransSelect.value || '').trim();
  if (agId && bransVal) {
    const g = Storage.antrenmanGrubuBul(agId);
    if (g && !antrenmanGrubuBransEslesirMi(g, bransVal)) {
      Helpers.toast(
        'Seçili antrenman grubu bu branş ile uyumlu değil. Branşı veya antrenman grubunu değiştirin.',
        'error'
      );
      return null;
    }
  }

  return {
    adSoyad: adSoyadInput.value.trim(),
    tcKimlik: tcKimlikInput ? tcKimlikInput.value.replace(/\D/g, '') : '',
    dogumTarihi: dogumTarihiInput.value,
    cinsiyet: cinsiyetSelect.value,
    brans: bransSelect.value,
    telefon: telefonInput.value,
    email: emailInput.value,
    veli1Ad: veli1AdInput.value,
    veli1Tel: veli1TelInput.value,
    veli1Yakinlik: veli1YakinlikSelect.value,
    aylikUcret: bursDurumu === 'burslu' ? '0' : aylikUcretInput?.value || '0',
    bursDurumu: bursDurumu,
    kayitTarihi: (kayitTarihiInput?.value || '').trim(),
  };
}

/**
 * Sporcu objesi oluştur
 */
function createSporcuObject(formData: FormData): Partial<Sporcu> {
  // Ek form alanlarını al
  const formaNoInput = Helpers.$('#formaNo') as HTMLInputElement | null;
  const veli2AdInput = Helpers.$('#veli2Ad') as HTMLInputElement | null;
  const veli2TelInput = Helpers.$('#veli2Tel') as HTMLInputElement | null;
  const kayitOdemeAlindiRadio = Helpers.$('#kayitOdemeAlindi') as HTMLInputElement | null;
  const boyInput = Helpers.$('#boy') as HTMLInputElement | null;
  const kiloInput = Helpers.$('#kilo') as HTMLInputElement | null;
  const bedenSelect = Helpers.$('#beden') as HTMLSelectElement | null;
  const ayakNoInput = Helpers.$('#ayakNo') as HTMLInputElement | null;
  const kanGrubuSelect = Helpers.$('#kanGrubu') as HTMLSelectElement | null;
  const alerjilerTextarea = Helpers.$('#alerjiler') as HTMLTextAreaElement | null;
  const kronikHastalikTextarea = Helpers.$('#kronikHastalik') as HTMLTextAreaElement | null;
  const autoYasGrubuEl = Helpers.$('#autoYasGrubu');
  const antrenmanGrubuSelect = Helpers.$('#antrenmanGrubuSelect') as HTMLSelectElement | null;
  const saglikRaporuTarihInput = Helpers.$('#saglikRaporuTarih') as HTMLInputElement | null;
  const lisansTarihInput = Helpers.$('#lisansTarih') as HTMLInputElement | null;
  const lisansNoInput = Helpers.$('#lisansNo') as HTMLInputElement | null;
  const sigortaTarihInput = Helpers.$('#sigortaTarih') as HTMLInputElement | null;

  const bursluMu = formData.bursDurumu === 'burslu';
  const telefonResult = Validation.telefonDogrula(formData.telefon);
  const veli1TelResult = Validation.telefonDogrula(formData.veli1Tel);
  const veli2TelValue = veli2TelInput?.value || '';
  const veli2TelResult = veli2TelValue ? Validation.telefonDogrula(veli2TelValue) : null;

  return {
    id: guncellenecekId || undefined,
    temelBilgiler: {
      adSoyad: formData.adSoyad,
      tcKimlik: formData.tcKimlik,
      dogumTarihi: formData.dogumTarihi,
      cinsiyet: formData.cinsiyet,
    },
    sporBilgileri: {
      brans: formData.brans,
      formaNo: formaNoInput?.value || '',
    },
    iletisim: {
      telefon: telefonResult.formatted,
      email: formData.email,
    },
    veliBilgileri: {
      veli1: {
        ad: formData.veli1Ad,
        telefon: veli1TelResult.formatted,
        yakinlik: formData.veli1Yakinlik,
      },
      veli2: {
        ad: veli2AdInput?.value || '',
        telefon: veli2TelResult?.formatted || '',
      },
    },
    odemeBilgileri: {
      aylikUcret: bursluMu ? 0 : Helpers.paraCoz(formData.aylikUcret),
      burslu: bursluMu,
      odemeGunu: null,
    },
    ekUcretler: {
      esofman: { tutar: 0, odendi: false },
      forma: { tutar: 0, odendi: false },
      yagmurluk: { tutar: 0, odendi: false },
      diger: { tutar: 0, odendi: false },
    },
    kayitOdemeDurumu: kayitOdemeAlindiRadio?.checked ? 'alindi' : 'alinmadi',
    fiziksel: {
      boy: boyInput?.value || '',
      kilo: kiloInput?.value || '',
      beden: bedenSelect?.value || '',
      ayakNo: ayakNoInput?.value || '',
    },
    saglik: {
      kanGrubu: kanGrubuSelect?.value || '',
      alerjiler: alerjilerTextarea?.value || '',
      kronikHastalik: kronikHastalikTextarea?.value || '',
    },
    tffGruplari: {
      anaGrup: autoYasGrubuEl?.textContent || '',
    },
    antrenmanGrubuId: (antrenmanGrubuSelect?.value || '').trim() || undefined,
    belgeler: {
      saglikRaporu: saglikRaporuTarihInput?.value || null,
      lisans: lisansTarihInput?.value || null,
      lisansNo: lisansNoInput?.value || '',
      sigorta: sigortaTarihInput?.value || null,
    },
  };
}

/**
 * Kayıt tarihini belirle
 */
function determineKayitTarihi(formData: FormData, sporcu: Partial<Sporcu>): string {
  const kayitTarihiStr = formData.kayitTarihi;
  const kayitTarihiDate = kayitTarihiStr ? new Date(kayitTarihiStr) : new Date();
  const kayitTarihiValid = !isNaN(kayitTarihiDate.getTime()) ? kayitTarihiDate : new Date();

  if (!guncellenecekId) {
    return kayitTarihiValid.toISOString();
  } else {
    const mevcutSporcu = Storage.sporcuBul(guncellenecekId);
    if (mevcutSporcu?.kayitTarihi) {
      return mevcutSporcu.kayitTarihi;
    } else {
      const idTarih = new Date(guncellenecekId);
      return !isNaN(idTarih.getTime()) ? idTarih.toISOString() : kayitTarihiValid.toISOString();
    }
  }
}

// ============================================================================
// BÖLÜM 9: KAYDET (SAVE) OPERATIONS
// ============================================================================
// Bu bölümde sporcu kaydetme ve güncelleme işlemleri yer alır.
// Alt fonksiyonlar:
// - collectAndValidateFormData: Form verilerini topla
// - createSporcuObject: Sporcu objesi oluştur
// - processYeniKayit: Yeni kayıt işlemleri
// - processGuncelleme: Güncelleme işlemleri
// - handleSaveSuccess: Başarı sonrası işlemler
// ============================================================================

/**
 * Sporcu kaydet
 */
function kaydet(): void {
  try {
    // 1. Form verilerini topla ve kontrol et
    const formData = collectAndValidateFormData();
    if (!formData) {
      return; // Hata mesajı zaten gösterildi
    }

    // 2. Validation kontrolü
    const validationResult = Validation.sporcuFormDogrula(formData);
    if (!validationResult.valid) {
      console.log('❌ [Sporcu] Validation hataları:', validationResult.errors);
      console.log('📋 [Sporcu] FormData:', formData);
      Validation.hatalariGoster(validationResult.errors);
      Helpers.toast('Lütfen hatalı alanları düzeltin.', 'error');
      return;
    }

    // 3. TC kontrol (benzersizlik)
    if (formData.tcKimlik && formData.tcKimlik.trim()) {
      const tcKayitliMi = Storage.tcKontrol(formData.tcKimlik, guncellenecekId);
      console.log('🔍 [Sporcu] TC kontrol:', {
        tc: formData.tcKimlik,
        guncellenecekId: guncellenecekId,
        tcKayitliMi: tcKayitliMi,
      });
      if (tcKayitliMi) {
        Helpers.toast('Bu TC Kimlik No ile kayıtlı sporcu zaten mevcut!', 'error');
        return; // Kayıt yapma, çık
      }
    }

    // 4. Sporcu objesi oluştur
    const sporcu = createSporcuObject(formData);

    // 5. Kayıt tarihini belirle
    sporcu.kayitTarihi = determineKayitTarihi(formData, sporcu);

    // 6. Sporcu kaydet
    const kaydedilenSporcu = Storage.sporcuKaydet(sporcu);
    const sporcuId = kaydedilenSporcu.id;

    // 7. Yeni kayıt veya güncelleme işlemlerini yap
    if (!guncellenecekId) {
      processYeniKayit(sporcu, sporcuId);
    } else {
      processGuncelleme(sporcuId);
    }

    // 8. Başarı mesajı ve UI güncellemeleri
    handleSaveSuccess();
  } catch (error) {
    console.error('❌ [Sporcu] kaydet hatası:', error);
    Helpers.toast('Sporcu kaydedilirken hata oluştu!', 'error');
  }
}

/**
 * Yeni kayıt işlemlerini yap
 */
function processYeniKayit(sporcu: Partial<Sporcu>, sporcuId: number): void {
  const kayitTarihi = new Date(sporcu.kayitTarihi || new Date().toISOString());
  const { ay: kayitAy, yil: kayitYil } = Helpers.suAnkiDonem(kayitTarihi);
  const kayitGunu = kayitTarihi.getDate();

  // Ödeme gününü kayıt tarihindeki gün olarak ayarla
  if (sporcu.odemeBilgileri) {
    sporcu.odemeBilgileri.odemeGunu = kayitGunu;
    const sporcular = Storage.sporculariGetir();
    const index = sporcular.findIndex(s => s.id === sporcuId);
    if (index !== -1 && sporcular[index]?.odemeBilgileri) {
      sporcular[index].odemeBilgileri.odemeGunu = kayitGunu;
      Storage.kaydet(Storage.STORAGE_KEYS.SPORCULAR, sporcular);
    }
  }

  // İlk ay aidatını işle
  const bursluMu = sporcu.odemeBilgileri?.burslu || false;
  if (!bursluMu && sporcu.odemeBilgileri && sporcu.odemeBilgileri.aylikUcret > 0) {
    const aylikUcret = sporcu.odemeBilgileri.aylikUcret;

    // 1. BORÇLANDIRMA: Aidat borcu kaydı oluştur (Pozitif tutar)
    Storage.aidatKaydet({
      sporcuId: sporcuId,
      tutar: aylikUcret, // Pozitif tutar (borç)
      tarih: kayitTarihi.toISOString(),
      donemAy: kayitAy,
      donemYil: kayitYil,
      aciklama: 'İlk Ay Aidat',
      tip: 'kayit',
      islem_turu: 'Aidat',
      odemeDurumu: 'Ödenmedi',
    } as any);

    // Tahsilat kontrolü: Eğer ilk aidat ödendi ise, tahsilat kaydı oluştur
    const kayitOdemeAlindiRadio = Helpers.$('#kayitOdemeAlindi') as HTMLInputElement | null;
    const kayitOdemeYontemiSelect = Helpers.$('#kayitOdemeYontemi') as HTMLSelectElement | null;
    const kayitOdemeDurumu =
      kayitOdemeAlindiRadio && kayitOdemeAlindiRadio.checked ? 'alindi' : 'alinmadi';
    if (kayitOdemeDurumu === 'alindi') {
      const odemeYontemi = kayitOdemeYontemiSelect?.value || 'Nakit';
      Storage.aidatKaydet({
        sporcuId: sporcuId,
        tutar: -aylikUcret, // Negatif tutar (tahsilat)
        tarih: kayitTarihi.toISOString(),
        donemAy: kayitAy,
        donemYil: kayitYil,
        aciklama: 'İlk Ay Aidat Tahsilatı',
        tip: 'kayit',
        islem_turu: 'Tahsilat',
        odemeDurumu: 'Ödendi',
        odemeTarihi: kayitTarihi.toISOString(),
        yontem: odemeYontemi as 'Nakit' | 'Banka / Havale',
      } as any);
    }
  }

  // Malzemeleri işle
  processMalzemeler(sporcuId, kayitTarihi, kayitAy, kayitYil);

  // Bakiye hesapla (log için)
  const sporcuAidatlari = Storage.sporcuAidatlari(sporcuId);
  const bakiye = sporcuAidatlari.reduce((toplam, aidat) => toplam + (aidat.tutar || 0), 0);
  console.log('💰 Sporcu bakiyesi hesaplandı:', {
    sporcuId,
    toplamIslem: sporcuAidatlari.length,
    bakiye: bakiye,
  });
}

/**
 * Güncelleme işlemlerini yap
 */
function processGuncelleme(sporcuId: number): void {
  const kayitOdemeAlindiRadio = Helpers.$('#kayitOdemeAlindi') as HTMLInputElement | null;
  const kayitOdemeYontemiSelect = Helpers.$('#kayitOdemeYontemi') as HTMLSelectElement | null;
  const kayitOdemeDurumu =
    kayitOdemeAlindiRadio && kayitOdemeAlindiRadio.checked ? 'alindi' : 'alinmadi';
  const mevcutAidatlari = Storage.sporcuAidatlari(sporcuId);

  // İlk ay aidat tahsilatını kontrol et
  const mevcutIlkAyTahsilati = mevcutAidatlari.find(
    a => a.tip === 'kayit' && a.islem_turu === 'Tahsilat' && a.tutar < 0
  );

  const mevcutOdemeAlindi = !!mevcutIlkAyTahsilati;

  // Ödeme durumu değiştiyse güncelle
  if (kayitOdemeDurumu === 'alindi' && !mevcutOdemeAlindi) {
    // Ödeme alındı olarak işaretlendi ama tahsilat kaydı yok, oluştur
    const ilkAyAidati = mevcutAidatlari.find(
      a => a.tip === 'kayit' && a.islem_turu === 'Aidat' && a.tutar > 0
    );

    if (ilkAyAidati) {
      const odemeYontemi = kayitOdemeYontemiSelect?.value || 'Nakit';
      Storage.aidatKaydet({
        sporcuId: sporcuId,
        tutar: -ilkAyAidati.tutar,
        tarih: new Date().toISOString(),
        donemAy: ilkAyAidati.donemAy,
        donemYil: ilkAyAidati.donemYil,
        aciklama: 'İlk Ay Aidat Tahsilatı',
        tip: 'kayit',
        islem_turu: 'Tahsilat',
        odemeDurumu: 'Ödendi',
        odemeTarihi: new Date().toISOString(),
        yontem: odemeYontemi as 'Nakit' | 'Banka / Havale',
      } as any);
    }
  } else if (kayitOdemeDurumu === 'alinmadi' && mevcutOdemeAlindi) {
    console.warn(
      '⚠️ Ödeme durumu "alınmadı" olarak değiştirildi, ancak mevcut tahsilat kayıtları korunuyor.'
    );
    Helpers.toast(
      'Ödeme durumu güncellendi. Mevcut tahsilat kayıtları korunuyor. ' +
        'Tahsilat kayıtlarını silmek için Aidat modülünü kullanın.',
      'info',
      SPORCU_CONSTANTS.TOAST_DURATION
    );
  }

  // Yeni eklenen malzemeleri işle
  if (malzemeler.length > 0) {
    const mevcutMalzemeBorclari = mevcutAidatlari.filter(
      a => a.tip === 'ekucret' && a.islem_turu === 'Malzeme' && a.tutar > 0
    );

    const mevcutMalzemeMap = new Map<string, number>();
    mevcutMalzemeBorclari.forEach(aidat => {
      const malzemeAd = aidat.aciklama?.replace(' Ücreti', '') || '';
      if (malzemeAd) {
        mevcutMalzemeMap.set(malzemeAd.toLowerCase(), aidat.tutar);
      }
    });

    const bugun = new Date();
    const { ay: buAy, yil: buYil } = Helpers.suAnkiDonem(bugun);

    malzemeler.forEach(malzeme => {
      if (malzeme.tutar > 0) {
        const mevcutMalzemeKey = malzeme.ad.toLowerCase();
        const mevcutTutar = mevcutMalzemeMap.get(mevcutMalzemeKey);

        if (!mevcutTutar || mevcutTutar !== malzeme.tutar) {
          Storage.aidatKaydet({
            sporcuId: sporcuId,
            tutar: malzeme.tutar,
            tarih: bugun.toISOString(),
            donemAy: buAy,
            donemYil: buYil,
            aciklama: `${malzeme.ad} Ücreti`,
            tip: 'ekucret',
            islem_turu: 'Malzeme',
            odemeDurumu: 'Ödenmedi',
          } as any);
        }
      }
    });
  }
}

/**
 * Malzemeleri işle ve kaydet
 */
function processMalzemeler(
  sporcuId: number,
  kayitTarihi: Date,
  kayitAy: number,
  kayitYil: number
): void {
  // Malzemeler listesini topla
  let malzemelerListesi: { ad: string; tutar: number; odendi?: boolean }[] = [];

  if (malzemeler.length > 0) {
    malzemelerListesi = malzemeler.map(m => ({
      ad: m.ad,
      tutar: m.tutar,
      odendi: m.odendi,
    }));
  } else {
    // Eski yöntem (geriye dönük uyumluluk)
    const esofmanUcretiInput = Helpers.$('#esofmanUcreti') as HTMLInputElement | null;
    const formaUcretiInput = Helpers.$('#formaUcreti') as HTMLInputElement | null;
    const yagmurlukUcretiInput = Helpers.$('#yagmurlukUcreti') as HTMLInputElement | null;
    const digerUcretInput = Helpers.$('#digerUcret') as HTMLInputElement | null;

    if (esofmanUcretiInput?.value) {
      malzemelerListesi.push({ ad: 'Eşofman', tutar: Helpers.paraCoz(esofmanUcretiInput.value) });
    }
    if (formaUcretiInput?.value) {
      malzemelerListesi.push({ ad: 'Forma', tutar: Helpers.paraCoz(formaUcretiInput.value) });
    }
    if (yagmurlukUcretiInput?.value) {
      malzemelerListesi.push({
        ad: 'Yağmurluk',
        tutar: Helpers.paraCoz(yagmurlukUcretiInput.value),
      });
    }
    if (digerUcretInput?.value) {
      malzemelerListesi.push({ ad: 'Diğer', tutar: Helpers.paraCoz(digerUcretInput.value) });
    }
  }

  // Malzemeleri kaydet
  const kayitOdemeYontemiSelect = Helpers.$('#kayitOdemeYontemi') as HTMLSelectElement | null;
  malzemelerListesi.forEach(malzeme => {
    if (malzeme.tutar > 0) {
      // Borç kaydı oluştur
      Storage.aidatKaydet({
        sporcuId: sporcuId,
        tutar: malzeme.tutar,
        tarih: kayitTarihi.toISOString(),
        donemAy: kayitAy,
        donemYil: kayitYil,
        aciklama: `${malzeme.ad} Ücreti`,
        tip: 'ekucret',
        islem_turu: 'Malzeme',
        odemeDurumu: 'Ödenmedi',
      } as any);

      // Ödendi ise tahsilat kaydı oluştur
      if (malzeme.odendi) {
        const odemeYontemi = kayitOdemeYontemiSelect?.value || 'Nakit';
        Storage.aidatKaydet({
          sporcuId: sporcuId,
          tutar: -malzeme.tutar,
          tarih: kayitTarihi.toISOString(),
          donemAy: kayitAy,
          donemYil: kayitYil,
          aciklama: `${malzeme.ad} Ücreti Tahsilatı`,
          tip: 'ekucret',
          islem_turu: 'Tahsilat',
          odemeDurumu: 'Ödendi',
          odemeTarihi: kayitTarihi.toISOString(),
          yontem: odemeYontemi as 'Nakit' | 'Banka / Havale',
        } as any);
      }
    }
  });
}

/**
 * Kayıt sonrası UI güncellemeleri
 */
function handleSaveSuccess(): void {
  const mesaj = guncellenecekId ? 'Sporcu güncellendi!' : 'Sporcu kaydedildi!';
  Helpers.toast(mesaj, 'success');

  formuTemizle();
  bransFiltresiDoldur();
  antrenmanGrubuSecenekleriniDoldur();

  if (window.App && typeof window.App.viewGoster === 'function') {
    window.App.viewGoster('sporcu-listesi');
  }

  setTimeout(() => {
    listeyiGuncelle();

    if (window.Dashboard && typeof window.Dashboard.guncelle === 'function') {
      window.Dashboard.guncelle();
    }

    if (window.Aidat && typeof window.Aidat.listeyiGuncelle === 'function') {
      window.Aidat.listeyiGuncelle();
    }

    if (window.Yoklama && typeof window.Yoklama.listeyiGuncelle === 'function') {
      window.Yoklama.listeyiGuncelle();
    }

    setTimeout(() => {
      listeyiGuncelle();
    }, SPORCU_CONSTANTS.LIST_UPDATE_DELAY);
  }, SPORCU_CONSTANTS.VIEW_UPDATE_DELAY);
}

// ============================================================================
// BÖLÜM 10: FORM HELPERS
// ============================================================================
// Bu bölümde form yardımcı fonksiyonları yer alır.
// - formuTemizle: Formu sıfırla
// - duzenle: Mevcut sporcuyu düzenleme moduna al
// ============================================================================

/**
 * Formu temizle
 */
export function formuTemizle(): void {
  const form = Helpers.$('#sporcuKayitForm') as HTMLFormElement | null;
  if (form) form.reset();

  guncellenecekId = null;

  const yasGrubuEl = Helpers.$('#autoYasGrubu');
  if (yasGrubuEl) yasGrubuEl.textContent = 'Hesaplanacak';

  const aylikUcretInput = Helpers.$('#aylikUcret') as HTMLInputElement | null;
  if (aylikUcretInput) {
    aylikUcretInput.disabled = false;
    aylikUcretInput.value = '';
  }

  const kaydetBtn = Helpers.$('#kaydetBtn');
  if (kaydetBtn) {
    kaydetBtn.innerHTML = '<i class="fa-solid fa-check"></i> Sporcuyu Kaydet';
    kaydetBtn.classList.remove('btn-warning');
    kaydetBtn.classList.add('btn-success');
  }

  // Tüm validation class'larını ve error mesajlarını temizle
  Validation.hatalariTemizle();
  if (form) {
    form.querySelectorAll('input, select, textarea').forEach(input => {
      input.classList.remove('validated-success', 'error');
      const errorEl = document.getElementById(input.id + 'Error');
      if (errorEl) {
        errorEl.textContent = '';
      }
    });
  }

  // Yeni alanları temizle
  const kayitOdemeAlindi = Helpers.$('#kayitOdemeAlindi') as HTMLInputElement | null;
  if (kayitOdemeAlindi) kayitOdemeAlindi.checked = true;

  // Eski malzeme alanlarını temizle (geriye dönük uyumluluk)
  ['esofmanUcreti', 'formaUcreti', 'yagmurlukUcreti', 'digerUcret'].forEach(id => {
    const input = Helpers.$('#' + id) as HTMLInputElement | null;
    if (input) input.value = '';
  });

  // Wizard state'i sıfırla
  wizardAdimGoster(1);

  // Malzemeler listesini temizle (önceden kalan malzemeleri kaldır)
  malzemeler = [];
  malzemeCounter = 0;

  // Malzeme listesini güncelle (wizard 2. adım)
  const malzemelerListesi = Helpers.$('#malzemelerListesi');
  if (malzemelerListesi) {
    malzemelerListesi.innerHTML = `
      <div class="empty-state-malzeme">
        <div class="empty-state-icon">
          <i class="fa-solid fa-box-open"></i>
        </div>
        <h4>Henüz malzeme eklenmedi</h4>
        <p>Malzeme eklemek için "Ekle" butonuna tıklayın</p>
      </div>
    `;
  }

  // Özet bölümündeki malzemeler toplamını da sıfırla
  const ozetMalzemeler = Helpers.$('#ozetMalzemeler');
  if (ozetMalzemeler) {
    ozetMalzemeler.textContent = '0,00 TL';
  }

  // Özet bölümünü güncelle (malzemeler temizlendikten sonra)
  ozetOlustur();

  // Finansal özeti güncelle (malzemeler temizlendikten sonra)
  finansalOzetHesapla();

  // Burs durumunu varsayılan yap
  const bursStandartRadio = Helpers.$('#bursDurumuStandart') as HTMLInputElement | null;
  if (bursStandartRadio) bursStandartRadio.checked = true;

  // Aylık ücret alanını göster
  const aylikUcretGroup = Helpers.$('#aylikUcretGroup') as HTMLElement | null;
  if (aylikUcretGroup) aylikUcretGroup.style.display = 'block';

  antrenmanGrubuSecenekleriniDoldur('');
}

/**
 * Sporcu düzenle
 * @param id - Sporcu ID
 */
export function duzenle(id: number): void {
  const sporcu = Storage.sporcuBul(id);
  if (!sporcu) {
    Helpers.toast('Sporcu bulunamadı!', 'error');
    return;
  }

  guncellenecekId = id;

  // Formu doldur
  const adSoyadInput = Helpers.$('#adSoyad') as HTMLInputElement | null;
  const tcKimlikInput = Helpers.$('#tcKimlik') as HTMLInputElement | null;
  const dogumTarihiInput = Helpers.$('#dogumTarihi') as HTMLInputElement | null;
  const kayitTarihiInput = Helpers.$('#kayitTarihi') as HTMLInputElement | null;
  const cinsiyetSelect = Helpers.$('#cinsiyet') as HTMLSelectElement | null;
  const bransSelect = Helpers.$('#brans') as HTMLSelectElement | null;
  const formaNoInput = Helpers.$('#formaNo') as HTMLInputElement | null;
  const telefonInput = Helpers.$('#telefon') as HTMLInputElement | null;
  const emailInput = Helpers.$('#email') as HTMLInputElement | null;
  const veli1AdInput = Helpers.$('#veli1Ad') as HTMLInputElement | null;
  const veli1TelInput = Helpers.$('#veli1Tel') as HTMLInputElement | null;
  const veli1YakinlikSelect = Helpers.$('#veli1Yakinlik') as HTMLSelectElement | null;
  const veli2AdInput = Helpers.$('#veli2Ad') as HTMLInputElement | null;
  const veli2TelInput = Helpers.$('#veli2Tel') as HTMLInputElement | null;
  const boyInput = Helpers.$('#boy') as HTMLInputElement | null;
  const kiloInput = Helpers.$('#kilo') as HTMLInputElement | null;
  const bedenSelect = Helpers.$('#beden') as HTMLSelectElement | null;
  const ayakNoInput = Helpers.$('#ayakNo') as HTMLInputElement | null;
  const kanGrubuSelect = Helpers.$('#kanGrubu') as HTMLSelectElement | null;
  const alerjilerTextarea = Helpers.$('#alerjiler') as HTMLTextAreaElement | null;
  const kronikHastalikTextarea = Helpers.$('#kronikHastalik') as HTMLTextAreaElement | null;

  if (adSoyadInput) adSoyadInput.value = sporcu.temelBilgiler?.adSoyad || '';
  if (tcKimlikInput) tcKimlikInput.value = sporcu.temelBilgiler?.tcKimlik || '';
  if (dogumTarihiInput) dogumTarihiInput.value = sporcu.temelBilgiler?.dogumTarihi || '';
  // Kayıt tarihi - ISO string'den date input formatına çevir (YYYY-MM-DD)
  if (kayitTarihiInput && sporcu.kayitTarihi) {
    const kayitTarihi = new Date(sporcu.kayitTarihi);
    if (!isNaN(kayitTarihi.getTime())) {
      const dateStr = kayitTarihi.toISOString().split('T')[0];
      if (dateStr) {
        kayitTarihiInput.value = dateStr;
      }
    }
  }
  if (cinsiyetSelect) cinsiyetSelect.value = sporcu.temelBilgiler?.cinsiyet || '';
  if (bransSelect) bransSelect.value = sporcu.sporBilgileri?.brans || '';
  if (formaNoInput) formaNoInput.value = sporcu.sporBilgileri?.formaNo || '';
  if (telefonInput) telefonInput.value = sporcu.iletisim?.telefon || '';
  if (emailInput) emailInput.value = sporcu.iletisim?.email || '';
  if (veli1AdInput) veli1AdInput.value = sporcu.veliBilgileri?.veli1?.ad || '';
  if (veli1TelInput) veli1TelInput.value = sporcu.veliBilgileri?.veli1?.telefon || '';
  if (veli1YakinlikSelect) veli1YakinlikSelect.value = sporcu.veliBilgileri?.veli1?.yakinlik || '';
  if (veli2AdInput) veli2AdInput.value = sporcu.veliBilgileri?.veli2?.ad || '';
  if (veli2TelInput) veli2TelInput.value = sporcu.veliBilgileri?.veli2?.telefon || '';
  if (boyInput) boyInput.value = sporcu.fiziksel?.boy || '';
  if (kiloInput) kiloInput.value = sporcu.fiziksel?.kilo || '';
  if (bedenSelect) bedenSelect.value = sporcu.fiziksel?.beden || '';
  if (ayakNoInput) ayakNoInput.value = sporcu.fiziksel?.ayakNo || '';
  if (kanGrubuSelect) kanGrubuSelect.value = sporcu.saglik?.kanGrubu || '';
  if (alerjilerTextarea) alerjilerTextarea.value = sporcu.saglik?.alerjiler || '';
  if (kronikHastalikTextarea) kronikHastalikTextarea.value = sporcu.saglik?.kronikHastalik || '';
  antrenmanGrubuSecenekleriniDoldur(sporcu.antrenmanGrubuId || '');

  // Yaş grubu
  const yasGrubuEl = Helpers.$('#autoYasGrubu');
  if (yasGrubuEl) {
    yasGrubuEl.textContent = sporcu.tffGruplari?.anaGrup || 'Hesaplanacak';
  }

  // Finansal bilgiler
  const aylikUcret = sporcu.odemeBilgileri?.aylikUcret || 0;
  const burslu = sporcu.odemeBilgileri?.burslu || false;

  const aylikUcretInput = Helpers.$('#aylikUcret') as HTMLInputElement | null;
  const bursDurumuSelect = Helpers.$('#bursDurumu') as HTMLSelectElement | null;
  if (aylikUcretInput) {
    aylikUcretInput.value = Helpers.paraFormat(aylikUcret);
    aylikUcretInput.disabled = burslu;
  }
  if (bursDurumuSelect) {
    bursDurumuSelect.value = burslu ? 'burslu' : 'standart';
  }

  // Belge bilgileri
  const saglikRaporuTarihInput = Helpers.$('#saglikRaporuTarih') as HTMLInputElement | null;
  const lisansTarihInput = Helpers.$('#lisansTarih') as HTMLInputElement | null;
  const lisansNoInput = Helpers.$('#lisansNo') as HTMLInputElement | null;
  const sigortaTarihInput = Helpers.$('#sigortaTarih') as HTMLInputElement | null;
  if (saglikRaporuTarihInput) saglikRaporuTarihInput.value = sporcu.belgeler?.saglikRaporu || '';
  if (lisansTarihInput) lisansTarihInput.value = sporcu.belgeler?.lisans || '';
  if (lisansNoInput) lisansNoInput.value = sporcu.belgeler?.lisansNo || '';
  if (sigortaTarihInput) sigortaTarihInput.value = sporcu.belgeler?.sigorta || '';

  // Kayıt ödeme durumu (wizard 3. adım)
  const kayitOdemeAlindiRadio = Helpers.$('#kayitOdemeAlindi') as HTMLInputElement | null;
  const kayitOdemeAlinmadiRadio = Helpers.$('#kayitOdemeAlinmadi') as HTMLInputElement | null;
  const kayitOdemeYontemiSelect = Helpers.$('#kayitOdemeYontemi') as HTMLSelectElement | null;
  const kayitOdemeYontemiGroup = Helpers.$('#kayitOdemeYontemiGroup') as HTMLElement | null;

  // Sporcu kayıt ödeme durumunu kontrol et (aidat kayıtlarından)
  // İlk ay aidat tahsilatı varsa ödeme alındı sayılır
  const sporcuAidatlari = Storage.sporcuAidatlari(id);
  const ilkAyTahsilati = sporcuAidatlari.find(
    a => a.tip === 'kayit' && a.islem_turu === 'Tahsilat' && a.tutar < 0 // Negatif tutar = tahsilat
  );

  const odemeAlindi = !!ilkAyTahsilati;

  if (kayitOdemeAlindiRadio && kayitOdemeAlinmadiRadio) {
    if (odemeAlindi) {
      kayitOdemeAlindiRadio.checked = true;
      kayitOdemeAlinmadiRadio.checked = false;
      if (kayitOdemeYontemiGroup) {
        kayitOdemeYontemiGroup.style.display = 'block';
      }
      if (kayitOdemeYontemiSelect && ilkAyTahsilati?.yontem) {
        kayitOdemeYontemiSelect.value = ilkAyTahsilati.yontem;
      }
    } else {
      kayitOdemeAlindiRadio.checked = false;
      kayitOdemeAlinmadiRadio.checked = true;
      if (kayitOdemeYontemiGroup) {
        kayitOdemeYontemiGroup.style.display = 'none';
      }
    }
  }

  // NOT: Malzemeler viewGoster içinde formuTemizle çağrıldığı için temizlenecek
  // Bu yüzden malzemeleri setTimeout içinde yeniden yükleyeceğiz (aşağıda)

  // Buton metnini değiştir
  const kaydetBtn = Helpers.$('#kaydetBtn');
  if (kaydetBtn) {
    kaydetBtn.innerHTML = '<i class="fa-solid fa-rotate"></i> Sporcuyu Güncelle';
    kaydetBtn.classList.remove('btn-success');
    kaydetBtn.classList.add('btn-warning');
  }

  // Forma git - ÖNCE view'ı göster, SONRA formu doldur
  // Çünkü viewGoster form temizleme yapıyor, bu yüzden form doldurma işlemi sonra yapılmalı
  if (window.App) {
    window.App.viewGoster('sporcu-kayit');

    // Form doldurma işlemini viewGoster'dan sonra yap (form temizleme işlemi tamamlandıktan sonra)
    // Kısa bir gecikme ile DOM'un hazır olmasını garanti et
    setTimeout(() => {
      // ÖNEMLİ: viewGoster içinde formuTemizle() çağrılıyor ve guncellenecekId'yi null yapıyor
      // Bu yüzden burada tekrar set etmeliyiz
      guncellenecekId = id;
      // Formu tekrar doldur (viewGoster form temizledi, bu yüzden tekrar doldurmalıyız)
      if (adSoyadInput) adSoyadInput.value = sporcu.temelBilgiler?.adSoyad || '';
      if (tcKimlikInput) tcKimlikInput.value = sporcu.temelBilgiler?.tcKimlik || '';
      if (dogumTarihiInput) dogumTarihiInput.value = sporcu.temelBilgiler?.dogumTarihi || '';
      // Kayıt tarihi - ISO string'den date input formatına çevir (YYYY-MM-DD)
      if (kayitTarihiInput && sporcu.kayitTarihi) {
        const kayitTarihi = new Date(sporcu.kayitTarihi);
        if (!isNaN(kayitTarihi.getTime())) {
          const dateStr = kayitTarihi.toISOString().split('T')[0];
          if (dateStr) {
            kayitTarihiInput.value = dateStr;
          }
        }
      }
      if (cinsiyetSelect) cinsiyetSelect.value = sporcu.temelBilgiler?.cinsiyet || '';
      if (bransSelect) bransSelect.value = sporcu.sporBilgileri?.brans || '';
      if (formaNoInput) formaNoInput.value = sporcu.sporBilgileri?.formaNo || '';
      if (telefonInput) telefonInput.value = sporcu.iletisim?.telefon || '';
      if (emailInput) emailInput.value = sporcu.iletisim?.email || '';
      if (veli1AdInput) veli1AdInput.value = sporcu.veliBilgileri?.veli1?.ad || '';
      if (veli1TelInput) veli1TelInput.value = sporcu.veliBilgileri?.veli1?.telefon || '';
      if (veli1YakinlikSelect)
        veli1YakinlikSelect.value = sporcu.veliBilgileri?.veli1?.yakinlik || '';
      if (veli2AdInput) veli2AdInput.value = sporcu.veliBilgileri?.veli2?.ad || '';
      if (veli2TelInput) veli2TelInput.value = sporcu.veliBilgileri?.veli2?.telefon || '';
      if (boyInput) boyInput.value = sporcu.fiziksel?.boy || '';
      if (kiloInput) kiloInput.value = sporcu.fiziksel?.kilo || '';
      if (bedenSelect) bedenSelect.value = sporcu.fiziksel?.beden || '';
      if (ayakNoInput) ayakNoInput.value = sporcu.fiziksel?.ayakNo || '';
      if (kanGrubuSelect) kanGrubuSelect.value = sporcu.saglik?.kanGrubu || '';
      if (alerjilerTextarea) alerjilerTextarea.value = sporcu.saglik?.alerjiler || '';
      if (kronikHastalikTextarea)
        kronikHastalikTextarea.value = sporcu.saglik?.kronikHastalik || '';
      antrenmanGrubuSecenekleriniDoldur(sporcu.antrenmanGrubuId || '');

      // Yaş grubu
      if (yasGrubuEl) {
        yasGrubuEl.textContent = sporcu.tffGruplari?.anaGrup || 'Hesaplanacak';
      }

      // Finansal bilgiler
      if (aylikUcretInput) {
        aylikUcretInput.value = Helpers.paraFormat(aylikUcret);
        aylikUcretInput.disabled = burslu;
      }
      if (bursDurumuSelect) {
        bursDurumuSelect.value = burslu ? 'burslu' : 'standart';
      }

      // Belge bilgileri
      if (saglikRaporuTarihInput)
        saglikRaporuTarihInput.value = sporcu.belgeler?.saglikRaporu || '';
      if (lisansTarihInput) lisansTarihInput.value = sporcu.belgeler?.lisans || '';
      if (lisansNoInput) lisansNoInput.value = sporcu.belgeler?.lisansNo || '';
      if (sigortaTarihInput) sigortaTarihInput.value = sporcu.belgeler?.sigorta || '';

      // Kayıt ödeme durumu
      if (kayitOdemeAlindiRadio && kayitOdemeAlinmadiRadio) {
        if (odemeAlindi) {
          kayitOdemeAlindiRadio.checked = true;
          kayitOdemeAlinmadiRadio.checked = false;
          if (kayitOdemeYontemiGroup) {
            kayitOdemeYontemiGroup.style.display = 'block';
          }
          if (kayitOdemeYontemiSelect && ilkAyTahsilati?.yontem) {
            kayitOdemeYontemiSelect.value = ilkAyTahsilati.yontem;
          }
        } else {
          kayitOdemeAlindiRadio.checked = false;
          kayitOdemeAlinmadiRadio.checked = true;
          if (kayitOdemeYontemiGroup) {
            kayitOdemeYontemiGroup.style.display = 'none';
          }
        }
      }

      // Malzemeleri yeniden yükle (viewGoster içinde formuTemizle çağrıldığı için malzemeler temizlendi)
      // Mevcut malzemeleri aidat kayıtlarından yükle
      const guncellenmisAidatlari = Storage.sporcuAidatlari(id);
      const guncellenmisMalzemeBorclari = guncellenmisAidatlari.filter(
        a => a.tip === 'ekucret' && a.islem_turu === 'Malzeme' && a.tutar > 0 // Pozitif tutar = borç
      );

      // Malzemeler listesini temizle ve mevcut malzemeleri yükle
      malzemeler = [];
      malzemeCounter = 0;

      guncellenmisMalzemeBorclari.forEach(aidat => {
        // Malzeme adını aciklama'dan al (örn: "Eşofman Ücreti" -> "Eşofman")
        const malzemeAd = aidat.aciklama?.replace(' Ücreti', '') || 'Malzeme';

        // Bu malzeme için tahsilat var mı kontrol et
        const malzemeTahsilati = guncellenmisAidatlari.find(
          a =>
            a.tip === 'ekucret' &&
            a.islem_turu === 'Tahsilat' &&
            a.aciklama?.includes(malzemeAd) &&
            a.tutar < 0
        );

        const odendi = !!malzemeTahsilati;

        malzemeler.push({
          id: `malzeme_${++malzemeCounter}_${Date.now()}`,
          ad: malzemeAd,
          tutar: aidat.tutar || 0,
          odendi: odendi,
        });
      });

      // Malzeme listesini UI'da güncelle
      const malzemelerListesiEl = Helpers.$('#malzemelerListesi');
      if (malzemelerListesiEl) {
        if (malzemeler.length === 0) {
          malzemelerListesiEl.innerHTML = `
            <div class="empty-state-malzeme">
              <div class="empty-state-icon">
                <i class="fa-solid fa-box-open"></i>
              </div>
              <h4>Henüz malzeme eklenmedi</h4>
              <p>Malzeme eklemek için "Ekle" butonuna tıklayın</p>
            </div>
          `;
        } else {
          malzemelerListesiEl.innerHTML = malzemeler
            .map(m => {
              const ad = Helpers.escapeHtml(m.ad);
              const tutar = Helpers.paraFormat(m.tutar);
              return `
              <div class="malzeme-item">
                <div class="malzeme-item-icon">
                  <i class="fa-solid fa-box"></i>
                </div>
                <div class="malzeme-item-content">
                  <div class="malzeme-item-name">${ad}</div>
                  <div class="malzeme-item-amount">${tutar} TL</div>
                </div>
                <button type="button" class="btn btn-small btn-icon btn-danger malzeme-sil-btn" data-malzeme-id="${m.id}" title="Sil">
                  <i class="fa-solid fa-trash"></i>
                </button>
              </div>
            `;
            })
            .join('');
        }
      }

      // Finansal özeti güncelle (malzemeler yüklendikten sonra)
      finansalOzetHesapla();

      // Buton metnini tekrar ayarla
      if (kaydetBtn) {
        kaydetBtn.innerHTML = '<i class="fa-solid fa-rotate"></i> Sporcuyu Güncelle';
        kaydetBtn.classList.remove('btn-success');
        kaydetBtn.classList.add('btn-warning');
      }
    }, 100);
  }
}

/**
 * Sporcuyu arşivle (ayrıldı); aidat ve geçmiş kayıtlar korunur.
 * @param id - Sporcu ID
 */
export function sil(id: number): void {
  const sporcu = Storage.sporcuBul(id);
  if (!sporcu) return;
  if (sporcu.durum === 'Ayrıldı') {
    Helpers.toast('Bu sporcu zaten arşivlenmiş (ayrıldı).', 'info');
    return;
  }

  const adSoyad = sporcu.temelBilgiler?.adSoyad || 'Sporcu';
  if (
    !Helpers.onay(
      `"${adSoyad}" kaydı arşivlenecek (ayrıldı).\n\nAidat ve tahsilat geçmişi silinmez; sporcu varsayılan listeden çıkar.\n\nDevam edilsin mi?`
    )
  ) {
    return;
  }

  const kendiMi = Helpers.onay(
    `Ayrılma kaynağı:\n\nTamam = Öğrenci / veli kendi isteğiyle\nİptal = Okul / yönetici kaydı`
  );
  const kaynak: 'kendi' | 'yonetici' = kendiMi ? 'kendi' : 'yonetici';

  Storage.sporcuAyrildi(id, kaynak);
  Helpers.toast(
    `Sporcu arşivlendi (${kendiMi ? 'kendi isteği' : 'yönetici'}). Muhasebe kayıtları korundu.`,
    'success'
  );

  listeyiGuncelle();
  bransFiltresiDoldur();
  antrenmanGrubuSecenekleriniDoldur();

  if (window.Dashboard && typeof window.Dashboard.guncelle === 'function') {
    window.Dashboard.guncelle();
  }
  if (window.Aidat && typeof window.Aidat.listeyiGuncelle === 'function') {
    window.Aidat.listeyiGuncelle();
  }
  if (window.Yoklama) window.Yoklama.listeyiGuncelle?.();
}

/**
 * Arşivden (Ayrıldı) tekrar operasyonel listeye al — aidat geçmişi korunur.
 */
export function tekrarAktifEt(id: number): void {
  const sporcu = Storage.sporcuBul(id);
  if (!sporcu) return;
  if (sporcu.durum !== 'Ayrıldı') {
    Helpers.toast('Bu sporcu arşivlenmemiş; işlem gerekmiyor.', 'info');
    return;
  }
  const ad = sporcu.temelBilgiler?.adSoyad || 'Sporcu';
  if (
    !Helpers.onay(
      `"${ad}" tekrar aktif sporcu listesine alınsın mı?\n\n` +
        `Ödeme günü, bugünün günü olarak ayarlanır; bu ay için henüz aidat borcu yoksa (burslu değilse) o aya borç yazılır. Geçmiş kayıtlar silinmez.`
    )
  ) {
    return;
  }
  Storage.sporcuTekrarAktifEt(id);
  Helpers.toast('Sporcu tekrar aktif listeye alındı.', 'success');
  listeyiGuncelle();
  bransFiltresiDoldur();
  antrenmanGrubuSecenekleriniDoldur();
  if (window.Dashboard?.guncelle) window.Dashboard.guncelle();
  if (window.Aidat?.listeyiGuncelle) window.Aidat.listeyiGuncelle();
  if (window.Yoklama?.listeyiGuncelle) window.Yoklama.listeyiGuncelle();
}

// ============================================================================
// BÖLÜM 12: WIZARD
// ============================================================================
// Bu bölümde 3 adımlı form wizard'ı işlemleri yer alır.
// Adım 1: Temel Bilgiler
// Adım 2: Finansal Bilgiler
// Adım 3: Özet & Onay
// ============================================================================

/**
 * Wizard mantığını başlat
 */
function wizardInit(): void {
  const ileriBtn = Helpers.$('#wizardIleriBtn') as HTMLButtonElement | null;
  const geriBtn = Helpers.$('#wizardGeriBtn') as HTMLButtonElement | null;

  if (ileriBtn) {
    ileriBtn.addEventListener('click', wizardIleri);
  }

  if (geriBtn) {
    geriBtn.addEventListener('click', wizardGeri);
  }

  // İlk adımı göster
  wizardAdimGoster(1);

  // Burs durumu değiştiğinde aylık ücret alanını göster/gizle
  const bursStandartRadio = Helpers.$('#bursDurumuStandart') as HTMLInputElement | null;
  const bursBursluRadio = Helpers.$('#bursDurumuBurslu') as HTMLInputElement | null;
  const aylikUcretGroup = Helpers.$('#aylikUcretGroup') as HTMLElement | null;

  if (bursStandartRadio && bursBursluRadio && aylikUcretGroup) {
    bursStandartRadio.addEventListener('change', () => {
      aylikUcretGroup.style.display = 'block';
      const aylikUcretInput = Helpers.$('#aylikUcret') as HTMLInputElement | null;
      if (aylikUcretInput) {
        aylikUcretInput.required = true;
        aylikUcretInput.removeAttribute('disabled');
      }
      finansalOzetHesapla();
    });

    bursBursluRadio.addEventListener('change', () => {
      aylikUcretGroup.style.display = 'none';
      const aylikUcretInput = Helpers.$('#aylikUcret') as HTMLInputElement | null;
      if (aylikUcretInput) {
        aylikUcretInput.value = '0';
        aylikUcretInput.required = false;
        aylikUcretInput.removeAttribute('required');
      }
      finansalOzetHesapla();
    });
  }

  // İlk ay ödeme durumu değiştiğinde ödeme yöntemi alanını göster/gizle
  const kayitOdemeAlindiRadio = Helpers.$('#kayitOdemeAlindi') as HTMLInputElement | null;
  const kayitOdemeAlinmadiRadio = Helpers.$('#kayitOdemeAlinmadi') as HTMLInputElement | null;
  const kayitOdemeYontemiGroup = Helpers.$('#kayitOdemeYontemiGroup') as HTMLElement | null;

  if (kayitOdemeAlindiRadio && kayitOdemeAlinmadiRadio && kayitOdemeYontemiGroup) {
    kayitOdemeAlindiRadio.addEventListener('change', () => {
      kayitOdemeYontemiGroup.style.display = 'block';
      const kayitOdemeYontemiSelect = Helpers.$('#kayitOdemeYontemi') as HTMLSelectElement | null;
      if (kayitOdemeYontemiSelect) kayitOdemeYontemiSelect.required = true;
      finansalOzetHesapla();
    });

    kayitOdemeAlinmadiRadio.addEventListener('change', () => {
      kayitOdemeYontemiGroup.style.display = 'none';
      const kayitOdemeYontemiSelect = Helpers.$('#kayitOdemeYontemi') as HTMLSelectElement | null;
      if (kayitOdemeYontemiSelect) {
        kayitOdemeYontemiSelect.required = false;
        kayitOdemeYontemiSelect.removeAttribute('required');
      }
      finansalOzetHesapla();
    });
  }

  // Aylık ücret ve malzeme değişikliklerinde özeti güncelle
  const aylikUcretInput = Helpers.$('#aylikUcret') as HTMLInputElement | null;
  if (aylikUcretInput) {
    aylikUcretInput.addEventListener('input', () => {
      Helpers.paraFormatInput(aylikUcretInput);
      finansalOzetHesapla();
    });
  }
}

/**
 * Wizard adım göster
 */
function wizardAdimGoster(step: number): void {
  currentWizardStep = step;

  // Tüm adım içeriklerini gizle
  const stepContents = document.querySelectorAll('.wizard-step-content');
  stepContents.forEach(content => {
    content.classList.remove('active');
  });

  // Tüm stepper adımlarını güncelle
  const steps = document.querySelectorAll('.wizard-step');
  steps.forEach((stepEl, index) => {
    const stepNum = index + 1;
    if (stepNum < step) {
      stepEl.classList.remove('active');
      stepEl.classList.add('completed');
    } else if (stepNum === step) {
      stepEl.classList.remove('completed');
      stepEl.classList.add('active');
    } else {
      stepEl.classList.remove('active', 'completed');
    }
  });

  // Aktif adım içeriğini göster
  const activeStep = document.querySelector(`[data-wizard-step="${step}"]`);
  if (activeStep) {
    activeStep.classList.add('active');
  }

  // Butonları güncelle
  const geriBtn = Helpers.$('#wizardGeriBtn') as HTMLButtonElement | null;
  const ileriBtn = Helpers.$('#wizardIleriBtn') as HTMLButtonElement | null;
  const kaydetBtn = Helpers.$('#kaydetBtn') as HTMLButtonElement | null;

  if (geriBtn) {
    geriBtn.style.display = step > 1 ? 'block' : 'none';
  }

  if (ileriBtn && kaydetBtn) {
    if (step === totalWizardSteps) {
      ileriBtn.style.display = 'none';
      kaydetBtn.style.display = 'block';
      ozetOlustur(); // Özet sayfasını oluştur
    } else {
      ileriBtn.style.display = 'block';
      kaydetBtn.style.display = 'none';
    }
  }
}

/**
 * Wizard ileri
 */
function wizardIleri(): void {
  // Mevcut adımı validate et
  if (!wizardAdimValidate(currentWizardStep)) {
    return;
  }

  if (currentWizardStep < totalWizardSteps) {
    wizardAdimGoster(currentWizardStep + 1);

    // Adım 2'ye geçildiğinde özeti hesapla
    if (currentWizardStep === 2) {
      finansalOzetHesapla();
    }
  }
}

/**
 * Wizard geri
 */
function wizardGeri(): void {
  if (currentWizardStep > 1) {
    wizardAdimGoster(currentWizardStep - 1);
  }
}

/**
 * Wizard adım validasyonu
 */
function wizardAdimValidate(step: number): boolean {
  let isValid = true;

  if (step === 1) {
    // Adım 1: Temel bilgiler validasyonu
    const requiredFields = [
      '#adSoyad',
      '#tcKimlik',
      '#dogumTarihi',
      '#cinsiyet',
      '#telefon',
      '#veli1Ad',
      '#veli1Tel',
      '#veli1Yakinlik',
      '#brans',
    ];

    requiredFields.forEach(selector => {
      const field = Helpers.$(selector) as HTMLInputElement | HTMLSelectElement | null;
      if (field) {
        const value = field.value.trim();
        if (!value) {
          field.classList.add('error');
          isValid = false;
        } else {
          field.classList.remove('error');
        }
      }
    });

    if (!isValid) {
      Helpers.toast('Lütfen zorunlu alanları doldurun.', 'error');
    }
  } else if (step === 2) {
    // Adım 2: Finansal bilgiler validasyonu
    const bursBursluRadio = Helpers.$('#bursDurumuBurslu') as HTMLInputElement | null;
    const aylikUcretInput = Helpers.$('#aylikUcret') as HTMLInputElement | null;
    const kayitOdemeAlindiRadio = Helpers.$('#kayitOdemeAlindi') as HTMLInputElement | null;
    const kayitOdemeYontemiSelect = Helpers.$('#kayitOdemeYontemi') as HTMLSelectElement | null;

    // Burslu değilse aylık ücret zorunlu
    if (bursBursluRadio && !bursBursluRadio.checked && aylikUcretInput) {
      const aylikUcret = Helpers.paraCoz(aylikUcretInput.value);
      if (!aylikUcret || aylikUcret <= 0) {
        aylikUcretInput.classList.add('error');
        Helpers.toast('Aylık ücret girilmelidir.', 'error');
        isValid = false;
      } else {
        aylikUcretInput.classList.remove('error');
      }
    }

    // İlk ay ödeme alındıysa ödeme yöntemi zorunlu
    if (kayitOdemeAlindiRadio && kayitOdemeAlindiRadio.checked && kayitOdemeYontemiSelect) {
      if (!kayitOdemeYontemiSelect.value) {
        kayitOdemeYontemiSelect.classList.add('error');
        Helpers.toast('Ödeme yöntemi seçilmelidir.', 'error');
        isValid = false;
      } else {
        kayitOdemeYontemiSelect.classList.remove('error');
      }
    }
  }

  return isValid;
}

/**
 * Sporcu durumunu değiştir
 * @param id - Sporcu ID
 */
export function durumDegistir(id: number): void {
  const sporcu = Storage.sporcuBul(id);
  if (!sporcu) return;
  if (sporcu.durum === 'Ayrıldı') {
    Helpers.toast('Arşivlenmiş sporcunun durumu buradan değiştirilemez.', 'info');
    return;
  }
  sporcu.durum = sporcu.durum === 'Aktif' ? 'Pasif' : 'Aktif';
  Storage.sporcuKaydet(sporcu);

  const yeniDurum = sporcu.durum;
  Helpers.toast(`Sporcu durumu "${yeniDurum}" olarak güncellendi.`, 'success');

  listeyiGuncelle();
  if (window.Dashboard) window.Dashboard.guncelle();
}

/**
 * Sporcuları sırala
 */
function sortSporcular(sporcular: Sporcu[], sortConfig: SortConfig): Sporcu[] {
  if (!sortConfig.field) {
    return sporcular;
  }

  return [...sporcular].sort((a, b) => {
    let aVal: string | number = '';
    let bVal: string | number = '';

    switch (sortConfig.field) {
      case 'adSoyad':
        aVal = (a.temelBilgiler?.adSoyad || '').toLowerCase();
        bVal = (b.temelBilgiler?.adSoyad || '').toLowerCase();
        break;
      case 'tcKimlik':
        aVal = a.temelBilgiler?.tcKimlik || '';
        bVal = b.temelBilgiler?.tcKimlik || '';
        break;
      case 'brans':
        aVal = (a.sporBilgileri?.brans || '').toLowerCase();
        bVal = (b.sporBilgileri?.brans || '').toLowerCase();
        break;
      case 'yasGrubu':
        aVal = (a.tffGruplari?.anaGrup || '').toLowerCase();
        bVal = (b.tffGruplari?.anaGrup || '').toLowerCase();
        break;
      case 'telefon':
        aVal = a.iletisim?.telefon || '';
        bVal = b.iletisim?.telefon || '';
        break;
      case 'aylikUcret':
        aVal = a.odemeBilgileri?.aylikUcret || 0;
        bVal = b.odemeBilgileri?.aylikUcret || 0;
        break;
      case 'durum':
        aVal = (a.durum || '').toLowerCase();
        bVal = (b.durum || '').toLowerCase();
        break;
      default:
        return 0;
    }

    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });
}

/**
 * Sporcu kartı oluştur (Yoklama modülü gibi kart görünümü)
 */
function createSporcuCard(
  sporcu: Sporcu,
  duzenleyebilir: boolean,
  silebilir: boolean
): HTMLDivElement {
  const item = document.createElement('div');

  // XSS koruması için tüm değerleri escape et
  const adSoyad = Helpers.escapeHtml(sporcu.temelBilgiler?.adSoyad || '-');
  const brans = Helpers.escapeHtml(sporcu.sporBilgileri?.brans || '-');
  const yasGrubu = Helpers.escapeHtml(sporcu.tffGruplari?.anaGrup || '-');
  const antrenmanAd = sporcuAntrenmanAdi(sporcu);
  const antrenmanEtiket = antrenmanAd ? Helpers.escapeHtml(antrenmanAd) : 'Antrenman yok';

  const ayrildi = sporcu.durum === 'Ayrıldı';
  const kaynakEtiket =
    sporcu.silinmeBilgisi?.kaynak === 'kendi'
      ? 'Kendi isteği'
      : sporcu.silinmeBilgisi?.kaynak === 'yonetici'
        ? 'Yönetici'
        : '';

  // Durum için class (yoklama modülü gibi)
  const durumClass = sporcu.durum === 'Aktif' ? 'aktif' : 'pasif';
  const durumText =
    sporcu.durum === 'Aktif'
      ? 'AKTİF'
      : ayrildi
        ? `AYRILDI${kaynakEtiket ? ' · ' + kaynakEtiket : ''}`
        : 'PASİF';
  const durumBadgeClass = sporcu.durum === 'Aktif' ? 'devam-var' : 'devam-yok';

  // Durum butonu için class ve icon
  const durumButtonClass = sporcu.durum === 'Aktif' ? 'btn-warning' : 'btn-success';
  const durumIcon = sporcu.durum === 'Aktif' ? 'fa-pause' : 'fa-play';
  const durumTitle = sporcu.durum === 'Aktif' ? 'Pasif Yap' : 'Aktif Yap';

  // Kart class'ı (yoklama modülü gibi); güncel dönem aidat borcu → aidat ile aynı nabız
  const borcPulse = sporcuGuncelDonemAidatBorclu(sporcu) ? ' sporcu-item-debt-pulse' : '';
  item.className = `sporcu-item ${durumClass}${ayrildi ? ' ayrildi' : ''}${borcPulse}`.trim();

  // HTML oluştur - Yoklama modülü gibi kart görünümü
  item.innerHTML = `
    <div class="sporcu-info">
      <strong class="sporcu-adi">${adSoyad}</strong>
      <span class="grup-badge" title="TFF yaş grubu · Branş · Kulüp antrenman grubu">${yasGrubu} · ${brans} · ${antrenmanEtiket}</span>
      <span class="devam-durum ${durumBadgeClass}">
        ${durumText}
      </span>
    </div>
    <div class="sporcu-buttons">
        ${
          duzenleyebilir
            ? `
            <button class="btn btn-small btn-icon btn-warning" data-action="edit" data-sporcu-id="${sporcu.id}" title="Düzenle">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>
            ${
              ayrildi
                ? `
            <button class="btn btn-small btn-icon btn-success" data-action="reactivate" data-sporcu-id="${sporcu.id}" title="Tekrar aktif listeye al">
              <i class="fa-solid fa-user-check"></i>
            </button>
            `
                : `
            <button class="btn btn-small btn-icon ${durumButtonClass}" data-action="toggle-status" data-sporcu-id="${sporcu.id}" title="${durumTitle}">
              <i class="fa-solid ${durumIcon}"></i>
            </button>
            `
            }
          <button class="btn btn-small btn-icon btn-info btn-rapor" data-action="rapor" data-sporcu-id="${sporcu.id}" title="Rapor">
            <i class="fa-solid fa-chart-line"></i>
          </button>
          `
            : ''
        }
        ${
          silebilir && !ayrildi
            ? `
            <button class="btn btn-small btn-icon btn-danger" data-action="delete" data-sporcu-id="${sporcu.id}" title="Arşivle (muhasebe korunur)">
              <i class="fa-solid fa-trash-alt"></i>
            </button>
          `
            : ''
        }
      </div>
  `;

  return item;
}

// ============================================================================
// BÖLÜM 14: LIST RENDERING
// ============================================================================
// Bu bölümde sporcu listesinin görüntülenmesi işlemleri yer alır.
// - Filtreleme (arama, branş, durum)
// - Sıralama
// - Pagination
// - Kart oluşturma
// ============================================================================

/**
 * Sporcu listesi filtrelerini varsayılana döndür (modül değişiminde Ayrıldı vb. kalmasın).
 */
export function listeFiltreleriniSifirla(): void {
  const durumFiltre = Helpers.$('#durumFiltre') as HTMLSelectElement | null;
  const bransFiltre = Helpers.$('#bransFiltre') as HTMLSelectElement | null;
  const antrenmanGrubuFiltre = Helpers.$('#antrenmanGrubuFiltre') as HTMLSelectElement | null;
  const searchBox = Helpers.$('#searchBox') as HTMLInputElement | null;
  if (durumFiltre) durumFiltre.value = '';
  if (bransFiltre) bransFiltre.value = '';
  if (antrenmanGrubuFiltre) antrenmanGrubuFiltre.value = '';
  if (searchBox) searchBox.value = '';
  filterCache.lastSporcularHash = null;
  filterCache.cachedResults = null;
  listeyiGuncelle();
}

/**
 * Sporcu listesi üstündeki özet kartlarını (toplam / aktif / pasif / branş) günceller.
 * Arama veya tablo filtresinden bağımsız; tüm kayıt tabanına göre hesaplanır.
 */
function sporcuListesiOzetKartlariniGuncelle(sporcular: Sporcu[]): void {
  const operasyonel = sporcular.filter(s => s.durum !== 'Ayrıldı');
  const toplam = operasyonel.length;
  const aktif = sporcular.filter(s => s.durum === 'Aktif').length;
  const pasif = sporcular.filter(s => s.durum === 'Pasif').length;

  const bransSet = new Set<string>();
  for (const s of operasyonel) {
    const b = (s.sporBilgileri?.brans || '').trim();
    if (b) bransSet.add(b.toLowerCase());
  }

  const setVal = (sel: string, n: number) => {
    const el = Helpers.$(sel);
    if (el) el.textContent = String(n);
  };

  setVal('#summaryToplamSporcu', toplam);
  setVal('#summaryAktifSporcu', aktif);
  setVal('#summaryPasifSporcu', pasif);
  setVal('#summaryBransSayisi', bransSet.size);
}

/**
 * Listeyi güncelle
 */
export function listeyiGuncelle(): void {
  try {
    const listContainer =
      document.getElementById('sporcuListesi') ?? (Helpers.$('#sporcuListesi') as HTMLElement | null);

    if (!listContainer) {
      return;
    }

    // Önce empty state'i gizle (smooth transition için)
    Helpers.hideEmptyState('#emptyState');

    const sporcular = Storage.sporculariGetir();
    sporcuListesiOzetKartlariniGuncelle(sporcular);

    // Loading state göster (eğer mevcut kayıtlar varsa)
    if (sporcular.length > 0 && listContainer.children.length > 0) {
      (listContainer as HTMLElement).style.opacity = '0.6';
      (listContainer as HTMLElement).style.transition = 'opacity 0.2s ease';
    }

    const searchBox = Helpers.$('#searchBox') as HTMLInputElement | null;
    // Arama terimini trim ve lowercase yap (boşlukları temizle)
    const searchTerm = (searchBox?.value || '').trim().toLowerCase();
    const bransFiltre = Helpers.$('#bransFiltre') as HTMLSelectElement | null;
    const durumFiltre = Helpers.$('#durumFiltre') as HTMLSelectElement | null;
    const antrenmanGrubuFiltre = Helpers.$('#antrenmanGrubuFiltre') as HTMLSelectElement | null;
    const bransFiltreValue = (bransFiltre?.value || '').trim();
    const durumFiltreValue = (durumFiltre?.value || '').trim();
    const antrenmanGrubuFiltreValue = (antrenmanGrubuFiltre?.value || '').trim();
    const tableContainer = Helpers.$('#sporcu-listesi .table-container');

    // Önce listContainer'ı opacity ile gizle (smooth transition)
    if (listContainer.children.length > 0) {
      (listContainer as HTMLElement).style.opacity = '0';
      (listContainer as HTMLElement).style.transition = 'opacity 0.15s ease';
    }

    // requestAnimationFrame ile smooth update
    requestAnimationFrame(() => {
      // Filtreleme yapıldığında sayfa numarasını sıfırla (ilk sayfaya dön)
      // Bu, kullanıcı deneyimini iyileştirir - filtreleme sonrası boş sayfa görünmez
      pagination.currentPage = 1;

      // Filter Cache kontrolü (performans optimizasyonu)
      const currentHash = hashSporcular(sporcular);
      let filtrelenmis: Sporcu[];

      // Cache geçerli mi kontrol et (searchTerm zaten lowercase)
      // Cache'i sadece aynı filtreler için kullan (performans için)
      const cacheKey = `${searchTerm}_${bransFiltreValue}_${durumFiltreValue}_${antrenmanGrubuFiltreValue}`;
      const lastCacheKey = filterCache.cachedResults
        ? `${filterCache.cachedResults.searchTerm}_${filterCache.cachedResults.bransFiltre}_${filterCache.cachedResults.durumFiltre}_${filterCache.cachedResults.antrenmanGrubuFiltre}`
        : '';

      // Cache kontrolü: Hash ve key eşleşmeli
      const isCacheValid =
        filterCache.lastSporcularHash === currentHash &&
        filterCache.cachedResults !== null &&
        cacheKey === lastCacheKey &&
        Array.isArray(filterCache.cachedResults.filtrelenmis);

      if (isCacheValid) {
        // Cache'den kullan
        filtrelenmis = filterCache.cachedResults.filtrelenmis;
        console.log('✅ [Sporcu] Cache kullanıldı:', { cacheKey, count: filtrelenmis.length });
      } else {
        // Cache geçersiz veya yok, yeni filtreleme yap
        if (filterCache.cachedResults === null || cacheKey !== lastCacheKey) {
          console.log('🔄 [Sporcu] Cache geçersiz, yeni filtreleme yapılıyor:', {
            cacheKey,
            lastCacheKey,
          });
        }
        // Yeni filtreleme yap
        filtrelenmis = sporcular.filter(s => {
          // Arama terimi boşsa tümünü göster, değilse içerik kontrolü yap (case-insensitive)
          let adUygun = true;
          if (searchTerm) {
            const adSoyad = s.temelBilgiler?.adSoyad?.toLowerCase() || '';
            const tcKimlik = (s.temelBilgiler?.tcKimlik || '').toLowerCase();
            const brans = s.sporBilgileri?.brans?.toLowerCase() || '';

            // includes kullanarak herhangi bir yerde eşleşme kontrolü
            adUygun =
              adSoyad.includes(searchTerm) ||
              tcKimlik.includes(searchTerm) ||
              brans.includes(searchTerm);
          }
          // Branş filtresi (case-insensitive)
          const bransUygun =
            !bransFiltreValue ||
            (s.sporBilgileri?.brans?.toLowerCase() || '') === bransFiltreValue.toLowerCase();
          // Durum: filtre boşken varsayılan listede "Ayrıldı" gösterme; "Ayrıldı" seçilince sadece onlar
          const durumUygun = (() => {
            const d = s.durum || '';
            if (!durumFiltreValue) {
              return d !== 'Ayrıldı';
            }
            return d === durumFiltreValue;
          })();
          const antrenmanUygun = (() => {
            const v = antrenmanGrubuFiltreValue;
            if (!v) return true;
            if (v === '__none__') return !s.antrenmanGrubuId;
            if (s.antrenmanGrubuId !== v) return false;
            if (bransFiltreValue) {
              const g = Storage.antrenmanGrubuBul(v);
              if (g && (g.brans || '').trim()) {
                const sb = (s.sporBilgileri?.brans || '').trim().toLowerCase();
                const gb = g.brans!.trim().toLowerCase();
                if (sb && gb !== sb) return false;
              }
            }
            return true;
          })();

          return adUygun && bransUygun && durumUygun && antrenmanUygun;
        });

        // Cache'i güncelle
        filterCache.lastSporcularHash = currentHash;
        filterCache.cachedResults = {
          searchTerm,
          bransFiltre: bransFiltreValue,
          durumFiltre: durumFiltreValue,
          antrenmanGrubuFiltre: antrenmanGrubuFiltreValue,
          filtrelenmis,
        };
      }

      // Sıralama uygula
      const siralanmis = sortSporcular(filtrelenmis, currentSort);

      // Pagination uygula (eğer sayfa boyutundan fazla kayıt varsa)
      const totalItems = siralanmis.length;
      pagination.totalPages = Math.max(1, Math.ceil(totalItems / pagination.pageSize));

      // Mevcut sayfa sınırlarını kontrol et
      if (pagination.currentPage > pagination.totalPages) {
        pagination.currentPage = pagination.totalPages;
      }

      // Sayfalama uygula
      const startIndex = (pagination.currentPage - 1) * pagination.pageSize;
      const endIndex = startIndex + pagination.pageSize;
      const paginatedSporcular =
        totalItems > pagination.pageSize ? siralanmis.slice(startIndex, endIndex) : siralanmis;

      listContainer.innerHTML = '';

      if (siralanmis.length === 0) {
        if (sporcular.length > 0) {
          Helpers.showEmptyState(
            '#emptyState',
            'Arama kriterlerine uygun sporcu bulunamadı',
            'Farklı arama kriterleri deneyin.',
            { icon: 'fa-search' }
          );
        } else {
          Helpers.showEmptyState(
            '#emptyState',
            'Henüz sporcu kaydı bulunmuyor',
            'İlk sporcu kaydını eklemek için "Sporcu Kayıt" sayfasını kullanın.',
            { icon: 'fa-user-slash' }
          );
        }
        (listContainer as HTMLElement).style.opacity = '1';
        return;
      }

      Helpers.hideEmptyState('#emptyState');

      // Skeleton'ı gizle
      if (tableContainer) {
        Helpers.hideSkeleton('#sporcu-listesi .table-container');
      }

      // Yetki kontrolleri (bir kez hesapla, tüm kartlar için kullan)
      const duzenleyebilir = window.Auth && window.Auth.yetkiKontrol('sporcu_duzenleyebilir');
      const silebilir = window.Auth && window.Auth.yetkiKontrol('sporcu_silebilir');

      // DOM Optimizasyonu: DocumentFragment kullanarak tek seferde ekleme
      const fragment = document.createDocumentFragment();

      // Tüm sporcuları göster - template fonksiyonu kullanarak (sayfalanmış)
      paginatedSporcular.forEach(sporcu => {
        const card = createSporcuCard(sporcu, duzenleyebilir, silebilir);
        fragment.appendChild(card);
      });

      // Tek seferde DOM'a ekle (Reflow optimizasyonu)
      listContainer.appendChild(fragment);

      // Listeyi smooth olarak göster ve tüm içeriğin görünürlüğünü garanti et
      requestAnimationFrame(() => {
        const listEl = listContainer as HTMLElement;
        listEl.style.opacity = '1';
        listEl.style.transition = 'opacity 0.2s ease';
        listEl.style.display = 'flex';
        listEl.style.flexDirection = 'column';
        listEl.style.visibility = 'visible';
        listEl.style.overflow = 'visible';
        listEl.style.maxHeight = 'none';

        /* Liste kart görünümü: iç scroll yok, sayfa ile uzar */
        if (tableContainer) {
          const tc = tableContainer as HTMLElement;
          tc.style.overflow = 'visible';
          tc.style.maxHeight = 'none';
          tc.style.minHeight = 'auto';
        }

        // Pagination UI'ını güncelle (eğer sayfalama gerekliyse)
        updatePaginationUI(totalItems);
      });
    });
  } catch (error) {
    console.error('❌ [Sporcu] listeyiGuncelle hatası:', error);
    if (typeof Helpers !== 'undefined' && Helpers.toast) {
      Helpers.toast('Sporcu listesi güncellenirken hata oluştu!', 'error');
    }
  }
}

/**
 * Pagination UI'ını güncelle
 */
function updatePaginationUI(totalItems: number): void {
  // Eğer sayfalama gerekmiyorsa (sayfa boyutu veya daha az kayıt) pagination UI'ını gizle
  if (totalItems <= pagination.pageSize) {
    const paginationEl = Helpers.$('#sporcuPagination');
    if (paginationEl) {
      (paginationEl as HTMLElement).style.display = 'none';
    }
    return;
  }

  // Pagination container'ı bul veya oluştur
  const tableContainer = Helpers.$('#sporcu-listesi .table-container');
  if (!tableContainer) return;

  let paginationEl = Helpers.$('#sporcuPagination');
  if (!paginationEl) {
    // Pagination container oluştur
    paginationEl = document.createElement('div');
    paginationEl.id = 'sporcuPagination';
    paginationEl.className = 'pagination-container';
    tableContainer.appendChild(paginationEl);
  }

  // Pagination HTML'i oluştur
  const startItem = (pagination.currentPage - 1) * pagination.pageSize + 1;
  const endItem = Math.min(pagination.currentPage * pagination.pageSize, totalItems);

  let paginationHTML = `
    <div class="pagination-info">
      <span>${startItem}-${endItem} / ${totalItems} kayıt gösteriliyor</span>
    </div>
    <div class="pagination-controls">
      <button class="btn btn-small" ${pagination.currentPage === 1 ? 'disabled' : ''} data-pagination-action="first" title="İlk Sayfa">
        <i class="fa-solid fa-angle-double-left"></i>
      </button>
      <button class="btn btn-small" ${pagination.currentPage === 1 ? 'disabled' : ''} data-pagination-action="prev" title="Önceki Sayfa">
        <i class="fa-solid fa-angle-left"></i>
      </button>
      <span class="pagination-page-info">
        Sayfa ${pagination.currentPage} / ${pagination.totalPages}
      </span>
      <button class="btn btn-small" ${pagination.currentPage === pagination.totalPages ? 'disabled' : ''} data-pagination-action="next" title="Sonraki Sayfa">
        <i class="fa-solid fa-angle-right"></i>
      </button>
      <button class="btn btn-small" ${pagination.currentPage === pagination.totalPages ? 'disabled' : ''} data-pagination-action="last" title="Son Sayfa">
        <i class="fa-solid fa-angle-double-right"></i>
      </button>
    </div>
  `;

  paginationEl.innerHTML = paginationHTML;
  (paginationEl as HTMLElement).style.display = 'flex';
  (paginationEl as HTMLElement).style.justifyContent = 'space-between';
  (paginationEl as HTMLElement).style.alignItems = 'center';
  (paginationEl as HTMLElement).style.marginTop = '1rem';
  (paginationEl as HTMLElement).style.padding = '1rem';
  (paginationEl as HTMLElement).style.borderTop = '1px solid var(--border-color, #e0e0e0)';

  // Pagination button event'leri
  paginationEl.querySelectorAll('[data-pagination-action]').forEach(btn => {
    const button = btn as HTMLButtonElement;
    button.addEventListener('click', () => {
      if (button.disabled) return;

      const action = button.getAttribute('data-pagination-action');
      switch (action) {
        case 'first':
          pagination.currentPage = 1;
          break;
        case 'prev':
          if (pagination.currentPage > 1) {
            pagination.currentPage--;
          }
          break;
        case 'next':
          if (pagination.currentPage < pagination.totalPages) {
            pagination.currentPage++;
          }
          break;
        case 'last':
          pagination.currentPage = pagination.totalPages;
          break;
      }

      listeyiGuncelle();
    });
  });
}

/**
 * Aktif sporcu sayısını getir
 * @returns Aktif sporcu sayısı
 */
export function aktifSporcuSayisi(): number {
  return Storage.sporculariGetir().filter(s => s.durum === 'Aktif').length;
}

/**
 * Sporcuları yaş grubuna göre getir
 * @param yasGrubu - Yaş grubu
 * @returns Sporcular
 */
export function yasGrubunaGore(yasGrubu: string): Sporcu[] {
  return Storage.sporculariGetir().filter(
    s => s.durum === 'Aktif' && (yasGrubu === 'all' || s.tffGruplari?.anaGrup === yasGrubu)
  );
}

/**
 * Finansal özet hesapla (canlı güncelleme)
 */
function finansalOzetHesapla(): void {
  // Aylık ücret
  const aylikUcretInput = Helpers.$('#aylikUcret') as HTMLInputElement | null;
  const bursDurumuBursluRadio = Helpers.$('#bursDurumuBurslu') as HTMLInputElement | null;
  const ozetAylikUcret = Helpers.$('#ozetAylikUcret');

  let aylikUcret = 0;
  if (aylikUcretInput && (!bursDurumuBursluRadio || !bursDurumuBursluRadio.checked)) {
    aylikUcret = Helpers.paraCoz(aylikUcretInput.value) || 0;
  }

  if (ozetAylikUcret) {
    ozetAylikUcret.textContent = Helpers.paraFormat(aylikUcret) + ' TL';
  }

  // Malzemeler toplamı
  const ozetMalzemeler = Helpers.$('#ozetMalzemeler');
  let malzemelerToplam = 0;

  // Dinamik malzemeler listesinden topla
  if (malzemeler.length > 0) {
    malzemelerToplam = malzemeler.reduce((toplam, m) => toplam + (m.tutar || 0), 0);
  } else {
    // Eski yöntem (geriye dönük uyumluluk)
    const esofmanUcretiInput = Helpers.$('#esofmanUcreti') as HTMLInputElement | null;
    const formaUcretiInput = Helpers.$('#formaUcreti') as HTMLInputElement | null;
    const yagmurlukUcretiInput = Helpers.$('#yagmurlukUcreti') as HTMLInputElement | null;
    const digerUcretInput = Helpers.$('#digerUcret') as HTMLInputElement | null;

    if (esofmanUcretiInput) malzemelerToplam += Helpers.paraCoz(esofmanUcretiInput.value) || 0;
    if (formaUcretiInput) malzemelerToplam += Helpers.paraCoz(formaUcretiInput.value) || 0;
    if (yagmurlukUcretiInput) malzemelerToplam += Helpers.paraCoz(yagmurlukUcretiInput.value) || 0;
    if (digerUcretInput) malzemelerToplam += Helpers.paraCoz(digerUcretInput.value) || 0;
  }

  if (ozetMalzemeler) {
    ozetMalzemeler.textContent = Helpers.paraFormat(malzemelerToplam) + ' TL';
  }

  // Toplam tutar
  const ozetToplam = Helpers.$('#ozetToplam');
  const toplamTutar = aylikUcret + malzemelerToplam;

  if (ozetToplam) {
    ozetToplam.textContent = Helpers.paraFormat(toplamTutar) + ' TL';
  }

  // İlk Ay Ödeme (ödeme durumuna göre)
  const ozetIlkAyOdeme = Helpers.$('#ozetIlkAyOdeme');
  const kayitOdemeAlindiRadio = Helpers.$('#kayitOdemeAlindi') as HTMLInputElement | null;

  let ilkAyOdeme = 0;
  if (kayitOdemeAlindiRadio && kayitOdemeAlindiRadio.checked) {
    // Ödeme alındıysa, toplam tutarı göster
    ilkAyOdeme = toplamTutar;
  }

  if (ozetIlkAyOdeme) {
    ozetIlkAyOdeme.textContent = Helpers.paraFormat(ilkAyOdeme) + ' TL';
  }

  // Kalan Borç (toplam - ödenen)
  const ozetKalanBorc = Helpers.$('#ozetKalanBorc');
  const kalanBorc = toplamTutar - ilkAyOdeme;

  if (ozetKalanBorc) {
    ozetKalanBorc.textContent = Helpers.paraFormat(kalanBorc) + ' TL';
  }
}

/**
 * Özet sayfasını oluştur (Wizard son adım)
 */
function ozetOlustur(): void {
  // Finansal özeti hesapla
  finansalOzetHesapla();

  // Temel bilgiler özeti
  const ozetTemelBilgiler = Helpers.$('#ozetTemelBilgiler');
  if (ozetTemelBilgiler) {
    const adSoyad = Helpers.$('#adSoyad') as HTMLInputElement | null;
    const tcKimlik = Helpers.$('#tcKimlik') as HTMLInputElement | null;
    const brans = Helpers.$('#brans') as HTMLSelectElement | null;
    const telefon = Helpers.$('#telefon') as HTMLInputElement | null;

    ozetTemelBilgiler.innerHTML = `
      <div class="summary-item">
        <span class="summary-label">Ad Soyad</span>
        <span class="summary-value">${Helpers.escapeHtml(adSoyad?.value || '-')}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">TC Kimlik</span>
        <span class="summary-value">${Helpers.escapeHtml(tcKimlik?.value || '-')}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Branş</span>
        <span class="summary-value">${Helpers.escapeHtml(brans?.options[brans.selectedIndex]?.text || '-')}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Telefon</span>
        <span class="summary-value">${Helpers.escapeHtml(telefon?.value || '-')}</span>
      </div>
    `;
  }

  // Finansal bilgiler özeti
  const ozetFinansalBilgiler = Helpers.$('#ozetFinansalBilgiler');
  if (ozetFinansalBilgiler) {
    const aylikUcret = Helpers.$('#aylikUcret') as HTMLInputElement | null;
    const bursDurumuBurslu = Helpers.$('#bursDurumuBurslu') as HTMLInputElement | null;
    const aylikUcretDegeri =
      aylikUcret && (!bursDurumuBurslu || !bursDurumuBurslu.checked)
        ? Helpers.paraFormat(Helpers.paraCoz(aylikUcret.value) || 0) + ' TL'
        : 'Burslu (Ücretsiz)';

    const malzemelerToplam = malzemeler.reduce((t, m) => t + (m.tutar || 0), 0);
    const toplamTutar =
      aylikUcret && (!bursDurumuBurslu || !bursDurumuBurslu.checked)
        ? Helpers.paraCoz(aylikUcret.value) || 0
        : 0;
    const genelToplam = toplamTutar + malzemelerToplam;

    // Ödeme durumunu kontrol et
    const kayitOdemeAlindiRadio = Helpers.$('#kayitOdemeAlindi') as HTMLInputElement | null;
    const ilkAyOdeme = kayitOdemeAlindiRadio && kayitOdemeAlindiRadio.checked ? genelToplam : 0;
    const kalanBorc = genelToplam - ilkAyOdeme;

    ozetFinansalBilgiler.innerHTML = `
      <div class="summary-item">
        <span class="summary-label">Aylık Ücret</span>
        <span class="summary-value">${aylikUcretDegeri}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Malzemeler</span>
        <span class="summary-value">${Helpers.paraFormat(malzemelerToplam)} TL</span>
      </div>
      <div class="summary-item summary-item-total">
        <span class="summary-label"><strong>Toplam</strong></span>
        <span class="summary-value"><strong>${Helpers.paraFormat(genelToplam)} TL</strong></span>
      </div>
      <div class="summary-item">
        <span class="summary-label">İlk Ay Ödeme</span>
        <span class="summary-value" id="ozetIlkAyOdeme">${Helpers.paraFormat(ilkAyOdeme)} TL</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Kalan Borç</span>
        <span class="summary-value" id="ozetKalanBorc">${Helpers.paraFormat(kalanBorc)} TL</span>
      </div>
    `;
  }

  // Malzemeler listesini göster (wizard 2. adımında)
  const malzemelerListesi = Helpers.$('#malzemelerListesi');
  if (malzemelerListesi) {
    if (malzemeler.length === 0) {
      malzemelerListesi.innerHTML = `
        <div class="empty-state-malzeme">
          <div class="empty-state-icon">
            <i class="fa-solid fa-box-open"></i>
          </div>
          <h4>Henüz malzeme eklenmedi</h4>
          <p>Malzeme eklemek için "Ekle" butonuna tıklayın</p>
        </div>
      `;
    } else {
      malzemelerListesi.innerHTML = malzemeler
        .map(m => {
          const ad = Helpers.escapeHtml(m.ad);
          const tutar = Helpers.paraFormat(m.tutar);
          return `
          <div class="malzeme-item">
            <div class="malzeme-item-icon">
              <i class="fa-solid fa-box"></i>
            </div>
            <div class="malzeme-item-content">
              <div class="malzeme-item-name">${ad}</div>
              <div class="malzeme-item-amount">${tutar} TL</div>
            </div>
            <button type="button" class="btn btn-small btn-icon btn-danger malzeme-sil-btn" data-malzeme-id="${m.id}" title="Sil">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        `;
        })
        .join('');
    }
  }
}

/**
 * Malzeme eventleri (ekleme/silme)
 */
function malzemeEventleri(): void {
  // Malzeme sil butonları (event delegation)
  const form = Helpers.$('#sporcuKayitForm');
  if (form) {
    form.addEventListener('click', e => {
      const target = e.target as HTMLElement;
      const silBtn = target.closest('.malzeme-sil-btn') as HTMLElement | null;

      if (silBtn) {
        e.preventDefault();
        e.stopPropagation();

        const malzemeId = silBtn.getAttribute('data-malzeme-id');
        if (malzemeId) {
          malzemeSil(malzemeId);
        }
      }
    });
  }

  // Sporcu kayıt formundaki malzeme ekle butonu - sadece sporcu kayıt formu görünürken
  const sporcuKayitView = Helpers.$('#sporcu-kayit');

  if (sporcuKayitView) {
    sporcuKayitView.addEventListener('click', e => {
      const target = e.target as HTMLElement;
      const btn = target.closest('#malzemeEkleBtn') as HTMLElement | null;

      if (btn && sporcuKayitView.classList.contains('active')) {
        e.preventDefault();
        e.stopPropagation();
        sporcuMalzemeEkleModalAc();
      }
    });
  }

  // NOT: Modal eventleri (kapat, kaydet, iptal) dashboard.ts'de document seviyesinde tanımlı
  // Her iki modül de aynı modal'ı kullanıyor, hangi view aktifse ona göre çalışıyor
}

/**
 * Sporcu kayıt formu için malzeme ekle modal'ını aç (wizard içinde)
 */
function sporcuMalzemeEkleModalAc(): void {
  const modal = Helpers.$('#malzemeEkleModal');
  if (!modal) return;

  // Context bilgisi ekle (sporcu-kayit'tan açıldığını belirt)
  modal.setAttribute('data-modal-context', 'sporcu-kayit');

  // Sporcu seçimini gizle (wizard içinde henüz sporcu kaydedilmemiş)
  const malzemeSporcuSelect = Helpers.$('#malzemeSporcuSelect');
  if (malzemeSporcuSelect) {
    (malzemeSporcuSelect as HTMLElement).style.display = 'none';
    const label = document.querySelector('label[for="malzemeSporcuSelect"]');
    if (label) (label as HTMLElement).style.display = 'none';
  }

  // Modal'ı aç
  (modal as HTMLElement).style.display = 'flex';
  (modal as HTMLElement).setAttribute('style', 'display: flex !important;');

  // Form alanlarını temizle
  const malzemeAd = Helpers.$('#malzemeAd') as HTMLInputElement | null;
  const malzemeTutar = Helpers.$('#malzemeTutar') as HTMLInputElement | null;

  if (malzemeAd) malzemeAd.value = '';
  if (malzemeTutar) malzemeTutar.value = '';

  // İlk input'a focus
  if (malzemeAd) malzemeAd.focus();
}

/**
 * Sporcu kayıt formu için malzeme ekle modal'ını kapat
 */
function sporcuMalzemeEkleModalKapat(): void {
  const modal = Helpers.$('#malzemeEkleModal');
  if (modal) {
    (modal as HTMLElement).style.display = 'none';
  }

  // Sporcu seçimini tekrar göster (dashboard için)
  const malzemeSporcuSelect = Helpers.$('#malzemeSporcuSelect');
  if (malzemeSporcuSelect) {
    (malzemeSporcuSelect as HTMLElement).style.display = '';
    const label = document.querySelector('label[for="malzemeSporcuSelect"]');
    if (label) (label as HTMLElement).style.display = '';
  }
}

/**
 * Malzeme ekle modal'ını kapat (genel)
 */
function malzemeEkleModalKapat(): void {
  const modal = Helpers.$('#malzemeEkleModal');
  if (modal) {
    (modal as HTMLElement).style.display = 'none';
  }
}

/**
 * Sporcu kayıt formu için malzeme kaydet (wizard içinde)
 */
function sporcuMalzemeKaydet(): void {
  const malzemeAd = Helpers.$('#malzemeAd') as HTMLInputElement | null;
  const malzemeTutar = Helpers.$('#malzemeTutar') as HTMLInputElement | null;

  if (!malzemeAd || !malzemeTutar) {
    Helpers.toast('Form alanları bulunamadı!', 'error');
    return;
  }

  const ad = malzemeAd.value.trim();
  const tutarStr = malzemeTutar.value.trim();

  // Validasyon
  if (!ad) {
    Helpers.toast('Lütfen malzeme adı girin!', 'error');
    malzemeAd.focus();
    return;
  }

  if (!tutarStr) {
    Helpers.toast('Lütfen tutar girin!', 'error');
    malzemeTutar.focus();
    return;
  }

  const tutar = Helpers.paraCoz(tutarStr);
  if (!tutar || tutar <= 0) {
    Helpers.toast('Geçerli bir tutar girin!', 'error');
    malzemeTutar.focus();
    return;
  }

  // Malzemeyi ekle
  malzemeEkle(ad, tutar);

  // Modal'ı kapat
  sporcuMalzemeEkleModalKapat();
}

/**
 * Malzeme ekle (wizard için - sporcu seçimi yok)
 */
function malzemeEkle(ad: string, tutar: number): void {
  const yeniMalzeme: Malzeme = {
    id: `malzeme_${++malzemeCounter}_${Date.now()}`,
    ad: ad,
    tutar: tutar,
  };

  malzemeler.push(yeniMalzeme);

  // Listeyi güncelle
  ozetOlustur();
  finansalOzetHesapla();

  Helpers.toast(`${ad} malzemesi eklendi.`, 'success');
}

/**
 * Malzeme sil
 */
function malzemeSil(malzemeId: string): void {
  const index = malzemeler.findIndex(m => m.id === malzemeId);
  if (index > -1) {
    const malzeme = malzemeler[index];
    if (malzeme && Helpers.onay(`${malzeme.ad} malzemesini silmek istediğinizden emin misiniz?`)) {
      malzemeler.splice(index, 1);

      // Listeyi güncelle
      ozetOlustur();
      finansalOzetHesapla();

      Helpers.toast('Malzeme silindi.', 'success');
    }
  }
}

/**
 * Form eventlerini yeniden bağla (view gösterildiğinde kullanılır)
 */
export function formEventleriniYenidenBagla(): void {
  // Event listener'ları önce temizle (zombie event önleme)
  const form = Helpers.$('#sporcuKayitForm') as HTMLFormElement | null;
  if (form && formSubmitHandler) {
    form.removeEventListener('submit', formSubmitHandler);
    formSubmitHandler = null;
  }

  const kaydetBtn = Helpers.$('#kaydetBtn') as HTMLButtonElement | null;
  if (kaydetBtn && kaydetBtnHandler) {
    kaydetBtn.removeEventListener('click', kaydetBtnHandler);
    kaydetBtnHandler = null;
  }

  // Alternatif butonları da temizle
  const altBtn = form?.querySelector('button[type="submit"]') as HTMLButtonElement | null;
  if (altBtn && kaydetBtnHandler) {
    altBtn.removeEventListener('click', kaydetBtnHandler);
  }

  // Flag'i sıfırla
  isFormEventsInitialized = false;

  // Eğer yeni kayıt başlatılıyorsa (guncellenecekId null ise), formu temizle
  if (guncellenecekId === null) {
    // Malzemeler listesini temizle
    malzemeler = [];
    malzemeCounter = 0;

    // Malzeme listesini UI'dan temizle
    const malzemelerListesi = Helpers.$('#malzemelerListesi');
    if (malzemelerListesi) {
      malzemelerListesi.innerHTML = `
        <div class="empty-state-malzeme">
          <div class="empty-state-icon">
            <i class="fa-solid fa-box-open"></i>
          </div>
          <h4>Henüz malzeme eklenmedi</h4>
          <p>Malzeme eklemek için "Ekle" butonuna tıklayın</p>
        </div>
      `;
    }

    // Özet bölümündeki malzemeler toplamını da sıfırla
    const ozetMalzemeler = Helpers.$('#ozetMalzemeler');
    if (ozetMalzemeler) {
      ozetMalzemeler.textContent = '0,00 TL';
    }

    // Özet bölümünü güncelle (malzemeler temizlendikten sonra)
    ozetOlustur();

    // Finansal özeti güncelle (malzemeler temizlendikten sonra)
    finansalOzetHesapla();
  }

  // Önce buton durumunu kontrol et
  butonDurumunuKontrolEt();

  // Normal event listener'ları ekle
  formEventleri();

  const bransEl = Helpers.$('#brans') as HTMLSelectElement | null;
  if (bransEl) delete bransEl.dataset.antrenmanGrupBound;
  bransDegisinceAntrenmanGrubuBagla();

  // Eski kayıt butonunu gizle
  setTimeout(() => {
    const kayitTuruToggleBtn = Helpers.$('#kayitTuruToggle') as HTMLButtonElement | null;
    if (kayitTuruToggleBtn) {
      kayitTuruToggleBtn.style.display = 'none';
    }
    const eskiKayitCheckbox = Helpers.$('#eskiKayit') as HTMLInputElement | null;
    if (eskiKayitCheckbox) {
      eskiKayitCheckbox.style.display = 'none';
    }
    const eskiKayitWrapper = Helpers.$('.eski-kayit-toggle-wrapper') as HTMLElement | null;
    if (eskiKayitWrapper) {
      eskiKayitWrapper.style.display = 'none';
    }
  }, 100);

  // Tarih alanlarını oluştur (HTML'de yoksa)
  // Birden fazla deneme yap (form yüklenene kadar bekle)
  let denemeSayisi = 0;
  const maxDeneme = 10;
  const tarihAlanlariniOlusturInterval = setInterval(() => {
    denemeSayisi++;
    const form = Helpers.$('#sporcuKayitForm') as HTMLFormElement | null;
    const dogumTarihi = Helpers.$('#dogumTarihi') as HTMLInputElement | null;

    if (form && dogumTarihi) {
      console.log('✅ [Sporcu] Form ve dogumTarihi bulundu, tarih alanları oluşturuluyor...');
      tarihAlanlariniOlustur();
      clearInterval(tarihAlanlariniOlusturInterval);
    } else if (denemeSayisi >= maxDeneme) {
      clearInterval(tarihAlanlariniOlusturInterval);
      console.warn(
        `⚠️ [Sporcu] Tarih alanları oluşturulamadı (${denemeSayisi} deneme): Form=${!!form}, dogumTarihi=${!!dogumTarihi}`
      );
    } else {
      console.log(
        `🔄 [Sporcu] Deneme ${denemeSayisi}/${maxDeneme}: Form=${!!form}, dogumTarihi=${!!dogumTarihi}`
      );
    }
  }, 100);

  // Kaydet butonunun görünürlüğünü kontrol et ve düzelt (zaten yukarıda tanımlı)
  if (kaydetBtn) {
    // Eğer buton gizliyse ve wizard'ın son adımındaysak, görünür yap
    if (
      (kaydetBtn.style.display === 'none' || kaydetBtn.offsetParent === null) &&
      currentWizardStep === totalWizardSteps
    ) {
      kaydetBtn.style.display = 'block';
      // Wizard'ı da son adıma al (güvenlik için)
      wizardAdimGoster(totalWizardSteps);
    }
  }

  // Event delegation ile de dene (form içindeki tüm butonlara - zaten yukarıda tanımlı)
  if (form) {
    // Eğer daha önce delegation handler eklenmişse kaldır
    if (delegationHandler) {
      form.removeEventListener('click', delegationHandler, true);
    }

    // Yeni delegation handler oluştur
    delegationHandler = function (e: Event) {
      const target = e.target as HTMLElement;
      const button = target.closest('button') as HTMLButtonElement | null;

      // Kaydet butonuna veya içindeki icon'a tıklanırsa
      if (
        button &&
        (button.id === 'kaydetBtn' ||
          button.textContent?.includes('Kaydet') ||
          button.textContent?.includes('kaydet') ||
          button.querySelector('i.fa-check') ||
          button.classList.contains('btn-success'))
      ) {
        // Buton gizliyse, wizard'ı son adıma al ve butonu göster
        if (button.style.display === 'none' || button.offsetParent === null) {
          wizardAdimGoster(totalWizardSteps);
          // Butonu görünür yap
          button.style.display = 'block';
          // Kısa bir gecikme ile kaydet fonksiyonunu çağır
          setTimeout(() => {
            kaydet();
          }, 100);
          return;
        }

        e.preventDefault();
        e.stopPropagation();
        kaydet();
      }
    };

    form.addEventListener('click', delegationHandler, true); // Capture phase'de dinle
  }
}

/**
 * Tarih alanlarını dinamik olarak oluştur (HTML'de yoksa)
 */
function tarihAlanlariniOlustur(): void {
  console.log('🔧 [Sporcu] tarihAlanlariniOlustur() çağrıldı');
  const form = Helpers.$('#sporcuKayitForm') as HTMLFormElement | null;
  if (!form) {
    console.warn('[Sporcu] Form bulunamadı: #sporcuKayitForm');
    return;
  }
  console.log('✅ [Sporcu] Form bulundu:', form);

  // HTML'deki mevcut "Kayıt Tarihi" label'ını "Aidat Başlangıç Tarihi" olarak güncelle
  const eskiKayitTarihiLabels = form.querySelectorAll('label');
  eskiKayitTarihiLabels.forEach(label => {
    const labelText = (label.textContent || label.innerText || '').trim();
    // "Kayıt Tarihi" veya "Kayıt Tarihi *" yazan label'ları bul ve güncelle
    // Ama "Aidat Başlangıç Tarihi" veya "Okula Kayıt Tarihi" (eski: Kulübe) içermemeli
    if (
      labelText.includes('Kayıt Tarihi') &&
      !labelText.includes('Aidat') &&
      !labelText.includes('Kulübe') &&
      !labelText.includes('Okula')
    ) {
      // Label içindeki metni güncelle
      const asterisk = labelText.includes('*') ? ' *' : '';
      label.innerHTML = `<i class="fa-solid fa-calendar-check"></i> Aidat Başlangıç Tarihi${asterisk}`;
      if (Helpers.Logger) {
        Helpers.Logger.log(
          '✅ [Sporcu] "Kayıt Tarihi" label\'ı "Aidat Başlangıç Tarihi" olarak güncellendi'
        );
      }

      // Input'un title'ını da güncelle
      const forAttr = label.getAttribute('for');
      if (forAttr) {
        const input = Helpers.$('#' + forAttr) as HTMLInputElement | null;
        if (input) {
          input.title =
            'Aidat Başlangıç Tarihi - Bu tarihten itibaren borç hesaplanır ve değiştirilemez.';
        }
      }
    }
  });

  // Aidat Başlangıç Tarihi alanını kontrol et ve oluştur
  let kayitTarihiInput = Helpers.$('#kayitTarihi') as HTMLInputElement | null;
  if (Helpers.Logger) {
    Helpers.Logger.debug(
      '🔍 [Sporcu] kayitTarihiInput kontrolü:',
      kayitTarihiInput ? 'VAR' : 'YOK'
    );
  }
  if (!kayitTarihiInput) {
    // Dogum tarihi alanını bul (referans noktası)
    const dogumTarihiEl = Helpers.$('#dogumTarihi') as HTMLInputElement | null;
    if (Helpers.Logger) {
      Helpers.Logger.debug('🔍 [Sporcu] dogumTarihiEl kontrolü:', dogumTarihiEl ? 'VAR' : 'YOK');
    }
    if (dogumTarihiEl) {
      // Form-group içinde mi kontrol et
      let parentContainer = dogumTarihiEl.parentElement as HTMLElement | null;

      // Eğer parent form-group değilse, form-group'u bul
      while (
        parentContainer &&
        !parentContainer.classList.contains('form-group') &&
        parentContainer !== form
      ) {
        parentContainer = parentContainer.parentElement as HTMLElement | null;
      }

      // Form-group bulunamazsa, dogumTarihiEl'in parent'ını kullan
      if (!parentContainer || parentContainer === form) {
        parentContainer = dogumTarihiEl.parentElement as HTMLElement | null;
      }

      if (parentContainer) {
        const formGroup = document.createElement('div');
        formGroup.className = 'form-group';
        // Görünürlüğü garanti et - inline style ile
        formGroup.setAttribute(
          'style',
          'display: block !important; visibility: visible !important; opacity: 1 !important;'
        );
        // Mevcut ayın ilk günü ve bugünü hesapla
        const bugun = new Date();
        const mevcutAyinIlkGunu = new Date(bugun.getFullYear(), bugun.getMonth(), 1);
        const minDateStr = mevcutAyinIlkGunu.toISOString().split('T')[0];
        const maxDateStr = bugun.toISOString().split('T')[0];

        formGroup.innerHTML = `
          <label for="kayitTarihi" style="display: block !important;">
            <i class="fa-solid fa-calendar-check"></i> 
            Aidat Başlangıç Tarihi
            <span class="text-muted" style="font-size: 0.85em;">(Borç hesaplaması için)</span>
          </label>
          <input 
            type="date" 
            id="kayitTarihi" 
            name="kayitTarihi" 
            min="${minDateStr}"
            max="${maxDateStr}"
            class="form-control"
            style="display: block !important; visibility: visible !important;"
            title="Aidat Başlangıç Tarihi - Sadece mevcut ay (${Helpers.suAnkiDonem(bugun).ay}/${Helpers.suAnkiDonem(bugun).yil}) içinde bir tarih seçebilirsiniz."
            placeholder="Mevcut ay içinde bir tarih seçin"
          />
          <small class="form-text text-muted" style="display: block !important;">
            Bu tarihten itibaren borç hesaplanır. Sadece mevcut ay içinde bir tarih seçebilirsiniz.
          </small>
        `;
        // Dogum tarihi container'ından sonra ekle
        parentContainer.insertAdjacentElement('afterend', formGroup);

        // DOM'a eklendikten hemen sonra görünürlüğü garanti et ve date kısıtlaması ekle
        requestAnimationFrame(() => {
          kayitTarihiInput = Helpers.$('#kayitTarihi') as HTMLInputElement | null;
          if (formGroup) {
            formGroup.setAttribute(
              'style',
              'display: block !important; visibility: visible !important; opacity: 1 !important;'
            );
          }
          if (kayitTarihiInput) {
            kayitTarihiInput.setAttribute(
              'style',
              'display: block !important; visibility: visible !important;'
            );

            // Date kısıtlamasını güncelle (her açılışta mevcut ay kontrolü)
            const bugun = new Date();
            const mevcutAyinIlkGunu = new Date(bugun.getFullYear(), bugun.getMonth(), 1);
            const minDateStr = mevcutAyinIlkGunu.toISOString().split('T')[0];
            const maxDateStr = bugun.toISOString().split('T')[0];
            kayitTarihiInput.min = minDateStr;
            kayitTarihiInput.max = maxDateStr;

            // Yeni kayıt için otomatik bugünün tarihini set et
            if (!guncellenecekId) {
              kayitTarihiInput.value = maxDateStr;
            }

            // Mevcut ay kontrolü için event listener ekle (sadece bir kez)
            if (!kayitTarihiInput.hasAttribute('data-kayit-tarihi-change-listener')) {
              kayitTarihiInput.setAttribute('data-kayit-tarihi-change-listener', 'true');
              kayitTarihiInput.addEventListener('change', function () {
                const secilenTarih = new Date(this.value);
                const mevcutAy = bugun.getMonth();
                const mevcutYil = bugun.getFullYear();

                if (
                  secilenTarih.getMonth() !== mevcutAy ||
                  secilenTarih.getFullYear() !== mevcutYil
                ) {
                  // Mevcut ay dışında bir tarih seçilmişse, bugünün tarihine ayarla
                  const secilenAy = secilenTarih.getMonth();
                  const secilenYil = secilenTarih.getFullYear();
                  const ayIsimleri = [
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
                  ];

                  let toastMesaji = '';
                  if (
                    secilenYil < mevcutYil ||
                    (secilenYil === mevcutYil && secilenAy < mevcutAy)
                  ) {
                    toastMesaji = `Geçmiş ay (${ayIsimleri[secilenAy]} ${secilenYil}) seçilemez. Sadece mevcut ay (${ayIsimleri[mevcutAy]} ${mevcutYil}) içinde bir tarih seçebilirsiniz.`;
                  } else {
                    toastMesaji = `Gelecek ay (${ayIsimleri[secilenAy]} ${secilenYil}) seçilemez. Sadece mevcut ay (${ayIsimleri[mevcutAy]} ${mevcutYil}) içinde bir tarih seçebilirsiniz.`;
                  }

                  this.value = maxDateStr;
                  Helpers.toast(toastMesaji, 'warning');
                }
              });
            }
          }
          if (Helpers.Logger) {
            Helpers.Logger.log(
              '✅ [Sporcu] Aidat Başlangıç Tarihi alanı oluşturuldu (mevcut ay kısıtlaması ile)'
            );
          }
        });
      } else {
        if (Helpers.Logger) {
          Helpers.Logger.warn('[Sporcu] Dogum tarihi parent container bulunamadı');
        }
      }
    } else {
      if (Helpers.Logger) {
        Helpers.Logger.warn('[Sporcu] Dogum tarihi alanı bulunamadı: #dogumTarihi');
      }
    }
  }

  // Okula Kayıt Tarihi alanını kontrol et ve oluştur
  let ilkKayitTarihiInput = Helpers.$('#ilkKayitTarihi') as HTMLInputElement | null;
  if (!ilkKayitTarihiInput) {
    // Kayıt tarihi alanını bul (referans noktası)
    const kayitTarihiEl =
      kayitTarihiInput || (Helpers.$('#kayitTarihi') as HTMLInputElement | null);
    if (kayitTarihiEl) {
      let parentContainer = kayitTarihiEl.parentElement as HTMLElement | null;

      // Eğer parent form-group değilse, form-group'u bul
      while (
        parentContainer &&
        !parentContainer.classList.contains('form-group') &&
        parentContainer !== form
      ) {
        parentContainer = parentContainer.parentElement as HTMLElement | null;
      }

      // Form-group bulunamazsa, kayitTarihiEl'in parent'ını kullan
      if (!parentContainer || parentContainer === form) {
        parentContainer = kayitTarihiEl.parentElement as HTMLElement | null;
      }

      if (parentContainer) {
        const formGroup = document.createElement('div');
        formGroup.className = 'form-group';
        // Görünürlüğü garanti et - inline style ile
        formGroup.setAttribute(
          'style',
          'display: block !important; visibility: visible !important; opacity: 1 !important;'
        );
        formGroup.innerHTML = `
          <label for="ilkKayitTarihi" style="display: block !important;">
            <i class="fa-solid fa-calendar-days"></i> 
            Okula Kayıt Tarihi
            <span class="text-muted" style="font-size: 0.85em;">(Arşiv bilgisi - İsteğe bağlı)</span>
          </label>
          <input 
            type="date" 
            id="ilkKayitTarihi" 
            name="ilkKayitTarihi" 
            class="form-control"
            style="display: block !important; visibility: visible !important;"
            title="Okula Kayıt Tarihi - Arşiv bilgisi (isteğe bağlı, düzenlenebilir)"
          />
          <small class="form-text text-muted" style="display: block !important;">
            Sporcu okula ne zaman kayıt oldu? (Sadece arşiv amaçlı, borç hesaplamasında kullanılmaz)
          </small>
        `;
        // Kayıt tarihi container'ından sonra ekle
        parentContainer.insertAdjacentElement('afterend', formGroup);

        // DOM'a eklendikten hemen sonra görünürlüğü garanti et
        requestAnimationFrame(() => {
          ilkKayitTarihiInput = Helpers.$('#ilkKayitTarihi') as HTMLInputElement | null;
          if (formGroup) {
            formGroup.setAttribute(
              'style',
              'display: block !important; visibility: visible !important; opacity: 1 !important;'
            );
          }
          if (ilkKayitTarihiInput) {
            ilkKayitTarihiInput.setAttribute(
              'style',
              'display: block !important; visibility: visible !important;'
            );
          }
          if (Helpers.Logger) {
            Helpers.Logger.log('✅ [Sporcu] Okula Kayıt Tarihi alanı oluşturuldu');
          }
        });
      } else {
        if (Helpers.Logger) {
          Helpers.Logger.warn('[Sporcu] Kayıt tarihi parent container bulunamadı');
        }
      }
    } else {
      if (Helpers.Logger) {
        Helpers.Logger.warn(
          '[Sporcu] Kayıt tarihi alanı bulunamadı, Okula Kayıt Tarihi eklenemedi'
        );
      }
    }
  }
}

/**
 * Eski kayıt toggle buton eventlerini bağla (DEVRE DIŞI)
 */
function eskiKayitEventleri(): void {
  // Fonksiyon devre dışı bırakıldı - eski kayıt özelliği kaldırıldı
  return;

  // Önce mevcut toggle butonunu kontrol et
  let kayitTuruToggleBtn = Helpers.$('#kayitTuruToggle') as HTMLButtonElement | null;
  let eskiKayitCheckbox = Helpers.$('#eskiKayit') as HTMLInputElement | null;
  console.log('🔍 [eskiKayitEventleri] İlk kontrol:', {
    toggleBtn: !!kayitTuruToggleBtn,
    checkbox: !!eskiKayitCheckbox,
  });

  // Eğer buton zaten varsa, sadece güncelle
  if (kayitTuruToggleBtn) {
    // Buton zaten var, sadece event listener ekle
  } else {
    // Buton yoksa, checkbox'ı veya label'ı bul ve buton oluştur
    console.log('🔍 [eskiKayitEventleri] Toggle butonu bulunamadı, oluşturulacak');

    // Önce ID ile checkbox'ı bul
    if (!eskiKayitCheckbox) {
      const view = Helpers.$('#sporcuKayitView') as HTMLElement | null;
      // Checkbox ID ile bulunamadı, view içinde tüm checkbox'ları tara
      if (view) {
        // Tüm checkbox'ları al (view içinde)
        const allCheckboxes = Array.from(
          view.querySelectorAll('input[type="checkbox"]')
        ) as HTMLInputElement[];
        // Tüm label'ları al (view içinde)
        const allLabels = Array.from(view.querySelectorAll('label'));

        console.log('🔍 [eskiKayitEventleri] View içinde Eski Kayıt aranıyor', {
          labelCount: allLabels.length,
          checkboxCount: allCheckboxes.length,
        });

        // Önce "Eski Kayıt" yazan label'ı bul
        for (let label of allLabels) {
          const labelText = (label.textContent || label.innerText || '').toLowerCase();
          if (labelText.includes('eski') && labelText.includes('kayıt')) {
            console.log('✅ [eskiKayitEventleri] Eski Kayıt label bulundu', {
              labelText: label.textContent,
            });

            // Label'ın içindeki checkbox'ı bul
            const checkboxInLabel = label.querySelector(
              'input[type="checkbox"]'
            ) as HTMLInputElement | null;
            if (checkboxInLabel) {
              eskiKayitCheckbox = checkboxInLabel;
              break;
            }

            // Label'ın for attribute'u ile bağlı checkbox'ı bul
            const forAttr = label.getAttribute('for');
            if (forAttr) {
              const checkboxByFor = Helpers.$('#' + forAttr) as HTMLInputElement | null;
              if (checkboxByFor && checkboxByFor.type === 'checkbox') {
                eskiKayitCheckbox = checkboxByFor;
                break;
              }
            }

            // Label'dan sonraki checkbox'ı bul
            let nextSibling = label.nextElementSibling;
            while (nextSibling) {
              if (
                nextSibling.tagName === 'INPUT' &&
                (nextSibling as HTMLInputElement).type === 'checkbox'
              ) {
                eskiKayitCheckbox = nextSibling as HTMLInputElement;
                break;
              }
              nextSibling = nextSibling.nextElementSibling;
            }

            if (eskiKayitCheckbox) break;
          }
        }

        // Eğer hala bulunamadıysa, son checkbox'ı al (genellikle Eski Kayıt en sonda olur)
        if (!eskiKayitCheckbox && allCheckboxes.length > 0) {
          console.log('⚠️ [eskiKayitEventleri] Son checkbox kullanılıyor', {
            totalCheckboxes: allCheckboxes.length,
          });
          eskiKayitCheckbox = allCheckboxes[allCheckboxes.length - 1];
        }
      }
    }

    // Checkbox bulunduysa ID ekle
    if (eskiKayitCheckbox && !eskiKayitCheckbox.id) {
      eskiKayitCheckbox.id = 'eskiKayit';
      console.log('✅ [eskiKayitEventleri] Checkbox ID eklendi');
    }

    // Eğer checkbox bulunduysa, yerine buton koy (yanına değil, yerine)
    if (eskiKayitCheckbox) {
      console.log('✅ [eskiKayitEventleri] Checkbox bulundu, butona dönüştürülüyor');

      // Checkbox'ın mevcut durumunu al
      const eskiKayitDurumu = eskiKayitCheckbox.checked;

      // Checkbox'ın parent'larını bul (label ve wrapper)
      const checkboxLabel = eskiKayitCheckbox.closest('label');
      const wrapper = checkboxLabel
        ? (checkboxLabel.closest('.eski-kayit-toggle-wrapper') as HTMLElement | null)
        : null;

      console.log('🔍 [eskiKayitEventleri] Parent kontrol edildi', {
        labelFound: !!checkboxLabel,
        wrapperFound: !!wrapper,
      });

      // Checkbox'a ID ekle (yoksa)
      if (!eskiKayitCheckbox.id) {
        eskiKayitCheckbox.id = 'eskiKayit';
      }

      // Toggle butonu oluştur
      kayitTuruToggleBtn = document.createElement('button');
      kayitTuruToggleBtn.type = 'button';
      kayitTuruToggleBtn.id = 'kayitTuruToggle';
      kayitTuruToggleBtn.className = 'btn btn-success';

      // Checkbox'ı tamamen gizle ama DOM'da tut (form gönderiminde değeri almak için)
      eskiKayitCheckbox.style.cssText =
        'display:none!important;position:absolute!important;opacity:0!important;width:0!important;height:0!important;pointer-events:none!important;margin:0!important;padding:0!important;visibility:hidden!important;';

      // Checkbox'ı form içine taşı (gizli olarak, form gönderiminde değeri almak için)
      const form = Helpers.$('#sporcuKayitForm') as HTMLFormElement | null;
      if (form && eskiKayitCheckbox.parentElement !== form) {
        form.appendChild(eskiKayitCheckbox);
        console.log('✅ [eskiKayitEventleri] Checkbox form içine taşındı');
      }

      // Label'ı da gizle (buton görünecek)
      if (checkboxLabel) {
        checkboxLabel.style.display = 'none';
      }

      // Butonu wrapper içine koy (label yerine)
      if (wrapper) {
        console.log('✅ [eskiKayitEventleri] Buton wrapper içine konuluyor');
        wrapper.innerHTML = ''; // Eski içeriği temizle
        wrapper.appendChild(kayitTuruToggleBtn);
      } else if (checkboxLabel) {
        console.log('✅ [eskiKayitEventleri] Buton label yerine konuluyor');
        // Wrapper yoksa, label'ın yerine butonu koy
        checkboxLabel.replaceWith(kayitTuruToggleBtn);
      } else {
        console.error('❌ [eskiKayitEventleri] Checkbox parent bulunamadı!');
      }

      console.log('✅ [eskiKayitEventleri] Toggle butonu oluşturuldu ve yerleştirildi', {
        buttonId: kayitTuruToggleBtn.id,
        wrapperFound: !!wrapper,
      });
    }
  }

  // Checkbox'ı tekrar bul (oluşturulduysa ID'si olabilir)
  const finalEskiKayitCheckbox = Helpers.$('#eskiKayit') as HTMLInputElement | null;

  if (kayitTuruToggleBtn) {
    // Eğer daha önce listener eklenmişse, önce kaldır
    if (kayitTuruToggleHandler && kayitTuruToggleBtn) {
      kayitTuruToggleBtn.removeEventListener('click', kayitTuruToggleHandler);
    }

    // İlk yüklemede durumu kontrol et
    const eskiKayit = finalEskiKayitCheckbox ? finalEskiKayitCheckbox.checked : false;
    kayitTuruToggleGuncelle(eskiKayit);

    // Toggle butonuna tıklandığında - Handler'ı sakla
    kayitTuruToggleHandler = function (e: Event) {
      e.preventDefault();
      // Mevcut durumu al ve tersine çevir
      const currentCheckbox = Helpers.$('#eskiKayit') as HTMLInputElement | null;
      const simdiEskiKayit = currentCheckbox ? currentCheckbox.checked : false;
      const yeniDurum = !simdiEskiKayit; // Toggle
      console.log('🔄 [eskiKayitEventleri] Durum değiştiriliyor', { simdiEskiKayit, yeniDurum });
      kayitTuruToggleGuncelle(yeniDurum);
      if (currentCheckbox) {
        currentCheckbox.checked = yeniDurum;
      } else {
        // Checkbox yoksa, hidden input oluştur
        const form = Helpers.$('#sporcuKayitForm') as HTMLFormElement | null;
        if (form) {
          let hiddenCheckbox = Helpers.$('#eskiKayit') as HTMLInputElement | null;
          if (!hiddenCheckbox) {
            hiddenCheckbox = document.createElement('input');
            hiddenCheckbox.type = 'checkbox';
            hiddenCheckbox.id = 'eskiKayit';
            hiddenCheckbox.name = 'eskiKayit';
            hiddenCheckbox.style.display = 'none';
            form.appendChild(hiddenCheckbox);
          }
          hiddenCheckbox.checked = yeniDurum;
        }
      }
    };

    kayitTuruToggleBtn.addEventListener('click', kayitTuruToggleHandler);
    console.log('✅ [eskiKayitEventleri] Event listener eklendi');
  } else {
    console.error('❌ [eskiKayitEventleri] Toggle butonu bulunamadı ve oluşturulamadı');
  }
}

// Toggle handler'ı sakla (zombie event önleme)
let kayitTuruToggleHandler: ((e: Event) => void) | null = null;

/**
 * Kayıt türü toggle butonunun görsel durumunu güncelle
 * @param eskiKayit - Eski kayıt mı?
 */
function kayitTuruToggleGuncelle(eskiKayit: boolean): void {
  console.log('🔄 [kayitTuruToggleGuncelle] Çağrıldı', { eskiKayit });

  const kayitTuruToggleBtn = Helpers.$('#kayitTuruToggle') as HTMLButtonElement | null;

  if (!kayitTuruToggleBtn) {
    console.warn('⚠️ [kayitTuruToggleGuncelle] Toggle butonu bulunamadı');
    return;
  }

  if (eskiKayit) {
    // Eski Kayıt aktif
    kayitTuruToggleBtn.classList.remove('btn-success');
    kayitTuruToggleBtn.classList.add('btn-warning', 'active');
    kayitTuruToggleBtn.textContent = 'Eski Kayıt';
    kayitTuruToggleBtn.innerHTML = '<i class="fa-solid fa-clock-rotate-left"></i> Eski Kayıt';
    kayitTuruToggleBtn.title =
      'Eski kayıt seçili: Geçmiş aylara borç yazılmayacak, sadece içinde bulunulan ay ve sonrası için borç hesaplanacak.';
    console.log('✅ [kayitTuruToggleGuncelle] Buton Eski Kayıt olarak güncellendi');
  } else {
    // Yeni Kayıt aktif (varsayılan)
    kayitTuruToggleBtn.classList.remove('btn-warning', 'active');
    kayitTuruToggleBtn.classList.add('btn-success');
    kayitTuruToggleBtn.textContent = 'Yeni Kayıt';
    kayitTuruToggleBtn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Yeni Kayıt';
    kayitTuruToggleBtn.title = 'Yeni kayıt seçili: Kayıt tarihinden itibaren borç hesaplanacak.';
    console.log('✅ [kayitTuruToggleGuncelle] Buton Yeni Kayıt olarak güncellendi');
  }
}

/**
 * Buton durumunu kontrol et
 */
function butonDurumunuKontrolEt(): {
  form: HTMLFormElement | null;
  kaydetBtn: HTMLButtonElement | null;
} {
  const form = Helpers.$('#sporcuKayitForm') as HTMLFormElement | null;
  const kaydetBtn = Helpers.$('#kaydetBtn') as HTMLButtonElement | null;

  return { form, kaydetBtn };
}

/**
 * Sporcu detay raporu veri yapısı
 */
interface SporcuDetayRaporu {
  sporcu: Sporcu;
  devam: {
    geldigiGunler: Array<{
      tarih: string;
      durum: 'var' | 'izinli';
      grup: string;
    }>;
    gelmedigiGunler: Array<{
      tarih: string;
      durum: 'yok';
      grup: string;
    }>;
    toplamGun: number;
    varGun: number;
    yokGun: number;
    izinliGun: number;
    devamOrani: number;
  };
  finansal: {
    /** Net ödenecek tutar (outstanding balance) */
    toplamBorc: number;
    tahakkukAidat: number;
    tahakkukMalzeme: number;
    tahsilatToplam: number;
    fazlaOdeme: number;
    sonOdemeTarihi: string | null;
    odemeGecmisi: Array<{
      donem: string;
      tutar: number;
      odendi: boolean;
      odemeTarihi: string | null;
    }>;
  };
}

/**
 * Yoklama `grup` alanı `v2:` + JSON biçiminde saklanabilir (yoklama oturum anahtarı).
 * Rapor ve PDF’de ham JSON yerine okunaklı tek satır üretir.
 */
function yoklamaGrupEtiketiRapor(raw: string): string {
  const s = (raw ?? '').trim();
  if (!s) return '';
  if (!s.startsWith('v2:')) return s;
  try {
    const o = JSON.parse(s.slice(3)) as {
      b: string | null;
      t: string | null;
      g: string | null;
    };
    const parcalar: string[] = [];
    if (o.b) parcalar.push(o.b);
    if (o.t && o.t !== 'all') parcalar.push(o.t);
    if (o.g && o.g !== 'all') {
      if (o.g === '__none__') {
        parcalar.push('Antrenman grubu atanmamış');
      } else {
        const ag = Storage.antrenmanGrubuBul(o.g);
        parcalar.push(ag?.ad ?? o.g);
      }
    }
    return parcalar.length > 0 ? parcalar.join(' · ') : '—';
  } catch {
    return s;
  }
}

/**
 * Sporcu detay raporu oluştur
 */
function sporcuDetayRaporu(sporcuId: number): SporcuDetayRaporu | null {
  try {
    const sporcu = Storage.sporcuBul(sporcuId);
    if (!sporcu) return null;

    const yoklamalar = Storage.yoklamalariGetir();
    const aidatlar = Storage.aidatlariGetir();

    // Devam bilgileri
    const geldigiGunler: SporcuDetayRaporu['devam']['geldigiGunler'] = [];
    const gelmedigiGunler: SporcuDetayRaporu['devam']['gelmedigiGunler'] = [];

    yoklamalar.forEach(y => {
      const kayit = y.sporcular.find(s => s.id === sporcuId);
      if (kayit) {
        if (kayit.durum === 'var' || kayit.durum === 'izinli') {
          geldigiGunler.push({
            tarih: y.tarih,
            durum: kayit.durum,
            grup: yoklamaGrupEtiketiRapor(typeof y.grup === 'string' ? y.grup : ''),
          });
        } else if (kayit.durum === 'yok') {
          gelmedigiGunler.push({
            tarih: y.tarih,
            durum: 'yok',
            grup: yoklamaGrupEtiketiRapor(typeof y.grup === 'string' ? y.grup : ''),
          });
        }
      }
    });

    // Tarihe göre sırala (en yeni üstte)
    geldigiGunler.sort((a, b) => new Date(b.tarih).getTime() - new Date(a.tarih).getTime());
    gelmedigiGunler.sort((a, b) => new Date(b.tarih).getTime() - new Date(a.tarih).getTime());

    const sporcuAidatlari = aidatlar.filter(a => a.sporcuId === sporcuId);

    // Merkezi hesap: tahakkuk (brüt) kalemleri + tahsilat → net ödenecek / fazla ödeme
    const fin = Helpers.finansalHesapla(aidatlar, sporcuId);

    let sonOdemeTarihi: string | null = null;
    sporcuAidatlari.forEach(a => {
      const tahsilatMi = (a.tutar || 0) < 0 || a.islem_turu === 'Tahsilat';
      if (!tahsilatMi) return;
      const tarihStr = a.odemeTarihi || a.tarih;
      if (!tarihStr) return;
      const d = new Date(tarihStr).getTime();
      if (Number.isNaN(d)) return;
      if (!sonOdemeTarihi || d > new Date(sonOdemeTarihi).getTime()) {
        sonOdemeTarihi = tarihStr;
      }
    });

    // Ödeme geçmişi (son 6 ay)
    const bugun = new Date();
    const odemeGecmisi: SporcuDetayRaporu['finansal']['odemeGecmisi'] = [];
    for (let i = 0; i < 6; i++) {
      const tarih = new Date(bugun.getFullYear(), bugun.getMonth() - i, 1);
      const ay = tarih.getMonth() + 1;
      const yil = tarih.getFullYear();
      const donem = `${Helpers.ayAdi(ay)} ${yil}`;

      // Dönem borç / tahakkuk satırları (Aidat + Malzeme + türsüz eski kayıtlar) — `finansalHesapla` ile uyumlu
      const donemBorcSatirlari = sporcuAidatlari.filter(
        a =>
          a.donemAy === ay &&
          a.donemYil === yil &&
          (a.tutar || 0) > 0 &&
          (a.islem_turu === 'Aidat' || a.islem_turu === 'Malzeme' || !a.islem_turu)
      );

      const beklenenTutar = donemBorcSatirlari.reduce((sum, a) => sum + (a.tutar || 0), 0);

      // Bu döneme yazılmış tahsilatlar (PDF / liste tutarı: borç yoksa ödenen tutar gösterilir)
      const donemTahsilatSatirlari = sporcuAidatlari.filter(
        a =>
          a.donemAy === ay &&
          a.donemYil === yil &&
          ((a.tutar || 0) < 0 || a.islem_turu === 'Tahsilat')
      );
      const tahsilatDonemToplam = donemTahsilatSatirlari.reduce(
        (sum, a) => sum + Math.abs(a.tutar || 0),
        0
      );

      // Ödeme / kapanış: tahsilat satırı, veya borç satırında Ödendi
      const donemOdemeleri = sporcuAidatlari.filter(
        a =>
          a.donemAy === ay &&
          a.donemYil === yil &&
          ((a.tutar || 0) < 0 || a.odemeDurumu === 'Ödendi' || a.islem_turu === 'Tahsilat')
      );

      const odendi =
        donemOdemeleri.length > 0 || donemBorcSatirlari.some(a => a.odemeDurumu === 'Ödendi');

      /** Görünen tutar: önce dönem tahakkuku; yoksa yalnız tahsilat varsa o dönemin tahsilatı (0 TL Ödendi hatasını önler) */
      const tutar =
        beklenenTutar > 0 ? beklenenTutar : tahsilatDonemToplam > 0 ? tahsilatDonemToplam : 0;

      let odemeTarihi: string | null = null;
      if (donemTahsilatSatirlari.length > 0) {
        let enSon = 0;
        for (const a of donemTahsilatSatirlari) {
          const raw = a.odemeTarihi || a.tarih;
          if (!raw) continue;
          const ts = new Date(raw).getTime();
          if (!Number.isNaN(ts) && ts >= enSon) {
            enSon = ts;
            odemeTarihi = raw;
          }
        }
      }
      if (!odemeTarihi && donemOdemeleri.length > 0) {
        odemeTarihi = donemOdemeleri[0].odemeTarihi || donemOdemeleri[0].tarih || null;
      }

      // Sadece borç varsa veya ödeme yapılmışsa göster
      if (tutar > 0 || odendi) {
        odemeGecmisi.push({
          donem,
          tutar,
          odendi,
          odemeTarihi,
        });
      }
    }

    return {
      sporcu,
      devam: {
        geldigiGunler,
        gelmedigiGunler,
        toplamGun: geldigiGunler.length + gelmedigiGunler.length,
        varGun: geldigiGunler.filter(g => g.durum === 'var').length,
        yokGun: gelmedigiGunler.length,
        izinliGun: geldigiGunler.filter(g => g.durum === 'izinli').length,
        devamOrani: Helpers.yuzdeHesapla(
          geldigiGunler.length,
          geldigiGunler.length + gelmedigiGunler.length
        ),
      },
      finansal: {
        toplamBorc: fin.kalanBorc,
        tahakkukAidat: fin.tahakkukAidat,
        tahakkukMalzeme: fin.tahakkukMalzeme,
        tahsilatToplam: fin.toplamTahsilat,
        fazlaOdeme: fin.fazlaOdeme,
        sonOdemeTarihi,
        odemeGecmisi,
      },
    };
  } catch (error) {
    console.error('❌ [Sporcu] sporcuDetayRaporu hatası:', error);
    return null;
  }
}

// ============================================================================
// BÖLÜM 22: SPORCU RAPOR
// ============================================================================
// Bu bölümde sporcu detay raporu işlemleri yer alır.
// - Kişisel bilgiler
// - Yoklama istatistikleri
// - Aidat özeti
// - Ödeme geçmişi
// - Grafikler (Chart.js)
// ============================================================================

/**
 * Sporcu raporu göster
 */
// Son açılan raporun sporcu ID'sini sakla (sayfa yenilendiğinde restore etmek için)
let lastRaporSporcuId: number | null = null;

function raporGoster(sporcuId: number): void {
  try {
    console.log('📊 [Sporcu] raporGoster çağrıldı, sporcuId:', sporcuId);

    // Son açılan raporun ID'sini sakla
    lastRaporSporcuId = sporcuId;
    localStorage.setItem('lastRaporSporcuId', sporcuId.toString());

    const rapor = sporcuDetayRaporu(sporcuId);

    if (!rapor) {
      console.warn('⚠️ [Sporcu] raporGoster - Sporcu bulunamadı:', sporcuId);
      Helpers.toast('Sporcu bulunamadı!', 'error');
      return;
    }

    console.log("✅ [Sporcu] raporGoster - Rapor oluşturuldu, view'e geçiliyor...");

    // Önce önceki rapor açıksa temizle (event listener'ları ve style'ları)
    const existingRaporView = Helpers.$('#sporcu-detay-raporu');
    if (existingRaporView && existingRaporView.classList.contains('active')) {
      // Önceki event listener'ları temizle
      if (raporWindowResizeListener) {
        window.removeEventListener('resize', raporWindowResizeListener);
        raporWindowResizeListener = null;
      }
      if (raporViewportResizeListener && window.visualViewport) {
        window.visualViewport.removeEventListener('resize', raporViewportResizeListener);
        raporViewportResizeListener = null;
      }
      if (raporButtonResizeHandler) {
        window.removeEventListener('resize', raporButtonResizeHandler);
        raporButtonResizeHandler = null;
      }
      // Body style'ları reset et
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
      document.body.style.top = '';
      document.body.style.left = '';
    }

    // View'e geç
    if (window.App && typeof window.App.viewGoster === 'function') {
      window.App.viewGoster('sporcu-detay-raporu');

      // Mobilde body scroll'u engelle
      const isMobile = window.innerWidth <= SPORCU_CONSTANTS.MOBILE_BREAKPOINT;
      if (isMobile) {
        // Scroll pozisyonunu kaydet (geri dönünce restore etmek için)
        savedScrollPosition = window.scrollY || window.pageYOffset || 0;
        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.width = '100%';
        document.body.style.height = '100%';
        document.body.style.top = `-${savedScrollPosition}px`;
        document.body.style.left = '0';
      }
    } else {
      console.error('❌ [Sporcu] raporGoster - window.App.viewGoster bulunamadı!');
      Helpers.toast('Sayfa geçişi yapılamadı!', 'error');
      return;
    }

    // Rapor içeriğini render et
    setTimeout(() => {
      raporRender(rapor);
      console.log('✅ [Sporcu] raporGoster - Rapor render edildi');

      // Viewport height değişikliğini dinle (DevTools açılıp kapanınca)
      // Gerçek sorun: 100vh DevTools açılıp kapanınca değişiyor
      // Çözüm: window.innerHeight kullanarak dinamik hesaplama
      // Tüm ekran boyutlarına uyum sağlamak için kapsamlı responsive mekanizma
      const updateViewportHeight = () => {
        const raporView = Helpers.$('#sporcu-detay-raporu');
        if (raporView && raporView.classList.contains('active')) {
          const windowWidth = window.innerWidth;
          const windowHeight = window.innerHeight;
          const isMobile = windowWidth <= SPORCU_CONSTANTS.MOBILE_BREAKPOINT;
          const isTablet = windowWidth > SPORCU_CONSTANTS.MOBILE_BREAKPOINT && windowWidth <= 1024;
          const isDesktop = windowWidth > 1024;

          // İçeriğin boş olup olmadığını kontrol et ve restore et
          const raporContent = raporView.querySelector('#raporContent') as HTMLElement | null;
          const hasContent =
            raporContent &&
            (raporContent.children.length > 0 ||
              (raporContent.innerHTML &&
                raporContent.innerHTML.trim() !== '' &&
                !raporContent.innerHTML.includes('İçerik dinamik olarak doldurulacak')));

          // Eğer içerik boşsa ve lastRaporSporcuId varsa, restore et
          if (
            !hasContent &&
            lastRaporSporcuId &&
            window.Sporcu &&
            typeof window.Sporcu.raporGoster === 'function'
          ) {
            const sporcuId = parseInt(lastRaporSporcuId.toString(), 10);
            if (!isNaN(sporcuId)) {
              // Raporu restore et
              setTimeout(() => {
                window.Sporcu.raporGoster(sporcuId);
              }, 100);
            }
          }

          // Tüm ekran boyutları için dinamik height hesaplama
          if (isMobile) {
            // Mobilde: viewport height'ı dinamik hesapla
            const vh = windowHeight;
            raporView.style.height = `${vh}px`;

            // Container height'ı da güncelle (tam viewport)
            const container = raporView.querySelector('.sporcu-rapor-container') as HTMLElement;
            if (container) {
              container.style.height = `${vh}px`;
              container.style.maxHeight = `${vh}px`;
            }

            // Body height'ı da güncelle (scroll sorununu önlemek için)
            if (document.body.style.position === 'fixed') {
              document.body.style.height = `${vh}px`;
            }
          } else if (isTablet) {
            // Tablette: viewport height'ı dinamik hesapla ama container'ı sınırla
            const vh = windowHeight;
            raporView.style.height = '';

            const container = raporView.querySelector('.sporcu-rapor-container') as HTMLElement;
            if (container) {
              // Tablet için max-height: 90vh
              container.style.height = '';
              container.style.maxHeight = `${vh * 0.9}px`;
            }

            // Body style'ları reset et
            if (document.body.style.position === 'fixed') {
              document.body.style.height = '';
              document.body.style.position = '';
              document.body.style.width = '';
              document.body.style.top = '';
              document.body.style.left = '';
            }
          } else {
            // Masaüstünde: height'ı reset et
            raporView.style.height = '';
            const container = raporView.querySelector('.sporcu-rapor-container') as HTMLElement;
            if (container) {
              container.style.height = '';
              container.style.maxHeight = '';
            }

            // Body style'ları reset et
            if (document.body.style.position === 'fixed') {
              document.body.style.height = '';
              document.body.style.position = '';
              document.body.style.width = '';
              document.body.style.top = '';
              document.body.style.left = '';
            }
          }

          // İçeriğin görünürlüğünü ve boyutlarını kontrol et
          if (raporContent) {
            const contentComputedStyle = window.getComputedStyle(raporContent);
            const container = raporView.querySelector(
              '.sporcu-rapor-container'
            ) as HTMLElement | null;
            const containerComputedStyle = container ? window.getComputedStyle(container) : null;
          }
        }
      };

      // İlk yüklemede ve resize'da çalıştır
      updateViewportHeight();

      // Önce mevcut listener'ları temizle
      if (raporViewportResizeListener && window.visualViewport) {
        window.visualViewport.removeEventListener('resize', raporViewportResizeListener);
      }
      if (raporWindowResizeListener) {
        window.removeEventListener('resize', raporWindowResizeListener);
      }

      // Yeni listener'ları oluştur ve sakla - Debounced resize handler
      // Performans için debounce kullan (çok sık resize event'i geliyor)
      let resizeTimeout: number | null = null;
      const debouncedUpdateViewportHeight = () => {
        if (resizeTimeout !== null) {
          clearTimeout(resizeTimeout);
        }
        resizeTimeout = window.setTimeout(() => {
          updateViewportHeight();
          resizeTimeout = null;
        }, 150); // 150ms debounce
      };

      raporViewportResizeListener = debouncedUpdateViewportHeight;
      raporWindowResizeListener = debouncedUpdateViewportHeight;

      window.addEventListener('resize', raporWindowResizeListener);

      // Visual viewport API kullan (daha doğru)
      if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', raporViewportResizeListener);
      }

      // Orientation change event'i de dinle (mobil cihazlarda ekran döndürme)
      const orientationChangeHandler = () => {
        setTimeout(() => {
          updateViewportHeight();
        }, 200); // Orientation change'den sonra biraz bekle
      };

      window.addEventListener('orientationchange', orientationChangeHandler);

      // Cleanup için sakla
      (window as any).__raporOrientationChangeHandler = orientationChangeHandler;

      // Scroll pozisyonunu en üste sıfırla
      const raporView = Helpers.$('#sporcu-detay-raporu');
      if (raporView) {
        // View'in kendisini en üste scroll et
        raporView.scrollTop = 0;

        // Mobilde bottom sheet içindeki content area'yı scroll et
        const contentAreaEl = raporView.querySelector('.rapor-content') as HTMLElement;
        if (contentAreaEl) {
          contentAreaEl.scrollTop = 0;
        }

        // Container'ı da scroll et
        const container = raporView.querySelector('.sporcu-rapor-container') as HTMLElement;
        if (container) {
          container.scrollTop = 0;
        }
      }

      // Window scroll pozisyonunu da sıfırla (masaüstü için)
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'instant' });
      }

      // Body scroll pozisyonunu da sıfırla
      if (document.body) {
        document.body.scrollTop = 0;
        document.documentElement.scrollTop = 0;
      }
    }, SPORCU_CONSTANTS.RENDER_DELAY);
  } catch (error) {
    console.error('❌ [Sporcu] raporGoster hatası:', error);
    Helpers.toast('Rapor gösterilirken hata oluştu!', 'error');
  }
}

/**
 * Rapor içeriğini render et
 */
function raporRender(rapor: SporcuDetayRaporu): void {
  const contentEl = Helpers.$('#raporContent');
  const titleEl = Helpers.$('#raporTitle');

  if (!contentEl || !titleEl) {
    return;
  }

  const s = rapor.sporcu;
  const adSoyad = s.temelBilgiler?.adSoyad || '-';

  // Başlık güncelle
  titleEl.textContent = `Öğrenci Dosyası: ${adSoyad}`;

  // Tarih formatı
  const tarihFormat = (tarih: string) => {
    const d = new Date(tarih);
    const gun = String(d.getDate()).padStart(2, '0');
    const ay = String(d.getMonth() + 1).padStart(2, '0');
    const yil = d.getFullYear();
    return `${gun}.${ay}.${yil}`;
  };

  // HTML oluştur - Temel Bilgiler ile başla

  let html = `
    <!-- Temel Bilgiler -->
    <div class="rapor-card">
      <div class="rapor-card-header">
        <i class="fa-solid fa-id-card"></i>
        <h3>Temel Bilgiler</h3>
      </div>
      <div class="rapor-card-body">
        <div class="rapor-info-grid">
          <div class="rapor-info-item">
            <span class="rapor-info-label">Ad Soyad</span>
            <span class="rapor-info-value">${Helpers.escapeHtml(adSoyad)}</span>
          </div>
          ${
            s.temelBilgiler?.tcKimlik
              ? `
          <div class="rapor-info-item">
            <span class="rapor-info-label">TC Kimlik</span>
            <span class="rapor-info-value">${Helpers.escapeHtml(s.temelBilgiler.tcKimlik)}</span>
          </div>
          `
              : ''
          }
          ${
            s.temelBilgiler?.dogumTarihi
              ? `
          <div class="rapor-info-item">
            <span class="rapor-info-label">Doğum Tarihi</span>
            <span class="rapor-info-value">${tarihFormat(s.temelBilgiler.dogumTarihi)}</span>
          </div>
          `
              : ''
          }
          ${
            s.temelBilgiler?.cinsiyet
              ? `
          <div class="rapor-info-item">
            <span class="rapor-info-label">Cinsiyet</span>
            <span class="rapor-info-value">${Helpers.escapeHtml(s.temelBilgiler.cinsiyet)}</span>
          </div>
          `
              : ''
          }
          ${
            s.sporBilgileri?.brans
              ? `
          <div class="rapor-info-item">
            <span class="rapor-info-label">Branş</span>
            <span class="rapor-info-value">${Helpers.escapeHtml(s.sporBilgileri.brans)}</span>
          </div>
          `
              : ''
          }
          ${
            s.tffGruplari?.anaGrup
              ? `
          <div class="rapor-info-item">
            <span class="rapor-info-label">Yaş Grubu</span>
            <span class="rapor-info-value">${Helpers.escapeHtml(s.tffGruplari.anaGrup)}</span>
          </div>
          `
              : ''
          }
          ${
            s.sporBilgileri?.formaNo
              ? `
          <div class="rapor-info-item">
            <span class="rapor-info-label">Forma No</span>
            <span class="rapor-info-value">${Helpers.escapeHtml(s.sporBilgileri.formaNo)}</span>
          </div>
          `
              : ''
          }
        </div>
      </div>
    </div>

    <!-- İletişim Bilgileri -->
    <div class="rapor-card">
      <div class="rapor-card-header">
        <i class="fa-solid fa-phone"></i>
        <h3>İletişim Bilgileri</h3>
      </div>
      <div class="rapor-card-body">
        <div class="rapor-info-grid">
          ${
            s.iletisim?.telefon
              ? `
          <div class="rapor-info-item">
            <span class="rapor-info-label">Telefon</span>
            <span class="rapor-info-value">${Helpers.escapeHtml(s.iletisim.telefon)}</span>
          </div>
          `
              : ''
          }
          ${
            s.iletisim?.email
              ? `
          <div class="rapor-info-item">
            <span class="rapor-info-label">E-posta</span>
            <span class="rapor-info-value">${Helpers.escapeHtml(s.iletisim.email)}</span>
          </div>
          `
              : ''
          }
          ${
            s.veliBilgileri?.veli1?.ad
              ? `
          <div class="rapor-info-item">
            <span class="rapor-info-label">1. Veli</span>
            <span class="rapor-info-value">${Helpers.escapeHtml(s.veliBilgileri.veli1.ad)} ${s.veliBilgileri.veli1.yakinlik ? `(${Helpers.escapeHtml(s.veliBilgileri.veli1.yakinlik)})` : ''} ${s.veliBilgileri.veli1.telefon ? `- ${Helpers.escapeHtml(s.veliBilgileri.veli1.telefon)}` : ''}</span>
          </div>
          `
              : ''
          }
          ${
            s.veliBilgileri?.veli2?.ad
              ? `
          <div class="rapor-info-item">
            <span class="rapor-info-label">2. Veli</span>
            <span class="rapor-info-value">${Helpers.escapeHtml(s.veliBilgileri.veli2.ad)} ${s.veliBilgileri.veli2.telefon ? `- ${Helpers.escapeHtml(s.veliBilgileri.veli2.telefon)}` : ''}</span>
          </div>
          `
              : ''
          }
        </div>
      </div>
    </div>

    <!-- Geldiği Günler -->
    <div class="rapor-card">
      <div class="rapor-card-header">
        <i class="fa-solid fa-check-circle"></i>
        <h3>Geldiği Günler (${rapor.devam.geldigiGunler.length})</h3>
      </div>
      <div class="rapor-card-body">
        <div class="tarih-listesi" id="geldigiGunlerList">
          ${
            rapor.devam.geldigiGunler.length > 0
              ? rapor.devam.geldigiGunler
                  .map(
                    g => `
              <div class="tarih-item tarih-var">
                <span class="tarih-tarih">${tarihFormat(g.tarih)}</span>
                <span class="tarih-durum">${g.durum === 'var' ? 'Var' : 'İzinli'}</span>
                <span class="tarih-grup">${Helpers.escapeHtml(g.grup)}</span>
              </div>
            `
                  )
                  .join('')
              : '<p class="text-muted">Henüz kayıt yok</p>'
          }
        </div>
      </div>
    </div>

    <!-- Gelmediği Günler -->
    <div class="rapor-card">
      <div class="rapor-card-header">
        <i class="fa-solid fa-times-circle"></i>
        <h3>Gelmediği Günler (${rapor.devam.gelmedigiGunler.length})</h3>
      </div>
      <div class="rapor-card-body">
        <div class="tarih-listesi" id="gelmedigiGunlerList">
          ${
            rapor.devam.gelmedigiGunler.length > 0
              ? rapor.devam.gelmedigiGunler
                  .map(
                    g => `
              <div class="tarih-item tarih-yok">
                <span class="tarih-tarih">${tarihFormat(g.tarih)}</span>
                <span class="tarih-durum">Yok</span>
                <span class="tarih-grup">${Helpers.escapeHtml(g.grup)}</span>
              </div>
            `
                  )
                  .join('')
              : '<p class="text-muted">Tüm günler geldi</p>'
          }
        </div>
      </div>
    </div>

    <!-- Aidat Ödeme Geçmişi -->
    <div class="rapor-card">
      <div class="rapor-card-header">
        <i class="fa-solid fa-history"></i>
        <h3>Aidat Ödeme Geçmişi</h3>
      </div>
      <div class="rapor-card-body">
        <div class="odeme-gecmisi-list">
          ${
            rapor.finansal.odemeGecmisi.length > 0
              ? rapor.finansal.odemeGecmisi
                  .map(
                    o => `
              <div class="odeme-item ${o.odendi ? 'odendi' : 'borclu'}">
                <span class="odeme-donem">${Helpers.escapeHtml(o.donem)}</span>
                <span class="odeme-tutar">${Helpers.paraFormat(o.tutar)} TL</span>
                <span class="odeme-durum">${o.odendi ? '✅ Ödendi' : '⚠️ Borçlu'}</span>
                ${o.odemeTarihi ? `<span class="odeme-tarih">${tarihFormat(o.odemeTarihi)}</span>` : ''}
              </div>
            `
                  )
                  .join('')
              : '<p class="text-muted">Ödeme geçmişi yok</p>'
          }
        </div>
      </div>
    </div>

    <!-- Özet Kartlar (En Sonda) -->
    <div class="rapor-ozet-grid">
      <div class="rapor-card">
        <div class="rapor-card-header">
          <i class="fa-solid fa-chart-line"></i>
          <h3>Devam Durumu</h3>
        </div>
        <div class="rapor-card-body">
          <div class="rapor-stat">
            <span class="rapor-stat-label">Bu Ay Devam</span>
            <span class="rapor-stat-value">%${rapor.devam.devamOrani}</span>
          </div>
          <div class="rapor-stat">
            <span class="rapor-stat-label">Toplam</span>
            <span class="rapor-stat-value">${rapor.devam.varGun}/${rapor.devam.toplamGun} gün</span>
          </div>
        </div>
      </div>

      <div class="rapor-card">
        <div class="rapor-card-header">
          <i class="fa-solid fa-wallet"></i>
          <h3>Finansal Durum</h3>
        </div>
        <div class="rapor-card-body">
          <div class="rapor-stat">
            <span class="rapor-stat-label">Aidat (tahakkuk)</span>
            <span class="rapor-stat-value">${Helpers.paraFormat(rapor.finansal.tahakkukAidat)} TL</span>
          </div>
          <div class="rapor-stat">
            <span class="rapor-stat-label">Malzeme (tahakkuk)</span>
            <span class="rapor-stat-value">${Helpers.paraFormat(rapor.finansal.tahakkukMalzeme)} TL</span>
          </div>
          <div class="rapor-stat">
            <span class="rapor-stat-label">Tahsilat</span>
            <span class="rapor-stat-value">${Helpers.paraFormat(rapor.finansal.tahsilatToplam)} TL</span>
          </div>
          <div class="rapor-stat rapor-stat--net">
            <span class="rapor-stat-label">Ödenecek bakiye</span>
            <span class="rapor-stat-value ${rapor.finansal.toplamBorc > 0 ? 'text-danger' : 'text-success'}">${rapor.finansal.toplamBorc === 0 ? '—' : `${Helpers.paraFormat(rapor.finansal.toplamBorc)} TL`}</span>
          </div>
          ${
            rapor.finansal.fazlaOdeme > 0
              ? `
          <div class="rapor-stat">
            <span class="rapor-stat-label">Fazla ödeme (alacak)</span>
            <span class="rapor-stat-value text-success">${Helpers.paraFormat(rapor.finansal.fazlaOdeme)} TL</span>
          </div>`
              : ''
          }
        </div>
      </div>
    </div>
  `;

  contentEl.innerHTML = html;

  // İçeriğin temizlenip temizlenmediğini ve görünürlüğünü kontrol et (200ms sonra)
  setTimeout(() => {
    const contentElAfter = Helpers.$('#raporContent');
    const raporView = Helpers.$('#sporcu-detay-raporu');
    const container = raporView?.querySelector('.sporcu-rapor-container') as HTMLElement | null;
    const computedStyle = contentElAfter ? window.getComputedStyle(contentElAfter) : null;
    const containerComputedStyle = container ? window.getComputedStyle(container) : null;
    const raporViewComputedStyle = raporView ? window.getComputedStyle(raporView) : null;
    const isMobile = window.innerWidth <= SPORCU_CONSTANTS.MOBILE_BREAKPOINT;

    // Mobil görünümde height sorununu düzelt
    if (isMobile && contentElAfter && computedStyle && container) {
      const scrollHeight = contentElAfter.scrollHeight;
      const currentHeight = parseFloat(computedStyle.height);
      const containerHeight = parseFloat(containerComputedStyle?.height || '0');

      // İçeriğin gerçek yüksekliği mevcut height'tan büyükse düzelt
      if (scrollHeight > currentHeight && currentHeight < scrollHeight * 0.5) {
        // Container'ın yüksekliğini de ayarla (viewport height - header height)
        const header = container.querySelector('.rapor-header') as HTMLElement | null;
        const headerHeight = header ? parseFloat(window.getComputedStyle(header).height) : 60;
        const viewportHeight = window.innerHeight;
        // Container'ı tam ekran yap (hamburger menü butonunun altında kalmaması için)
        const targetContainerHeight = viewportHeight; // Tam viewport height
        const targetContentHeight = targetContainerHeight - headerHeight;

        // Container'ı ayarla
        container.style.height = `${targetContainerHeight}px`;
        container.style.maxHeight = `${targetContainerHeight}px`;

        // Content'i ayarla
        contentElAfter.style.minHeight = `${Math.max(scrollHeight, targetContentHeight)}px`;
        contentElAfter.style.height = 'auto';
        contentElAfter.style.maxHeight = 'none';
      }
    }
  }, 200);

  // İçeriğin temizlenip temizlenmediğini ve görünürlüğünü kontrol et (500ms sonra)
  setTimeout(() => {
    const contentElAfter = Helpers.$('#raporContent');
    const raporView = Helpers.$('#sporcu-detay-raporu');
    const container = raporView?.querySelector('.sporcu-rapor-container') as HTMLElement | null;
    const computedStyle = contentElAfter ? window.getComputedStyle(contentElAfter) : null;
    const containerComputedStyle = container ? window.getComputedStyle(container) : null;
    const raporViewComputedStyle = raporView ? window.getComputedStyle(raporView) : null;
    const isMobile = window.innerWidth <= SPORCU_CONSTANTS.MOBILE_BREAKPOINT;

    // Mobil görünümde height sorununu düzelt (tekrar kontrol)
    if (isMobile && contentElAfter && computedStyle && container) {
      const scrollHeight = contentElAfter.scrollHeight;
      const currentHeight = parseFloat(computedStyle.height);
      const containerHeight = parseFloat(containerComputedStyle?.height || '0');

      // İçeriğin gerçek yüksekliği mevcut height'tan büyükse düzelt
      if (scrollHeight > currentHeight && currentHeight < scrollHeight * 0.5) {
        // Container'ın yüksekliğini de ayarla (viewport height - header height)
        const header = container.querySelector('.rapor-header') as HTMLElement | null;
        const headerHeight = header ? parseFloat(window.getComputedStyle(header).height) : 60;
        const viewportHeight = window.innerHeight;
        // Container'ı tam ekran yap (hamburger menü butonunun altında kalmaması için)
        const targetContainerHeight = viewportHeight; // Tam viewport height
        const targetContentHeight = targetContainerHeight - headerHeight;

        // Container'ı ayarla
        container.style.height = `${targetContainerHeight}px`;
        container.style.maxHeight = `${targetContainerHeight}px`;

        // Content'i ayarla
        contentElAfter.style.minHeight = `${Math.max(scrollHeight, targetContentHeight)}px`;
        contentElAfter.style.height = 'auto';
        contentElAfter.style.maxHeight = 'none';
      }
    }
  }, 500);

  // Event listener'ları ekle ve butonların görünürlüğünü garanti et
  const geriBtn = Helpers.$('#raporGeriBtn') as HTMLButtonElement | null;
  const yazdirBtn = Helpers.$('#raporYazdirBtn') as HTMLButtonElement | null;
  const raporView = Helpers.$('#sporcu-detay-raporu');
  const raporHeader = Helpers.$('.rapor-header');

  // Mobil görünümde butonların görünürlüğünü kontrol et ve zorla görünür yap
  const isMobile = window.innerWidth <= SPORCU_CONSTANTS.MOBILE_BREAKPOINT;

  // Mobil görünümde content height'ı düzelt (hemen)
  if (isMobile && contentEl && raporView) {
    requestAnimationFrame(() => {
      const container = raporView.querySelector('.sporcu-rapor-container') as HTMLElement | null;
      if (container) {
        const scrollHeight = contentEl.scrollHeight;
        const computedHeight = parseFloat(window.getComputedStyle(contentEl).height);
        const header = container.querySelector('.rapor-header') as HTMLElement | null;
        const headerHeight = header ? parseFloat(window.getComputedStyle(header).height) : 60;
        const viewportHeight = window.innerHeight;
        // Container'ı tam ekran yap (hamburger menü butonunun altında kalmaması için)
        const targetContainerHeight = viewportHeight; // Tam viewport height
        const targetContentHeight = targetContainerHeight - headerHeight;

        if (scrollHeight > computedHeight && computedHeight < scrollHeight * 0.5) {
          // Container'ı ayarla
          container.style.height = `${targetContainerHeight}px`;
          container.style.maxHeight = `${targetContainerHeight}px`;

          // Content'i ayarla
          contentEl.style.minHeight = `${Math.max(scrollHeight, targetContentHeight)}px`;
          contentEl.style.height = 'auto';
          contentEl.style.maxHeight = 'none';
        }
      }
    });
  }

  /**
   * Butonların görünürlüğünü garanti et
   * Tüm olası CSS override'larını JavaScript ile geçersiz kıl
   */
  const ensureButtonsVisible = (): void => {
    const currentGeriBtn = Helpers.$('#raporGeriBtn') as HTMLButtonElement | null;
    const currentYazdirBtn = Helpers.$('#raporYazdirBtn') as HTMLButtonElement | null;
    const currentRaporHeader = Helpers.$('.rapor-header') as HTMLElement | null;
    const currentContainer = Helpers.$('.sporcu-rapor-container') as HTMLElement | null;
    const currentIsMobile = window.innerWidth <= SPORCU_CONSTANTS.MOBILE_BREAKPOINT;

    // Container'ın genişliğini garanti et
    if (currentContainer) {
      currentContainer.style.width = '100%';
      currentContainer.style.maxWidth = '100%';
      currentContainer.style.boxSizing = 'border-box';
    }

    // Header'ın genişliğini garanti et
    if (currentRaporHeader) {
      currentRaporHeader.style.display = currentIsMobile ? 'grid' : 'flex';
      currentRaporHeader.style.visibility = 'visible';
      currentRaporHeader.style.opacity = '1';
      currentRaporHeader.style.overflow = 'visible';
      currentRaporHeader.style.width = '100%';
      currentRaporHeader.style.maxWidth = '100%';
      currentRaporHeader.style.boxSizing = 'border-box';
    }

    if (currentGeriBtn) {
      currentGeriBtn.style.display = 'flex';
      currentGeriBtn.style.visibility = 'visible';
      currentGeriBtn.style.opacity = '1';
      currentGeriBtn.style.position = 'relative';
      currentGeriBtn.style.zIndex = '30';
      currentGeriBtn.style.pointerEvents = 'auto';
      currentGeriBtn.style.cursor = 'pointer';
      currentGeriBtn.style.boxSizing = 'border-box';
      if (currentIsMobile) {
        currentGeriBtn.style.width = '100%';
        currentGeriBtn.style.maxWidth = '100%';
        currentGeriBtn.style.minWidth = '0';
      } else {
        currentGeriBtn.style.width = 'auto';
      }
      currentGeriBtn.style.minHeight = '44px';
    }

    if (currentYazdirBtn) {
      currentYazdirBtn.style.display = 'flex';
      currentYazdirBtn.style.visibility = 'visible';
      currentYazdirBtn.style.opacity = '1';
      currentYazdirBtn.style.position = 'relative';
      currentYazdirBtn.style.zIndex = '30';
      currentYazdirBtn.style.pointerEvents = 'auto';
      currentYazdirBtn.style.cursor = 'pointer';
      currentYazdirBtn.style.boxSizing = 'border-box';
      if (currentIsMobile) {
        currentYazdirBtn.style.width = '100%';
        currentYazdirBtn.style.maxWidth = '100%';
        currentYazdirBtn.style.minWidth = '0';
      } else {
        currentYazdirBtn.style.width = 'auto';
      }
      currentYazdirBtn.style.minHeight = '44px';
    }
  };

  // Butonları hemen görünür yap
  ensureButtonsVisible();

  // Rapor kapatma fonksiyonu - Tüm event listener'ları ve style'ları temizle
  const raporKapat = () => {
    console.log('🔄 [Sporcu] raporKapat çağrıldı');

    // Tüm resize listener'ları temizle
    if (raporWindowResizeListener) {
      window.removeEventListener('resize', raporWindowResizeListener);
      raporWindowResizeListener = null;
    }

    if (raporViewportResizeListener && window.visualViewport) {
      window.visualViewport.removeEventListener('resize', raporViewportResizeListener);
      raporViewportResizeListener = null;
    }

    if (raporButtonResizeHandler) {
      window.removeEventListener('resize', raporButtonResizeHandler);
      raporButtonResizeHandler = null;
    }

    // Orientation change handler'ı temizle
    if ((window as any).__raporOrientationChangeHandler) {
      window.removeEventListener(
        'orientationchange',
        (window as any).__raporOrientationChangeHandler
      );
      (window as any).__raporOrientationChangeHandler = null;
    }

    // Event listener'ları temizle
    const geriBtn = Helpers.$('#raporGeriBtn') as HTMLButtonElement | null;
    const yazdirBtn = Helpers.$('#raporYazdirBtn') as HTMLButtonElement | null;
    const raporView = Helpers.$('#sporcu-detay-raporu');

    if (geriBtn && raporGeriBtnHandler) {
      geriBtn.removeEventListener('click', raporGeriBtnHandler);
      raporGeriBtnHandler = null;
    }

    if (yazdirBtn && raporYazdirBtnHandler) {
      yazdirBtn.removeEventListener('click', raporYazdirBtnHandler);
      raporYazdirBtnHandler = null;
    }

    if (raporView && raporOverlayClickHandler) {
      raporView.removeEventListener('click', raporOverlayClickHandler);
      raporOverlayClickHandler = null;
    }

    // Mobilde body scroll'u geri aç ve tüm style'ları reset et
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';
    document.body.style.height = '';
    document.body.style.top = '';
    document.body.style.left = '';

    // Rapor view'in style'larını da reset et
    if (raporView) {
      raporView.style.height = '';
      const container = raporView.querySelector('.sporcu-rapor-container') as HTMLElement;
      if (container) {
        container.style.height = '';
        container.style.maxHeight = '';
      }
    }

    // Scroll pozisyonunu restore et (kaydedilen pozisyon varsa)
    if (savedScrollPosition > 0) {
      requestAnimationFrame(() => {
        window.scrollTo({ top: savedScrollPosition, behavior: 'instant' });
        savedScrollPosition = 0;
      });
    }

    // Flag'i sıfırla
    isRaporEventsInitialized = false;

    // View'i kapat
    if (window.App && typeof window.App.viewGoster === 'function') {
      window.App.viewGoster('sporcu-listesi');
    }

    // Bir sonraki frame'de body'nin düzgün render edildiğinden emin ol
    requestAnimationFrame(() => {
      // Body'nin scroll'unun düzgün çalıştığından emin ol
      document.body.style.overflow = '';
      document.body.style.position = '';
    });
  };

  // Event listener'ları ekle - Önce mevcut olanları temizle
  if (isRaporEventsInitialized) {
    if (geriBtn && raporGeriBtnHandler) {
      geriBtn.removeEventListener('click', raporGeriBtnHandler);
      raporGeriBtnHandler = null;
    }
    if (yazdirBtn && raporYazdirBtnHandler) {
      yazdirBtn.removeEventListener('click', raporYazdirBtnHandler);
      raporYazdirBtnHandler = null;
    }
    if (raporView && raporOverlayClickHandler) {
      raporView.removeEventListener('click', raporOverlayClickHandler);
      raporOverlayClickHandler = null;
    }
  }

  // Yeni event handler'ları oluştur
  raporGeriBtnHandler = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('🔄 [Sporcu] Rapor Geri butonu tıklandı');
    raporKapat();
  };

  raporYazdirBtnHandler = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('🖨️ [Sporcu] Rapor Yazdır butonu tıklandı');

    // PDF indirme seçeneği sun
    if (typeof window !== 'undefined' && typeof (window as any).html2pdf !== 'undefined') {
      const pdfSec = Helpers.onay(
        'PDF olarak indirmek ister misiniz?\n\n"Evet" - PDF indir\n"Hayır" - Yazdır'
      );
      if (pdfSec) {
        sporcuRaporuPdfIndir();
      } else {
        window.print();
      }
    } else {
      window.print();
    }
  };

  // Event listener'ları ekle
  if (geriBtn) {
    geriBtn.addEventListener('click', raporGeriBtnHandler);
  }

  if (yazdirBtn) {
    yazdirBtn.addEventListener('click', raporYazdirBtnHandler);
  }

  // Mobilde overlay tıklanınca kapat
  if (raporView && window.innerWidth <= SPORCU_CONSTANTS.MOBILE_BREAKPOINT) {
    raporOverlayClickHandler = (e: Event) => {
      const target = e.target as HTMLElement;
      const container = raporView.querySelector('.sporcu-rapor-container') as HTMLElement;
      // Sadece overlay'e (container dışına) tıklanırsa kapat
      if (target === raporView || (container && !container.contains(target))) {
        raporKapat();
      }
    };
    raporView.addEventListener('click', raporOverlayClickHandler);
  }

  // Resize event'inde de kontrol et (ekran boyutu değiştiğinde)
  // Bu handler sadece buton görünürlüğü için, viewport height için değil
  // Önce mevcut handler'ı temizle
  if (raporButtonResizeHandler) {
    window.removeEventListener('resize', raporButtonResizeHandler);
  }

  raporButtonResizeHandler = (): void => {
    ensureButtonsVisible();
  };
  window.addEventListener('resize', raporButtonResizeHandler);

  // Flag'i set et
  isRaporEventsInitialized = true;

  /**
   * Sporcu detay raporunu PDF olarak indir - Profesyonel, uluslararası standartlara uygun
   */
  const sporcuRaporuPdfIndir = (): void => {
    if (typeof window === 'undefined' || typeof (window as any).html2pdf === 'undefined') {
      Helpers.toast('PDF kütüphanesi yüklenemedi!', 'error');
      window.print(); // Fallback olarak yazdır
      return;
    }

    const raporContent = Helpers.$('#raporContent') as HTMLElement | null;
    const raporTitle = Helpers.$('#raporTitle') as HTMLElement | null;
    const sporcuAdi =
      raporTitle?.textContent?.replace('Öğrenci Dosyası: ', '').trim() || 'Sporcu Raporu';

    if (!raporContent) {
      Helpers.toast('Rapor içeriği bulunamadı!', 'error');
      return;
    }

    const docMeta = buildReportDocumentMeta();
    const logoSrc = Helpers.soybisLogoUrl();
    const sporcuAdiGuvenli = reportEscapeHtml(sporcuAdi);

    // Mevcut DOM'u kopyala ve temizle
    const raporClone = raporContent.cloneNode(true) as HTMLElement;

    // Görünmez elementleri kaldır
    raporClone
      .querySelectorAll(
        '.btn, button, .no-print, .rapor-header, i.fa-solid, i.fa-regular, i.fa-brands'
      )
      .forEach(el => {
        el.remove();
      });

    // Başlıktan icon'u temizle
    raporClone.querySelectorAll('h2, h3').forEach(h => {
      const icons = h.querySelectorAll('i');
      icons.forEach(i => i.remove());
    });

    // Rapor verilerini topla - Daha güvenilir yöntem
    const kartlar: Array<{
      baslik: string;
      veriler: Array<{ label: string; deger: string; tip?: 'positive' | 'negative' | 'normal' }>;
      tip?: 'grid' | 'list' | 'table';
    }> = [];

    // Tüm kartları işle
    raporClone.querySelectorAll('.rapor-card').forEach(kart => {
      const baslikEl = kart.querySelector('h3');
      if (!baslikEl) return;

      const baslik = baslikEl.textContent?.trim() || '';
      const veriler: Array<{
        label: string;
        deger: string;
        tip?: 'positive' | 'negative' | 'normal';
      }> = [];
      let isOzetKart = kart.closest('.rapor-ozet-grid') !== null;

      // .rapor-stat (özet kartlar için)
      kart.querySelectorAll('.rapor-stat').forEach(stat => {
        const labelEl = stat.querySelector('.rapor-stat-label');
        const degerEl = stat.querySelector('.rapor-stat-value');
        if (labelEl && degerEl) {
          const label = labelEl.textContent?.trim() || '';
          const deger = degerEl.textContent?.trim() || '';

          let tip: 'positive' | 'negative' | 'normal' = 'normal';
          if (
            degerEl.classList.contains('text-success') ||
            degerEl.classList.contains('financial-positive')
          ) {
            tip = 'positive';
          } else if (
            degerEl.classList.contains('text-danger') ||
            degerEl.classList.contains('financial-negative')
          ) {
            tip = 'negative';
          }

          if (label && deger) {
            veriler.push({ label, deger, tip });
          }
        }
      });

      // .rapor-info-item (temel bilgiler, iletişim için)
      kart.querySelectorAll('.rapor-info-item').forEach(item => {
        const labelEl = item.querySelector('.rapor-info-label');
        const degerEl = item.querySelector('.rapor-info-value');
        if (labelEl && degerEl) {
          const label = labelEl.textContent?.trim() || '';
          const deger = degerEl.textContent?.trim() || '';
          if (label && deger) {
            veriler.push({ label, deger, tip: 'normal' });
          }
        }
      });

      // .rapor-list li (genel liste formatı)
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
        }
      });

      // Tarih listeleri (Geldiği/Gelmediği günler)
      const tarihListesi = kart.querySelector('.tarih-listesi');
      if (tarihListesi) {
        tarihListesi.querySelectorAll('.tarih-item').forEach(item => {
          const tarihEl = item.querySelector('.tarih-tarih');
          const durumEl = item.querySelector('.tarih-durum');
          const grupEl = item.querySelector('.tarih-grup');
          if (tarihEl && durumEl) {
            const tarih = tarihEl.textContent?.trim() || '';
            const durum = durumEl.textContent?.trim() || '';
            const grupRaw = grupEl?.textContent?.trim() || '';
            const grup = yoklamaGrupEtiketiRapor(grupRaw);
            const deger = `${durum}${grup ? ` - ${grup}` : ''}`;
            veriler.push({ label: tarih, deger, tip: 'normal' });
          }
        });
      }

      // Ödeme geçmişi
      const odemeListesi = kart.querySelector('.odeme-gecmisi-list');
      if (odemeListesi) {
        odemeListesi.querySelectorAll('.odeme-item').forEach(item => {
          const donemEl = item.querySelector('.odeme-donem');
          const tutarEl = item.querySelector('.odeme-tutar');
          const durumEl = item.querySelector('.odeme-durum');
          const tarihEl = item.querySelector('.odeme-tarih');
          if (donemEl && tutarEl && durumEl) {
            const donem = donemEl.textContent?.trim() || '';
            const tutar = tutarEl.textContent?.trim() || '';
            const durum = durumEl.textContent?.trim() || '';
            const tarih = tarihEl?.textContent?.trim() || '';
            const deger = `${tutar} - ${durum}${tarih ? ` (${tarih})` : ''}`;
            const isOdendi = item.classList.contains('odendi');
            veriler.push({
              label: donem,
              deger,
              tip: isOdendi ? 'positive' : 'negative',
            });
          }
        });
      }

      if (veriler.length > 0) {
        kartlar.push({
          baslik,
          veriler,
          tip: isOzetKart ? 'grid' : 'table',
        });
      }
    });

    // Kartları sırala: Devam Durumu ve Finansal Durum en sona
    const ozetKartlar = ['Devam Durumu', 'Finansal Durum'];
    const normalKartlar = kartlar.filter(k => !ozetKartlar.includes(k.baslik));
    const sonKartlar = kartlar.filter(k => ozetKartlar.includes(k.baslik));
    const siraliKartlar = [...normalKartlar, ...sonKartlar];

    const raporSporcuId =
      lastRaporSporcuId ??
      (() => {
        const raw =
          typeof localStorage !== 'undefined' ? localStorage.getItem('lastRaporSporcuId') : null;
        return raw ? parseInt(raw, 10) : 0;
      })();
    if (raporSporcuId > 0) {
      const fresh = sporcuDetayRaporu(raporSporcuId);
      if (fresh) {
        const f = fresh.finansal;
        const fmt = (n: number) => `${Helpers.paraFormat(n)} TL`;
        const finVeriler: Array<{
          label: string;
          deger: string;
          tip?: 'positive' | 'negative' | 'normal';
        }> = [
          { label: 'Aidat (tahakkuk)', deger: fmt(f.tahakkukAidat), tip: 'normal' },
          { label: 'Malzeme (tahakkuk)', deger: fmt(f.tahakkukMalzeme), tip: 'normal' },
          { label: 'Tahsilat', deger: fmt(f.tahsilatToplam), tip: 'normal' },
          {
            label: 'Ödenecek bakiye',
            deger: f.toplamBorc === 0 ? '—' : fmt(f.toplamBorc),
            tip: f.toplamBorc > 0 ? 'negative' : 'positive',
          },
        ];
        if (f.fazlaOdeme > 0) {
          finVeriler.push({
            label: 'Fazla ödeme (alacak)',
            deger: fmt(f.fazlaOdeme),
            tip: 'positive',
          });
        }
        const fi = siraliKartlar.findIndex(k => k.baslik === 'Finansal Durum');
        if (fi >= 0) {
          siraliKartlar[fi] = {
            baslik: 'Finansal Durum',
            veriler: finVeriler,
            tip: 'grid',
          };
        }
      }
    }

    // Debug log
    console.log('📊 Sporcu PDF Veri Toplama:', {
      kartSayisi: siraliKartlar.length,
      toplamVeri: siraliKartlar.reduce((sum, k) => sum + k.veriler.length, 0),
      kartlar: siraliKartlar.map(k => ({
        baslik: k.baslik,
        veriSayisi: k.veriler.length,
        tip: k.tip,
      })),
    });

    // Eğer hiç kart bulunamadıysa
    if (siraliKartlar.length === 0) {
      console.info('PDF: Sporcu kartları parse edilemedi, özet fallback hazırlanıyor.', {
        raporContent: !!raporContent,
        cards: raporContent?.querySelectorAll('.rapor-card').length || 0,
        innerHTML: raporContent?.innerHTML.substring(0, 200),
      });
      const allText = (raporContent?.textContent || '').replace(/\s+/g, ' ').trim();
      if (allText.length > 50) {
        siraliKartlar.push({
          baslik: 'Rapor Özeti',
          veriler: [{ label: 'İçerik', deger: allText.substring(0, 1200), tip: 'normal' }],
          tip: 'table',
        });
      }
    }

    // Eğer kartlar boşsa, mevcut DOM'u direkt kullan
    if (siraliKartlar.length === 0) {
      console.info('PDF: Sporcu DOM fallback akışı kullanılıyor.');
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
      header.style.borderBottom = '1px solid #cbd5e1';
      header.style.paddingBottom = '10px';
      header.style.marginBottom = '16px';
      header.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:flex-start; gap:10px; flex-wrap:wrap;">
        <div style="display:flex; align-items:center; gap:10px;">
          <img src="${logoSrc}" alt="SOYBIS 360°" width="42" height="42" style="object-fit:contain; display:block;" crossorigin="anonymous" />
          <div>
            <div style="font-size:11.5pt; font-weight:700; letter-spacing:0.03em; color:#0f172a;">SOYBIS 360°</div>
            <div style="font-size:8.8pt; color:#475569;">Spor Okulları Yönetim Bilgi Sistemi</div>
          </div>
        </div>
      </div>
      <div style="margin-top:10px; padding-top:8px; border-top:1px solid #e2e8f0;">
        <div style="font-size:15pt; font-weight:700; color:#0f172a; letter-spacing:-0.01em;">${sporcuAdiGuvenli}</div>
        <div style="font-size:8.5pt; color:#64748b; margin-top:2px;">SOYBIS Resmi Rapor Formatı</div>
      </div>
    `;
      tempDiv.appendChild(header);

      // İçeriği ekle
      raporClone.querySelectorAll('.rapor-card, .rapor-list li').forEach(el => {
        const node = el as HTMLElement;
        node.style.border = 'none';
        node.style.boxShadow = 'none';
        node.style.background = 'transparent';
        node.style.borderRadius = '0';
        node.style.color = '#000000';
      });
      raporClone.querySelectorAll('.rapor-list li').forEach(el => {
        const node = el as HTMLElement;
        node.style.borderTop = '1px solid #111111';
        node.style.borderBottom = '1px solid #111111';
        node.style.padding = '6px 0';
        node.style.margin = '0';
      });
      raporClone
        .querySelectorAll('.rapor-label, .rapor-deger, .financial-positive, .financial-negative')
        .forEach(el => {
          const node = el as HTMLElement;
          node.style.color = '#000000';
        });
      tempDiv.appendChild(raporClone);

      // Footer ekle
      const footer = document.createElement('div');
      footer.style.marginTop = '8px';
      footer.style.paddingTop = '6px';
      footer.style.borderTop = '1px solid #e2e8f0';
      footer.style.textAlign = 'center';
      footer.style.fontSize = '8pt';
      footer.style.color = '#718096';
      footer.style.pageBreakInside = 'avoid';
      footer.style.breakInside = 'avoid';
      footer.style.pageBreakBefore = 'avoid';
      footer.style.breakBefore = 'avoid-page';
      footer.innerHTML = `
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px;font-size:7.5pt;color:#64748b;border-top:1px solid #cbd5e1;padding-top:12px;margin-top:16px;">
        <div><strong style="color:#0f172a;">SOYBIS 360°</strong> · Yalnızca kurum içi kullanım</div>
        <div style="font-family:ui-monospace,monospace;font-size:7pt;">${docMeta.iso8601Utc}</div>
      </div>
    `;
      tempDiv.appendChild(footer);

      void (async () => {
        try {
          await runPdfExportWithRuntime({
            tempDiv,
            logoSrc,
            marginMm: [...PDF_EXPORT_MARGIN_MM],
            buildOptions: (w, h) => ({
              margin: [...PDF_EXPORT_MARGIN_MM],
              filename: `Athlete_Report_${sporcuAdi.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`,
              image: { type: 'jpeg', quality: 0.98 },
              html2canvas: {
                scale: getHtml2PdfCanvasScale(),
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
            }),
          });
          Helpers.toast('PDF başarıyla indirildi!', 'success');
        } catch (error: unknown) {
          console.error('PDF oluşturma hatası:', error);
          Helpers.toast('PDF oluşturulurken hata oluştu!', 'error');
          window.print();
        }
      })();
      return;
    }

    /* html2pdf köküne tam belge yazmak head stillerini düşürebilir; rapor modülü gibi yalnızca stil + gövde parçası */
    const sporcuRaporPdfExtraStyles = `
.pdf-page--sporcu-detay {
  max-width: 100%;
  overflow-wrap: anywhere;
  word-wrap: break-word;
}
.pdf-page--sporcu-detay .pdf-h1 {
  word-break: break-word;
  overflow-wrap: anywhere;
}
.pdf-page--sporcu-detay .pdf-stats-grid {
  grid-template-columns: 1fr;
  gap: 10px;
}
.pdf-page--sporcu-detay .pdf-stat-card,
.pdf-page--sporcu-detay .pdf-stat-label,
.pdf-page--sporcu-detay .pdf-stat-value {
  min-width: 0;
  max-width: 100%;
  overflow-wrap: anywhere;
  word-break: break-word;
}
.pdf-page--sporcu-detay .pdf-stat-value {
  font-size: 14pt;
  line-height: 1.25;
}
.pdf-page--sporcu-detay .pdf-table {
  table-layout: fixed;
  width: 100%;
}
.pdf-page--sporcu-detay .pdf-td-label,
.pdf-page--sporcu-detay .pdf-td-value {
  overflow-wrap: anywhere;
  word-break: break-word;
}
.pdf-page--sporcu-detay .pdf-footer-left {
  max-width: 50%;
}
.pdf-page--sporcu-detay .pdf-footer-right {
  white-space: normal !important;
  max-width: 48%;
  text-align: right;
}
/* Bölüm başlığı çizgisi + tablo thead üst çizgisi üst üste binmesin (boş satır hissi) */
.pdf-page--sporcu-detay .pdf-section .pdf-h2 {
  border-bottom: none;
  margin-bottom: 6px;
  padding-bottom: 2px;
}
.pdf-page--sporcu-detay .pdf-table thead th {
  border-top: 1px solid #111111 !important;
}
`;

    const pdfHTML = `
<style>${REPORT_PDF_STYLES}</style>
<style>${sporcuRaporPdfExtraStyles}</style>
  <div class="pdf-page pdf-page--sporcu-detay">
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
        <div class="pdf-h1">${sporcuAdiGuvenli}</div>
        <div class="pdf-h1-sub">SOYBIS Resmi Rapor Formatı</div>
      </div>
    </div>
    <div class="pdf-content">
      ${siraliKartlar
        .map(kart => {
          if (kart.tip === 'grid') {
            return `
            <div class="pdf-section">
              <div class="pdf-h2">${reportEscapeHtml(kart.baslik)}</div>
              <div class="pdf-stats-grid">
                ${kart.veriler
                  .map(
                    v => `
                  <div class="pdf-stat-card">
                    <div class="pdf-stat-label">${reportEscapeHtml(v.label)}</div>
                    <div class="pdf-stat-value ${v.tip === 'positive' ? 'positive' : v.tip === 'negative' ? 'negative' : ''}">${reportEscapeHtml(v.deger)}</div>
                  </div>
                `
                  )
                  .join('')}
              </div>
            </div>
          `;
          }
          return `
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
          `;
        })
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

    // Geçici container oluştur
    const tempDiv = document.createElement('div');
    tempDiv.style.width = pdfExportRootWidthMm(PDF_EXPORT_MARGIN_MM);
    tempDiv.style.background = '#ffffff';
    tempDiv.style.overflow = 'visible';
    tempDiv.innerHTML = pdfHTML;
    stylePdfExportCaptureRoot(tempDiv);
    void (async () => {
      try {
        await runPdfExportWithRuntime({
          tempDiv,
          logoSrc,
          marginMm: [...PDF_EXPORT_MARGIN_MM],
          buildOptions: (width, height) => ({
            margin: [...PDF_EXPORT_MARGIN_MM],
            filename: `Athlete_Report_${sporcuAdi.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`,
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
        window.print();
      }
    })();
  };

  if (geriBtn && raporGeriBtnHandler) {
    // Eski listener'ı kaldır (varsa)
    geriBtn.removeEventListener('click', raporGeriBtnHandler);
    // Yeni listener ekle
    geriBtn.addEventListener('click', raporGeriBtnHandler);
    ensureButtonsVisible();
  }

  if (yazdirBtn && raporYazdirBtnHandler) {
    // Eski listener'ı kaldır (varsa)
    yazdirBtn.removeEventListener('click', raporYazdirBtnHandler);
    // Yeni listener ekle
    yazdirBtn.addEventListener('click', raporYazdirBtnHandler);
    ensureButtonsVisible();
  }

  // requestAnimationFrame ile bir sonraki frame'de tekrar kontrol et
  requestAnimationFrame(() => {
    ensureButtonsVisible();

    // Bir kez daha kontrol et (CSS yüklenmesi için)
    setTimeout(() => {
      ensureButtonsVisible();
    }, SPORCU_CONSTANTS.RENDER_DELAY);
  });

  // Mobil: Overlay'e tıklanınca kapat - Bu zaten yukarıda (raporRender içinde) eklendi
  // Duplicate önlemek için burada tekrar eklenmiyor
}

/**
 * Sporcu kayıt tarihini al (basit versiyon)
 */
function sporcuKayitTarihiAl(sporcu: Sporcu): Date | null {
  const adaylar = [
    sporcu?.kayitTarihi,
    (sporcu as any)?.kayitBilgileri?.kayitTarihi,
    (sporcu as any)?.createdAt,
    (sporcu as any)?.olusturulmaTarihi,
  ];

  for (const aday of adaylar) {
    if (!aday) continue;

    if (typeof aday === 'string' && aday.includes('.')) {
      const parts = aday.split('.');
      if (parts.length === 3) {
        const gun = parseInt(parts[0], 10);
        const ay = parseInt(parts[1], 10) - 1;
        const yil = parseInt(parts[2], 10);
        if (
          !isNaN(gun) &&
          !isNaN(ay) &&
          !isNaN(yil) &&
          gun >= 1 &&
          gun <= 31 &&
          ay >= 0 &&
          ay <= 11 &&
          yil > 0
        ) {
          const date = new Date(yil, ay, gun);
          if (date.getFullYear() === yil && date.getMonth() === ay && date.getDate() === gun) {
            return date;
          }
        }
      }
    }

    const standardDate = new Date(aday);
    if (!isNaN(standardDate.getTime())) {
      return standardDate;
    }
  }

  return null;
}

// ============================================================================
// BÖLÜM 23: TOPLU ZAM
// ============================================================================
// Bu bölümde toplu zam işlemleri yer alır.
// Ayarlar modülünden çağrılır.
// - Modal oluşturma
// - Önizleme
// - Zam uygulama
// ============================================================================

/**
 * Gelecek aylar borç kayıtlarını güncelle (toplu zam için)
 * Belirtilen tarihten itibaren geçerli olacak şekilde günceller
 * 1. Eski borç kayıtlarını siler
 * 2. Yeni ücretle gelecek aylar için borç kayıtları oluşturur
 */
function gelecekAylarBorcKayitlariniGuncelle(
  sporcuId: number,
  eskiUcret: number,
  yeniUcret: number,
  gecerlilikAy: number,
  gecerlilikYil: number
): void {
  const sporcu = Storage.sporculariGetir().find(s => s.id === sporcuId);
  if (!sporcu) return;

  const bursluMu = sporcu.odemeBilgileri?.burslu || false;
  if (bursluMu || yeniUcret <= 0) {
    return;
  }

  /**
   * Dönem ay farkını hesapla (helper fonksiyon)
   */
  const donemAyFarkiHesapla = (
    donemAy: number,
    donemYil: number,
    kayitAy: number,
    kayitYil: number
  ): number => {
    return (donemYil - kayitYil) * 12 + (donemAy - kayitAy);
  };

  const aidatlar = Storage.aidatlariGetir();

  const gecerlilikTarihindenSonrakiBorclari = aidatlar.filter(a => {
    if (a.sporcuId !== sporcuId) return false;
    if (a.islem_turu !== 'Aidat') return false;

    const donemAyFarki = donemAyFarkiHesapla(a.donemAy, a.donemYil, gecerlilikAy, gecerlilikYil);
    return donemAyFarki >= 0;
  });

  if (gecerlilikTarihindenSonrakiBorclari.length > 0) {
    const kalanAidatlar = aidatlar.filter(
      a => !gecerlilikTarihindenSonrakiBorclari.find(b => b.id === a.id)
    );
    Storage.kaydet(Storage.STORAGE_KEYS.AIDATLAR, kalanAidatlar);
  }

  const kayitTarihi = sporcuKayitTarihiAl(sporcu);
  if (!kayitTarihi) return;

  const kayitAy = kayitTarihi.getMonth() + 1;
  const kayitYil = kayitTarihi.getFullYear();
  const kayitGunu = kayitTarihi.getDate();

  const gelecekAySayisi = 12;

  for (let i = 0; i < gelecekAySayisi; i++) {
    let hedefAy = gecerlilikAy + i;
    let hedefYil = gecerlilikYil;

    while (hedefAy > 12) {
      hedefAy -= 12;
      hedefYil += 1;
    }

    const donemAyFarki = donemAyFarkiHesapla(hedefAy, hedefYil, kayitAy, kayitYil);
    if (donemAyFarki < 0) continue;

    if (donemAyFarki === 0 && kayitGunu > 1) {
      continue;
    }

    const guncellenmisAidatlar = Storage.aidatlariGetir();
    const mevcutKayit = guncellenmisAidatlar.find(
      a =>
        a.sporcuId === sporcuId &&
        a.donemAy === hedefAy &&
        a.donemYil === hedefYil &&
        a.islem_turu === 'Aidat' &&
        (a.tutar || 0) > 0
    );

    if (mevcutKayit) continue;

    const hedefTarih = new Date(hedefYil, hedefAy - 1, kayitGunu);
    if (isNaN(hedefTarih.getTime())) continue;

    const yeniAidat: any = {
      sporcuId: sporcuId,
      tutar: yeniUcret,
      tarih: hedefTarih.toISOString(),
      donemAy: hedefAy,
      donemYil: hedefYil,
      aciklama: `${Helpers.ayAdi(hedefAy)} ${hedefYil} Aidatı`,
      tip: 'zam',
      islem_turu: 'Aidat',
      odemeDurumu: 'Ödenmedi',
    };

    Storage.aidatKaydet(yeniAidat);
  }
}

/**
 * Toplu zam form değerlerini al
 */
interface TopluZamFormValues {
  zamTuru: string;
  zamMiktar: number;
  zamYuzde: number;
  zamEnflasyon: number;
  bransFiltre: string;
  durumFiltre: string;
  yasGrubuFiltre: string;
  gecerlilikAy: number;
  gecerlilikYil: number;
}

function topluZamFormDegerleriniAl(): TopluZamFormValues {
  const { ay: buAy, yil: buYil } = Helpers.suAnkiDonem();
  const gelecekAy = buAy === 12 ? 1 : buAy + 1;
  const gelecekYil = buAy === 12 ? buYil + 1 : buYil;

  const gecerlilikAySelect = Helpers.$('#zamGecerlilikAy') as HTMLSelectElement | null;
  const gecerlilikYilSelect = Helpers.$('#zamGecerlilikYil') as HTMLSelectElement | null;

  return {
    zamTuru: (Helpers.$('#zamTuru') as HTMLSelectElement | null)?.value || 'sabit',
    zamMiktar: Helpers.paraCoz((Helpers.$('#zamMiktar') as HTMLInputElement | null)?.value || '0'),
    zamYuzde: parseFloat((Helpers.$('#zamYuzde') as HTMLInputElement | null)?.value || '0'),
    zamEnflasyon: parseFloat((Helpers.$('#zamEnflasyon') as HTMLInputElement | null)?.value || '0'),
    bransFiltre: (Helpers.$('#zamBransFiltre') as HTMLSelectElement | null)?.value || '',
    durumFiltre: (Helpers.$('#zamDurumFiltre') as HTMLSelectElement | null)?.value || '',
    yasGrubuFiltre: (Helpers.$('#zamYasGrubuFiltre') as HTMLSelectElement | null)?.value || '',
    gecerlilikAy: gecerlilikAySelect ? parseInt(gecerlilikAySelect.value, 10) : gelecekAy,
    gecerlilikYil: gecerlilikYilSelect ? parseInt(gecerlilikYilSelect.value, 10) : gelecekYil,
  };
}

/**
 * Geçerli zam kontrolü
 */
function topluZamGecerliMi(values: TopluZamFormValues): boolean {
  if (values.zamTuru === 'sabit' && values.zamMiktar > 0) return true;
  if (values.zamTuru === 'yuzde' && values.zamYuzde > 0) return true;
  if (values.zamTuru === 'enflasyon' && values.zamEnflasyon > 0) return true;
  return false;
}

/**
 * Sporcuları filtrele (toplu zam için)
 */
function topluZamSporculariFiltrele(values: TopluZamFormValues): Sporcu[] {
  return Storage.sporculariGetir().filter(s => {
    if (s.odemeBilgileri?.burslu) return false;
    if (s.durum === 'Ayrıldı' && values.durumFiltre !== 'Ayrıldı') return false;
    if (values.bransFiltre && s.sporBilgileri?.brans !== values.bransFiltre) return false;
    if (values.durumFiltre && s.durum !== values.durumFiltre) return false;
    if (values.yasGrubuFiltre && s.tffGruplari?.anaGrup !== values.yasGrubuFiltre) return false;
    return true;
  });
}

/**
 * Zam hesapla
 */
function topluZamHesapla(mevcutUcret: number, values: TopluZamFormValues): number {
  let yeniUcret = mevcutUcret;

  if (values.zamTuru === 'sabit') {
    yeniUcret = mevcutUcret + values.zamMiktar;
  } else if (values.zamTuru === 'yuzde') {
    yeniUcret = mevcutUcret * (1 + values.zamYuzde / 100);
  } else if (values.zamTuru === 'enflasyon') {
    yeniUcret = mevcutUcret * (1 + values.zamEnflasyon / 100);
  }

  return Math.round(yeniUcret * 100) / 100;
}

/**
 * Select option oluştur
 */
function selectOptionOlustur(value: string, text: string): HTMLOptionElement {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = text;
  return option;
}

/**
 * Toplu zam modalını oluştur ve göster
 */
export function topluZamModalAc(): void {
  let modal = Helpers.$('#topluZamModal') as HTMLElement | null;
  if (!modal) {
    modal = topluZamModalOlustur();
  }

  const zamTuruSelect = Helpers.$('#zamTuru') as HTMLSelectElement | null;
  const zamMiktarInput = Helpers.$('#zamMiktar') as HTMLInputElement | null;
  const zamYuzdeInput = Helpers.$('#zamYuzde') as HTMLInputElement | null;
  const zamEnflasyonInput = Helpers.$('#zamEnflasyon') as HTMLInputElement | null;
  const zamBransFiltre = Helpers.$('#zamBransFiltre') as HTMLSelectElement | null;
  const zamDurumFiltre = Helpers.$('#zamDurumFiltre') as HTMLSelectElement | null;
  const zamYasGrubuFiltre = Helpers.$('#zamYasGrubuFiltre') as HTMLSelectElement | null;
  const zamGecerlilikAy = Helpers.$('#zamGecerlilikAy') as HTMLSelectElement | null;
  const zamGecerlilikYil = Helpers.$('#zamGecerlilikYil') as HTMLSelectElement | null;

  const { ay: buAy, yil: buYil } = Helpers.suAnkiDonem();
  const gelecekAy = buAy === 12 ? 1 : buAy + 1;
  const gelecekYil = buAy === 12 ? buYil + 1 : buYil;

  if (zamTuruSelect) zamTuruSelect.value = 'sabit';
  if (zamMiktarInput) zamMiktarInput.value = '';
  if (zamYuzdeInput) zamYuzdeInput.value = '';
  if (zamEnflasyonInput) zamEnflasyonInput.value = '';
  if (zamBransFiltre) zamBransFiltre.value = '';
  if (zamDurumFiltre) zamDurumFiltre.value = 'Aktif';
  if (zamYasGrubuFiltre) zamYasGrubuFiltre.value = '';

  // Tarih seçicilerini doldur
  if (zamGecerlilikAy) {
    zamGecerlilikAy.innerHTML = '';
    for (let ay = 1; ay <= 12; ay++) {
      const option = selectOptionOlustur(ay.toString(), Helpers.ayAdi(ay));
      if (ay === gelecekAy) {
        option.selected = true;
      }
      zamGecerlilikAy.appendChild(option);
    }
  }

  if (zamGecerlilikYil) {
    zamGecerlilikYil.innerHTML = '';
    const mevcutYil = buYil;
    for (let yil = mevcutYil; yil <= mevcutYil + 2; yil++) {
      const option = selectOptionOlustur(yil.toString(), yil.toString());
      if (yil === gelecekYil) {
        option.selected = true;
      }
      zamGecerlilikYil.appendChild(option);
    }
  }

  if (zamTuruSelect) {
    zamTuruSelect.onchange = () => zamTuruDegisti();
    zamTuruDegisti();
  }

  if (zamBransFiltre) zamBransFiltre.onchange = topluZamOnizlemeGuncelle;
  if (zamDurumFiltre) zamDurumFiltre.onchange = topluZamOnizlemeGuncelle;
  if (zamYasGrubuFiltre) zamYasGrubuFiltre.onchange = topluZamOnizlemeGuncelle;
  if (zamMiktarInput) zamMiktarInput.oninput = topluZamOnizlemeGuncelle;
  if (zamYuzdeInput) zamYuzdeInput.oninput = topluZamOnizlemeGuncelle;
  if (zamEnflasyonInput) zamEnflasyonInput.oninput = topluZamOnizlemeGuncelle;
  if (zamGecerlilikAy) zamGecerlilikAy.onchange = topluZamOnizlemeGuncelle;
  if (zamGecerlilikYil) zamGecerlilikYil.onchange = topluZamOnizlemeGuncelle;

  if (zamBransFiltre) {
    const branslar = [
      ...new Set(
        Storage.sporculariGetir()
          .map(s => s.sporBilgileri?.brans)
          .filter(Boolean)
      ),
    ];
    zamBransFiltre.innerHTML = '<option value="">Tüm Branşlar</option>';
    branslar.forEach(brans => {
      zamBransFiltre.appendChild(selectOptionOlustur(brans, brans));
    });
  }

  if (zamYasGrubuFiltre) {
    const yasGruplari = [
      ...new Set(
        Storage.sporculariGetir()
          .map(s => s.tffGruplari?.anaGrup)
          .filter(Boolean)
      ),
    ];
    zamYasGrubuFiltre.innerHTML = '<option value="">Tüm Yaş Grupları</option>';
    yasGruplari.sort().forEach(grup => {
      zamYasGrubuFiltre.appendChild(selectOptionOlustur(grup, grup));
    });
  }

  topluZamOnizlemeGuncelle();

  if (modal) {
    modal.classList.add('active');
  }
}

/**
 * Toplu zam modalını oluştur (HTML)
 */
function topluZamModalOlustur(): HTMLElement | null {
  const modalHTML = `
    <div id="topluZamModal" class="modal">
      <div class="modal-content modal-large">
        <div class="modal-header">
          <h2 id="topluZamModalBaslik">Toplu Zam Yap</h2>
          <button id="topluZamModalKapat" class="modal-close" type="button">
            <i class="fa-solid fa-times"></i>
          </button>
        </div>
        <div class="modal-body">
          <form id="topluZamForm">
            <div class="form-group">
              <label for="zamTuru">Zam Türü <span class="required">*</span></label>
              <select id="zamTuru" class="form-control" required>
                <option value="sabit">Sabit Tutar (TL)</option>
                <option value="yuzde">Yüzdelik Zam (%)</option>
                <option value="enflasyon">Enflasyon Bazlı (%)</option>
              </select>
            </div>

            <div id="zamMiktarWrapper" class="form-group">
              <label for="zamMiktar">Zam Miktarı (TL) <span class="required">*</span></label>
              <input type="text" id="zamMiktar" class="form-control" placeholder="Örn: 500" required>
            </div>

            <div id="zamYuzdeWrapper" class="form-group" style="display: none;">
              <label for="zamYuzde">Zam Yüzdesi (%) <span class="required">*</span></label>
              <input type="number" id="zamYuzde" class="form-control" placeholder="Örn: 10" min="0" max="100" step="0.01">
            </div>

            <div id="zamEnflasyonWrapper" class="form-group" style="display: none;">
              <label for="zamEnflasyon">Enflasyon Oranı (%) <span class="required">*</span></label>
              <input type="number" id="zamEnflasyon" class="form-control" placeholder="Örn: 25.5" min="0" step="0.01">
            </div>

            <div class="form-group">
              <label for="zamGecerlilikTarihi">
                <i class="fa-solid fa-calendar-alt"></i> Zamın Geçerli Olacağı Tarih <span class="required">*</span>
              </label>
              <div class="form-row" style="margin: 0;">
                <div class="form-group" style="flex: 1; margin-right: 10px;">
                  <select id="zamGecerlilikAy" class="form-control" required>
                  </select>
                </div>
                <div class="form-group" style="flex: 1;">
                  <select id="zamGecerlilikYil" class="form-control" required>
                  </select>
                </div>
              </div>
              <small style="color: #666; font-size: 12px; display: block; margin-top: 5px;">
                <i class="fa-solid fa-info-circle"></i> Zam bu tarihten itibaren geçerli olacaktır
              </small>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label for="zamBransFiltre">Branş Filtresi</label>
                <select id="zamBransFiltre" class="form-control">
                  <option value="">Tüm Branşlar</option>
                </select>
              </div>

              <div class="form-group">
                <label for="zamDurumFiltre">Durum Filtresi</label>
                <select id="zamDurumFiltre" class="form-control">
                  <option value="Aktif">Aktif</option>
                  <option value="Pasif">Pasif</option>
                  <option value="Ayrıldı">Ayrıldı</option>
                  <option value="">Tümü</option>
                </select>
              </div>

              <div class="form-group">
                <label for="zamYasGrubuFiltre">Yaş Grubu Filtresi</label>
                <select id="zamYasGrubuFiltre" class="form-control">
                  <option value="">Tüm Yaş Grupları</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label>Önizleme</label>
              <div id="topluZamOnizleme" class="table-container" style="max-height: 400px; overflow-y: auto;">
                <table class="table">
                  <thead>
                    <tr>
                      <th>Ad Soyad</th>
                      <th>Branş</th>
                      <th>Mevcut Ücret</th>
                      <th>Yeni Ücret</th>
                      <th>Fark</th>
                      <th>Geçerlilik Tarihi</th>
                    </tr>
                  </thead>
                  <tbody id="topluZamOnizlemeBody">
                    <tr>
                      <td colspan="6" class="text-center">Filtreleri seçip zam bilgilerini girin</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button id="topluZamIptal" class="btn btn-secondary" type="button">İptal</button>
          <button id="topluZamUygula" class="btn btn-primary" type="button">Zamı Uygula</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHTML);

  const modalKapat = Helpers.$('#topluZamModalKapat') as HTMLButtonElement | null;
  const modalIptal = Helpers.$('#topluZamIptal') as HTMLButtonElement | null;
  const modalUygula = Helpers.$('#topluZamUygula') as HTMLButtonElement | null;
  const zamMiktarInput = Helpers.$('#zamMiktar') as HTMLInputElement | null;
  const modal = Helpers.$('#topluZamModal') as HTMLElement | null;

  if (modalKapat) modalKapat.addEventListener('click', topluZamModalKapat);
  if (modalIptal) modalIptal.addEventListener('click', topluZamModalKapat);
  if (modalUygula) modalUygula.addEventListener('click', topluZamUygula);
  if (zamMiktarInput) {
    zamMiktarInput.addEventListener('input', function () {
      Helpers.paraFormatInput(this as HTMLInputElement);
    });
  }
  if (modal) {
    modal.addEventListener('click', e => {
      if (e.target === modal) {
        topluZamModalKapat();
      }
    });
  }

  return modal;
}

/**
 * Zam türü değiştiğinde input alanlarını göster/gizle
 */
function zamTuruDegisti(): void {
  const zamTuru = (Helpers.$('#zamTuru') as HTMLSelectElement | null)?.value || 'sabit';
  const miktarWrapper = Helpers.$('#zamMiktarWrapper') as HTMLElement | null;
  const yuzdeWrapper = Helpers.$('#zamYuzdeWrapper') as HTMLElement | null;
  const enflasyonWrapper = Helpers.$('#zamEnflasyonWrapper') as HTMLElement | null;

  if (miktarWrapper) miktarWrapper.style.display = zamTuru === 'sabit' ? 'block' : 'none';
  if (yuzdeWrapper) yuzdeWrapper.style.display = zamTuru === 'yuzde' ? 'block' : 'none';
  if (enflasyonWrapper) enflasyonWrapper.style.display = zamTuru === 'enflasyon' ? 'block' : 'none';

  topluZamOnizlemeGuncelle();
}

/**
 * Toplu zam önizlemesini güncelle
 */
function topluZamOnizlemeGuncelle(): void {
  const tbody = Helpers.$('#topluZamOnizlemeBody') as HTMLElement | null;
  if (!tbody) return;

  const values = topluZamFormDegerleriniAl();

  if (!topluZamGecerliMi(values)) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Zam bilgilerini girin</td></tr>';
    return;
  }

  const sporcular = topluZamSporculariFiltrele(values);

  if (sporcular.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="6" class="text-center">Filtrelere uygun sporcu bulunamadı</td></tr>';
    return;
  }

  const gecerlilikTarihi = `${Helpers.ayAdi(values.gecerlilikAy)} ${values.gecerlilikYil}`;

  tbody.innerHTML = '';
  sporcular.forEach(sporcu => {
    const mevcutUcret = sporcu.odemeBilgileri?.aylikUcret || 0;
    const yeniUcret = topluZamHesapla(mevcutUcret, values);
    const fark = yeniUcret - mevcutUcret;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${Helpers.escapeHtml(sporcu.temelBilgiler?.adSoyad || '-')}</td>
      <td>${Helpers.escapeHtml(sporcu.sporBilgileri?.brans || '-')}</td>
      <td>${Helpers.paraFormat(mevcutUcret)} TL</td>
      <td><strong>${Helpers.paraFormat(yeniUcret)} TL</strong></td>
      <td class="${fark >= 0 ? 'text-success' : 'text-danger'}">${fark >= 0 ? '+' : ''}${Helpers.paraFormat(fark)} TL</td>
      <td><span style="color: #667eea; font-weight: 600;">${gecerlilikTarihi}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

/**
 * Zam türü metnini al
 */
function topluZamTuruMetni(values: TopluZamFormValues): string {
  if (values.zamTuru === 'sabit') {
    return `${Helpers.paraFormat(values.zamMiktar)} TL`;
  }
  if (values.zamTuru === 'yuzde') {
    return `%${values.zamYuzde}`;
  }
  return `%${values.zamEnflasyon} (Enflasyon)`;
}

/**
 * Toplu zamı uygula
 */
function topluZamUygula(): void {
  const values = topluZamFormDegerleriniAl();

  if (!topluZamGecerliMi(values)) {
    Helpers.toast('Lütfen geçerli bir zam miktarı girin', 'error');
    return;
  }

  const sporcular = topluZamSporculariFiltrele(values);

  if (sporcular.length === 0) {
    Helpers.toast('Filtrelere uygun sporcu bulunamadı', 'error');
    return;
  }

  const zamTuruText = topluZamTuruMetni(values);
  const gecerlilikAyAdi = Helpers.ayAdi(values.gecerlilikAy);
  const onayMesaji = `${sporcular.length} sporcuya ${zamTuruText} zam yapılacak.\n\nZam ${gecerlilikAyAdi} ${values.gecerlilikYil} ayından itibaren geçerli olacaktır.\n\nDevam etmek istiyor musunuz?`;

  if (!confirm(onayMesaji)) {
    return;
  }

  const sporcularListesi = Storage.sporculariGetir();
  let guncellenenSayisi = 0;

  sporcular.forEach(sporcu => {
    const mevcutUcret = sporcu.odemeBilgileri?.aylikUcret || 0;
    const yeniUcret = topluZamHesapla(mevcutUcret, values);

    if (sporcu.odemeBilgileri) {
      sporcu.odemeBilgileri.aylikUcret = yeniUcret;
    } else {
      // `odemeBilgileri` tipinde burslu ve odemeGunu zorunlu olduğu için temel değerlerle set ediyoruz.
      sporcu.odemeBilgileri = { aylikUcret: yeniUcret, burslu: false, odemeGunu: null };
    }

    gelecekAylarBorcKayitlariniGuncelle(
      sporcu.id,
      mevcutUcret,
      yeniUcret,
      values.gecerlilikAy,
      values.gecerlilikYil
    );

    const index = sporcularListesi.findIndex(s => s.id === sporcu.id);
    if (index !== -1) {
      sporcularListesi[index] = sporcu;
    }

    guncellenenSayisi++;
  });

  Storage.kaydet(Storage.STORAGE_KEYS.SPORCULAR, sporcularListesi);
  Helpers.toast(`${guncellenenSayisi} sporcuya zam uygulandı`, 'success');

  topluZamModalKapat();
  listeyiGuncelle();

  const Aidat = (window as any).Aidat;
  if (Aidat?.listeyiGuncelle) {
    Aidat.listeyiGuncelle();
  }
  if (Aidat?.takvimiOlustur) {
    Aidat.takvimiOlustur();
  }
}

/**
 * Toplu zam modalını kapat
 */
function topluZamModalKapat(): void {
  const modal = Helpers.$('#topluZamModal') as HTMLElement | null;
  if (modal) {
    modal.classList.remove('active');
  }
}

/**
 * Antrenman grupları (Ayarlar) değişince sporcu formu ve liste filtrelerini yeniler.
 */
export function antrenmanGruplariUiYenile(): void {
  filterCache.cachedResults = null;
  filterCache.lastSporcularHash = null;
  antrenmanGrubuSecenekleriniDoldur();
  listeyiGuncelle();
}

// ============================================================================
// BÖLÜM 24: GLOBAL EXPORTS
// ============================================================================
// Bu bölümde window objesi üzerinden dışa aktarılan fonksiyonlar yer alır.
// Diğer modüller (app.ts, dashboard.ts vb.) bu fonksiyonlara erişir.
// ============================================================================

// Temporary global access for backward compatibility
// This will be removed once app.ts is migrated
if (typeof window !== 'undefined') {
  (window as any).Sporcu = {
    init,
    kaydet,
    duzenle,
    sil,
    tekrarAktifEt,
    durumDegistir,
    formuTemizle,
    listeFiltreleriniSifirla,
    listeyiGuncelle,
    aktifSporcuSayisi,
    yasGrubunaGore,
    formEventleriniYenidenBagla,
    butonDurumunuKontrolEt,
    raporGoster,
    // Malzeme fonksiyonları (dashboard'dan erişim için)
    sporcuMalzemeEkleModalKapat,
    sporcuMalzemeKaydet,
    // Toplu zam fonksiyonları
    topluZamModalAc,
    gelecekAylarBorcKayitlariniGuncelle,
    antrenmanGruplariUiYenile,
  };
}
