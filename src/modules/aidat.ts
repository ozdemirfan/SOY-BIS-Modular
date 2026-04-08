/**
 * SOY-BIS - Aidat Modülü (aidat.ts)
 * Aidat takip, ödeme ve raporlama işlemleri - TypeScript Version
 */

import * as Storage from '../utils/storage';
import * as Helpers from '../utils/helpers';
import { assertAidatDonemKpiSanity } from '../utils/aidatKpiSanity';
import type { Aidat, Sporcu, Session } from '../types';

// ========== INTERFACES & TYPES ==========

interface CalendarState {
  currentMonth: number;
  currentYear: number;
  selectedDate: string | null;
  viewMode: 'calendar' | 'monthly';
}

interface MonthlyListStateItem {
  showAll: boolean;
  limit: number;
}

interface MonthlyListState {
  debt: { [key: string]: MonthlyListStateItem };
  paid: { [key: string]: MonthlyListStateItem };
}

interface KalanBorcBilgisi {
  aylikUcret: number;
  donemBorcu?: number;
  toplamOdenen: number;
  kalanBorc: number;
  donemAy: number;
  donemYil: number;
}

/**
 * Tahsilat ve ödeme modalı önizlemesi için tek kaynak:
 * `finansalHesapla` dönemde henüz borç satırı yoksa `toplamBorc=0` döner; o durumda
 * beklenen tutar aylık ücrettir (liste filtresi ve `sporcuBorcHesapla` ile uyumlu).
 * Eski hata: modalda yalnızca brüt borç kullanılıp `Math.min(aylikUcret, …)` ile kısılınca
 * "0 TL, ödeme tamamlandı" gösteriliyordu.
 */
function donemBeklenenBorcVeKalan(
  sporcu: Sporcu,
  fin: Helpers.FinansalHesaplama
): { beklenenBorcDonem: number; kalanBorc: number } {
  const burslu = sporcu.odemeBilgileri?.burslu === true;
  const aylikUcret = sporcu.odemeBilgileri?.aylikUcret || 0;
  const brutBorcKayit = fin.toplamBorc;
  const beklenenBorcDonem = burslu ? brutBorcKayit : brutBorcKayit > 0 ? brutBorcKayit : aylikUcret;
  const kalanBorc = Math.max(0, beklenenBorcDonem - fin.toplamTahsilat);
  return { beklenenBorcDonem, kalanBorc };
}

interface DonemRaporuResult {
  donem: string;
  beklenen: number;
  tahsilat: number;
  kalan: number;
  tahsilatOrani: number;
  odeyenler: number;
  kismiOdeyenler: number;
  borcular: number;
  toplamSporcu: number;
}

interface GunIcinDurumResult {
  status: 'debt' | 'partial' | 'paid' | null;
  stats: {
    tamOdenen: number;
    kismiOdenen: number;
    borclu: number;
    toplamBeklenen: number;
    toplamOdenen: number;
    toplamSporcu: number; // O gün ödeme yapacak toplam sporcu sayısı
  };
}

interface SporcuDurumItem {
  sporcu: Sporcu;
  aylikUcret: number;
  odenen: number;
  borc: number;
  durum: 'paid' | 'partial' | 'debt';
  donemOdemeleri: Aidat[];
}

// ========== GLOBAL WINDOW TYPE DECLARATIONS ==========

declare global {
  interface Window {
    Auth?: {
      yetkiKontrol: (yetki: string) => boolean;
      isAdmin: () => boolean;
      aktifKullanici: () => Session | null;
    };
    Notification?: {
      ayarlariGetir?: () => {
        enabled: boolean;
        methods: {
          sms: boolean;
          email: boolean;
          whatsapp: boolean;
        };
        messageTemplates: {
          sms: string;
        };
      };
      mesajDoldur?: (template: string, data: Record<string, unknown>) => string;
      topluHatirlatmaGonder?: (
        sporcular: Sporcu[],
        method: string,
        ay?: number,
        yil?: number
      ) => void;
      hatirlatilacaklariGetir?: () => Array<{
        sporcu: Sporcu;
        tip: string;
        mesaj: string;
        oncelik: 'info' | 'warning' | 'danger';
      }>;
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
    Aidat?: {
      init?: () => void;
      listeyiGuncelle?: () => void;
      hizliFiltrele?: (tip: 'all' | 'paid' | 'debt' | 'upcoming') => void;
      filtreSifirla?: () => void;
      odemeModalAc?: (sporcuId?: number | null) => void;
      gecmisModalAc?: (sporcuId: number) => void;
      donemRaporu?: (ay: number, yil: number) => DonemRaporuResult;
      takvimiOlustur?: () => void;
      aylikOzetOlustur?: () => void;
      monthlyListToggle?: (donemKey: string, tip: 'debt' | 'paid') => void;
      monthlyTabSwitch?: (donemKey: string, tip: 'debt' | 'paid') => void;
      monthlySearchFilter?: (donemKey: string) => void;
      monthlyDebtFilter?: (donemKey: string, searchTerm?: string | null) => void;
      monthlyPaidFilter?: (donemKey: string, searchTerm?: string | null) => void;
      gunSecildi?: (dateStr: string) => void;
      smsGonderTekil?: (sporcuId: number) => void;
      topluSmsGonder?: () => void;
      gunDetaylariKapat?: () => void;
    };
  }
}

// ========== MODULE STATE ==========

// AbortController for event listener cleanup
let modalAbortController: AbortController | null = null;
let buttonAbortController: AbortController | null = null;

// Takvim durumu
let calendarState: CalendarState = {
  currentMonth: new Date().getMonth(),
  currentYear: new Date().getFullYear(),
  selectedDate: null,
  viewMode: 'calendar', // 'calendar' veya 'monthly'
};

// Aylık özet liste durumları (hangi dönemde kaç gösteriliyor)
let monthlyListState: MonthlyListState = {
  debt: {}, // { '1': { showAll: false, limit: 10 } }
  paid: {}, // { '1': { showAll: false, limit: 10 } }
};

// Hızlı filtre durumu (index.html ile uyumlu varsayılan: Ödemeyenler)
let aktifFiltre: 'all' | 'paid' | 'debt' | 'upcoming' = 'debt';

// View mode (table/card)
let currentView: 'table' | 'card' = 'card';

let aidatResizeListenerEklendi = false;

function aidatKartIzgarasiniTemizle(): void {
  const g = Helpers.$('#aidatCardsGrid');
  if (g) g.innerHTML = '';
}

// Sıralama durumu
let sortState: {
  column: string | null;
  direction: 'asc' | 'desc';
} = {
  column: null,
  direction: 'asc',
};

// Cache for sporcu registration dates (performance optimization)
let sporcuKayitTarihleriCache: Map<number, Date | null> = new Map();

// Gelişmiş filtre durumu
let advancedFilters: {
  brans: string;
  yasGrubu: string;
  borcAralik: string;
} = {
  brans: '',
  yasGrubu: '',
  borcAralik: '',
};

// ========== MODULE FUNCTIONS ==========

/**
 * Modülü başlat
 */
export function init(): void {
  // Yetki kontrolü - Aidat sadece Yönetici ve Muhasebe
  if (
    typeof window !== 'undefined' &&
    window.Auth &&
    !window.Auth?.yetkiKontrol('aidat_gorebilir')
  ) {
    const aidatView = Helpers.$('#aidat');
    if (aidatView) {
      (aidatView as HTMLElement).style.display = 'none';
    }
    return;
  }

  modalEventleri();
  aramaEventleri();
  takvimEventleri();

  // Event delegation'ı hemen ekle
  butonEventleri();

  // Yeni özellikler: View toggle, gelişmiş filtreler, sıralama, toplu seçim
  viewToggleEventleri();
  gelismisFiltreEventleri();
  siralamaEventleri();

  // Gelişmiş filtre seçeneklerini doldur
  gelismisFiltreSecenekleriniDoldur();

  // Sadece takvim görünümü kullanılıyor
  calendarState.viewMode = 'calendar';
  const calendarView = Helpers.$('#aidatCalendar');
  if (calendarView) (calendarView as HTMLElement).style.display = 'block';

  takvimiOlustur();
  /* listeyiGuncelle viewGuncelle içinde çağrılır; panel görünürlüğü + kart senkronu tek yerden */
  viewGuncelle(currentView);

  if (!aidatResizeListenerEklendi) {
    aidatResizeListenerEklendi = true;
    let aidatResizeTimer: ReturnType<typeof setTimeout> | null = null;
    window.addEventListener('resize', () => {
      if (aidatResizeTimer) clearTimeout(aidatResizeTimer);
      aidatResizeTimer = setTimeout(() => {
        aidatViewPanelSenkron();
      }, 150);
    });
  }

  aidatHizliFiltreButonlariniAyarla(aktifFiltre);
}

/**
 * Modal eventlerini bağla
 */
function modalEventleri(): void {
  // Eski event listener'ları iptal et
  if (modalAbortController) {
    modalAbortController.abort();
  }

  // Yeni AbortController oluştur
  modalAbortController = new AbortController();
  const signal = modalAbortController.signal;

  // Ödeme modalı
  const odemeModalKapat = Helpers.$('#odemeModalKapat');
  const odemeIptal = Helpers.$('#odemeIptal');
  const odemeKaydet = Helpers.$('#odemeKaydet');
  const odemeModal = Helpers.$('#odemeModal');

  if (odemeModalKapat) {
    odemeModalKapat.addEventListener(
      'click',
      e => {
        e.preventDefault();
        e.stopPropagation();
        odemeModalKapat_fn();
      },
      { signal }
    );
  }

  if (odemeIptal) {
    odemeIptal.addEventListener(
      'click',
      e => {
        e.preventDefault();
        e.stopPropagation();
        odemeModalKapat_fn();
      },
      { signal }
    );
  }

  if (odemeKaydet) {
    odemeKaydet.addEventListener(
      'click',
      e => {
        e.preventDefault();
        e.stopPropagation();
        odemeKaydet_fn();
      },
      { signal }
    );
  }

  // Modal dışına tıklandığında kapat (modal backdrop)
  if (odemeModal) {
    odemeModal.addEventListener(
      'click',
      e => {
        // Eğer modal'ın kendisine (backdrop'a) tıklandıysa kapat
        if (e.target === odemeModal) {
          odemeModalKapat_fn();
        }
      },
      { signal }
    );

    // Modal içindeki içeriğe tıklandığında kapanmasın
    const modalContent = odemeModal.querySelector('.modal-content');
    if (modalContent) {
      modalContent.addEventListener(
        'click',
        e => {
          e.stopPropagation(); // İçeriğe tıklanınca modal kapanmasın
        },
        { signal }
      );
    }
  }

  // Geçmiş modalı
  const gecmisModalKapat = Helpers.$('#gecmisModalKapat');
  const gecmisKapat = Helpers.$('#gecmisKapat');

  if (gecmisModalKapat) {
    gecmisModalKapat.addEventListener('click', gecmisModalKapat_fn, { signal });
  }
  if (gecmisKapat) {
    gecmisKapat.addEventListener('click', gecmisModalKapat_fn, { signal });
  }

  // Tutar input'u için para formatı
  const odemeTutar = Helpers.$('#odemeTutar');
  if (odemeTutar && odemeTutar instanceof HTMLInputElement) {
    odemeTutar.addEventListener(
      'input',
      function () {
        Helpers.paraFormatInput(this as HTMLInputElement);
      },
      { signal }
    );
  }

  // İşlem türü değiştiğinde açıklama alanını göster/gizle
  const odemeIslemTuru = Helpers.$('#odemeIslemTuru') as HTMLSelectElement | null;
  if (odemeIslemTuru) {
    odemeIslemTuru.addEventListener(
      'change',
      function () {
        const aciklamaGroup = Helpers.$('#odemeAciklamaGroup') as HTMLElement | null;
        const aciklamaInput = Helpers.$('#odemeAciklama') as HTMLInputElement | null;
        if (aciklamaGroup && aciklamaInput) {
          if (this.value === 'Malzeme') {
            aciklamaGroup.style.display = 'block';
            aciklamaInput.required = true;
          } else {
            aciklamaGroup.style.display = 'none';
            aciklamaInput.required = false;
            aciklamaInput.value = '';
          }
        }
      },
      { signal }
    );
  }

  // Dönem seçicilerini doldur
  donemSecicileriDoldur();
}

/**
 * Arama eventlerini bağla
 */
function aramaEventleri(): void {
  const aramaInput = Helpers.$('#aidatArama') as HTMLInputElement | null;
  const aramaClear = Helpers.$('#aidatSearchClear');

  if (aramaInput) {
    aramaInput.addEventListener('input', e => {
      const value = (e.target as HTMLInputElement).value;
      if (aramaClear) {
        (aramaClear as HTMLElement).style.display = value ? 'block' : 'none';
      }
      Helpers.debounce(listeyiGuncelle, 300)();
    });
  }

  if (aramaClear) {
    aramaClear.addEventListener('click', () => {
      if (aramaInput) {
        aramaInput.value = '';
        (aramaClear as HTMLElement).style.display = 'none';
        listeyiGuncelle();
      }
    });
  }
}

/**
 * View toggle eventlerini bağla (Table/Card)
 */
function viewToggleEventleri(): void {
  const viewToggleBtns = document.querySelectorAll('.view-toggle-btn');
  viewToggleBtns.forEach(btn => {
    btn.addEventListener('click', e => {
      const target = e.currentTarget as HTMLElement;
      const view = target.getAttribute('data-view') as 'table' | 'card';

      // Tüm butonlardan active class'ı kaldır
      viewToggleBtns.forEach(b => b.classList.remove('active'));
      // Tıklanan butona active ekle
      target.classList.add('active');

      viewGuncelle(view);
    });
  });
}

/** Tablo / kart sarmalayıcılarının görünürlüğü (mobilde data-aidat-view + CSS; masaüstünde inline) */
function aidatViewPanelSenkron(): void {
  const tableView = Helpers.$('#aidatTableView') as HTMLElement | null;
  const cardView = Helpers.$('#aidatCardView') as HTMLElement | null;
  const listCard = Helpers.$('#aidatListCard') as HTMLElement | null;
  if (listCard) {
    listCard.setAttribute('data-aidat-view', currentView);
  }

  const mobil =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(max-width: 768px)').matches
      : false;

  if (mobil) {
    /* Mobilde !important kuralları data-aidat-view ile; inline bırakılan display çakışmasın */
    if (tableView) {
      tableView.style.removeProperty('display');
      tableView.style.removeProperty('visibility');
    }
    if (cardView) {
      cardView.style.removeProperty('display');
      cardView.style.removeProperty('visibility');
    }
  } else if (currentView === 'table') {
    if (tableView) tableView.style.display = 'block';
    if (cardView) cardView.style.display = 'none';
  } else {
    if (tableView) tableView.style.display = 'none';
    if (cardView) cardView.style.display = 'block';
  }
}

/**
 * View'ı güncelle (Table/Card)
 */
function viewGuncelle(view: 'table' | 'card'): void {
  currentView = view;
  aidatViewPanelSenkron();
  listeyiGuncelle();
}

/**
 * Gelişmiş filtre eventlerini bağla
 */
function gelismisFiltreEventleri(): void {
  const filterToggle = Helpers.$('#aidatFilterToggle');
  const advancedFiltersDiv = Helpers.$('#aidatAdvancedFilters');
  const bransFilter = Helpers.$('#aidatFilterBrans') as HTMLSelectElement | null;
  const yasGrubuFilter = Helpers.$('#aidatFilterYasGrubu') as HTMLSelectElement | null;
  const borcAralikFilter = Helpers.$('#aidatFilterBorcAralik') as HTMLSelectElement | null;

  // Toggle butonu
  if (filterToggle && advancedFiltersDiv) {
    filterToggle.addEventListener('click', () => {
      const isVisible = (advancedFiltersDiv as HTMLElement).style.display !== 'none';
      (advancedFiltersDiv as HTMLElement).style.display = isVisible ? 'none' : 'block';
      filterToggle.classList.toggle('active', !isVisible);
    });
  }

  // Filtre değişiklikleri
  if (bransFilter) {
    bransFilter.addEventListener('change', () => {
      advancedFilters.brans = bransFilter.value;
      listeyiGuncelle();
    });
  }

  if (yasGrubuFilter) {
    yasGrubuFilter.addEventListener('change', () => {
      advancedFilters.yasGrubu = yasGrubuFilter.value;
      listeyiGuncelle();
    });
  }

  if (borcAralikFilter) {
    borcAralikFilter.addEventListener('change', () => {
      advancedFilters.borcAralik = borcAralikFilter.value;
      listeyiGuncelle();
    });
  }
}

/**
 * Gelişmiş filtre seçeneklerini doldur
 */
function gelismisFiltreSecenekleriniDoldur(): void {
  const sporcular = Storage.sporculariGetir();
  const branslar = new Set<string>();
  const yasGruplari = new Set<string>();

  sporcular.forEach(s => {
    if (s.sporBilgileri?.brans) branslar.add(s.sporBilgileri.brans);
    if (s.tffGruplari?.anaGrup) yasGruplari.add(s.tffGruplari.anaGrup);
  });

  // Branş filtresini doldur
  const bransFilter = Helpers.$('#aidatFilterBrans') as HTMLSelectElement | null;
  if (bransFilter) {
    const sortedBranslar = Array.from(branslar).sort();
    sortedBranslar.forEach(brans => {
      const option = document.createElement('option');
      option.value = brans;
      option.textContent = brans;
      bransFilter.appendChild(option);
    });
  }

  // Yaş grubu filtresini doldur
  const yasGrubuFilter = Helpers.$('#aidatFilterYasGrubu') as HTMLSelectElement | null;
  if (yasGrubuFilter) {
    const sortedYasGruplari = Array.from(yasGruplari).sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, '')) || 99;
      const numB = parseInt(b.replace(/\D/g, '')) || 99;
      return numA - numB;
    });
    sortedYasGruplari.forEach(grup => {
      const option = document.createElement('option');
      option.value = grup;
      option.textContent = grup;
      yasGrubuFilter.appendChild(option);
    });
  }
}

/**
 * Sıralama eventlerini bağla
 */
function siralamaEventleri(): void {
  // Event delegation kullanarak dinamik butonları yakala
  const tableWrapper = Helpers.$('#aidatTableView');
  if (tableWrapper) {
    // Sıralama butonları için event delegation
    tableWrapper.addEventListener('click', e => {
      const target = e.target as HTMLElement;
      const sortBtn = target.closest('.sort-btn') as HTMLElement | null;

      if (sortBtn) {
        e.preventDefault();
        e.stopPropagation();

        const column = sortBtn.getAttribute('data-sort');
        if (!column) return;

        // Sıralama yönünü değiştir
        if (sortState.column === column) {
          sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
        } else {
          sortState.column = column;
          sortState.direction = 'asc';
        }

        // Buton durumlarını güncelle
        document.querySelectorAll('.sort-btn').forEach(b => {
          b.classList.remove('active');
          // İkonu güncelle
          const icon = b.querySelector('i');
          if (icon) {
            icon.className = 'fa-solid fa-sort';
          }
        });

        sortBtn.classList.add('active');
        // Aktif butonun ikonunu güncelle
        const icon = sortBtn.querySelector('i');
        if (icon) {
          icon.className =
            sortState.direction === 'asc' ? 'fa-solid fa-sort-up' : 'fa-solid fa-sort-down';
        }

        // Listeyi güncelle
        listeyiGuncelle();
      }
    });
  }

  // Tablo başlıklarındaki sıralama kaldırıldı - sadece sağ üstteki butonlar kullanılıyor
}

/**
 * Event delegation - tüm ödeme al butonlarını yakala
 */
function butonEventleri(): void {
  // Eski event listener'ı iptal et
  if (buttonAbortController) {
    buttonAbortController.abort();
  }

  // Yeni AbortController oluştur
  buttonAbortController = new AbortController();
  const signal = buttonAbortController.signal;

  // Document'e event delegation ekle - tüm ödeme al butonları için
  const clickHandler = function (e: Event) {
    const target = e.target as HTMLElement;
    if (!target) return;

    // Sporcu listesi tablosundaki tüm butonları ignore et
    const isSporcuListButton =
      target.closest('#sporcuTableBody') ||
      target.closest('#sporcu-listesi') ||
      (target.tagName === 'BUTTON' &&
        (target.onclick?.toString().includes('Sporcu.sil') ||
          target.onclick?.toString().includes('Sporcu.duzenle') ||
          target.closest('#sporcuTableBody')));

    if (isSporcuListButton) {
      return; // Sporcu listesi butonlarını ignore et
    }

    // Debug: Ödeme al butonu ile ilgili her tıklamayı logla
    const closestOdemeBtn = target.closest('.odeme-al-btn') as HTMLElement | null;

    // Rapor butonlarını ignore et
    const isRaporBtn =
      target.classList.contains('btn-rapor') ||
      target.getAttribute('data-action') === 'rapor' ||
      target.closest('#yoklamaListesi');

    if (isRaporBtn) {
      return; // Rapor butonunu ignore et
    }

    const isOdemeBtn =
      closestOdemeBtn ||
      target.classList.contains('odeme-al-btn') ||
      (target.tagName === 'BUTTON' &&
        target.hasAttribute('data-sporcu-id') &&
        !target.classList.contains('btn-rapor') &&
        target.getAttribute('data-action') !== 'rapor' &&
        !target.closest('#sporcuTableBody') &&
        !target.closest('#sporcu-listesi') &&
        !target.closest('#yoklamaListesi') &&
        !target.onclick?.toString().includes('Sporcu.sil') &&
        !target.onclick?.toString().includes('Sporcu.duzenle'));

    if (isOdemeBtn) {
      const btn = closestOdemeBtn || target;
    }

    // Ödeme al butonu kontrolü - önce closest ile kontrol et (en güvenilir)
    let odemeBtn: HTMLElement | null = null;

    // 1. Butonun içindeki icon veya text'e tıklandıysa, parent butonu bul (önce bu)
    odemeBtn = target.closest('button.odeme-al-btn') as HTMLElement | null;

    // 2. Direkt buton kontrolü (class veya data attribute ile)
    // Rapor butonlarını ve sporcu listesi butonlarını ignore et
    if (
      !odemeBtn &&
      target.tagName === 'BUTTON' &&
      (target.classList.contains('odeme-al-btn') ||
        (target.hasAttribute('data-sporcu-id') &&
          !target.classList.contains('btn-rapor') &&
          target.getAttribute('data-action') !== 'rapor' &&
          !target.closest('#sporcuTableBody') &&
          !target.closest('#sporcu-listesi') &&
          !target.closest('#yoklamaListesi') &&
          !target.onclick?.toString().includes('Sporcu.sil') &&
          !target.onclick?.toString().includes('Sporcu.duzenle')))
    ) {
      odemeBtn = target as HTMLElement;
    }

    // Debug: Buton yakalanıp yakalanmadığını kontrol et
    let isCalendarItem = false;

    if (!odemeBtn) {
      // Calendar item kontrolü
      const calendarItem = target.closest('.calendar-day-sporcu-item') as HTMLElement | null;
      if (calendarItem) {
        odemeBtn = calendarItem;
        isCalendarItem = true;
      }
    }

    if (!odemeBtn) {
      // Monthly item kontrolü
      const monthlyItem = target.closest('.monthly-summary-card-item') as HTMLElement | null;
      if (monthlyItem) {
        odemeBtn = monthlyItem;
      }
    }

    if (!odemeBtn) {
      // Inline onclick ile buton kontrolü
      const btn = target.closest('button[onclick*="odemeModalAc"]') as HTMLElement | null;
      if (btn) {
        odemeBtn = btn;
      }
    }

    if (!odemeBtn) {
      // Ana listedeki buton kontrolü (i elementi tıklanmış olabilir)
      const button = target.closest('button.odeme-al-btn') as HTMLElement | null;
      if (button) {
        odemeBtn = button;
      }
    }

    if (odemeBtn) {
      // KRİTİK: Sporcu listesi tablosundaki TÜM butonları ignore et
      if (
        odemeBtn.closest('#sporcuTableBody') ||
        odemeBtn.closest('#sporcu-listesi') ||
        (odemeBtn.tagName === 'BUTTON' &&
          (odemeBtn.onclick?.toString().includes('Sporcu.sil') ||
            odemeBtn.onclick?.toString().includes('Sporcu.duzenle')))
      ) {
        return; // Sporcu listesi butonlarını ignore et
      }

      // Rapor butonu kontrolü - rapor butonunu ignore et
      if (
        odemeBtn.classList.contains('btn-rapor') ||
        odemeBtn.getAttribute('data-action') === 'rapor' ||
        odemeBtn.closest('#yoklamaListesi')
      ) {
        // Bu bir rapor butonu veya yoklama listesi butonu - ignore et
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      // data-sporcu-id varsa onu kullan
      let sporcuId: number | null = null;

      // Önce data-sporcu-id attribute'unu kontrol et
      let dataSporcuId = odemeBtn.getAttribute('data-sporcu-id');

      // Eğer butonun kendisinde yoksa, parent elementlerde ara
      if (!dataSporcuId) {
        const parentWithId = odemeBtn.closest('[data-sporcu-id]') as HTMLElement | null;
        if (parentWithId) {
          dataSporcuId = parentWithId.getAttribute('data-sporcu-id');
        }
      }

      if (dataSporcuId) {
        // String'i number'a çevir - çok büyük sayılar için Number kullan
        const parsedId = Number(dataSporcuId);
        if (!isNaN(parsedId) && parsedId > 0) {
          sporcuId = parsedId;
        } else {
        }
      } else {
        // onclick attribute'undan sporcu ID'yi çıkar
        const onclickAttr = odemeBtn.getAttribute('onclick');
        if (onclickAttr) {
          const match = onclickAttr.match(/odemeModalAc\((\d+)\)/);
          if (match && match[1]) {
            sporcuId = parseInt(match[1], 10);
          }
        }

        // Hala bulunamadıysa, parent elementlerden ara (tr veya action-buttons içinde olabilir)
        if (!sporcuId || isNaN(sporcuId)) {
          const parentRow = odemeBtn.closest('tr');
          if (parentRow) {
            // tr içindeki tüm data-sporcu-id attribute'larını kontrol et
            const allDataIds = parentRow.querySelectorAll('[data-sporcu-id]');
            if (allDataIds.length > 0 && allDataIds[0]) {
              const firstId = allDataIds[0].getAttribute('data-sporcu-id');
              if (firstId) {
                sporcuId = parseInt(firstId, 10);
              }
            }
          }
        }
      }

      if (sporcuId && sporcuId > 0 && !isNaN(sporcuId)) {
        // Modal açma - tek bir yerde, fallback yok
        try {
          odemeModalAc(sporcuId);

          // Takvim görünümündeyse detayları kapat
          if (isCalendarItem) {
            setTimeout(() => {
              gunDetaylariKapat();
            }, 100);
          }
        } catch (error) {
          console.error('❌ Ödeme modalı açılırken hata:', error);
          Helpers.toast('Ödeme modalı açılamadı. Lütfen sayfayı yenileyin.', 'error');
        }
      } else {
        // Sporcu ID bulunamadı veya geçersiz
        console.error('Sporcu ID bulunamadı veya geçersiz', {
          sporcuId,
          isNumber: typeof sporcuId === 'number',
          isValid: sporcuId && sporcuId > 0 && !isNaN(sporcuId),
        });
        Helpers.toast('Geçersiz sporcu seçimi!', 'error');
      }
      return;
    }

    // SMS gönder butonu
    const smsBtn = target.closest(
      '.sms-gonder-btn, button[onclick*="smsGonderTekil"]'
    ) as HTMLElement | null;
    if (smsBtn) {
      e.preventDefault();
      e.stopPropagation();

      let sporcuId: number | null = null;
      if (smsBtn.hasAttribute('data-sporcu-id')) {
        sporcuId = parseInt(smsBtn.getAttribute('data-sporcu-id') || '0', 10);
      } else {
        const onclickAttr = smsBtn.getAttribute('onclick');
        if (onclickAttr) {
          const match = onclickAttr.match(/smsGonderTekil\((\d+)\)/);
          if (match && match[1]) {
            sporcuId = parseInt(match[1], 10);
          }
        }
      }

      if (sporcuId && sporcuId > 0) {
        try {
          smsGonderTekil(sporcuId);
        } catch (error) {
          console.error('SMS gönderilirken hata:', error);
          Helpers.toast('SMS gönderilemedi!', 'error');
        }
      }
      return;
    }

    // Geçmiş butonu
    const gecmisBtn = target.closest(
      '.gecmis-btn, button[onclick*="gecmisModalAc"]'
    ) as HTMLElement | null;
    if (gecmisBtn) {
      e.preventDefault();
      e.stopPropagation();

      let sporcuId: number | null = null;

      const dataSporcuId = gecmisBtn.getAttribute('data-sporcu-id');
      if (dataSporcuId) {
        sporcuId = parseInt(dataSporcuId, 10);
      } else {
        const onclickAttr = gecmisBtn.getAttribute('onclick');
        if (onclickAttr) {
          const match = onclickAttr.match(/gecmisModalAc\((\d+)\)/);
          if (match && match[1]) {
            sporcuId = parseInt(match[1], 10);
          }
        }

        if (!sporcuId || isNaN(sporcuId)) {
          const parentRow = gecmisBtn.closest('tr');
          if (parentRow) {
            const allDataIds = parentRow.querySelectorAll('[data-sporcu-id]');
            if (
              allDataIds.length > 0 &&
              allDataIds[0] &&
              allDataIds[0].hasAttribute('data-sporcu-id')
            ) {
              const firstId = allDataIds[0].getAttribute('data-sporcu-id');
              if (firstId) {
                sporcuId = parseInt(firstId, 10);
              }
            }
          }
        }
      }

      if (sporcuId && sporcuId > 0 && !isNaN(sporcuId)) {
        try {
          gecmisModalAc(sporcuId);
        } catch (error) {
          console.error('Geçmiş modalı açılırken hata:', error);
          Helpers.toast('Ödeme geçmişi açılamadı. Lütfen sayfayı yenileyin.', 'error');
        }
      } else {
        // Sporcu ID bulunamadı veya geçersiz
        console.error('Sporcu ID bulunamadı veya geçersiz', {
          sporcuId,
          isNumber: typeof sporcuId === 'number',
          isValid: sporcuId && sporcuId > 0 && !isNaN(sporcuId),
        });
        Helpers.toast('Geçersiz sporcu seçimi!', 'error');
      }
      return;
    }
  };

  // Event listener ekle (AbortController ile yönetiliyor)
  document.addEventListener('click', clickHandler, { capture: true, signal: signal });
}

/**
 * Dönem seçicilerini doldur
 */
function donemSecicileriDoldur(): void {
  const aySelect = Helpers.$('#odemeDonemAy') as HTMLSelectElement | null;
  const yilSelect = Helpers.$('#odemeDonemYil') as HTMLSelectElement | null;

  if (aySelect) {
    aySelect.innerHTML = '';
    Helpers.AYLAR.forEach((ay, index) => {
      const option = document.createElement('option');
      option.value = (index + 1).toString();
      option.textContent = ay;
      option.selected = index === new Date().getMonth();
      aySelect.appendChild(option);
    });
  }

  if (yilSelect) {
    yilSelect.innerHTML = '';
    const buYil = new Date().getFullYear();
    for (let yil = buYil - 1; yil <= buYil + 1; yil++) {
      const option = document.createElement('option');
      option.value = yil.toString();
      option.textContent = yil.toString();
      option.selected = yil === buYil;
      yilSelect.appendChild(option);
    }
  }
}

/**
 * Mevcut ay için doğru tutarı hesapla
 * @param sporcu - Sporcu objesi
 * @returns Mevcut ay için doğru tutar
 */
function mevcutAyIcinTutarHesapla(sporcu: Sporcu | null | undefined): number {
  if (!sporcu || !sporcu.id) return 0;

  const { ay: buAy, yil: buYil } = Helpers.suAnkiDonem();
  const aylikUcret = sporcu.odemeBilgileri?.aylikUcret || 0;

  // donemDegisti fonksiyonundaki mantığı kullan
  // Helper fonksiyonu ile mevcut ay için borç hesapla
  const aidatlar = Storage.aidatlariGetir();
  const finansalHesap = Helpers.finansalHesapla(aidatlar, sporcu.id, buAy, buYil);
  const toplamBorc = finansalHesap.toplamBorc;

  // Eğer mevcut ay için borç kaydı varsa, onu kullan
  // Eğer yoksa, aylikUcret kullan (çünkü mevcut ay için otomatik borç hesaplaması yapılır)
  return toplamBorc > 0 ? toplamBorc : aylikUcret;
}

/**
 * Ödeme modalını aç
 * @param sporcuId - Sporcu ID (opsiyonel)
 */
export function odemeModalAc(sporcuId: number | null = null): void {
  const modal = Helpers.$('#odemeModal');
  const sporcuSelect = Helpers.$('#odemeSporcuSelect') as HTMLSelectElement | null;
  const odemeTutar = Helpers.$('#odemeTutar') as HTMLInputElement | null;
  const odemeTarih = Helpers.$('#odemeTarih') as HTMLInputElement | null;

  if (!modal) {
    console.error('odemeModalAc: #odemeModal bulunamadı!');
    Helpers.toast('Ödeme modalı bulunamadı!', 'error');
    return;
  }

  if (!sporcuSelect) {
    console.error('odemeModalAc: #odemeSporcuSelect bulunamadı!');
    Helpers.toast('Sporcu seçimi bulunamadı!', 'error');
    return;
  }

  // Sporcu listesini doldur
  const sporcular = Storage.sporculariGetir().filter(
    s => s.durum === 'Aktif' && !s.odemeBilgileri?.burslu && s.id != null
  );

  sporcuSelect.innerHTML = '<option value="">Sporcu seçin</option>';
  sporcular.forEach(s => {
    if (!s.id) return; // ID yoksa atla
    const option = document.createElement('option');
    option.value = s.id.toString();
    option.textContent = s.temelBilgiler?.adSoyad || 'Bilinmiyor';
    sporcuSelect.appendChild(option);
  });

  // Tarihi bugüne ayarla
  if (odemeTarih) {
    odemeTarih.value = Helpers.bugunISO();
  }

  // Ödeme yöntemini varsayılan olarak "Nakit" yap
  const odemeYontemi = Helpers.$('#odemeYontemi') as HTMLSelectElement | null;
  if (odemeYontemi) {
    odemeYontemi.value = 'Nakit';
  }

  // İşlem türünü varsayılan olarak "Tahsilat" yap
  const odemeIslemTuru = Helpers.$('#odemeIslemTuru') as HTMLSelectElement | null;
  if (odemeIslemTuru) {
    odemeIslemTuru.value = 'Tahsilat';
    // Açıklama alanını başlangıçta gizle (event listener zaten modalEventleri'nde eklenmiş)
    const aciklamaGroup = Helpers.$('#odemeAciklamaGroup') as HTMLElement | null;
    const aciklamaInput = Helpers.$('#odemeAciklama') as HTMLInputElement | null;
    if (aciklamaGroup && aciklamaInput) {
      aciklamaGroup.style.display = 'none';
      aciklamaInput.required = false;
    }
  }

  // Dönem seçicilerini güncelle
  donemSecicileriDoldur();

  // Sporcu seçildiğinde kalan borcu hesapla
  sporcuSelect.onchange = function () {
    donemDegisti();
  };

  // Dönem değiştiğinde kalan borcu hesapla
  const aySelect = Helpers.$('#odemeDonemAy') as HTMLSelectElement | null;
  const yilSelect = Helpers.$('#odemeDonemYil') as HTMLSelectElement | null;
  if (aySelect) aySelect.onchange = donemDegisti;
  if (yilSelect) yilSelect.onchange = donemDegisti;

  // Sporcu seçiliyse
  if (sporcuId) {
    sporcuSelect.value = sporcuId.toString();
    donemDegisti();
  } else {
    if (odemeTutar) odemeTutar.value = '';
    kalanBorcBilgisiGoster(null);
  }

  modalEventleri();

  (modal as HTMLElement).style.display = '';
  (modal as HTMLElement).style.visibility = '';
  (modal as HTMLElement).style.opacity = '';

  modal.classList.add('active');

  const computedStyle = window.getComputedStyle(modal);
  if (computedStyle.display === 'none') {
    (modal as HTMLElement).style.display = 'flex';
  }

  setTimeout(() => {
    const afterComputedStyle = window.getComputedStyle(modal);

    if (!modal.classList.contains('active')) {
      console.error('Modal active class eklenemedi!');
    }

    if (afterComputedStyle.display === 'none') {
      // Force show
      (modal as HTMLElement).style.display = 'flex';
      (modal as HTMLElement).style.visibility = 'visible';
      (modal as HTMLElement).style.opacity = '1';
    }
  }, 100);
}

/**
 * Dönem veya sporcu değiştiğinde kalan borcu hesapla
 */
function donemDegisti(): void {
  const sporcuSelect = Helpers.$('#odemeSporcuSelect') as HTMLSelectElement | null;
  const aySelect = Helpers.$('#odemeDonemAy') as HTMLSelectElement | null;
  const yilSelect = Helpers.$('#odemeDonemYil') as HTMLSelectElement | null;
  const odemeTutar = Helpers.$('#odemeTutar') as HTMLInputElement | null;

  if (!sporcuSelect || !aySelect || !yilSelect) return;

  // parseInt kullanımı - ID ve dönem bilgileri tam sayı olmalı
  const sporcuId = parseInt(sporcuSelect.value, 10);
  const donemAy = parseInt(aySelect.value, 10);
  const donemYil = parseInt(yilSelect.value, 10);

  // Geçerli sayı kontrolü (NaN veya 0 kontrolü)
  if (!sporcuId || isNaN(sporcuId) || sporcuId <= 0) {
    if (odemeTutar) odemeTutar.value = '';
    kalanBorcBilgisiGoster(null);
    return;
  }
  if (!donemAy || isNaN(donemAy) || donemAy < 1 || donemAy > 12) {
    if (odemeTutar) odemeTutar.value = '';
    kalanBorcBilgisiGoster(null);
    return;
  }
  if (!donemYil || isNaN(donemYil) || donemYil < 2000 || donemYil > 2100) {
    if (odemeTutar) odemeTutar.value = '';
    kalanBorcBilgisiGoster(null);
    return;
  }

  const sporcu = Storage.sporcuBul(sporcuId);
  if (!sporcu) {
    kalanBorcBilgisiGoster(null);
    return;
  }

  const aylikUcret = sporcu.odemeBilgileri?.aylikUcret || 0;

  const aidatlar = Storage.aidatlariGetir();
  const finansalHesap = Helpers.finansalHesapla(aidatlar, sporcuId, donemAy, donemYil);
  const { beklenenBorcDonem, kalanBorc } = donemBeklenenBorcVeKalan(sporcu, finansalHesap);
  const toplamTahsilat = finansalHesap.toplamTahsilat;

  kalanBorcBilgisiGoster({
    aylikUcret,
    donemBorcu: beklenenBorcDonem,
    toplamOdenen: toplamTahsilat,
    kalanBorc,
    donemAy,
    donemYil,
  });

  // Tutar alanına kalan borcu yaz
  if (odemeTutar) {
    if (kalanBorc > 0) {
      odemeTutar.value = Helpers.paraFormat(kalanBorc);
    } else {
      odemeTutar.value = '';
    }
  }
}

/**
 * Kalan borç bilgisini modal'da göster
 */
function kalanBorcBilgisiGoster(bilgi: KalanBorcBilgisi | null): void {
  let bilgiDiv = Helpers.$('#donemBorcBilgisi');

  // Div yoksa oluştur
  if (!bilgiDiv) {
    const tutarGroup = Helpers.$('#odemeTutar')?.parentElement;
    if (tutarGroup) {
      bilgiDiv = document.createElement('div');
      bilgiDiv.id = 'donemBorcBilgisi';
      bilgiDiv.style.cssText =
        'margin-top: 0.5rem; padding: 0.75rem; border-radius: 6px; font-size: 0.875rem;';
      tutarGroup.appendChild(bilgiDiv);
    }
  }

  if (!bilgiDiv) return;

  if (!bilgi) {
    (bilgiDiv as HTMLElement).style.display = 'none';
    return;
  }

  (bilgiDiv as HTMLElement).style.display = 'block';

  if (bilgi.kalanBorc <= 0) {
    // Tam ödendi
    (bilgiDiv as HTMLElement).style.background = 'rgba(16, 185, 129, 0.1)';
    (bilgiDiv as HTMLElement).style.border = '1px solid var(--success)';
    (bilgiDiv as HTMLElement).style.color = 'var(--success)';
    bilgiDiv.innerHTML = `
      <i class="fa-solid fa-check-circle"></i>
      <strong>${Helpers.ayAdi(bilgi.donemAy)} ${bilgi.donemYil}</strong> dönemi için 
      <strong>${Helpers.paraFormat(bilgi.toplamOdenen)} TL</strong> ödeme yapılmış. 
      <br><span style="color: var(--success);">✓ Bu dönem için ödeme tamamlanmış!</span>
    `;
  } else if (bilgi.toplamOdenen > 0) {
    // Kısmi ödeme var
    (bilgiDiv as HTMLElement).style.background = 'rgba(245, 158, 11, 0.1)';
    (bilgiDiv as HTMLElement).style.border = '1px solid var(--warning)';
    (bilgiDiv as HTMLElement).style.color = 'var(--warning)';
    bilgiDiv.innerHTML = `
      <i class="fa-solid fa-exclamation-triangle"></i>
      <strong>${Helpers.ayAdi(bilgi.donemAy)} ${bilgi.donemYil}</strong> dönemi için 
      ${Helpers.paraFormat(bilgi.toplamOdenen)} TL ödenmiş.
      <br><strong>Kalan borç: ${Helpers.paraFormat(bilgi.kalanBorc)} TL</strong>
    `;
  } else {
    // Hiç ödeme yok
    (bilgiDiv as HTMLElement).style.background = 'rgba(59, 130, 246, 0.1)';
    (bilgiDiv as HTMLElement).style.border = '1px solid var(--primary)';
    (bilgiDiv as HTMLElement).style.color = 'var(--text)';
    // Seçilen dönem için doğru tutarı kullan (donemBorcu), yoksa aylikUcret kullan
    const beklenenTutar =
      bilgi.donemBorcu !== undefined && bilgi.donemBorcu > 0
        ? Helpers.paraFormat(bilgi.donemBorcu)
        : Helpers.paraFormat(bilgi.aylikUcret);
    bilgiDiv.innerHTML = `
      <i class="fa-solid fa-info-circle" style="color: var(--primary);"></i>
      <strong>${Helpers.ayAdi(bilgi.donemAy)} ${bilgi.donemYil}</strong> dönemi için 
      <strong>${beklenenTutar} TL</strong> ödeme bekleniyor.
    `;
  }
}

/**
 * Ödeme modalını kapat
 */
function odemeModalKapat_fn(): void {
  const modal = Helpers.$('#odemeModal');
  if (modal) {
    modal.classList.remove('active');
    (modal as HTMLElement).style.display = 'none';
    (modal as HTMLElement).style.visibility = 'hidden';
    (modal as HTMLElement).style.opacity = '0';

    const sporcuSelect = Helpers.$('#odemeSporcuSelect') as HTMLSelectElement | null;
    const odemeTutar = Helpers.$('#odemeTutar') as HTMLInputElement | null;
    const odemeTarih = Helpers.$('#odemeTarih') as HTMLInputElement | null;
    const odemeAciklama = Helpers.$('#odemeAciklama') as HTMLInputElement | null;

    if (sporcuSelect) sporcuSelect.value = '';
    if (odemeTutar) odemeTutar.value = '';
    if (odemeTarih) odemeTarih.value = '';
    if (odemeAciklama) odemeAciklama.value = '';
    const odemeNot = Helpers.$('#odemeNot') as HTMLTextAreaElement | null;
    if (odemeNot) odemeNot.value = '';
  } else {
    console.error('❌ Modal bulunamadı!');
  }
}

/**
 * Fazla ödemeyi gelecek ayların aidatlarına dağıtarak kaydet
 * Fazla ödeme tutarı birden fazla ayı kapsayabilir
 * @param sporcuId - Sporcu ID
 * @param fazlaTutar - Fazla ödeme tutarı
 * @param mevcutDonemAy - Mevcut dönem ayı
 * @param mevcutDonemYil - Mevcut dönem yılı
 * @param odemeTarihi - Ödeme tarihi
 * @param yontem - Ödeme yöntemi
 * @returns Kaç ay için ödeme yapıldığı bilgisi
 */
function fazlaOdemeyiGelecekAylaraKaydet(
  sporcuId: number,
  fazlaTutar: number,
  mevcutDonemAy: number,
  mevcutDonemYil: number,
  odemeTarihi: string,
  yontem: 'Nakit' | 'Banka / Havale'
): { kaydedilenAySayisi: number; toplamKayit: number; ayListesi: string[] } {
  try {
    const sporcu = Storage.sporcuBul(sporcuId);
    if (!sporcu) {
      console.warn('⚠️ Fazla ödeme kaydı: Sporcu bulunamadı');
      return { kaydedilenAySayisi: 0, toplamKayit: 0, ayListesi: [] };
    }

    const aylikUcret = sporcu.odemeBilgileri?.aylikUcret || 0;
    if (aylikUcret <= 0) {
      console.warn('⚠️ Fazla ödeme kaydı: Aylık ücret 0 veya negatif');
      return { kaydedilenAySayisi: 0, toplamKayit: 0, ayListesi: [] };
    }

    let kalanFazlaOdeme = fazlaTutar;
    let donemAy = mevcutDonemAy;
    let donemYil = mevcutDonemYil;
    let kaydedilenAySayisi = 0;
    const ayListesi: string[] = [];
    const MAX_AY = 12; // Maksimum 12 ay sonrasına kadar kaydet (güvenlik)

    // Fazla ödemeyi aylık ücrete bölerek gelecek aylara dağıt
    while (kalanFazlaOdeme > 0 && kaydedilenAySayisi < MAX_AY) {
      // Gelecek ayı hesapla
      const gelecekDonem = Helpers.gelecekDonem(donemAy, donemYil);
      donemAy = gelecekDonem.ay;
      donemYil = gelecekDonem.yil;

      // Bu ay için ödenecek tutar (aylık ücret kadar veya kalan fazla ödeme)
      const buAyTutar = Math.min(aylikUcret, kalanFazlaOdeme);

      // Bu ay için fazla ödeme kaydı oluştur (negatif tutar - tahsilat)
      const fazlaOdemeKaydi: Partial<Aidat> = {
        sporcuId: sporcuId,
        tutar: -buAyTutar, // NEGATİF tutar (tahsilat)
        tarih: odemeTarihi,
        donemAy: donemAy,
        donemYil: donemYil,
        yontem: yontem,
        islem_turu: 'Tahsilat',
        aciklama: `Fazla ödeme - ${Helpers.ayAdi(mevcutDonemAy)} ${mevcutDonemYil} döneminden aktarıldı`,
        odemeDurumu: 'Ödendi',
        odemeTarihi: odemeTarihi,
        kayitTarihi: Helpers.bugunISO(),
      };

      Storage.aidatKaydet(fazlaOdemeKaydi);

      ayListesi.push(`${Helpers.ayAdi(donemAy)} ${donemYil}`);
      kaydedilenAySayisi++;
      kalanFazlaOdeme -= buAyTutar;

      // Eğer kalan fazla ödeme aylık ücretten küçükse, tamamı bu aya atandı, döngüden çık
      if (kalanFazlaOdeme <= 0) {
        break;
      }
    }

    console.log('✅ Fazla ödeme gelecek aylara kaydedildi:', {
      sporcuId,
      fazlaTutar,
      kaydedilenAySayisi,
      ayListesi,
    });

    return {
      kaydedilenAySayisi,
      toplamKayit: kaydedilenAySayisi,
      ayListesi,
    };
  } catch (error) {
    console.error('❌ Fazla ödeme kaydı hatası:', error);
    // Hata olsa bile devam et (ana işlem etkilenmesin)
    return { kaydedilenAySayisi: 0, toplamKayit: 0, ayListesi: [] };
  }
}

/**
 * Ödeme kaydet
 */
function odemeKaydet_fn(): void {
  try {
    const sporcuSelect = Helpers.$('#odemeSporcuSelect') as HTMLSelectElement | null;
    const odemeTutar = Helpers.$('#odemeTutar') as HTMLInputElement | null;
    const odemeTarih = Helpers.$('#odemeTarih') as HTMLInputElement | null;
    const aySelect = Helpers.$('#odemeDonemAy') as HTMLSelectElement | null;
    const yilSelect = Helpers.$('#odemeDonemYil') as HTMLSelectElement | null;
    const odemeIslemTuru = Helpers.$('#odemeIslemTuru') as HTMLSelectElement | null;
    const odemeAciklama = Helpers.$('#odemeAciklama') as HTMLInputElement | null;
    const odemeNot = Helpers.$('#odemeNot') as HTMLTextAreaElement | null;

    // Form elementlerinin varlığını kontrol et
    if (!sporcuSelect || !odemeTutar || !odemeTarih || !aySelect || !yilSelect || !odemeIslemTuru) {
      console.error('❌ odemeKaydet_fn: Form elementleri eksik!');
      Helpers.toast('Form alanları bulunamadı!', 'error');
      return;
    }

    const sporcuId = parseInt(sporcuSelect.value, 10);
    const tutar = Helpers.paraCoz(odemeTutar.value);
    const tarih = odemeTarih.value;
    const donemAy = parseInt(aySelect.value, 10);
    const donemYil = parseInt(yilSelect.value, 10);
    const islemTuru = odemeIslemTuru.value;

    // Validasyon
    if (!sporcuId || isNaN(sporcuId) || sporcuId <= 0) {
      Helpers.toast('Lütfen geçerli bir sporcu seçin!', 'error');
      return;
    }

    // Tutar validasyonu - Negatif, sıfır ve NaN kontrolü
    if (isNaN(tutar)) {
      Helpers.toast('Geçerli bir tutar girin! (Sayı formatında)', 'error');
      return;
    }
    if (tutar < 0) {
      Helpers.toast('Tutar negatif olamaz! Lütfen pozitif bir değer girin.', 'error');
      return;
    }
    if (tutar === 0) {
      Helpers.toast("Tutar sıfır olamaz! Lütfen 0'dan büyük bir değer girin.", 'error');
      return;
    }

    if (!tarih || tarih.trim() === '') {
      Helpers.toast('Lütfen tarih seçin!', 'error');
      return;
    }

    // Tarih geçerlilik kontrolü
    const tarihObj = new Date(tarih);
    if (isNaN(tarihObj.getTime())) {
      Helpers.toast('Geçerli bir tarih seçin!', 'error');
      return;
    }

    // Malzeme borcu ekleniyorsa açıklama zorunlu ve geçerli olmalı
    if (islemTuru === 'Malzeme') {
      if (!odemeAciklama) {
        Helpers.toast('Malzeme borcu için açıklama alanı bulunamadı!', 'error');
        return;
      }
      const aciklama = odemeAciklama.value.trim();
      if (!aciklama || aciklama.length === 0) {
        Helpers.toast('Malzeme borcu için açıklama girmelisiniz!', 'error');
        odemeAciklama.focus(); // Kullanıcıyı hataya yönlendir
        return;
      }
      // Minimum ve maksimum uzunluk kontrolü
      if (aciklama.length < 2) {
        Helpers.toast('Açıklama en az 2 karakter olmalıdır!', 'error');
        odemeAciklama.focus();
        return;
      }
      // Maksimum uzunluk kontrolü (performans ve veri bütünlüğü için)
      if (aciklama.length > 100) {
        Helpers.toast('Açıklama en fazla 100 karakter olabilir!', 'error');
        odemeAciklama.focus();
        return;
      }
    }

    // Sporcu bilgisini al
    const sporcu = Storage.sporcuBul(sporcuId);
    if (!sporcu) {
      Helpers.toast('Sporcu bulunamadı!', 'error');
      return;
    }

    // İşlem türüne göre işlem yap
    if (islemTuru === 'Malzeme') {
      // MALZEME BORCU EKLE: Pozitif tutar (borç) olarak kaydet
      const malzemeBorcu: Partial<Aidat> = {
        sporcuId: sporcuId,
        tutar: tutar, // POZİTİF tutar (borç)
        tarih: tarih,
        donemAy: donemAy,
        donemYil: donemYil,
        aciklama: odemeAciklama?.value.trim() || 'Malzeme Ücreti',
        tip: 'ekucret',
        islem_turu: 'Malzeme',
        odemeDurumu: 'Ödenmedi',
        kayitTarihi: Helpers.bugunISO(),
      };

      try {
        Storage.aidatKaydet(malzemeBorcu);
        // XSS koruması: Açıklama escape edilmiş (toast içinde güvenli)
        const guvenliAciklama = Helpers.escapeHtml(odemeAciklama?.value.trim() || 'Malzeme Ücreti');
        Helpers.toast(
          `${guvenliAciklama} borcu (${Helpers.paraFormat(tutar)} TL) eklendi.`,
          'success'
        );
      } catch (error) {
        // Kayıt tarihi kontrolü hatası
        const hataMesaji = error instanceof Error ? error.message : 'Bilinmeyen hata';
        Helpers.toast(`Hata: ${hataMesaji}`, 'error');
        console.error('Malzeme borcu kaydetme hatası:', error);
        return; // İşlemi durdur
      }
    } else {
      // TAHSİLAT: Negatif tutar (tahsilat) olarak kaydet
      // Bu dönem için yapılan ödemeleri kontrol et
      const aidatlar = Storage.aidatlariGetir();
      const donemOdemeleri = aidatlar.filter(
        a => a.sporcuId === sporcuId && a.donemAy === donemAy && a.donemYil === donemYil
      );

      const finansalHesap = Helpers.finansalHesapla(aidatlar, sporcuId, donemAy, donemYil);
      const toplamTahsilat = finansalHesap.toplamTahsilat;
      const { beklenenBorcDonem, kalanBorc } = donemBeklenenBorcVeKalan(sporcu, finansalHesap);

      // Fazla ödeme yapılmaya çalışılıyorsa uyar (sadece tahsilat için)
      if (tutar > kalanBorc && kalanBorc > 0) {
        const onay = Helpers.onay(
          `Kalan borç ${Helpers.paraFormat(kalanBorc)} TL.\n` +
            `${Helpers.paraFormat(tutar)} TL ödeme yapmak istiyorsunuz.\n\n` +
            `Fazla ödeme (${Helpers.paraFormat(tutar - kalanBorc)} TL) kaydetmek istiyor musunuz?`
        );
        if (!onay) return;
      }

      // Ödeme yöntemini al
      const yontem =
        (Helpers.$('#odemeYontemi') as HTMLSelectElement | null)?.value || 'Banka / Havale';

      // Açıklama/Not alanını al (opsiyonel)
      const not = odemeNot?.value.trim() || '';

      // Ödeme kaydet - YENİ MANTIK: Negatif tutar (tahsilat) olarak kaydet
      const odeme: Partial<Aidat> = {
        sporcuId: sporcuId,
        tutar: -tutar, // NEGATİF tutar (tahsilat)
        tarih: tarih,
        donemAy: donemAy,
        donemYil: donemYil,
        yontem: yontem as 'Nakit' | 'Banka / Havale',
        islem_turu: 'Tahsilat',
        aciklama: not || undefined, // Açıklama varsa ekle
        odemeDurumu:
          toplamTahsilat + tutar >= beklenenBorcDonem
            ? 'Ödendi'
            : toplamTahsilat + tutar > 0
              ? 'Kısmi'
              : 'Ödenmedi',
        odemeTarihi: tarih,
        kayitTarihi: Helpers.bugunISO(),
      };

      try {
        Storage.aidatKaydet(odeme);
      } catch (error) {
        // Kayıt tarihi kontrolü hatası (tahsilat için olmamalı ama yine de kontrol)
        const hataMesaji = error instanceof Error ? error.message : 'Bilinmeyen hata';
        Helpers.toast(`Hata: ${hataMesaji}`, 'error');
        console.error('Ödeme kaydetme hatası:', error);
        return; // İşlemi durdur
      }

      // Başarı mesajı ve fazla ödeme kontrolü
      const yeniTahsilat = toplamTahsilat + tutar;
      const yeniKalanBorc = Math.max(0, beklenenBorcDonem - yeniTahsilat);
      const yeniFazlaOdeme = Math.max(0, yeniTahsilat - beklenenBorcDonem);

      // Fazla ödeme varsa ve bu ay tam ödendiyse, fazla kısmı gelecek ayların aidatlarına dağıtarak kaydet
      // (Yalnızca gerçekten beklenen tutar aşıldıysa; beklenenBorcDonem=0 iken dağıtma yapılmaz)
      if (yeniFazlaOdeme > 0 && yeniKalanBorc <= 0 && beklenenBorcDonem > 0) {
        const fazlaOdemeSonuc = fazlaOdemeyiGelecekAylaraKaydet(
          sporcuId,
          yeniFazlaOdeme,
          donemAy,
          donemYil,
          tarih,
          yontem as 'Nakit' | 'Banka / Havale'
        );

        let fazlaOdemeMesaji = '';
        if (fazlaOdemeSonuc.kaydedilenAySayisi === 1) {
          // Tek ay
          fazlaOdemeMesaji = `${Helpers.paraFormat(yeniFazlaOdeme)} TL fazla ödeme ${fazlaOdemeSonuc.ayListesi[0]} dönemi aidatına sayılmıştır.`;
        } else if (fazlaOdemeSonuc.kaydedilenAySayisi > 1) {
          // Birden fazla ay
          const ayListesiStr = fazlaOdemeSonuc.ayListesi.join(', ');
          fazlaOdemeMesaji = `${Helpers.paraFormat(yeniFazlaOdeme)} TL fazla ödeme ${fazlaOdemeSonuc.kaydedilenAySayisi} aya dağıtıldı (${ayListesiStr}).`;
        }

        Helpers.toast(
          `${Helpers.ayAdi(donemAy)} ${donemYil} dönemi için ödeme TAMAMLANDI! ✓\n` +
            fazlaOdemeMesaji,
          'success'
        );
      } else if (yeniKalanBorc <= 0) {
        Helpers.toast(
          `${Helpers.ayAdi(donemAy)} ${donemYil} dönemi için ödeme TAMAMLANDI! ✓`,
          'success'
        );
      } else {
        Helpers.toast(
          `${Helpers.ayAdi(donemAy)} ${donemYil} dönemi için ${Helpers.paraFormat(tutar)} TL ödeme alındı. ` +
            `Kalan borç: ${Helpers.paraFormat(yeniKalanBorc)} TL`,
          'success'
        );
      }
    }

    odemeModalKapat_fn();
    listeyiGuncelle();
    takvimiOlustur(); // Takvimi güncelle
    // Aylık özet kaldırıldı - sadece takvim kullanılıyor

    // Dashboard'u güncelle - tüm modülleri güncelle
    try {
      if (
        typeof window !== 'undefined' &&
        window.Dashboard &&
        typeof window.Dashboard.guncelle === 'function'
      ) {
        window.Dashboard.guncelle();
      }
      // Rapor modülünü de güncelle
      if (
        typeof window !== 'undefined' &&
        window.Rapor &&
        typeof window.Rapor.guncelle === 'function'
      ) {
        window.Rapor.guncelle();
      }
    } catch (e) {
      console.error('Dashboard güncelleme hatası:', e);
    }
  } catch (error) {
    // Beklenmeyen hata durumunda sistemi çökertme
    console.error('❌ odemeKaydet_fn: Beklenmeyen hata:', error);
    Helpers.toast('Ödeme kaydedilirken bir hata oluştu!', 'error');
  }
}

/**
 * Ödeme geçmişi modalını aç
 * @param sporcuId - Sporcu ID
 */
export function gecmisModalAc(sporcuId: number): void {
  try {
    // Sporcu ID validasyonu
    if (!sporcuId || isNaN(sporcuId) || sporcuId <= 0) {
      console.error('❌ gecmisModalAc: Geçersiz sporcu ID:', sporcuId);
      Helpers.toast('Geçersiz sporcu ID!', 'error');
      return;
    }

    const modal = Helpers.$('#odemeGecmisiModal');
    const icerik = Helpers.$('#odemeGecmisiIcerik');

    if (!modal) {
      console.error('❌ gecmisModalAc: #odemeGecmisiModal bulunamadı!');
      Helpers.toast('Modal bulunamadı!', 'error');
      return;
    }

    if (!icerik) {
      console.error('❌ gecmisModalAc: #odemeGecmisiIcerik bulunamadı!');
      Helpers.toast('Modal içeriği bulunamadı!', 'error');
      return;
    }

    // Sporcu bilgisini güvenli şekilde al
    let sporcu;
    let odemeler;
    try {
      sporcu = Storage.sporcuBul(sporcuId);
      odemeler = Storage.sporcuAidatlari(sporcuId);
    } catch (storageError) {
      console.error('❌ gecmisModalAc: Storage hatası:', storageError);
      Helpers.toast('Veri okuma hatası!', 'error');
      return;
    }

    if (!sporcu) {
      Helpers.toast('Sporcu bulunamadı!', 'error');
      return;
    }

    // Başlık güncelle
    const baslik = modal.querySelector('.modal-header h2');
    if (baslik) {
      // Güvenli: XSS koruması için escapeHtml kullan
      const adSoyad = Helpers.escapeHtml(sporcu.temelBilgiler?.adSoyad || 'Bilinmeyen');
      baslik.innerHTML = `<i class="fa-solid fa-history"></i> ${adSoyad} - Ödeme Geçmişi`;
    }

    // İçerik oluştur
    if (odemeler.length === 0) {
      icerik.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-receipt"></i>
        <h3>Ödeme kaydı bulunamadı</h3>
        <p>Bu sporcuya ait henüz ödeme kaydı yapılmamış.</p>
      </div>
    `;
    } else {
      // Tarihe göre sırala (yeniden eskiye)
      const siraliOdemeler = Helpers.sirala(odemeler, 'tarih', 'desc') as Aidat[];
      // Toplam ödeme: Sadece tahsilatları topla (negatif tutarlar veya islem_turu='Tahsilat')
      const toplamOdeme = odemeler
        .filter(o => (o.tutar || 0) < 0 || o.islem_turu === 'Tahsilat')
        .reduce((t, o) => t + Math.abs(o.tutar || 0), 0);

      icerik.innerHTML = `
      <div style="margin-bottom: 1rem; padding: 1rem; background: var(--card-bg); border-radius: var(--radius);">
        <strong>Toplam Ödeme:</strong> 
        <span class="financial-positive">${Helpers.paraFormat(toplamOdeme)} TL</span>
        <span style="color: var(--muted);"> (${odemeler.length} işlem)</span>
      </div>
      <div class="odeme-gecmisi-liste">
        ${siraliOdemeler
          .map(o => {
            const tarihStr = o.tarih || o.odemeTarihi || o.kayitTarihi || '';
            // Dönem bilgisi kontrolü - Geçerli ay (1-12) ve yıl (2000-2100) kontrolü
            const donemGecerli =
              o.donemAy &&
              o.donemYil &&
              o.donemAy >= 1 &&
              o.donemAy <= 12 &&
              o.donemYil >= 2000 &&
              o.donemYil <= 2100;
            const donemStr =
              donemGecerli && o.donemAy
                ? `${Helpers.ayAdi(o.donemAy)} ${o.donemYil}`
                : 'Dönem belirtilmemiş';

            // Açıklama belirleme - Hangi borcun ödendiğini göster (örneğin: "Forma", "Eşofman", "Aralık 2024 Aidatı")
            let aciklama = '';

            if (o.aciklama) {
              // Eğer açıklama varsa onu kullan (örneğin: "Eşofman", "Forma", "Yağmurluk", "Diğer", "Aralık 2024 Aidatı")
              aciklama = Helpers.escapeHtml(o.aciklama);
            } else if (o.islem_turu) {
              // İşlem türüne göre açıklama oluştur
              if (o.islem_turu === 'Aidat') {
                // Aidat için dönem bilgisini ekle
                if (o.donemAy && o.donemYil) {
                  aciklama = `${Helpers.ayAdi(o.donemAy)} ${o.donemYil} Aidatı`;
                } else {
                  aciklama = 'Aidat';
                }
              } else if (o.islem_turu === 'Malzeme') {
                aciklama = 'Malzeme';
              } else if (o.islem_turu === 'Tahsilat') {
                // Tahsilat için, eğer açıklama yoksa "Genel Ödeme" göster
                aciklama = 'Genel Ödeme';
              } else {
                aciklama = o.islem_turu;
              }
            } else {
              // Varsayılan açıklama
              aciklama = (o.tutar || 0) < 0 ? 'Ödeme' : (o.tutar || 0) > 0 ? 'Borç' : 'İşlem';
            }

            // İşlem türü badge'i
            let islemTuruBadge = '';
            if (o.islem_turu === 'Aidat') {
              islemTuruBadge =
                '<span class="badge badge-info" style="font-size: 0.75rem; padding: 0.25rem 0.5rem;">Aidat</span>';
            } else if (o.islem_turu === 'Malzeme') {
              islemTuruBadge =
                '<span class="badge badge-warning" style="font-size: 0.75rem; padding: 0.25rem 0.5rem;">Malzeme</span>';
            } else if (o.islem_turu === 'Tahsilat') {
              islemTuruBadge =
                '<span class="badge badge-success" style="font-size: 0.75rem; padding: 0.25rem 0.5rem;">Tahsilat</span>';
            }

            return `
          <div class="odeme-item">
            <div class="odeme-item-info">
              <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <span class="odeme-item-tarih">${Helpers.tarihFormat(tarihStr)}</span>
                  ${islemTuruBadge}
                </div>
                <span class="odeme-item-aciklama" style="font-weight: 500; color: var(--text);">${aciklama}</span>
                <span class="odeme-item-donem" style="font-size: 0.875rem; color: var(--muted);">${donemStr}</span>
              </div>
            </div>
            <span class="odeme-item-tutar ${(o.tutar || 0) < 0 ? 'financial-positive' : (o.tutar || 0) > 0 ? 'financial-negative' : ''}" style="font-size: 1.1rem; font-weight: 600;">${(o.tutar || 0) < 0 ? '-' : (o.tutar || 0) > 0 ? '+' : ''}${Helpers.paraFormat(Math.abs(o.tutar || 0))} TL</span>
          </div>
        `;
          })
          .join('')}
      </div>
    `;
    }

    // Modal'ı göster
    try {
      // Modal stillerini resetle
      (modal as HTMLElement).style.display = '';
      (modal as HTMLElement).style.visibility = '';
      (modal as HTMLElement).style.opacity = '';

      modal.classList.add('active');

      // Eğer modal hala görünmüyorsa, display stilini manuel olarak set et
      const computedStyle = window.getComputedStyle(modal);
      if (computedStyle.display === 'none') {
        (modal as HTMLElement).style.display = 'flex';
      }
    } catch (modalError) {
      // Modal gösterim hatası - sistemi çökertme
      console.error('❌ Geçmiş modal gösterim hatası:', modalError);
      Helpers.toast('Modal açılırken bir hata oluştu!', 'error');
    }
  } catch (error) {
    // Beklenmeyen hata durumunda sistemi çökertme
    console.error('❌ gecmisModalAc: Beklenmeyen hata:', error);
    Helpers.toast('Ödeme geçmişi açılırken bir hata oluştu!', 'error');
  }
}

/**
 * Geçmiş modalını kapat
 */
function gecmisModalKapat_fn(): void {
  const modal = Helpers.$('#odemeGecmisiModal');
  if (modal) {
    modal.classList.remove('active');
    (modal as HTMLElement).style.display = 'none';
    (modal as HTMLElement).style.visibility = 'hidden';
    (modal as HTMLElement).style.opacity = '0';
  } else {
    console.error('❌ Geçmiş modal bulunamadı!');
  }
}

/** Hızlı filtre butonlarındaki .active (listeyi tetiklemez) */
function aidatHizliFiltreButonlariniAyarla(tip: 'all' | 'paid' | 'debt' | 'upcoming'): void {
  const btnMap: Record<'all' | 'paid' | 'debt' | 'upcoming', string> = {
    all: '#aidatFilterAll',
    paid: '#aidatFilterPaid',
    debt: '#aidatFilterDebt',
    upcoming: '#aidatFilterUpcoming',
  };
  document.querySelectorAll('.aidat-filter-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  const sel = btnMap[tip];
  if (sel) {
    const activeBtn = Helpers.$(sel);
    if (activeBtn) activeBtn.classList.add('active');
  }
}

/**
 * Hızlı filtreleme
 * @param tip - 'all', 'paid', 'debt', 'upcoming'
 */
export function hizliFiltrele(tip: 'all' | 'paid' | 'debt' | 'upcoming'): void {
  // Aynı filtreye tekrar tıklanıyorsa işlem yapma
  if (aktifFiltre === tip) return;

  aktifFiltre = tip;

  // Buton durumlarını güncelle - doğru class selector kullan
  document.querySelectorAll('.aidat-filter-btn').forEach(btn => {
    (btn as HTMLButtonElement).disabled = true; // Butonları geçici olarak devre dışı bırak
  });

  aidatHizliFiltreButonlariniAyarla(tip);

  // Listeyi güncelle - requestAnimationFrame ile smooth update
  requestAnimationFrame(() => {
    listeyiGuncelle();
    // Butonları tekrar aktif et
    requestAnimationFrame(() => {
      document.querySelectorAll('.aidat-filter-btn').forEach(btn => {
        (btn as HTMLButtonElement).disabled = false;
      });
    });
  });
}

/** Liste / takvim: seçili ay veya bugünün dönemi (tek kaynak) */
function aidatAktifDonemAyYil(): { buAy: number; buYil: number } {
  const calendarView = Helpers.$('#aidatCalendar');
  const isCalendarViewVisible =
    calendarView && window.getComputedStyle(calendarView as HTMLElement).display !== 'none';
  if (isCalendarViewVisible && calendarState) {
    return { buAy: calendarState.currentMonth + 1, buYil: calendarState.currentYear };
  }
  const d = Helpers.suAnkiDonem();
  return { buAy: d.ay, buYil: d.yil };
}

function aidatDonemTabloHesap(
  sporcu: Sporcu,
  aidatlar: Aidat[],
  buAy: number,
  buYil: number
): {
  buDonemOdemeler: Aidat[];
  beklenenBorc: number;
  borc: number;
  toplamTahsilatBuSporcu: number;
  donemAidatBorclari: number;
  donemMalzemeBorclari: number;
  toplamBorc: number;
} | null {
  if (sporcu.id == null) return null;
  const burslu = sporcu.odemeBilgileri?.burslu || false;
  const aylikUcret = sporcu.odemeBilgileri?.aylikUcret || 0;
  const buDonemOdemeler = buDonemOdemeleriFiltrele(aidatlar, sporcu.id, buAy, buYil);

  const donemAidatBorclari = buDonemOdemeler
    .filter(a => (a.tutar || 0) > 0 && (a.islem_turu === 'Aidat' || !a.islem_turu))
    .reduce((t, a) => t + (a.tutar || 0), 0);

  const donemMalzemeBorclari = buDonemOdemeler
    .filter(a => (a.tutar || 0) > 0 && a.islem_turu === 'Malzeme')
    .reduce((t, a) => t + (a.tutar || 0), 0);

  const toplamBorc = donemAidatBorclari + donemMalzemeBorclari;
  const beklenenBorc = toplamBorc > 0 ? toplamBorc : aylikUcret;
  const toplamTahsilatBuSporcu = tahsilatTutariHesapla(buDonemOdemeler);
  const borc = burslu ? 0 : Math.max(0, beklenenBorc - toplamTahsilatBuSporcu);

  return {
    buDonemOdemeler,
    beklenenBorc,
    borc,
    toplamTahsilatBuSporcu,
    donemAidatBorclari,
    donemMalzemeBorclari,
    toplamBorc,
  };
}

function aidatTabloOdendiMi(beklenenBorc: number, toplamTahsilatBuSporcu: number): boolean {
  if (beklenenBorc > 0) {
    return toplamTahsilatBuSporcu >= beklenenBorc;
  }
  return toplamTahsilatBuSporcu > 0;
}

function aidatKpiOzetHesapla(
  kaynakSporcular: Sporcu[],
  aidatlar: Aidat[],
  listeAy: number,
  listeYil: number
): { beklenen: number; tahsilat: number; kalan: number } {
  const gecerli = kaynakSporcular.filter(
    (s): s is Sporcu & { id: number } => s != null && s.id != null && typeof s.id === 'number'
  );
  const satirlar = gecerli
    .map(s => {
      const burslu = s.odemeBilgileri?.burslu || false;
      const kayitTarihi = sporcuKayitTarihiGetir(s);
      if (kayitTarihi) {
        const { kayitAy, kayitYil } = kayitTarihiBilgileriAl(kayitTarihi);
        const donemAyFarki = donemAyFarkiHesapla(listeAy, listeYil, kayitAy, kayitYil);
        if (donemAyFarki < 0) return null;
      }
      const h = aidatDonemTabloHesap(s, aidatlar, listeAy, listeYil);
      if (!h) return null;
      return {
        burslu,
        beklenenBorc: h.beklenenBorc,
        toplamTahsilatBuSporcu: h.toplamTahsilatBuSporcu,
        borc: h.borc,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .filter(x => !x.burslu);

  const kpi = {
    beklenen: satirlar.reduce((t, x) => t + x.beklenenBorc, 0),
    tahsilat: satirlar.reduce((t, x) => t + x.toplamTahsilatBuSporcu, 0),
    kalan: satirlar.reduce((t, x) => t + x.borc, 0),
  };
  assertAidatDonemKpiSanity(kpi, 'aidatKpiOzetHesapla');
  return kpi;
}

export function aidatDonemKpiOzet(
  listeAy: number,
  listeYil: number
): { beklenen: number; tahsilat: number; kalan: number } {
  const sporcular = Storage.sporculariGetir();
  const aidatlar = Storage.aidatlariGetir();
  const kaynak = sporcular.filter(s => s.durum === 'Aktif' && s.id != null);
  return aidatKpiOzetHesapla(kaynak, aidatlar, listeAy, listeYil);
}

export function aidatGuncelDonemKpiOzet(): {
  beklenen: number;
  tahsilat: number;
  kalan: number;
} {
  const { ay, yil } = Helpers.suAnkiDonem();
  return aidatDonemKpiOzet(ay, yil);
}

/** Raporlar: Aidat ekranı / `aidatDonemKpiOzet` ile aynı dönem ve kurallar */
export interface AidatDonemBorcluSatir {
  sporcu: Sporcu;
  borc: number;
  beklenenBorc: number;
  toplamTahsilatBuSporcu: number;
}

export function aidatDonemBorcluDetaylari(listeAy: number, listeYil: number): AidatDonemBorcluSatir[] {
  const sporcular = Storage.sporculariGetir();
  const aidatlar = Storage.aidatlariGetir();
  const kaynak = sporcular.filter(s => s.durum === 'Aktif' && s.id != null);
  const gecerli = kaynak.filter(
    (s): s is Sporcu & { id: number } => s != null && s.id != null && typeof s.id === 'number'
  );
  const out: AidatDonemBorcluSatir[] = [];
  for (const s of gecerli) {
    const burslu = s.odemeBilgileri?.burslu || false;
    if (burslu) continue;
    const kayitTarihi = sporcuKayitTarihiGetir(s);
    if (kayitTarihi) {
      const { kayitAy, kayitYil } = kayitTarihiBilgileriAl(kayitTarihi);
      if (donemAyFarkiHesapla(listeAy, listeYil, kayitAy, kayitYil) < 0) continue;
    }
    const h = aidatDonemTabloHesap(s, aidatlar, listeAy, listeYil);
    if (!h) continue;
    if (h.borc > 0) {
      out.push({
        sporcu: s,
        borc: h.borc,
        beklenenBorc: h.beklenenBorc,
        toplamTahsilatBuSporcu: h.toplamTahsilatBuSporcu,
      });
    }
  }
  out.sort((a, b) => b.borc - a.borc);
  return out;
}

/**
 * Seçilen yıl için 12 ayın KPI toplamları; borçlu listesi — o yıl içinde en yüksek aylık kalan borcu.
 */
export function aidatYilOzetVeBorclular(yil: number): {
  beklenen: number;
  tahsilat: number;
  kalan: number;
  borclular: AidatDonemBorcluSatir[];
} {
  let beklenen = 0;
  let tahsilat = 0;
  let kalan = 0;
  for (let m = 1; m <= 12; m++) {
    const k = aidatDonemKpiOzet(m, yil);
    beklenen += k.beklenen;
    tahsilat += k.tahsilat;
    kalan += k.kalan;
  }
  const byId = new Map<number, AidatDonemBorcluSatir>();
  for (let m = 1; m <= 12; m++) {
    for (const row of aidatDonemBorcluDetaylari(m, yil)) {
      const id = row.sporcu.id!;
      const prev = byId.get(id);
      if (!prev || row.borc > prev.borc) {
        byId.set(id, row);
      }
    }
  }
  const borclular = Array.from(byId.values()).sort((a, b) => b.borc - a.borc);
  return { beklenen, tahsilat, kalan, borclular };
}

export function sporcuGuncelDonemAidatBorclu(sporcu: Sporcu): boolean {
  if (sporcu.odemeBilgileri?.burslu) return false;
  const aidatlar = Storage.aidatlariGetir();
  // Takvimde gezinilen ay değil — sporcu/yoklama kartındaki nabız gerçek "bugünün dönemi" ile uyumlu olsun
  const { ay, yil } = Helpers.suAnkiDonem();
  const h = aidatDonemTabloHesap(sporcu, aidatlar, ay, yil);
  if (!h) return false;
  return h.borc > 0;
}

/**
 * Listeyi güncelle
 */
export function listeyiGuncelle(): void {
  const tbody = Helpers.$('#aidatTableBody');
  const tableWrapper = Helpers.$('.aidat-table-wrapper');
  if (!tbody) {
    return;
  }

  // Önce empty state'i gizle (smooth transition için)
  Helpers.hideEmptyState('#aidatEmptyState');

  const sporcular = Storage.sporculariGetir();
  const aidatlar = Storage.aidatlariGetir();

  const aidatArama = Helpers.$('#aidatArama') as HTMLInputElement | null;
  const arama = (aidatArama?.value || '').toLowerCase();

  const { buAy, buYil } = aidatAktifDonemAyYil();

  // Aktif sporcuları filtrele - ID kontrolü ekle + Gelişmiş filtreler
  let filtrelenmis = sporcular.filter(s => {
    const aktif = s.durum === 'Aktif';
    const idVar = s && s.id != null;

    // Arama filtresi (ad, soyad, branş, yaş grubu)
    const aramaUygun =
      !arama ||
      s.temelBilgiler?.adSoyad?.toLowerCase().includes(arama) ||
      s.sporBilgileri?.brans?.toLowerCase().includes(arama) ||
      s.tffGruplari?.anaGrup?.toLowerCase().includes(arama);

    // Gelişmiş filtreler
    const bransUygun = !advancedFilters.brans || s.sporBilgileri?.brans === advancedFilters.brans;
    const yasGrubuUygun =
      !advancedFilters.yasGrubu || s.tffGruplari?.anaGrup === advancedFilters.yasGrubu;

    // ID kontrolü - ID'siz sporcular filtreleniyor (veri bütünlüğü için)

    return aktif && idVar && aramaUygun && bransUygun && yasGrubuUygun;
  });

  // Önce tbody'yi opacity ile gizle (smooth transition)
  if (tbody.children.length > 0) {
    (tbody as HTMLElement).style.opacity = '0';
    (tbody as HTMLElement).style.transition = 'opacity 0.15s ease';
  }

  // requestAnimationFrame ile smooth update
  requestAnimationFrame(() => {
    tbody.innerHTML = '';
    const kpiKaynak = filtrelenmis.slice();

    if (filtrelenmis.length === 0) {
      aidatKartIzgarasiniTemizle();
      Helpers.showEmptyState(
        '#aidatEmptyState',
        'Henüz aidat kaydı bulunmuyor',
        'Aidat takibi için önce sporcu kaydı yapmalısınız.',
        { icon: 'fa-wallet' }
      );
      ozet(0, 0, 0);
      return;
    }

    // Hızlı filtreleme uygula
    if (aktifFiltre !== 'all') {
      const bugun = new Date();
      const bugunGunu = bugun.getDate();

      filtrelenmis = filtrelenmis.filter(s => {
        const burslu = s.odemeBilgileri?.burslu || false;
        if (burslu) return false; // Bursluları filtreleme dışında bırak

        const aylikUcret = s.odemeBilgileri?.aylikUcret || 0;
        if (aylikUcret === 0) return false;

        // Kayıt tarihinden önceki aylar için borç hesaplama yapma
        const kayitTarihi = sporcuKayitTarihiGetir(s);
        if (kayitTarihi) {
          const { kayitAy, kayitYil } = kayitTarihiBilgileriAl(kayitTarihi);
          const donemAyFarki = donemAyFarkiHesapla(buAy, buYil, kayitAy, kayitYil);

          if (donemAyFarki < 0) {
            return false;
          }
        }

        const tabDonem = aidatDonemTabloHesap(s, aidatlar, buAy, buYil);
        if (!tabDonem) return false;

        // Ödeme günü: Manuel ayarlanmışsa onu kullan, yoksa kayıt tarihindeki günü kullan
        let odemeGunu: number | null = null;
        if (s.odemeBilgileri?.odemeGunu) {
          odemeGunu = s.odemeBilgileri.odemeGunu;
        } else if (s.kayitTarihi) {
          const kayitTarihi = new Date(s.kayitTarihi);
          if (!isNaN(kayitTarihi.getTime())) {
            odemeGunu = kayitTarihi.getDate();
          }
        }
        // Ödeme günü yoksa ve yaklaşanlar filtresindeysek atla, diğer filtrelerde devam et
        if (aktifFiltre === 'upcoming' && odemeGunu === null) return false;

        if (aktifFiltre === 'paid') {
          return aidatTabloOdendiMi(tabDonem.beklenenBorc, tabDonem.toplamTahsilatBuSporcu);
        } else if (aktifFiltre === 'debt') {
          return tabDonem.borc > 0;
        } else if (aktifFiltre === 'upcoming') {
          if (tabDonem.borc <= 0) return false;

          // Ödeme günü null ise atla
          if (odemeGunu === null) return false;

          const bugunAy = bugun.getMonth();
          const bugunYil = bugun.getFullYear();
          const buAySonGunu = new Date(bugunYil, bugunAy + 1, 0).getDate();

          // Ödeme günü bu ay içindeyse
          if (odemeGunu >= bugunGunu && odemeGunu <= buAySonGunu) {
            const gunFarki = odemeGunu - bugunGunu;
            return gunFarki >= 0 && gunFarki <= 5;
          }

          // Ödeme günü gelecek ay içindeyse (ay sonuna yakınsa)
          if (odemeGunu < bugunGunu) {
            // Bu ayın kalan günü + gelecek ayın ödeme günü
            const buAyKalanGun = buAySonGunu - bugunGunu;
            const toplamGun = buAyKalanGun + odemeGunu;
            return toplamGun <= 5;
          }

          return false;
        }

        return true;
      });

      // Filtreleme sonrası boşsa empty state göster
      if (filtrelenmis.length === 0) {
        let title: string, message: string, icon: string;
        if (aktifFiltre === 'paid') {
          title = 'Ödeme Yapan Sporcu Bulunmuyor';
          message = 'Bu ay tam ödeme yapan sporcu bulunmuyor.';
          icon = 'fa-check-circle';
        } else if (aktifFiltre === 'debt') {
          title = 'Borçlu Sporcu Bulunmuyor';
          message = 'Tüm sporcular ödemelerini tamamlamış.';
          icon = 'fa-exclamation-triangle';
        } else if (aktifFiltre === 'upcoming') {
          title = 'Yaklaşan Ödeme Yok';
          message = '5 gün içinde ödeme günü olan sporcu bulunmuyor.';
          icon = 'fa-clock';
        } else {
          title = 'Kayıt Bulunamadı';
          message = 'Filtre kriterlerine uygun kayıt bulunamadı.';
          icon = 'fa-inbox';
        }
        aidatKartIzgarasiniTemizle();
        Helpers.showEmptyState('#aidatEmptyState', title, message, { icon });
        {
          const kpi = aidatKpiOzetHesapla(kpiKaynak, aidatlar, buAy, buYil);
          ozet(kpi.beklenen, kpi.tahsilat, kpi.kalan);
        }
        // Fade-in animasyonu için opacity'yi tekrar ayarla
        requestAnimationFrame(() => {
          (tbody as HTMLElement).style.opacity = '1';
        });
        return;
      }
    }

    // Skeleton'ı gizle
    if (tableWrapper) {
      Helpers.hideSkeleton('.aidat-table-wrapper');
    }

    // Önce tüm sporcuların borç bilgilerini hesapla ve sıralama için hazırla
    // ID'si olmayan sporcuları filtrele (TypeScript type guard ile)
    const gecerliSporcular = filtrelenmis.filter(
      (s): s is Sporcu & { id: number } => s != null && s.id != null && typeof s.id === 'number'
    );

    let sporcularBorcBilgileri = gecerliSporcular
      .map(s => {
        const burslu = s.odemeBilgileri?.burslu || false;
        const aylikUcret = s.odemeBilgileri?.aylikUcret || 0;

        const kayitTarihi = sporcuKayitTarihiGetir(s);
        if (kayitTarihi) {
          const { kayitAy, kayitYil } = kayitTarihiBilgileriAl(kayitTarihi);
          const donemAyFarki = donemAyFarkiHesapla(buAy, buYil, kayitAy, kayitYil);
          if (donemAyFarki < 0) return null;
        }

        const h = aidatDonemTabloHesap(s, aidatlar, buAy, buYil);
        if (!h) return null;

        return {
          sporcu: s,
          burslu,
          aylikUcret,
          buDonemOdemeler: h.buDonemOdemeler,
          donemAidatBorclari: h.donemAidatBorclari,
          donemMalzemeBorclari: h.donemMalzemeBorclari,
          beklenenBorc: h.beklenenBorc,
          toplamBorc: h.toplamBorc,
          toplamTahsilatBuSporcu: h.toplamTahsilatBuSporcu,
          borc: h.borc,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    // Sıralama: Önce gelişmiş sıralama, sonra varsayılan
    if (sortState.column) {
      sporcularBorcBilgileri.sort((a, b) => {
        let compareValue = 0;

        switch (sortState.column) {
          case 'ad':
            const adA = a.sporcu.temelBilgiler?.adSoyad || '';
            const adB = b.sporcu.temelBilgiler?.adSoyad || '';
            compareValue = adA.localeCompare(adB, 'tr', { sensitivity: 'base' });
            break;
          case 'borc':
            compareValue = a.borc - b.borc;
            break;
          case 'ucret':
            compareValue = a.aylikUcret - b.aylikUcret;
            break;
          case 'brans':
            const bransA = a.sporcu.sporBilgileri?.brans || '';
            const bransB = b.sporcu.sporBilgileri?.brans || '';
            compareValue = bransA.localeCompare(bransB, 'tr', { sensitivity: 'base' });
            break;
          case 'durum':
            const durumA = a.borc <= 0 && a.toplamBorc > 0 ? 0 : a.borc > 0 ? 2 : 1;
            const durumB = b.borc <= 0 && b.toplamBorc > 0 ? 0 : b.borc > 0 ? 2 : 1;
            compareValue = durumA - durumB;
            break;
          default:
            compareValue = 0;
        }

        return sortState.direction === 'asc' ? compareValue : -compareValue;
      });
    } else {
      // Varsayılan sıralama: Ödemeyenler ve Yaklaşanlar en borçludan en borçsuza, Ödeyenler alfabetik
      if (aktifFiltre === 'debt' || aktifFiltre === 'upcoming') {
        // En borçludan en borçsuza doğru sırala
        sporcularBorcBilgileri.sort((a, b) => b.borc - a.borc);
      } else if (aktifFiltre === 'paid') {
        // Ödeyenler: Alfabetik sırala
        sporcularBorcBilgileri.sort((a, b) => {
          const adA = a.sporcu.temelBilgiler?.adSoyad || '';
          const adB = b.sporcu.temelBilgiler?.adSoyad || '';
          return adA.localeCompare(adB, 'tr', { sensitivity: 'base' });
        });
      }
    }

    // Borç aralığı filtresi (sıralamadan sonra uygula)
    if (advancedFilters.borcAralik) {
      const [min = 0, max = Infinity] =
        advancedFilters.borcAralik === '2000+'
          ? [2000, Infinity]
          : advancedFilters.borcAralik.split('-').map(v => parseInt(v.trim()));

      const filtered = sporcularBorcBilgileri.filter(item => {
        if (advancedFilters.borcAralik === '2000+') {
          return item.borc >= min;
        }
        return item.borc >= min && item.borc <= max;
      });

      // Eğer filtre sonucu boşsa, empty state göster
      if (filtered.length === 0) {
        aidatKartIzgarasiniTemizle();
        Helpers.showEmptyState(
          '#aidatEmptyState',
          'Borç Aralığına Uygun Sporcu Bulunamadı',
          `Seçilen borç aralığında (${advancedFilters.borcAralik}) sporcu bulunmuyor.`,
          { icon: 'fa-filter' }
        );
        {
          const kpi = aidatKpiOzetHesapla(kpiKaynak, aidatlar, buAy, buYil);
          ozet(kpi.beklenen, kpi.tahsilat, kpi.kalan);
        }
        return;
      }

      sporcularBorcBilgileri = filtered;
    }

    {
      const kpi = aidatKpiOzetHesapla(kpiKaynak, aidatlar, buAy, buYil);
      ozet(kpi.beklenen, kpi.tahsilat, kpi.kalan);
    }

    sporcularBorcBilgileri.forEach(
      ({
        sporcu: s,
        burslu,
        aylikUcret,
        buDonemOdemeler,
        toplamBorc,
        toplamTahsilatBuSporcu,
        borc,
        beklenenBorc,
      }) => {
        // Burada sadece tablo gösterimi için döngü yapıyoruz
        // Alacakların toplamı ve tahsilat zaten yukarıda hesaplandı

        // Sporcu ID kontrolü - ID yoksa buton oluşturma
        if (!s) {
          console.warn('Sporcu objesi bulunamadı, atlanıyor');
          return;
        }

        // ID'yi kontrol et ve debug log
        const sporcuId = s.id;
        if (!sporcuId || sporcuId === undefined || sporcuId === null || isNaN(sporcuId)) {
          console.error('❌ Sporcu ID bulunamadı veya geçersiz!', {
            sporcu: s,
            id: s.id,
            hasId: 'id' in s,
            keys: Object.keys(s),
            adSoyad: s.temelBilgiler?.adSoyad,
            idType: typeof s.id,
          });
          return; // ID yoksa bu satırı atla
        }

        // Durum badge ve satır class'ı
        // Takvim mantığı: beklenenBorc (aidat borç kaydı varsa onu kullan, yoksa aylikUcret)
        // Ödendi: odenen >= beklenenBorc
        // Kısmi: odenen > 0 && odenen < beklenenBorc
        // Borçlu: odenen === 0

        let durum: string;
        let avatarStatusClass = '';

        if (burslu) {
          durum = Helpers.createBadge('success', 'BURSLU');
          avatarStatusClass = 'avatar-paid';
        } else {
          // Takvim mantığı ile tutarlı hesaplama (beklenenBorc zaten hesaplanmış)
          // Fazla ödeme durumunu da kontrol et
          if (beklenenBorc > 0) {
            // Beklenen borç var
            if (toplamTahsilatBuSporcu >= beklenenBorc) {
              // Tam ödendi veya fazla ödeme: Tahsilat >= Beklenen borç
              durum = Helpers.createBadge('success', 'Ödendi');
              avatarStatusClass = 'avatar-paid';
            } else if (toplamTahsilatBuSporcu > 0) {
              // Kısmi ödeme: Tahsilat var ama beklenen borçtan az
              durum = Helpers.createBadge('warning', 'Kısmi');
              avatarStatusClass = 'avatar-debt';
            } else {
              // Borçlu: Hiç ödeme yapılmamış
              durum = Helpers.createBadge('danger', 'Borçlu');
              avatarStatusClass = 'avatar-debt';
            }
          } else {
            // Beklenen borç yok (aylikUcret = 0 veya borç kaydı yok)
            if (toplamTahsilatBuSporcu > 0) {
              // Ödeme yapılmış ama beklenen borç yok (fazla ödeme veya yanlış dönem)
              // Bu durumda "Ödendi" göster (çünkü ödeme yapılmış)
              durum = Helpers.createBadge('success', 'Ödendi');
              avatarStatusClass = 'avatar-paid';
            } else {
              // Hiç ödeme yapılmamış ve beklenen borç yok
              durum = Helpers.createBadge('info', 'Beklenen Borç Yok');
              avatarStatusClass = 'avatar-paid';
            }
          }
        }

        // Son ödeme tarihi
        const sonOdeme =
          buDonemOdemeler.length > 0
            ? (() => {
                const sonOdemeKayit = buDonemOdemeler[buDonemOdemeler.length - 1];
                if (!sonOdemeKayit) return '-';
                return Helpers.tarihFormat(
                  sonOdemeKayit.tarih ||
                    sonOdemeKayit.odemeTarihi ||
                    sonOdemeKayit.kayitTarihi ||
                    ''
                );
              })()
            : '-';

        const tr = document.createElement('tr');

        // Güvenli: XSS koruması için escapeHtml kullan
        const adSoyad = Helpers.escapeHtml(s.temelBilgiler?.adSoyad || '-');
        const brans = Helpers.escapeHtml(s.sporBilgileri?.brans || '-');
        const yasGrubu = Helpers.escapeHtml(s.tffGruplari?.anaGrup || '-');

        // Avatar için baş harfler
        const adSoyadParts = (s.temelBilgiler?.adSoyad || '').split(' ').filter(p => p.length > 0);
        const avatarInitials =
          adSoyadParts.length >= 2
            ? (
                (adSoyadParts[0]?.charAt(0) || '') +
                (adSoyadParts[adSoyadParts.length - 1]?.charAt(0) || '')
              ).toUpperCase()
            : (adSoyadParts[0]?.charAt(0) || '?').toUpperCase();

        // Birleştirilmiş sporcu meta bilgisi
        const sporcuMeta = `${brans} • ${yasGrubu}`;

        tr.innerHTML = `
        <td class="sporcu-cell">
          <div class="sporcu-avatar ${avatarStatusClass}">${avatarInitials}</div>
          <div class="sporcu-info">
            <div class="sporcu-name">${adSoyad}</div>
            <div class="sporcu-meta">${sporcuMeta}</div>
          </div>
        </td>
        <td data-label="Aylık Ücret" class="aidat-td-ucret">${burslu ? '0 TL' : Helpers.paraFormat(aylikUcret) + ' TL'}</td>
        <td data-label="Son Ödeme">${Helpers.escapeHtml(sonOdeme)}</td>
        <td data-label="Durum">${durum}</td>
        <td data-label="Kalan Borç">${borc > 0 ? '<span class="financial-negative">' + Helpers.paraFormat(borc) + ' TL</span>' : '-'}</td>
        <td class="td-actions actions-col">
          <div class="action-buttons">
            ${
              !burslu && sporcuId
                ? `
              <button type="button" class="btn btn-small btn-success odeme-al-btn" data-sporcu-id="${sporcuId}" title="Ödeme Al">
              <i class="fa-solid fa-credit-card"></i>
              </button>
              ${
                borc > 0
                  ? `
                <button type="button" class="btn btn-small btn-warning sms-gonder-btn" data-sporcu-id="${sporcuId}" title="SMS Gönder">
                  <i class="fa-solid fa-sms"></i>
                </button>
              `
                  : ''
              }
            `
                : ''
            }
            ${
              sporcuId
                ? `<button type="button" class="btn btn-small gecmis-btn" data-sporcu-id="${sporcuId}" title="Geçmiş">
            <i class="fa-solid fa-history"></i>
          </button>`
                : ''
            }
          </div>
        </td>
      `;

        // Event listener'ları hem event delegation hem de direkt onclick ile ekliyoruz
        // butonEventleri() fonksiyonu tüm butonları yakalıyor
        tbody.appendChild(tr);

        // Butonlara direkt event listener ekle (backup olarak)
        const odemeBtn = tr.querySelector('button.odeme-al-btn') as HTMLButtonElement | null;
        if (odemeBtn && sporcuId) {
          const oldOnclick = odemeBtn.getAttribute('onclick');
          odemeBtn.removeAttribute('onclick');

          const newBtn = odemeBtn.cloneNode(true) as HTMLButtonElement;
          odemeBtn.parentNode?.replaceChild(newBtn, odemeBtn);

          newBtn.addEventListener(
            'click',
            function (e) {
              e.preventDefault();
              e.stopPropagation();
              e.stopImmediatePropagation();
              if (window.Aidat && typeof window.Aidat.odemeModalAc === 'function') {
                window.Aidat.odemeModalAc(sporcuId);
              } else if (typeof odemeModalAc === 'function') {
                odemeModalAc(sporcuId);
              } else {
                console.error('odemeModalAc fonksiyonu bulunamadı!');
                Helpers.toast('Ödeme modalı açılamadı. Sayfayı yenileyin.', 'error');
              }
            },
            true
          ); // Capture phase'de yakala - en önce yakala

          // Mouse event'lerini de yakala (backup)
          newBtn.addEventListener(
            'mousedown',
            function (e) {
              console.log('🖱️ Mouse down event yakalandı');
            },
            true
          );

          newBtn.addEventListener(
            'mouseup',
            function (e) {
              console.log('🖱️ Mouse up event yakalandı');
            },
            true
          );
        } else {
          console.warn('⚠️ Buton bulunamadı veya sporcuId yok:', {
            odemeBtn: !!odemeBtn,
            sporcuId: sporcuId,
          });
        }
      }
    );

    // Tabloyu smooth olarak göster
    requestAnimationFrame(() => {
      (tbody as HTMLElement).style.opacity = '1';
      (tbody as HTMLElement).style.transition = 'opacity 0.2s ease';
    });

    /* Kart ızgarası sporcu-listesi kartlarıyla aynı HTML; mobilde tek liste buradan.
       Masaüstünde tablo+kart senkron kalsın diye her güncellemede doldurulur. */
    kartGorusunuOlustur();
  });
}

/**
 * Özet bilgilerini güncelle
 */
function ozet(alacaklarinToplami: number, tahsilat: number, kalan: number): void {
  const beklenenEl = Helpers.$('#toplamBeklenen');
  const tahsilatEl = Helpers.$('#toplamTahsilat');
  const kalanEl = Helpers.$('#kalanBorc');
  const yuzdeEl = Helpers.$('#tahsilatYuzde');

  if (beklenenEl)
    (beklenenEl as HTMLElement).textContent = Helpers.paraFormat(alacaklarinToplami) + ' TL';
  if (tahsilatEl) (tahsilatEl as HTMLElement).textContent = Helpers.paraFormat(tahsilat) + ' TL';
  if (kalanEl) (kalanEl as HTMLElement).textContent = Helpers.paraFormat(kalan) + ' TL';

  // Yüzde hesaplama: Tahsilat / Alacakların Toplamı * 100
  // Alacakların toplamı 0'dan büyükse yüzde hesapla, değilse 0 göster
  const yuzde =
    alacaklarinToplami > 0 ? Math.min(100, Math.round((tahsilat / alacaklarinToplami) * 100)) : 0;
  if (yuzdeEl) (yuzdeEl as HTMLElement).textContent = '%' + yuzde;
}

/**
 * Dönem bazlı tahsilat raporu
 * @param ay - Ay
 * @param yil - Yıl
 * @returns Rapor
 */
export function donemRaporu(ay: number, yil: number): DonemRaporuResult {
  const sporcular = Storage.sporculariGetir();
  const aidatlar = Storage.aidatlariGetir();

  const kpi = aidatDonemKpiOzet(ay, yil);

  let odeyenler = 0;
  let kismiOdeyenler = 0;
  let borcular = 0;
  let toplamSporcu = 0;

  sporcular
    .filter(
      (s): s is Sporcu & { id: number } =>
        s.durum === 'Aktif' && s.id != null && typeof s.id === 'number'
    )
    .forEach(s => {
      if (s.odemeBilgileri?.burslu) return;

      const kayitTarihi = sporcuKayitTarihiGetir(s);
      if (kayitTarihi) {
        const { kayitAy, kayitYil } = kayitTarihiBilgileriAl(kayitTarihi);
        if (donemAyFarkiHesapla(ay, yil, kayitAy, kayitYil) < 0) return;
      }

      const h = aidatDonemTabloHesap(s, aidatlar, ay, yil);
      if (!h) return;

      toplamSporcu++;

      if (aidatTabloOdendiMi(h.beklenenBorc, h.toplamTahsilatBuSporcu)) {
        odeyenler++;
      } else if (h.toplamTahsilatBuSporcu > 0) {
        kismiOdeyenler++;
      } else {
        borcular++;
      }
    });

  return {
    donem: `${Helpers.ayAdi(ay)} ${yil}`,
    beklenen: kpi.beklenen,
    tahsilat: kpi.tahsilat,
    kalan: kpi.kalan,
    tahsilatOrani: Helpers.yuzdeHesapla(kpi.tahsilat, kpi.beklenen),
    odeyenler,
    kismiOdeyenler,
    borcular,
    toplamSporcu,
  };
}

/**
 * Takvim eventlerini bağla
 */
function takvimEventleri(): void {
  const prevBtn = Helpers.$('#calendarPrevMonth');
  const nextBtn = Helpers.$('#calendarNextMonth');
  const monthSelect = Helpers.$('#calendarMonth') as HTMLSelectElement | null;
  const yearSelect = Helpers.$('#calendarYear') as HTMLSelectElement | null;
  const todayBtn = Helpers.$('#calendarToday');

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      calendarState.currentMonth--;
      if (calendarState.currentMonth < 0) {
        calendarState.currentMonth = 11;
        calendarState.currentYear--;
      }
      // Select elementlerini güncelle
      const monthSelect = Helpers.$('#calendarMonth') as HTMLSelectElement | null;
      const yearSelect = Helpers.$('#calendarYear') as HTMLSelectElement | null;
      if (monthSelect) monthSelect.value = calendarState.currentMonth.toString();
      if (yearSelect) yearSelect.value = calendarState.currentYear.toString();
      takvimiOlustur();
      // Filtreleri de güncelle (takvim ayına göre)
      listeyiGuncelle();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      calendarState.currentMonth++;
      if (calendarState.currentMonth > 11) {
        calendarState.currentMonth = 0;
        calendarState.currentYear++;
      }
      // Select elementlerini güncelle
      const monthSelect = Helpers.$('#calendarMonth') as HTMLSelectElement | null;
      const yearSelect = Helpers.$('#calendarYear') as HTMLSelectElement | null;
      if (monthSelect) monthSelect.value = calendarState.currentMonth.toString();
      if (yearSelect) yearSelect.value = calendarState.currentYear.toString();
      takvimiOlustur();
      // Filtreleri de güncelle (takvim ayına göre)
      listeyiGuncelle();
    });
  }

  if (monthSelect) {
    // Ay seçeneklerini doldur
    Helpers.AYLAR.forEach((ay, index) => {
      const option = document.createElement('option');
      option.value = index.toString();
      option.textContent = ay;
      monthSelect.appendChild(option);
    });
    monthSelect.value = calendarState.currentMonth.toString();
    monthSelect.addEventListener('change', function () {
      calendarState.currentMonth = parseInt((this as HTMLSelectElement).value, 10);
      takvimiOlustur();
      // Filtreleri de güncelle (takvim ayına göre)
      listeyiGuncelle();
    });
  }

  if (yearSelect) {
    // Yıl seçeneklerini doldur (mevcut yıl ± 2)
    const buYil = new Date().getFullYear();
    for (let yil = buYil - 2; yil <= buYil + 2; yil++) {
      const option = document.createElement('option');
      option.value = yil.toString();
      option.textContent = yil.toString();
      yearSelect.appendChild(option);
    }
    yearSelect.value = calendarState.currentYear.toString();
    yearSelect.addEventListener('change', function () {
      calendarState.currentYear = parseInt((this as HTMLSelectElement).value, 10);
      takvimiOlustur();
      // Filtreleri de güncelle (takvim ayına göre)
      listeyiGuncelle();
    });
  }

  if (todayBtn) {
    todayBtn.addEventListener('click', () => {
      const now = new Date();
      calendarState.currentMonth = now.getMonth();
      calendarState.currentYear = now.getFullYear();
      if (monthSelect) monthSelect.value = calendarState.currentMonth.toString();
      if (yearSelect) yearSelect.value = calendarState.currentYear.toString();
      takvimiOlustur();
      // Filtreleri de güncelle (takvim ayına göre)
      listeyiGuncelle();
    });
  }
}

/**
 * Takvimi oluştur
 */
export function takvimiOlustur(): void {
  const container = Helpers.$('#aidatCalendar');
  if (!container) return;

  const { currentMonth, currentYear } = calendarState;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Ayın ilk günü
  const firstDay = new Date(currentYear, currentMonth, 1);
  const lastDay = new Date(currentYear, currentMonth + 1, 0);

  // İlk günün haftanın hangi günü olduğu (0 = Pazar, 1 = Pazartesi, ...)
  const startDay = firstDay.getDay();
  // Pazartesi başlangıcı için düzeltme (0 = Pazartesi)
  const startDayAdjusted = startDay === 0 ? 6 : startDay - 1;

  // Ödeme verilerini al
  const aidatlar = Storage.aidatlariGetir();
  const sporcular = Storage.sporculariGetir().filter(
    s => s.durum === 'Aktif' && !s.odemeBilgileri?.burslu
  );

  // Clear cache for each calendar render
  sporcuKayitTarihleriCache.clear();

  // Hafta günleri
  const weekdays = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

  let html = '<div class="calendar-grid">';

  // Hafta günleri başlıkları
  weekdays.forEach(day => {
    html += `<div class="calendar-weekday">${day}</div>`;
  });

  // Önceki ayın son günleri (takvimi doldurmak için)
  const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
  for (let i = startDayAdjusted - 1; i >= 0; i--) {
    const day = prevMonthLastDay - i;
    html += `<div class="calendar-day other-month">
      <div class="calendar-day-number">${day}</div>
    </div>`;
  }

  // Bu ayın günleri
  for (let day = 1; day <= lastDay.getDate(); day++) {
    const date = new Date(currentYear, currentMonth, day);
    const dateStr = Helpers.tarihISO(date);
    const isToday = date.getTime() === today.getTime();
    const isSelected = calendarState.selectedDate === dateStr;

    // Bu gün için borç durumunu hesapla
    let stats;
    try {
      const result = gunIcinDurumHesapla(dateStr, sporcular, aidatlar, sporcuKayitTarihleriCache);
      stats = result.stats || {
        tamOdenen: 0,
        kismiOdenen: 0,
        borclu: 0,
        toplamBeklenen: 0,
        toplamOdenen: 0,
        toplamSporcu: 0,
      };
    } catch (error) {
      console.error('Takvim hesaplama hatası:', error);
      stats = {
        tamOdenen: 0,
        kismiOdenen: 0,
        borclu: 0,
        toplamBeklenen: 0,
        toplamOdenen: 0,
        toplamSporcu: 0,
      };
    }

    let dayClasses = 'calendar-day';
    if (isToday) dayClasses += ' today';
    if (isSelected) dayClasses += ' selected';

    // Apple tarzı tasarım: Glassmorphism + Progress indicator
    const toplamOdeyen = stats.tamOdenen || 0;
    const toplamOdemeyen = (stats.borclu || 0) + (stats.kismiOdenen || 0);
    const toplamSporcu = stats.toplamSporcu || 0;
    const toplamBeklenen = stats.toplamBeklenen || 0;
    const toplamOdenen = stats.toplamOdenen || 0;

    // Ödeme yüzdesi ve durum
    let paymentRate = 0;
    let statusClass = '';
    let progressStyle = '';

    if (toplamSporcu > 0) {
      paymentRate = Math.round((toplamOdeyen / toplamSporcu) * 100);

      // Status class belirleme
      if (paymentRate === 100) {
        statusClass = 'status-complete';
      } else if (paymentRate >= 80) {
        statusClass = 'status-good';
      } else if (paymentRate >= 50) {
        statusClass = 'status-warning';
      } else if (paymentRate > 0) {
        statusClass = 'status-partial';
      } else {
        statusClass = 'status-pending';
      }

      // Progress ring için CSS variable
      progressStyle = `--progress: ${paymentRate}%;`;
    } else {
      // Sporcu yoksa (geçmiş aylar için veya ödeme günü olmayan günler için)
      // Status class'ı boş bırak veya 'status-empty' gibi bir class ekle
      statusClass = 'status-empty';
    }

    // Apple tarzı kart içeriği
    let cardContent = `<div class="calendar-day-number">${day}</div>`;

    if (toplamSporcu > 0) {
      cardContent += `
        <div class="calendar-day-progress-ring ${statusClass}" style="${progressStyle}">
          <svg class="progress-ring-svg" viewBox="0 0 36 36">
            <circle class="progress-ring-circle-bg" cx="18" cy="18" r="16"></circle>
            <circle class="progress-ring-circle" cx="18" cy="18" r="16"></circle>
          </svg>
        </div>
      `;
    }

    html += `<div class="${dayClasses} ${statusClass}" 
                   data-date="${dateStr}" 
                   data-payment-rate="${paymentRate}"
                   data-total-students="${toplamSporcu}"
                   data-paid="${toplamOdeyen}"
                   data-unpaid="${toplamOdemeyen}"
                   data-amount="${toplamOdenen}"
                   onclick="window.Aidat.gunSecildi('${dateStr}')">
      ${cardContent}
    </div>`;
  }

  // Sonraki ayın ilk günleri (takvimi doldurmak için)
  const totalCells = startDayAdjusted + lastDay.getDate();
  const remainingCells = 42 - totalCells; // 6 hafta x 7 gün = 42
  for (let day = 1; day <= remainingCells && day <= 14; day++) {
    html += `<div class="calendar-day other-month">
      <div class="calendar-day-number">${day}</div>
    </div>`;
  }

  html += '</div>';
  container.innerHTML = html;

  // Apple tarzı tooltip event listener'larını ekle
  setupCalendarTooltips();
}

/**
 * Apple tarzı tooltip sistemi
 */
let calendarTooltip: HTMLElement | null = null;
let tooltipTimeout: number | null = null;

function setupCalendarTooltips(): void {
  // Önce mevcut tooltip'i temizle
  if (calendarTooltip && calendarTooltip.parentNode) {
    calendarTooltip.parentNode.removeChild(calendarTooltip);
  }
  calendarTooltip = null;

  // Mevcut event listener'ları temizle (yeni event listener eklemek için)
  const calendarDays = document.querySelectorAll('.calendar-day[data-total-students]');

  // Tooltip oluştur (sadece bir kez, global)
  if (!calendarTooltip) {
    calendarTooltip = document.createElement('div');
    calendarTooltip.className = 'calendar-day-tooltip';
    calendarTooltip.innerHTML = '<div class="calendar-day-tooltip-content"></div>';
    document.body.appendChild(calendarTooltip);
  }

  const tooltipContent = calendarTooltip.querySelector(
    '.calendar-day-tooltip-content'
  ) as HTMLElement;

  // Event delegation kullan (daha performanslı ve çoklu açılmayı önler)
  const calendarContainer = document.querySelector('#aidatCalendar');
  if (!calendarContainer) return;

  // Mevcut listener'ları kaldır
  calendarContainer.removeEventListener('mouseenter', handleTooltipShow as any, true);
  calendarContainer.removeEventListener('mouseleave', handleTooltipHide as any, true);

  // Yeni listener'lar ekle
  calendarContainer.addEventListener('mouseenter', handleTooltipShow as any, true);
  calendarContainer.addEventListener('mouseleave', handleTooltipHide as any, true);

  function handleTooltipShow(e: Event): void {
    const target = (e.target as HTMLElement).closest(
      '.calendar-day[data-total-students]'
    ) as HTMLElement;
    if (!target || !calendarTooltip || !tooltipContent) return;

    const totalStudents = parseInt(target.dataset.totalStudents || '0');
    if (totalStudents === 0) return;

    // Timeout'u temizle
    if (tooltipTimeout) {
      clearTimeout(tooltipTimeout);
      tooltipTimeout = null;
    }

    const rect = target.getBoundingClientRect();
    const paid = parseInt(target.dataset.paid || '0');
    const unpaid = parseInt(target.dataset.unpaid || '0');
    const amount = parseFloat(target.dataset.amount || '0');
    const dateStr = target.dataset.date || '';

    // Tarih formatla
    const date = new Date(dateStr);
    const dateFormatted = date.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    // Tooltip içeriği
    tooltipContent.innerHTML = `
      <div class="tooltip-header">${dateFormatted}</div>
      <div class="tooltip-stats">
        ${
          paid > 0
            ? `
          <div class="tooltip-stat-item">
            <div class="tooltip-stat-label">
              <span class="tooltip-stat-icon paid"></span>
              <span>Ödendi</span>
            </div>
            <span class="tooltip-stat-value">${paid} sporcu</span>
          </div>
        `
            : ''
        }
        ${
          unpaid > 0
            ? `
          <div class="tooltip-stat-item">
            <div class="tooltip-stat-label">
              <span class="tooltip-stat-icon unpaid"></span>
              <span>Ödenmedi</span>
            </div>
            <span class="tooltip-stat-value">${unpaid} sporcu</span>
          </div>
        `
            : ''
        }
      </div>
      ${
        amount > 0
          ? `
        <div class="tooltip-amount">
          <span>Toplam Tahsilat</span>
          <span class="tooltip-amount-value">${Helpers.paraFormat(amount)} ₺</span>
        </div>
      `
          : ''
      }
    `;

    // Tooltip pozisyonu (requestAnimationFrame ile smooth)
    requestAnimationFrame(() => {
      if (!calendarTooltip) return;

      const tooltipRect = calendarTooltip.getBoundingClientRect();
      let left = rect.left + rect.width / 2 - tooltipRect.width / 2;
      let top = rect.top - tooltipRect.height - 12;

      // Ekran dışına taşmaması için düzeltme
      if (left < 10) left = 10;
      if (left + tooltipRect.width > window.innerWidth - 10) {
        left = window.innerWidth - tooltipRect.width - 10;
      }
      if (top < 10) {
        top = rect.bottom + 12;
      }

      calendarTooltip.style.left = `${left}px`;
      calendarTooltip.style.top = `${top}px`;
      calendarTooltip.classList.add('visible');
    });
  }

  function handleTooltipHide(e: Event): void {
    const target = (e.target as HTMLElement).closest(
      '.calendar-day[data-total-students]'
    ) as HTMLElement;
    if (!target || !calendarTooltip) return;

    // Tooltip'in kendisine gidiyorsa kapatma
    const relatedTarget = (e as MouseEvent).relatedTarget as HTMLElement;
    if (relatedTarget && calendarTooltip.contains(relatedTarget)) {
      return;
    }

    // Kısa bir gecikme ile kapat (smooth transition için)
    if (tooltipTimeout) {
      clearTimeout(tooltipTimeout);
    }

    tooltipTimeout = window.setTimeout(() => {
      if (calendarTooltip) {
        calendarTooltip.classList.remove('visible');
      }
      tooltipTimeout = null;
    }, 100);
  }

  // Tooltip'in üzerine gelince açık kalsın
  if (calendarTooltip) {
    calendarTooltip.addEventListener('mouseenter', () => {
      if (tooltipTimeout) {
        clearTimeout(tooltipTimeout);
        tooltipTimeout = null;
      }
    });

    calendarTooltip.addEventListener('mouseleave', () => {
      if (calendarTooltip) {
        calendarTooltip.classList.remove('visible');
      }
    });
  }
}

/**
 * Dönem ay farkını hesapla (helper fonksiyon)
 * @param donemAy - Dönem ayı (1-12)
 * @param donemYil - Dönem yılı
 * @param kayitAy - Kayıt ayı (1-12)
 * @param kayitYil - Kayıt yılı
 * @returns Ay farkı (negatif = geçmiş, 0 = aynı ay, pozitif = gelecek)
 */
function donemAyFarkiHesapla(
  donemAy: number,
  donemYil: number,
  kayitAy: number,
  kayitYil: number
): number {
  return (donemYil - kayitYil) * 12 + (donemAy - kayitAy);
}

/**
 * Kayıt tarihi bilgilerini al (helper fonksiyon)
 * @param kayitTarihi - Kayıt tarihi (Date)
 * @returns Kayıt ayı, yılı ve günü
 */
function kayitTarihiBilgileriAl(kayitTarihi: Date): {
  kayitAy: number;
  kayitYil: number;
  kayitGunu: number;
} {
  return {
    kayitAy: kayitTarihi.getMonth() + 1,
    kayitYil: kayitTarihi.getFullYear(),
    kayitGunu: kayitTarihi.getDate(),
  };
}

/**
 * Bu dönem için ödeme kayıtlarını filtrele (helper fonksiyon)
 * @param aidatlar - Tüm aidat kayıtları
 * @param sporcuId - Sporcu ID
 * @param buAy - Bu ay (1-12)
 * @param buYil - Bu yıl
 * @returns Filtrelenmiş ödeme kayıtları
 */
function buDonemOdemeleriFiltrele(
  aidatlar: Aidat[],
  sporcuId: number,
  buAy: number,
  buYil: number
): Aidat[] {
  return aidatlar.filter(a => {
    if (a.sporcuId !== sporcuId) return false;

    const donemUygun = a.donemAy === buAy && a.donemYil === buYil;
    if (donemUygun) return true;

    if (a.tarih) {
      const aidatTarihi = new Date(a.tarih);
      if (!isNaN(aidatTarihi.getTime())) {
        const aidatAy = aidatTarihi.getMonth() + 1;
        const aidatYil = aidatTarihi.getFullYear();
        if (aidatAy === buAy && aidatYil === buYil) {
          return true;
        }
      }
    }

    if (a.odemeTarihi) {
      const odemeTarihi = new Date(a.odemeTarihi);
      if (!isNaN(odemeTarihi.getTime())) {
        const odemeAy = odemeTarihi.getMonth() + 1;
        const odemeYil = odemeTarihi.getFullYear();
        if (odemeAy === buAy && odemeYil === buYil) {
          return true;
        }
      }
    }

    return false;
  });
}

/**
 * Tahsilat tutarını hesapla (helper fonksiyon)
 * @param donemOdemeleri - Dönem ödeme kayıtları
 * @returns Toplam tahsilat tutarı
 */
function tahsilatTutariHesapla(donemOdemeleri: Aidat[]): number {
  return donemOdemeleri
    .filter(a => {
      if (a.islem_turu === 'Tahsilat') return true;
      if (!a.islem_turu && (a.tutar || 0) < 0) return true;
      return false;
    })
    .reduce((t, a) => {
      const tutar = a.tutar || 0;
      return t + Math.abs(tutar);
    }, 0);
}

/**
 * Sporcu kayıt tarihini güvenli al (birden çok alandan dener, yoksa bugünü döndürür)
 * @param sporcu - Sporcu objesi
 * @param cache - Optional cache Map for performance optimization
 * @returns Kayıt tarihi (Date) veya null
 */
function sporcuKayitTarihiGetir(sporcu: Sporcu, cache?: Map<number, Date | null>): Date | null {
  // Check cache first
  if (cache && sporcu?.id && cache.has(sporcu.id)) {
    const cachedValue = cache.get(sporcu.id)!;
    return cachedValue;
  }

  const adaylar = [
    sporcu?.kayitTarihi,
    (sporcu as any)?.kayitBilgileri?.kayitTarihi,
    (sporcu as any)?.createdAt,
    (sporcu as any)?.olusturulmaTarihi,
    (sporcu as any)?.eklenmeTarihi,
  ];

  for (const aday of adaylar) {
    if (!aday) continue;

    // DD.MM.YYYY formatını doğru parse et
    let d: Date | null = null;
    let parseMethod = '';

    if (typeof aday === 'string' && aday.includes('.')) {
      // DD.MM.YYYY formatı
      const parts = aday.split('.');
      if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
        const gun = parseInt(parts[0], 10);
        const ay = parseInt(parts[1], 10) - 1; // JavaScript ay 0-11 arası
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
          // Tarih geçerli mi kontrol et
          if (date.getFullYear() === yil && date.getMonth() === ay && date.getDate() === gun) {
            d = date;
            parseMethod = 'DD.MM.YYYY';
          }
        }
      }
    }

    // DD.MM.YYYY parse edilemediyse standart Date() ile dene
    if (!d) {
      const standardDate = new Date(aday);
      if (!isNaN(standardDate.getTime())) {
        d = standardDate;
        parseMethod = 'standard Date()';
      } else {
        continue; // Geçersiz tarih, sonraki adayı dene
      }
    }

    const bugun = new Date();
    // Gelecek tarihleri bugüne kırp
    const result = d > bugun ? bugun : d;
    // Store in cache
    if (cache && sporcu?.id) {
      cache.set(sporcu.id, result);
    }
    return result;
  }

  // Hiç tarih yoksa: null döndür (geçmiş ayları kirletmemek için)
  const result = null;
  // Store null in cache too
  if (cache && sporcu?.id) {
    cache.set(sporcu.id, result);
  }
  return result;
}

/**
 * Gün için durum hesapla
 * @param dateStr - Tarih string (ISO)
 * @param sporcular - Sporcular
 * @param aidatlar - Aidatlar
 * @param kayitTarihleriCache - Optional cache Map for performance optimization
 * @returns Durum ve istatistikler
 */
function gunIcinDurumHesapla(
  dateStr: string,
  sporcular: Sporcu[],
  aidatlar: Aidat[],
  kayitTarihleriCache?: Map<number, Date | null>
): GunIcinDurumResult {
  const date = new Date(dateStr);
  const gunNumarasi = date.getDate(); // 1-31 arası
  const { ay: buAy, yil: buYil } = Helpers.suAnkiDonem(date);

  let tamOdenen = 0;
  let kismiOdenen = 0;
  let borclu = 0;
  let toplamBeklenen = 0;
  let toplamOdenen = 0;

  // SADECE bu günün ödeme günü olan sporcuları kontrol et
  const oGununSporculari = sporcular.filter(sporcu => {
    // KRİTİK KONTROL: Kayıt tarihinden önceki aylar için sporcu ekleme
    // Bu kontrol ÖNCE yapılmalı - filtreleme aşamasında
    const kayitTarihi = sporcuKayitTarihiGetir(sporcu, kayitTarihleriCache);

    // Kayıt tarihi yoksa öğrenciyi hariç tut
    // Kayıt tarihi olmayan öğrenciler geçmiş aylarda görünmemeli
    if (!kayitTarihi) {
      return false; // Kayıt tarihi yoksa öğrenciyi hariç tut
    }

    const { kayitAy, kayitYil, kayitGunu } = kayitTarihiBilgileriAl(kayitTarihi);
    const donemAyFarki = donemAyFarkiHesapla(buAy, buYil, kayitAy, kayitYil);

    if (donemAyFarki < 0) {
      return false;
    }

    if (donemAyFarki === 0 && gunNumarasi < kayitGunu) {
      return false;
    }

    let odemeGunu: number | null = null;

    // Manuel olarak ayarlanmış ödeme günü varsa onu kullan
    if (sporcu.odemeBilgileri?.odemeGunu) {
      odemeGunu = sporcu.odemeBilgileri.odemeGunu;
    } else {
      // Kayıt tarihindeki günü ödeme günü olarak kullan (kayitTarihi artık kesinlikle var)
      odemeGunu = kayitGunu;
    }

    return odemeGunu === gunNumarasi; // Sadece ödeme günü bu gün olanlar
  });

  // Toplam sporcu sayısı (bu günün ödeme günü olanlar)
  const toplamSporcu = oGununSporculari.length;

  oGununSporculari.forEach(sporcu => {
    const aylikUcret = sporcu.odemeBilgileri?.aylikUcret || 0;
    if (aylikUcret === 0) return;

    // Kayıt tarihi kontrolü zaten filter aşamasında yapıldı
    // Burada sadece borç hesaplama yapılır - geçmiş aylar için sporcu zaten filtrelenmiş

    // Bu dönem için ödemeleri bul - Helper fonksiyon kullan
    const kayitTarihi = sporcuKayitTarihiGetir(sporcu, kayitTarihleriCache);
    let donemOdemeleri = buDonemOdemeleriFiltrele(aidatlar, sporcu.id!, buAy, buYil);

    // Kayıt tarihi kontrolü - Geçmiş aylar için aidat kayıtlarını filtrele
    if (kayitTarihi) {
      const { kayitAy, kayitYil, kayitGunu } = kayitTarihiBilgileriAl(kayitTarihi);
      donemOdemeleri = donemOdemeleri.filter(a => {
        const aidatDonemAy = a.donemAy || (a.tarih ? new Date(a.tarih).getMonth() + 1 : null);
        const aidatDonemYil = a.donemYil || (a.tarih ? new Date(a.tarih).getFullYear() : null);

        if (aidatDonemAy && aidatDonemYil) {
          const aidatDonemAyFarki = donemAyFarkiHesapla(
            aidatDonemAy,
            aidatDonemYil,
            kayitAy,
            kayitYil
          );
          if (aidatDonemAyFarki < 0) return false;
          if (aidatDonemAyFarki === 0 && gunNumarasi < kayitGunu) return false;
        }
        return true;
      });
    }

    // Aidat ve Malzeme borçlarını ayrı hesapla
    // Takvim sadece AİDAT borçlarını gösterir (aylık ücret bazlı)
    // Malzeme borçları ayrı yönetilir (Aidat modülünde ayrı gösterilir)
    const donemAidatBorclari = donemOdemeleri
      .filter(a => (a.tutar || 0) > 0 && (a.islem_turu === 'Aidat' || !a.islem_turu))
      .reduce((t, a) => t + (a.tutar || 0), 0);

    // Malzeme borçları (takvim hesaplamasına dahil edilmez, sadece bilgi amaçlı)
    const donemMalzemeBorclari = donemOdemeleri
      .filter(a => (a.tutar || 0) > 0 && a.islem_turu === 'Malzeme')
      .reduce((t, a) => t + (a.tutar || 0), 0);

    // Tahsilat hesaplama
    const odenen = tahsilatTutariHesapla(donemOdemeleri);

    // Bu dönem için beklenen borç: SADECE AİDAT (malzeme hariç)
    // Eğer aidat borç kaydı varsa onu kullan, yoksa aylık ücret
    const beklenenBorc = donemAidatBorclari > 0 ? donemAidatBorclari : aylikUcret;

    if (odenen >= beklenenBorc) {
      tamOdenen++;
    } else if (odenen > 0) {
      kismiOdenen++;
    } else {
      borclu++;
    }

    toplamBeklenen += beklenenBorc;
    toplamOdenen += odenen;
  });

  // Genel durum belirleme (çoğunluğa göre)
  let status: 'debt' | 'partial' | 'paid' | null = null;
  if (toplamSporcu === 0) {
    status = null;
  } else if (borclu > tamOdenen && borclu > kismiOdenen) {
    status = 'debt';
  } else if (kismiOdenen > tamOdenen) {
    status = 'partial';
  } else if (tamOdenen > 0 && borclu === 0) {
    status = 'paid';
  }

  return {
    status,
    stats: {
      tamOdenen,
      kismiOdenen,
      borclu,
      toplamBeklenen,
      toplamOdenen,
      toplamSporcu,
    },
  };
}

/**
 * Gün seçildiğinde
 * @param dateStr - Seçilen tarih
 */
export function gunSecildi(dateStr: string): void {
  calendarState.selectedDate = dateStr;
  takvimiOlustur(); // Seçili günü vurgulamak için

  // O günün ödemelerini göster
  gunDetaylariGoster(dateStr);
}

/**
 * Gün detaylarını göster (modal) - O günün ödeme günü olan sporcuları göster
 * @param dateStr - Tarih
 */
function gunDetaylariGoster(dateStr: string): void {
  const date = new Date(dateStr);
  const gunNumarasi = date.getDate(); // 1-31 arası
  const aidatlar = Storage.aidatlariGetir();
  const sporcular = Storage.sporculariGetir().filter(
    s => s.durum === 'Aktif' && !s.odemeBilgileri?.burslu
  );

  // Bu ayın dönem bilgisi
  const { ay: buAy, yil: buYil } = Helpers.suAnkiDonem(date);

  // Create a local cache for this function call
  const localCache = new Map<number, Date | null>();

  // Bu günün ödeme günü olan sporcuları bul
  const oGununSporculari = sporcular.filter(sporcu => {
    // KRİTİK KONTROL: Kayıt tarihinden önceki aylar için sporcu ekleme
    const kayitTarihi = sporcuKayitTarihiGetir(sporcu, localCache);
    if (kayitTarihi) {
      const { kayitAy, kayitYil, kayitGunu } = kayitTarihiBilgileriAl(kayitTarihi);
      const donemAyFarki = donemAyFarkiHesapla(buAy, buYil, kayitAy, kayitYil);

      if (donemAyFarki < 0) {
        return false;
      }

      if (donemAyFarki === 0 && gunNumarasi < kayitGunu) {
        return false;
      }
    }

    let odemeGunu: number | null = null;

    // Manuel olarak ayarlanmış ödeme günü varsa onu kullan
    if (sporcu.odemeBilgileri?.odemeGunu) {
      odemeGunu = sporcu.odemeBilgileri.odemeGunu;
    } else if (kayitTarihi) {
      // Kayıt tarihindeki günü ödeme günü olarak kullan
      odemeGunu = kayitTarihi.getDate();
    }

    // Ödeme günü yoksa bu sporcuyu atla (kayıt tarihi olmayan sporcu)
    if (odemeGunu === null) {
      return false;
    }

    return odemeGunu === gunNumarasi;
  });

  // Tıklanan günün indicator durumuna göre filtrele
  const clickedDay = document.querySelector(`[data-date="${dateStr}"]`);
  const indicatorType: 'unpaid' | 'paid' | 'mixed' | null = clickedDay?.classList.contains('unpaid')
    ? 'unpaid'
    : clickedDay?.classList.contains('paid')
      ? 'paid'
      : clickedDay?.classList.contains('mixed')
        ? 'mixed'
        : null;

  // Her sporcu için ödeme durumunu hesapla
  const sporcuDurumlari: SporcuDurumItem[] = oGununSporculari.map(sporcu => {
    const aylikUcret = sporcu.odemeBilgileri?.aylikUcret || 0;

    // Bu dönem için ödemeleri bul
    const donemOdemeleri = aidatlar.filter(
      a => a.sporcuId === sporcu.id && a.donemAy === buAy && a.donemYil === buYil
    );

    // Aidat ve Malzeme borçlarını ayrı hesapla
    // Takvim sadece AİDAT borçlarını gösterir (aylık ücret bazlı)
    // Malzeme borçları ayrı yönetilir (Aidat modülünde ayrı gösterilir)
    const donemAidatBorclari = donemOdemeleri
      .filter(a => (a.tutar || 0) > 0 && (a.islem_turu === 'Aidat' || !a.islem_turu))
      .reduce((t, a) => t + (a.tutar || 0), 0);

    // Malzeme borçları (takvim hesaplamasına dahil edilmez, sadece bilgi amaçlı)
    const donemMalzemeBorclari = donemOdemeleri
      .filter(a => (a.tutar || 0) > 0 && a.islem_turu === 'Malzeme')
      .reduce((t, a) => t + (a.tutar || 0), 0);

    // Tahsilatları hesapla - çift saymayı önlemek için
    // islem_turu='Tahsilat' olanlar VEYA (islem_turu yok VE tutar negatif)
    const donemTahsilatlari = donemOdemeleri
      .filter(a => {
        // islem_turu='Tahsilat' olanlar (tutar pozitif veya negatif olabilir)
        if (a.islem_turu === 'Tahsilat') return true;
        // Eski kayıtlar: islem_turu yok ve tutar negatif
        if (!a.islem_turu && (a.tutar || 0) < 0) return true;
        return false;
      })
      .reduce((t, a) => t + Math.abs(a.tutar || 0), 0);

    const odenen = donemTahsilatlari;

    // Borç = SADECE AİDAT borçları - Bu dönem tahsilatları
    // Eğer aidat borç kaydı yoksa, aylık ücretten tahsilatları çıkar
    // Malzeme borçları takvim hesaplamasına dahil edilmez
    const toplamBorcBuDonem = donemAidatBorclari > 0 ? donemAidatBorclari : aylikUcret;
    const borc = Math.max(0, toplamBorcBuDonem - odenen);
    const durum: 'paid' | 'partial' | 'debt' =
      odenen >= toplamBorcBuDonem ? 'paid' : odenen > 0 ? 'partial' : 'debt';

    return {
      sporcu,
      aylikUcret,
      odenen,
      borc,
      durum,
      donemOdemeleri,
    };
  });

  // Ödemesini yapmayanları filtrele (borç > 0 olanlar)
  const borcluSporcular = sporcuDurumlari.filter(s => s.borc > 0);
  const odenenSporcular = sporcuDurumlari.filter(s => s.borc <= 0);

  // Indicator tipine göre gösterilecek listeyi belirle
  let gosterilecekListe: SporcuDurumItem[] = [];
  let listeBasligi = '';

  if (indicatorType === 'unpaid') {
    gosterilecekListe = borcluSporcular;
    listeBasligi = 'Ödemesini Yapmayanlar';
  } else if (indicatorType === 'paid') {
    gosterilecekListe = odenenSporcular;
    listeBasligi = 'Ödeme Yapanlar';
  } else {
    gosterilecekListe = sporcuDurumlari;
    listeBasligi = 'Tüm Sporcular';
  }

  // Modal oluştur veya güncelle
  let modal = Helpers.$('#calendarDayModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'calendarDayModal';
    modal.className = 'calendar-day-modal';
    modal.innerHTML = `
      <div class="calendar-day-modal-content">
        <div class="calendar-day-modal-header">
          <h2 id="calendarDayModalTitle"></h2>
          <button class="calendar-day-modal-close" onclick="window.Aidat.gunDetaylariKapat()">
            <i class="fa-solid fa-times"></i>
          </button>
        </div>
        <div id="calendarDayModalBody" class="calendar-day-payments"></div>
      </div>
    `;
    document.body.appendChild(modal);

    // Dışarı tıklanınca kapat
    modal.addEventListener('click', function (e: MouseEvent) {
      if (e.target === modal) {
        gunDetaylariKapat();
      }
    });
  }

  // Başlık
  const title = Helpers.$('#calendarDayModalTitle');
  if (title) {
    (title as HTMLElement).textContent =
      `${gunNumarasi} ${Helpers.ayAdi(buAy)} ${buYil} - Ödeme Günü`;
  }

  // İçerik
  const body = Helpers.$('#calendarDayModalBody');
  if (body) {
    if (oGununSporculari.length === 0) {
      body.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-calendar-check"></i>
          <h3>Bu gün için ödeme günü olan sporcu bulunmuyor</h3>
          <p>${gunNumarasi}. gün ödeme günü olarak ayarlanmış sporcu yok.</p>
        </div>
      `;
    } else {
      // Özet istatistikler - Borç kayıtlarından ve tahsilatlardan hesapla
      // Beklenen = Bu dönem için oluşturulmuş borç kayıtları (Aidat + Malzeme)
      const toplamBeklenen = sporcuDurumlari.reduce((t, s) => {
        // Bu sporcu için bu dönemdeki borç kayıtlarını bul
        const donemOdemeleri = aidatlar.filter(
          a => a.sporcuId === s.sporcu.id && a.donemAy === buAy && a.donemYil === buYil
        );
        const donemBorclari = donemOdemeleri
          .filter(
            a =>
              (a.tutar || 0) > 0 &&
              (a.islem_turu === 'Aidat' || a.islem_turu === 'Malzeme' || !a.islem_turu)
          )
          .reduce((sum, a) => sum + (a.tutar || 0), 0);
        // Eğer borç kaydı yoksa, aylık ücreti kullan
        return t + (donemBorclari > 0 ? donemBorclari : s.aylikUcret);
      }, 0);
      const toplamOdenen = sporcuDurumlari.reduce((t, s) => t + s.odenen, 0);
      const toplamBorc = sporcuDurumlari.reduce((t, s) => t + s.borc, 0);

      let html = `
        <div class="calendar-day-summary">
          <div class="calendar-day-summary-stat">
            <span class="calendar-day-summary-label">Toplam Sporcu</span>
            <span class="calendar-day-summary-value">${oGununSporculari.length}</span>
          </div>
          <div class="calendar-day-summary-stat">
            <span class="calendar-day-summary-label">Beklenen</span>
            <span class="calendar-day-summary-value">${Helpers.paraFormat(toplamBeklenen)} TL</span>
          </div>
          <div class="calendar-day-summary-stat">
            <span class="calendar-day-summary-label">Tahsilat</span>
            <span class="calendar-day-summary-value financial-positive">${Helpers.paraFormat(toplamOdenen)} TL</span>
          </div>
          <div class="calendar-day-summary-stat">
            <span class="calendar-day-summary-label">Borç</span>
            <span class="calendar-day-summary-value ${toplamBorc > 0 ? 'financial-negative' : ''}">${Helpers.paraFormat(toplamBorc)} TL</span>
          </div>
        </div>
      `;

      // Gösterilecek liste
      if (gosterilecekListe.length > 0) {
        html += `
          <div class="calendar-day-section">
            <h3 class="calendar-day-section-title">
              <i class="fa-solid fa-${indicatorType === 'unpaid' ? 'exclamation-triangle' : indicatorType === 'paid' ? 'check-circle' : 'users'}"></i> 
              ${listeBasligi} (${gosterilecekListe.length})
            </h3>
            <div class="calendar-day-sporcu-list">
              ${gosterilecekListe
                .sort((a, b) => {
                  if (indicatorType === 'unpaid') return b.borc - a.borc;
                  if (indicatorType === 'paid') return b.odenen - a.odenen;
                  return b.borc - a.borc;
                })
                .map(item => {
                  // Durum belirleme: Borç 0 ise "Borcu Yok", kısmi ödeme varsa "Kısmi Ödeme", tam borçlu ise "Borçlu"
                  let durumClass = '';
                  let durumText = '';
                  if (item.borc <= 0) {
                    durumClass = 'paid'; // Yeşil arka plan için
                    durumText = 'Borcu Yok';
                  } else if (item.durum === 'partial') {
                    durumClass = 'partial';
                    durumText = 'Kısmi Ödeme';
                  } else {
                    durumClass = 'debt'; // Kırmızı arka plan için
                    durumText = 'Borçlu';
                  }

                  // Güvenli: XSS koruması için escapeHtml kullan
                  const adSoyad = Helpers.escapeHtml(
                    item.sporcu.temelBilgiler?.adSoyad || 'Bilinmeyen'
                  );
                  const brans = Helpers.escapeHtml(item.sporcu.sporBilgileri?.brans || '-');

                  // Beklenen tutar: Bu dönem için borç kayıtları varsa onu kullan, yoksa aylık ücret
                  const donemOdemeleri = aidatlar.filter(
                    a => a.sporcuId === item.sporcu.id && a.donemAy === buAy && a.donemYil === buYil
                  );
                  const donemBorclari = donemOdemeleri
                    .filter(
                      a =>
                        (a.tutar || 0) > 0 &&
                        (a.islem_turu === 'Aidat' || a.islem_turu === 'Malzeme' || !a.islem_turu)
                    )
                    .reduce((t, a) => t + (a.tutar || 0), 0);
                  const beklenenTutar = donemBorclari > 0 ? donemBorclari : item.aylikUcret;

                  return `
                  <div class="calendar-day-sporcu-item ${durumClass}" data-sporcu-id="${item.sporcu.id}" style="cursor: pointer;">
                    <div class="calendar-day-sporcu-info">
                      <div class="calendar-day-sporcu-name">${adSoyad}</div>
                      <div class="calendar-day-sporcu-details">
                        ${brans} | ${durumText}
                      </div>
                    </div>
                    <div class="calendar-day-sporcu-amount">
                      <div class="calendar-day-sporcu-borc ${item.borc > 0 ? 'financial-negative' : 'financial-positive'}">${Helpers.paraFormat(item.borc)} TL</div>
                      <div class="calendar-day-sporcu-odenen" style="font-size: var(--font-size-xs); color: var(--muted);">
                        ${Helpers.paraFormat(item.odenen)} / ${Helpers.paraFormat(beklenenTutar)} TL
                      </div>
                    </div>
                  </div>
                `;
                })
                .join('')}
            </div>
          </div>
        `;
      }

      body.innerHTML = html;
    }
  }

  modal.classList.add('active');
}

/**
 * Gün detaylarını kapat
 */
export function gunDetaylariKapat(): void {
  const modal = Helpers.$('#calendarDayModal');
  if (modal) {
    modal.classList.remove('active');
    calendarState.selectedDate = null;
    setTimeout(() => takvimiOlustur(), 300);
  }
}

/**
 * Aylık özet liste oluştur (kompakt kart görünümü)
 * @param sporcular - Sporcular listesi
 * @param donemKey - Dönem anahtarı (1, 11, 21)
 * @param tip - 'debt' veya 'paid'
 * @returns HTML
 */
function aylikOzetListeOlustur(
  sporcular: SporcuDurumItem[],
  donemKey: string,
  tip: 'debt' | 'paid'
): string {
  if (!sporcular || sporcular.length === 0) {
    return '<div class="monthly-summary-empty"><i class="fa-solid fa-check-circle"></i><p>Kayıt bulunamadı</p></div>';
  }

  // State kontrolü - limit: 12 (kompakt görünüm, scroll yok)
  if (!monthlyListState[tip][donemKey]) {
    monthlyListState[tip][donemKey] = { showAll: false, limit: 12 };
  }

  const state = monthlyListState[tip][donemKey];
  const gosterilecekler = state.showAll ? sporcular : sporcular.slice(0, state.limit);
  const kalanSayi = Math.max(0, sporcular.length - state.limit);

  // Kompakt kart görünümü (grid layout)
  let html = '<div class="monthly-summary-list-compact">';

  html += gosterilecekler
    .map(item => {
      const durumClass = tip === 'debt' ? (item.durum === 'partial' ? 'partial' : 'debt') : 'paid';
      const durumText = tip === 'debt' ? (item.durum === 'partial' ? 'Kısmi' : 'Borçlu') : 'Ödendi';
      const tutar = tip === 'debt' ? item.borc : item.odenen;
      const title = tip === 'debt' ? 'Ödeme almak için tıklayın' : 'Detay görmek için tıklayın';

      // Güvenli: XSS koruması için escapeHtml kullan
      const adSoyad = Helpers.escapeHtml(item.sporcu.temelBilgiler?.adSoyad || 'Bilinmeyen');
      const brans = Helpers.escapeHtml(item.sporcu.sporBilgileri?.brans || '-');
      return `
      <div class="monthly-summary-card-item ${durumClass}" data-sporcu-id="${item.sporcu.id}" title="${title}" style="cursor: pointer;">
        <div class="monthly-summary-card-item-name">${adSoyad}</div>
        <div class="monthly-summary-card-item-details">${brans} | ${durumText}</div>
        <div class="monthly-summary-card-item-amount ${durumClass}">${Helpers.paraFormat(tutar)} TL</div>
      </div>
    `;
    })
    .join('');

  html += '</div>';

  // "Daha fazla göster" butonu
  if (!state.showAll && kalanSayi > 0) {
    html += `
      <div style="text-align: center; margin-top: var(--spacing-md);">
        <button class="btn btn-small" onclick="window.Aidat.monthlyListToggle('${donemKey}', '${tip}')" style="width: 100%;">
          <i class="fa-solid fa-chevron-down"></i> ${kalanSayi} kişi daha göster
        </button>
      </div>
    `;
  } else if (state.showAll && sporcular.length > state.limit) {
    html += `
      <div style="text-align: center; margin-top: var(--spacing-md);">
        <button class="btn btn-small" onclick="window.Aidat.monthlyListToggle('${donemKey}', '${tip}')" style="width: 100%;">
          <i class="fa-solid fa-chevron-up"></i> Daha az göster (İlk ${state.limit})
        </button>
      </div>
    `;
  }

  return html;
}

/**
 * Aylık özet liste toggle (daha fazla/daha az göster)
 * @param donemKey - Dönem anahtarı
 * @param tip - 'debt' veya 'paid'
 */
export function monthlyListToggle(donemKey: string, tip: 'debt' | 'paid'): void {
  if (!monthlyListState[tip][donemKey]) {
    monthlyListState[tip][donemKey] = { showAll: false, limit: 12 };
  }

  monthlyListState[tip][donemKey].showAll = !monthlyListState[tip][donemKey].showAll;

  // Listeyi yeniden oluştur
  aylikOzetOlustur();
}

/**
 * Tab değiştir
 * @param donemKey - Dönem anahtarı
 * @param tip - 'debt' veya 'paid'
 */
export function monthlyTabSwitch(donemKey: string, tip: 'debt' | 'paid'): void {
  // Tüm tab'ları pasif yap (bu dönem için)
  const allTabs = document.querySelectorAll(`[id^="tab_"]`);
  allTabs.forEach(tab => {
    if (tab.id.endsWith(`_${donemKey}`)) {
      tab.classList.remove('active');
    }
  });

  // Tüm içerikleri gizle (bu dönem için)
  const allContents = document.querySelectorAll(`[id^="content_"]`);
  allContents.forEach(content => {
    if (content.id.endsWith(`_${donemKey}`)) {
      content.classList.remove('active');
    }
  });

  // Seçili tab'ı aktif yap
  const activeTab = Helpers.$(`#tab_${tip}_${donemKey}`);
  if (activeTab) activeTab.classList.add('active');

  // Seçili içeriği göster
  const activeContent = Helpers.$(`#content_${tip}_${donemKey}`);
  if (activeContent) activeContent.classList.add('active');
}

/**
 * Birleşik arama filtresi (hem borçlu hem ödeme yapan)
 * @param donemKey - Dönem anahtarı
 */
export function monthlySearchFilter(donemKey: string): void {
  const searchInput = Helpers.$(`#monthlySearch_${donemKey}`) as HTMLInputElement | null;
  if (!searchInput) return;

  const searchTerm = searchInput.value.toLowerCase().trim();
  const activeTab = document.querySelector(`[id^="tab_${donemKey}"].active`);
  if (!activeTab) return;

  const tip = activeTab.id.includes('debt') ? 'debt' : 'paid';

  // İlgili filtre fonksiyonunu çağır
  if (tip === 'debt') {
    monthlyDebtFilter(donemKey, searchTerm);
  } else {
    monthlyPaidFilter(donemKey, searchTerm);
  }
}

/**
 * Aylık özet borçlu filtreleme
 * @param donemKey - Dönem anahtarı
 * @param searchTerm - Arama terimi (opsiyonel)
 */
export function monthlyDebtFilter(donemKey: string, searchTerm: string | null = null): void {
  const listContainer = Helpers.$(`#monthlyDebtList_${donemKey}`);
  if (!listContainer) return;

  // Arama terimi yoksa birleşik arama kutusundan al
  if (searchTerm === null) {
    const searchInput = Helpers.$(`#monthlySearch_${donemKey}`) as HTMLInputElement | null;
    searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
  }

  // Tüm borçlu sporcuları al (orijinal listeden)
  const { currentMonth, currentYear } = calendarState;
  const aidatlar = Storage.aidatlariGetir();
  const sporcular = Storage.sporculariGetir().filter(
    s => s.durum === 'Aktif' && !s.odemeBilgileri?.burslu
  );

  const borcluSporcular: SporcuDurumItem[] = [];
  sporcular.forEach(sporcu => {
    const aylikUcret = sporcu.odemeBilgileri?.aylikUcret || 0;
    if (aylikUcret === 0) return;

    const donemOdemeleri = aidatlar.filter(
      a => a.sporcuId === sporcu.id && a.donemAy === currentMonth + 1 && a.donemYil === currentYear
    );

    const odenen = donemOdemeleri.reduce((t, a) => t + (a.tutar || 0), 0);
    const borc = aylikUcret - odenen;

    if (borc > 0) {
      borcluSporcular.push({
        sporcu,
        aylikUcret,
        odenen,
        borc,
        durum: odenen > 0 ? 'partial' : 'debt',
        donemOdemeleri,
      });
    }
  });

  // Filtrele
  let filtrelenmis = borcluSporcular;
  if (searchTerm) {
    filtrelenmis = borcluSporcular.filter(item => {
      const ad = (item.sporcu.temelBilgiler?.adSoyad || '').toLowerCase();
      const brans = (item.sporcu.sporBilgileri?.brans || '').toLowerCase();
      return ad.includes(searchTerm) || brans.includes(searchTerm);
    });
    // Arama yapıldığında state'i sıfırla (tümünü göster)
    monthlyListState.debt[donemKey] = { showAll: true, limit: 12 };
  } else {
    // Arama boşsa state'i koru (ilk 12 veya tümü)
    if (!monthlyListState.debt[donemKey]) {
      monthlyListState.debt[donemKey] = { showAll: false, limit: 12 };
    }
  }

  // Sırala ve göster
  filtrelenmis.sort((a, b) => b.borc - a.borc);
  listContainer.innerHTML = aylikOzetListeOlustur(filtrelenmis, donemKey, 'debt');
}

/**
 * Aylık özet ödeme yapan filtreleme
 * @param donemKey - Dönem anahtarı
 * @param searchTerm - Arama terimi (opsiyonel)
 */
export function monthlyPaidFilter(donemKey: string, searchTerm: string | null = null): void {
  const listContainer = Helpers.$(`#monthlyPaidList_${donemKey}`);
  if (!listContainer) return;

  // Arama terimi yoksa birleşik arama kutusundan al
  if (searchTerm === null) {
    const searchInput = Helpers.$(`#monthlySearch_${donemKey}`) as HTMLInputElement | null;
    searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
  }

  // Tüm ödeme yapan sporcuları al
  const { currentMonth, currentYear } = calendarState;
  const aidatlar = Storage.aidatlariGetir();
  const sporcular = Storage.sporculariGetir().filter(
    s => s.durum === 'Aktif' && !s.odemeBilgileri?.burslu
  );

  const odenenSporcular: SporcuDurumItem[] = [];
  sporcular.forEach(sporcu => {
    const aylikUcret = sporcu.odemeBilgileri?.aylikUcret || 0;
    if (aylikUcret === 0) return;

    const donemOdemeleri = aidatlar.filter(
      a => a.sporcuId === sporcu.id && a.donemAy === currentMonth + 1 && a.donemYil === currentYear
    );

    const odenen = donemOdemeleri.reduce((t, a) => t + (a.tutar || 0), 0);

    if (odenen >= aylikUcret) {
      odenenSporcular.push({
        sporcu,
        aylikUcret,
        odenen,
        borc: 0,
        durum: 'paid',
        donemOdemeleri,
      });
    }
  });

  // Filtrele
  let filtrelenmis = odenenSporcular;
  if (searchTerm) {
    filtrelenmis = odenenSporcular.filter(item => {
      const ad = (item.sporcu.temelBilgiler?.adSoyad || '').toLowerCase();
      const brans = (item.sporcu.sporBilgileri?.brans || '').toLowerCase();
      return ad.includes(searchTerm) || brans.includes(searchTerm);
    });
    // Arama yapıldığında state'i sıfırla (tümünü göster)
    monthlyListState.paid[donemKey] = { showAll: true, limit: 12 };
  } else {
    // Arama boşsa state'i koru (ilk 12 veya tümü)
    if (!monthlyListState.paid[donemKey]) {
      monthlyListState.paid[donemKey] = { showAll: false, limit: 12 };
    }
  }

  // Sırala ve göster
  filtrelenmis.sort((a, b) => b.odenen - a.odenen);
  listContainer.innerHTML = aylikOzetListeOlustur(filtrelenmis, donemKey, 'paid');
}

interface DonemBilgisi {
  baslangic: number;
  bitis: number;
  ad: string;
  class: string;
  icon: string;
}

interface SporcuDurumItemWithState {
  sporcu: Sporcu;
  aylikUcret: number;
  odenen: number;
  borc: number;
  durum: 'partial' | 'debt' | 'paid';
}

/**
 * Aylık özet görünümünü oluştur
 */
export function aylikOzetOlustur(): void {
  const container = Helpers.$('#monthlySummary');
  if (!container) return;

  const { currentMonth, currentYear } = calendarState;
  const aidatlar = Storage.aidatlariGetir();
  const sporcular = Storage.sporculariGetir().filter(
    s => s.durum === 'Aktif' && !s.odemeBilgileri?.burslu
  );

  // 3 dönem: 1-10, 11-20, 21-31
  const donemler: DonemBilgisi[] = [
    { baslangic: 1, bitis: 10, ad: 'İlk 10 Gün', class: 'period-early', icon: 'fa-clock' },
    {
      baslangic: 11,
      bitis: 20,
      ad: '11-20 Gün',
      class: 'period-late',
      icon: 'fa-exclamation-triangle',
    },
    { baslangic: 21, bitis: 31, ad: '21-31 Gün', class: 'period-critical', icon: 'fa-bell' },
  ];

  let html = '<div class="monthly-summary-grid">';

  donemler.forEach(donem => {
    // Bu dönem için tüm sporcuları analiz et
    const borcluSporcular: SporcuDurumItemWithState[] = [];
    const odenenSporcular: SporcuDurumItemWithState[] = [];
    let toplamBeklenen = 0;
    let toplamOdenen = 0;
    let toplamBorc = 0;

    sporcular.forEach(sporcu => {
      const aylikUcret = sporcu.odemeBilgileri?.aylikUcret || 0;
      if (aylikUcret === 0) return;

      toplamBeklenen += aylikUcret;

      // Bu ay için ödemeleri bul
      const donemOdemeleri = aidatlar.filter(
        a =>
          a.sporcuId === sporcu.id && a.donemAy === currentMonth + 1 && a.donemYil === currentYear
      );

      const odenen = donemOdemeleri.reduce((t, a) => t + (a.tutar || 0), 0);
      const borc = aylikUcret - odenen;

      toplamOdenen += odenen;

      // Borçlu veya kısmi ödeme yapanları ekle
      if (borc > 0) {
        toplamBorc += borc;
        borcluSporcular.push({
          sporcu,
          aylikUcret,
          odenen,
          borc,
          durum: odenen > 0 ? 'partial' : 'debt',
        });
      } else if (odenen >= aylikUcret) {
        // Tam ödeme yapanları da ekle
        odenenSporcular.push({
          sporcu,
          aylikUcret,
          odenen,
          borc: 0,
          durum: 'paid',
        });
      }
    });

    // Tahsilat oranı
    const tahsilatOrani =
      toplamBeklenen > 0 ? Math.round((toplamOdenen / toplamBeklenen) * 100) : 0;

    html += `
      <div class="monthly-summary-card ${donem.class}">
        <div class="monthly-summary-card-header">
          <i class="fa-solid ${donem.icon}"></i>
          <h3>${donem.ad}</h3>
        </div>
        <div class="monthly-summary-stats">
          <div class="monthly-summary-stat">
            <span class="monthly-summary-stat-label">Toplam Beklenen</span>
            <span class="monthly-summary-stat-value">${Helpers.paraFormat(toplamBeklenen)} TL</span>
          </div>
          <div class="monthly-summary-stat">
            <span class="monthly-summary-stat-label">Toplam Tahsilat</span>
            <span class="monthly-summary-stat-value positive">${Helpers.paraFormat(toplamOdenen)} TL</span>
          </div>
          <div class="monthly-summary-stat">
            <span class="monthly-summary-stat-label">Toplam Borç</span>
            <span class="monthly-summary-stat-value negative">${Helpers.paraFormat(toplamBorc)} TL</span>
          </div>
          <div class="monthly-summary-stat">
            <span class="monthly-summary-stat-label">Tahsilat Oranı</span>
            <span class="monthly-summary-stat-value ${tahsilatOrani >= 80 ? 'positive' : tahsilatOrani >= 50 ? '' : 'negative'}">%${tahsilatOrani}</span>
          </div>
          <div class="monthly-summary-stat">
            <span class="monthly-summary-stat-label">Borçlu Sporcu</span>
            <span class="monthly-summary-stat-value ${borcluSporcular.length === 0 ? 'positive' : 'negative'}">${borcluSporcular.length} kişi</span>
          </div>
        </div>
        <div class="monthly-summary-list">
          ${
            borcluSporcular.length === 0 && odenenSporcular.length === 0
              ? `
            <div class="monthly-summary-empty">
              <i class="fa-solid fa-check-circle"></i>
              <p>Tüm ödemeler tamamlanmış!</p>
            </div>
          `
              : `
            <!-- Tab Yapısı -->
            <div class="monthly-summary-tabs">
              ${
                borcluSporcular.length > 0
                  ? `
                <button class="monthly-summary-tab active" 
                        onclick="window.Aidat.monthlyTabSwitch('${donem.baslangic}', 'debt')"
                        id="tab_debt_${donem.baslangic}">
                  <i class="fa-solid fa-exclamation-triangle"></i> Borçlular (${borcluSporcular.length})
                </button>
              `
                  : ''
              }
              ${
                odenenSporcular.length > 0
                  ? `
                <button class="monthly-summary-tab ${borcluSporcular.length === 0 ? 'active' : ''}" 
                        onclick="window.Aidat.monthlyTabSwitch('${donem.baslangic}', 'paid')"
                        id="tab_paid_${donem.baslangic}">
                  <i class="fa-solid fa-check-circle"></i> Ödeme Yapanlar (${odenenSporcular.length})
                </button>
              `
                  : ''
              }
            </div>
            
            <!-- Arama Kutusu -->
            <div style="margin-bottom: var(--spacing-md);">
              <input type="text" 
                     class="search-box" 
                     id="monthlySearch_${donem.baslangic}" 
                     placeholder="🔍 Sporcu ara..." 
                     style="width: 100%; padding: 0.75rem; font-size: var(--font-size-sm);"
                     oninput="window.Aidat.monthlySearchFilter('${donem.baslangic}')">
            </div>
            
            <!-- Tab İçerikleri -->
            ${
              borcluSporcular.length > 0
                ? `
              <div class="monthly-summary-tab-content ${borcluSporcular.length > 0 && odenenSporcular.length === 0 ? 'active' : borcluSporcular.length > 0 ? 'active' : ''}" 
                   id="content_debt_${donem.baslangic}">
                <div id="monthlyDebtList_${donem.baslangic}">
                  ${aylikOzetListeOlustur(
                    borcluSporcular
                      .sort((a, b) => b.borc - a.borc)
                      .map(s => ({
                        sporcu: s.sporcu,
                        aylikUcret: s.aylikUcret,
                        odenen: s.odenen,
                        borc: s.borc,
                        durum: s.durum,
                        donemOdemeleri: aidatlar.filter(
                          a =>
                            a.sporcuId === s.sporcu.id &&
                            a.donemAy === currentMonth + 1 &&
                            a.donemYil === currentYear
                        ),
                      })),
                    donem.baslangic.toString(),
                    'debt'
                  )}
                </div>
              </div>
            `
                : ''
            }
            ${
              odenenSporcular.length > 0
                ? `
              <div class="monthly-summary-tab-content ${borcluSporcular.length === 0 ? 'active' : ''}" 
                   id="content_paid_${donem.baslangic}">
                <div id="monthlyPaidList_${donem.baslangic}">
                  ${aylikOzetListeOlustur(
                    odenenSporcular
                      .sort((a, b) => b.odenen - a.odenen)
                      .map(s => ({
                        sporcu: s.sporcu,
                        aylikUcret: s.aylikUcret,
                        odenen: s.odenen,
                        borc: s.borc,
                        durum: s.durum,
                        donemOdemeleri: aidatlar.filter(
                          a =>
                            a.sporcuId === s.sporcu.id &&
                            a.donemAy === currentMonth + 1 &&
                            a.donemYil === currentYear
                        ),
                      })),
                    donem.baslangic.toString(),
                    'paid'
                  )}
                </div>
              </div>
            `
                : ''
            }
          `
          }
        </div>
      </div>
    `;
  });

  html += '</div>';

  // Genel özet kartı
  const genelToplamBeklenen = sporcular.reduce(
    (t, s) => t + (s.odemeBilgileri?.aylikUcret || 0),
    0
  );
  const genelToplamOdenen = aidatlar
    .filter(a => a.donemAy === currentMonth + 1 && a.donemYil === currentYear)
    .reduce((t, a) => t + (a.tutar || 0), 0);
  const genelToplamBorc = genelToplamBeklenen - genelToplamOdenen;
  const genelTahsilatOrani =
    genelToplamBeklenen > 0 ? Math.round((genelToplamOdenen / genelToplamBeklenen) * 100) : 0;

  html =
    `
    <div class="monthly-summary-card" style="grid-column: 1 / -1; background: linear-gradient(135deg, rgba(49, 130, 206, 0.1) 0%, rgba(49, 130, 206, 0.05) 100%); border: 2px solid var(--accent);">
      <div class="monthly-summary-card-header">
        <i class="fa-solid fa-chart-line" style="background: rgba(49, 130, 206, 0.2); color: var(--accent);"></i>
        <h3>${Helpers.AYLAR[currentMonth]} ${currentYear} - Genel Özet</h3>
      </div>
      <div class="monthly-summary-stats" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--spacing-md);">
        <div class="monthly-summary-stat">
          <span class="monthly-summary-stat-label">Toplam Beklenen</span>
          <span class="monthly-summary-stat-value" style="font-size: var(--font-size-lg);">${Helpers.paraFormat(genelToplamBeklenen)} TL</span>
        </div>
        <div class="monthly-summary-stat">
          <span class="monthly-summary-stat-label">Toplam Tahsilat</span>
          <span class="monthly-summary-stat-value positive" style="font-size: var(--font-size-lg);">${Helpers.paraFormat(genelToplamOdenen)} TL</span>
        </div>
        <div class="monthly-summary-stat">
          <span class="monthly-summary-stat-label">Toplam Borç</span>
          <span class="monthly-summary-stat-value negative" style="font-size: var(--font-size-lg);">${Helpers.paraFormat(genelToplamBorc)} TL</span>
        </div>
        <div class="monthly-summary-stat">
          <span class="monthly-summary-stat-label">Tahsilat Oranı</span>
          <span class="monthly-summary-stat-value ${genelTahsilatOrani >= 80 ? 'positive' : genelTahsilatOrani >= 50 ? '' : 'negative'}" style="font-size: var(--font-size-lg); font-weight: var(--font-weight-bold);">%${genelTahsilatOrani}</span>
        </div>
      </div>
    </div>
  ` + html;

  container.innerHTML = html;
}

/**
 * Tekil SMS gönder (bir sporcu için)
 * @param sporcuId - Sporcu ID
 */
export function smsGonderTekil(sporcuId: number): void {
  const sporcu = Storage.sporcuBul(sporcuId);
  if (!sporcu) {
    Helpers.toast('Sporcu bulunamadı!', 'error');
    return;
  }

  // Veli telefonu kontrolü
  const veliTel = sporcu.veliBilgileri?.veli1?.telefon || sporcu.iletisim?.telefon;
  if (!veliTel) {
    Helpers.toast('Sporcu için veli telefonu bulunamadı!', 'warning');
    return;
  }

  // Notification modülü ile SMS gönder
  if (typeof window !== 'undefined' && window.Notification) {
    const ayarlar = window.Notification.ayarlariGetir?.();
    if (!ayarlar?.enabled) {
      Helpers.toast(
        "Hatırlatma sistemi kapalı! Ayarlar > Hatırlatma Ayarları'ndan aktifleştirin.",
        'warning'
      );
      return;
    }
    if (!ayarlar?.methods?.sms) {
      Helpers.toast(
        "SMS kanalı kapalı! Ayarlar > Hatırlatma Ayarları > Bildirim Kanalları'ndan SMS'i aktifleştirin.",
        'warning'
      );
      return;
    }

    // SMS gönder
    window.Notification.topluHatirlatmaGonder?.([sporcu], 'sms');

    Helpers.toast(`${sporcu.temelBilgiler?.adSoyad} velisine SMS gönderildi!`, 'success');
  } else {
    Helpers.toast('SMS özelliği kullanılamıyor!', 'error');
  }
}

/**
 * Toplu SMS gönder (filtrelenmiş listeye)
 */
/**
 * Sporcu için dönem borcunu hesapla (helper fonksiyon)
 */
function sporcuBorcHesapla(
  sporcuId: number,
  donemAy: number,
  donemYil: number
): {
  aylikUcret: number;
  toplamBorc: number;
  toplamOdenen: number;
  kalanBorc: number;
} {
  const sporcu = Storage.sporcuBul(sporcuId);
  if (!sporcu) {
    return { aylikUcret: 0, toplamBorc: 0, toplamOdenen: 0, kalanBorc: 0 };
  }

  const aylikUcret = sporcu.odemeBilgileri?.aylikUcret || 0;
  const burslu = sporcu.odemeBilgileri?.burslu || false;

  if (burslu) {
    return { aylikUcret: 0, toplamBorc: 0, toplamOdenen: 0, kalanBorc: 0 };
  }

  const aidatlar = Storage.aidatlariGetir();
  const donemKayitlari = aidatlar.filter(
    a => a.sporcuId === sporcuId && a.donemAy === donemAy && a.donemYil === donemYil
  );

  // Borçları topla (Aidat, Malzeme veya pozitif tutar)
  const borcKayitlari = donemKayitlari.filter(a => {
    const tutar = a.tutar || 0;
    // Borç kayıtları: Aidat, Malzeme veya islem_turu yoksa ve pozitif tutar
    return a.islem_turu === 'Aidat' || a.islem_turu === 'Malzeme' || (!a.islem_turu && tutar > 0);
  });
  const toplamBorc = borcKayitlari.reduce((t, a) => t + Math.abs(a.tutar || 0), 0);

  // Ödemeleri topla (Tahsilat veya negatif tutar)
  const odemeKayitlari = donemKayitlari.filter(a => {
    return a.islem_turu === 'Tahsilat' || (!a.islem_turu && (a.tutar || 0) < 0);
  });
  const toplamOdenen = odemeKayitlari.reduce((t, a) => t + Math.abs(a.tutar || 0), 0);

  // Kalan borç = Toplam borç - Toplam ödenen
  // Eğer dönem için borç kaydı yoksa, aylık ücret borç olarak kabul edilir
  const donemBorcu = toplamBorc > 0 ? toplamBorc : aylikUcret;
  const kalanBorc = Math.max(0, donemBorcu - toplamOdenen);

  return { aylikUcret, toplamBorc, toplamOdenen, kalanBorc };
}

export function topluSmsGonder(): void {
  console.log('🚀 topluSmsGonder() fonksiyonu çağrıldı');
  const sporcular = Storage.sporculariGetir();
  const aidatlar = Storage.aidatlariGetir();
  const { ay: buAy, yil: buYil } = Helpers.suAnkiDonem();
  const aidatArama = Helpers.$('#aidatArama') as HTMLInputElement | null;
  const arama = (aidatArama?.value || '').toLowerCase();
  console.log(`📅 Dönem: ${buAy}/${buYil}, Arama: "${arama}"`);

  // Aktif filtreye göre sporcuları al
  let filtrelenmis = sporcular.filter(
    s =>
      s.durum === 'Aktif' &&
      s.temelBilgiler?.adSoyad?.toLowerCase().includes(arama) &&
      !s.odemeBilgileri?.burslu
  );

  // Filtreleme uygula - ÖNCE borç kontrolü yap, sonra filtreleme
  if (aktifFiltre === 'debt') {
    // Sadece borçlular
    filtrelenmis = filtrelenmis.filter(s => {
      const finansal = sporcuBorcHesapla(s.id!, buAy, buYil);
      return finansal.kalanBorc > 0;
    });
  } else if (aktifFiltre === 'upcoming') {
    // Yaklaşan ödeme günü olan ve borçlu olanlar
    const bugun = new Date();
    const bugunGunu = bugun.getDate();
    filtrelenmis = filtrelenmis.filter(s => {
      const odemeGunu = s.odemeBilgileri?.odemeGunu || 5;
      const gunFarki = odemeGunu - bugunGunu;
      if (gunFarki < 0 || gunFarki > 5) return false;

      const finansal = sporcuBorcHesapla(s.id!, buAy, buYil);
      return finansal.kalanBorc > 0;
    });
  } else {
    // 'all' filtresinde de sadece borçlulara SMS gönder
    filtrelenmis = filtrelenmis.filter(s => {
      const finansal = sporcuBorcHesapla(s.id!, buAy, buYil);
      return finansal.kalanBorc > 0;
    });
  }

  // Telefonu olanları filtrele
  const telefonluSporcular = filtrelenmis.filter(s => {
    const veliTel = s.veliBilgileri?.veli1?.telefon || s.iletisim?.telefon;
    return veliTel;
  });

  if (telefonluSporcular.length === 0) {
    Helpers.toast('SMS gönderilebilecek borçlu sporcu bulunamadı!', 'warning');
    return;
  }

  // Onay iste
  const onay = confirm(
    `${telefonluSporcular.length} borçlu sporcuya SMS gönderilecek. Devam etmek istiyor musunuz?`
  );
  if (!onay) return;

  // SMS gönder
  if (typeof window !== 'undefined' && window.Notification) {
    const ayarlar = window.Notification.ayarlariGetir?.();
    if (!ayarlar?.enabled || !ayarlar?.methods?.sms) {
      Helpers.toast(
        "SMS özelliği aktif değil! Ayarlar > Hatırlatma Ayarları'ndan aktifleştirin.",
        'warning'
      );
      return;
    }

    // topluHatirlatmaGonder içinde toast gösterilecek, burada gösterme
    window.Notification.topluHatirlatmaGonder?.(telefonluSporcular, 'sms', buAy, buYil);
  } else {
    Helpers.toast('SMS özelliği kullanılamıyor!', 'error');
  }
}

/** Sporcu listesi ile aynı grup satırı (TFF yaş · branş · kulüp antrenman) */
function sporcuAntrenmanEtiketiAdi(s: Sporcu): string {
  const id = s.antrenmanGrubuId;
  if (!id) return '';
  return Storage.antrenmanGrubuBul(id)?.ad || '';
}

/**
 * Kart görünümünü oluştur
 */
function kartGorusunuOlustur(): void {
  const cardsGrid = Helpers.$('#aidatCardsGrid');
  if (!cardsGrid) return;

  const sporcular = Storage.sporculariGetir();
  const aidatlar = Storage.aidatlariGetir();
  const { buAy, buYil } = aidatAktifDonemAyYil();

  const aidatArama = Helpers.$('#aidatArama') as HTMLInputElement | null;
  const arama = (aidatArama?.value || '').toLowerCase();

  // Aynı filtreleme mantığını kullan
  let filtrelenmis = sporcular.filter(s => {
    const aktif = s.durum === 'Aktif';
    const idVar = s && s.id != null;
    const aramaUygun =
      !arama ||
      s.temelBilgiler?.adSoyad?.toLowerCase().includes(arama) ||
      s.sporBilgileri?.brans?.toLowerCase().includes(arama) ||
      s.tffGruplari?.anaGrup?.toLowerCase().includes(arama);
    const bransUygun = !advancedFilters.brans || s.sporBilgileri?.brans === advancedFilters.brans;
    const yasGrubuUygun =
      !advancedFilters.yasGrubu || s.tffGruplari?.anaGrup === advancedFilters.yasGrubu;
    return aktif && idVar && aramaUygun && bransUygun && yasGrubuUygun;
  });

  // Hızlı filtreleme uygula (listeyiGuncelle'deki mantık)
  if (aktifFiltre !== 'all') {
    const bugun = new Date();
    const bugunGunu = bugun.getDate();

    filtrelenmis = filtrelenmis.filter(s => {
      const burslu = s.odemeBilgileri?.burslu || false;
      if (burslu) return false;

      const aylikUcret = s.odemeBilgileri?.aylikUcret || 0;
      if (aylikUcret === 0) return false;

      const kayitTarihi = sporcuKayitTarihiGetir(s);
      if (kayitTarihi) {
        const { kayitAy, kayitYil } = kayitTarihiBilgileriAl(kayitTarihi);
        const donemAyFarki = donemAyFarkiHesapla(buAy, buYil, kayitAy, kayitYil);
        if (donemAyFarki < 0) return false;
      }

      const tabDonem = aidatDonemTabloHesap(s, aidatlar, buAy, buYil);
      if (!tabDonem) return false;

      let odemeGunu: number | null = null;
      if (s.odemeBilgileri?.odemeGunu) {
        odemeGunu = s.odemeBilgileri.odemeGunu;
      } else if (s.kayitTarihi) {
        const kt = new Date(s.kayitTarihi);
        if (!isNaN(kt.getTime())) odemeGunu = kt.getDate();
      }
      if (aktifFiltre === 'upcoming' && odemeGunu === null) return false;

      if (aktifFiltre === 'paid') {
        return aidatTabloOdendiMi(tabDonem.beklenenBorc, tabDonem.toplamTahsilatBuSporcu);
      }
      if (aktifFiltre === 'debt') {
        return tabDonem.borc > 0;
      }
      if (aktifFiltre === 'upcoming') {
        if (tabDonem.borc <= 0) return false;
        if (odemeGunu === null) return false;
        const bugunAy = bugun.getMonth();
        const bugunYil = bugun.getFullYear();
        const buAySonGunu = new Date(bugunYil, bugunAy + 1, 0).getDate();
        if (odemeGunu >= bugunGunu && odemeGunu <= buAySonGunu) {
          const gunFarki = odemeGunu - bugunGunu;
          return gunFarki >= 0 && gunFarki <= 5;
        }
        if (odemeGunu < bugunGunu) {
          const buAyKalanGun = buAySonGunu - bugunGunu;
          const toplamGun = buAyKalanGun + odemeGunu;
          return toplamGun <= 5;
        }
        return false;
      }
      return true;
    });
  }

  // Borç bilgilerini hesapla
  const gecerliSporcular = filtrelenmis.filter(
    (s): s is Sporcu & { id: number } => s != null && s.id != null && typeof s.id === 'number'
  );

  const sporcularBorcBilgileri = gecerliSporcular.map(s => {
    const burslu = s.odemeBilgileri?.burslu || false;
    const aylikUcret = s.odemeBilgileri?.aylikUcret || 0;
    const h = aidatDonemTabloHesap(s, aidatlar, buAy, buYil);
    const toplamBorc = h?.toplamBorc ?? 0;
    const beklenenBorc = h?.beklenenBorc ?? 0;
    const toplamTahsilatBuSporcu = h?.toplamTahsilatBuSporcu ?? 0;
    const borc = burslu ? 0 : (h?.borc ?? 0);

    return {
      sporcu: s,
      burslu,
      aylikUcret,
      toplamBorc,
      beklenenBorc,
      toplamTahsilatBuSporcu,
      borc,
    };
  });

  // Sıralama uygula (listeyiGuncelle'deki mantık)
  if (sortState.column) {
    sporcularBorcBilgileri.sort((a, b) => {
      let compareValue = 0;
      switch (sortState.column) {
        case 'ad':
          compareValue = (a.sporcu.temelBilgiler?.adSoyad || '').localeCompare(
            b.sporcu.temelBilgiler?.adSoyad || '',
            'tr',
            { sensitivity: 'base' }
          );
          break;
        case 'borc':
          compareValue = a.borc - b.borc;
          break;
        case 'ucret':
          compareValue = a.aylikUcret - b.aylikUcret;
          break;
        default:
          compareValue = 0;
      }
      return sortState.direction === 'asc' ? compareValue : -compareValue;
    });
  }

  // Kartları render et — sporcu listesi modülü ile aynı kart yapısı (sporcu-item)
  cardsGrid.innerHTML = sporcularBorcBilgileri
    .map(({ sporcu: s, burslu, aylikUcret, toplamBorc, beklenenBorc, toplamTahsilatBuSporcu, borc }) => {
      const sporcuId = s.id!;
      const adSoyad = Helpers.escapeHtml(s.temelBilgiler?.adSoyad || '-');
      const brans = Helpers.escapeHtml(s.sporBilgileri?.brans || '-');
      const yasGrubu = Helpers.escapeHtml(s.tffGruplari?.anaGrup || '-');
      const agRaw = sporcuAntrenmanEtiketiAdi(s);
      const antrenmanEtiket = agRaw ? Helpers.escapeHtml(agRaw) : 'Antrenman yok';

      let durumText = '';
      let devamClass = '';
      let borderClass: 'aktif' | 'pasif' | 'aidat-partial' = 'aktif';

      if (burslu) {
        durumText = 'BURSLU';
        devamClass = 'devam-var';
        borderClass = 'aktif';
      } else if (borc <= 0 && beklenenBorc > 0) {
        durumText = 'ÖDENDİ';
        devamClass = 'devam-var';
        borderClass = 'aktif';
      } else if (toplamTahsilatBuSporcu > 0 && borc > 0) {
        durumText = 'KISMI';
        devamClass = 'aidat-durum-kismi';
        borderClass = 'aidat-partial';
      } else {
        durumText = 'BORÇLU';
        devamClass = 'devam-yok';
        borderClass = 'pasif';
      }

      const debtPulse = !burslu && borc > 0 ? ' sporcu-item-debt-pulse' : '';
      const itemClass = `sporcu-item ${borderClass}${debtPulse}`.trim();

      const finansOzeti = burslu
        ? 'Burslu · Borç yok'
        : `${Helpers.paraFormat(aylikUcret)} TL · ${borc > 0 ? 'Kalan ' + Helpers.paraFormat(borc) + ' TL' : 'Borç yok'}`;

      return `
      <div class="${itemClass}" data-sporcu-id="${sporcuId}">
        <div class="sporcu-info">
          <strong class="sporcu-adi">${adSoyad}</strong>
          <span class="grup-badge" title="TFF yaş grubu · Branş · Kulüp antrenman grubu">${yasGrubu} · ${brans} · ${antrenmanEtiket}</span>
          <span class="aidat-kart-finans">${finansOzeti}</span>
          <span class="devam-durum ${devamClass}">${durumText}</span>
        </div>
        <div class="sporcu-buttons">
          ${
            !burslu && sporcuId
              ? `
            <button type="button" class="btn btn-small btn-icon btn-success odeme-al-btn" data-sporcu-id="${sporcuId}" title="Ödeme Al">
              <i class="fa-solid fa-credit-card"></i>
            </button>
            ${
              borc > 0
                ? `
              <button type="button" class="btn btn-small btn-icon btn-warning sms-gonder-btn" data-sporcu-id="${sporcuId}" title="SMS Gönder">
                <i class="fa-solid fa-sms"></i>
              </button>
            `
                : ''
            }
          `
              : ''
          }
          ${
            sporcuId
              ? `
            <button type="button" class="btn btn-small btn-icon btn-info gecmis-btn" data-sporcu-id="${sporcuId}" title="Geçmiş">
              <i class="fa-solid fa-history"></i>
            </button>
          `
              : ''
          }
        </div>
      </div>
    `;
    })
    .join('');
}

/**
 * Modülden çıkıldığında: takvimi bugüne yaklaştır, varsayılan hızlı filtreyi Ödemeyenler yap.
 * (Her view değişiminde çağrılmamalı — appViewNavigation yalnızca aidat → başka view.)
 */
export function filtreSifirla(): void {
  aktifFiltre = 'debt';
  aidatHizliFiltreButonlariniAyarla('debt');

  // Takvim ayı/yılını mevcut ay/yıla sıfırla
  const now = new Date();
  calendarState.currentMonth = now.getMonth();
  calendarState.currentYear = now.getFullYear();

  // DOM'daki select elementlerini güncelle
  const monthSelect = Helpers.$('#calendarMonth') as HTMLSelectElement | null;
  const yearSelect = Helpers.$('#calendarYear') as HTMLSelectElement | null;

  if (monthSelect) {
    monthSelect.value = calendarState.currentMonth.toString();
  }

  if (yearSelect) {
    yearSelect.value = calendarState.currentYear.toString();
  }

  // Takvimi güncelle (mevcut ay/yıl ile)
  takvimiOlustur();
}

// ========== PUBLIC API EXPORT ==========

// Global erişim için (backward compatibility)
// app.ts'deki exposeModulesToWindow() fonksiyonunda expose ediliyor
// Burada expose etmiyoruz, çünkü app.ts'de daha kontrollü bir şekilde expose ediliyor
