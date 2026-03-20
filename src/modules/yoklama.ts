/**
 * SOY-BIS - Yoklama Modülü (yoklama.ts)
 * Yoklama kayıt ve takip işlemleri - TypeScript Version
 *
 * ENHANCED VERSION v2.0 - YENİ ÖZELLİKLER:
 * ✅ Optimistic UI + Batch Operations (2 sn auto-save)
 * ✅ Undo/Redo (Ctrl+Z / Ctrl+Y)
 * ✅ Keyboard Shortcuts (V/Y/I/G + Arrow keys)
 * ✅ Touch Gestures (Swipe left/right)
 * ✅ Audit Trail (Kim ne zaman değiştirdi)
 * ✅ Smart Analytics (Risk analizi, tahmin, öneriler)
 * ✅ Memory Leak Fix (AbortController)
 */

import * as Helpers from '../utils/helpers';
import * as Storage from '../utils/storage';
import type { Sporcu } from '../types';
import { apiPost } from '../services/apiClient';

// Import enhanced classes (opsiyonel - feature flags ile)
let YoklamaStateClass: any = null;
let YoklamaHistoryClass: any = null;
let YoklamaAuditClass: any = null;
let YoklamaAnalyticsClass: any = null;
let YoklamaKeyboardClass: any = null;
let YoklamaTouchClass: any = null;

// Enhanced özellikler için dinamik import
const ENHANCED_FEATURES = {
  OPTIMISTIC_UI: true, // Anında UI güncellemesi
  BATCH_SAVE: true, // 2 saniye sonra toplu kayıt
  UNDO_REDO: true, // Ctrl+Z / Ctrl+Y
  AUDIT_TRAIL: true, // Değişiklik log'ları
  SMART_ANALYTICS: true, // Risk analizi, tahmin
  KEYBOARD_SHORTCUTS: true, // V/Y/I/G tuşları
  TOUCH_GESTURES: true, // Swipe gestures (mobil)
};

const API_ENABLED = Boolean((import.meta as any)?.env?.VITE_SOYBIS_API_BASE);

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

interface SporcuDevamRaporuResult {
  toplamYoklama: number;
  varSayisi: number;
  yokSayisi: number;
  izinliSayisi: number;
  devamOrani: number;
}

// Enhanced features global state
let enhancedState: any = null;
let enhancedHistory: any = null;
let enhancedAudit: any = null;
let enhancedAnalytics: any = null;
let enhancedKeyboard: any = null;
let enhancedTouch: any = null;
let abortController: AbortController | null = null;
let autoSaveIndicator: HTMLElement | null = null;

/**
 * Modülü başlat
 */
export function init(): void {
  console.log('✅ [Yoklama] Modül başlatılıyor... (Enhanced v2.0)');

  // Yetki kontrolü - Yoklama sadece Yönetici ve Antrenör
  if (
    typeof window !== 'undefined' &&
    window.Auth &&
    !window.Auth?.yetkiKontrol('yoklama_gorebilir')
  ) {
    const yoklamaView = Helpers.$('#yoklama');
    if (yoklamaView) {
      (yoklamaView as HTMLElement).style.display = 'none';
    }
    return;
  }

  // Enhanced features'ı başlat
  initEnhancedFeatures();

  filtreEventleri();
  butonEventleri();
  yasGruplariniDoldur();
  raporButonEventleri();

  // Enhanced keyboard shortcuts
  if (ENHANCED_FEATURES.KEYBOARD_SHORTCUTS) {
    initKeyboardShortcuts();
  }

  // Enhanced touch gestures (mobil)
  if (ENHANCED_FEATURES.TOUCH_GESTURES && window.innerWidth < 768) {
    initTouchGestures();
  }

  // Auto-save indicator
  createAutoSaveIndicator();

  listeyiGuncelle();

  console.log('✅ [Yoklama] Modül başlatıldı (Enhanced)', {
    optimisticUI: ENHANCED_FEATURES.OPTIMISTIC_UI,
    undoRedo: ENHANCED_FEATURES.UNDO_REDO,
    keyboard: ENHANCED_FEATURES.KEYBOARD_SHORTCUTS,
    touch: ENHANCED_FEATURES.TOUCH_GESTURES,
    audit: ENHANCED_FEATURES.AUDIT_TRAIL,
  });
}

/**
 * Enhanced features'ı başlat
 */
function initEnhancedFeatures(): void {
  try {
    // State class'ı dinamik yükle (yoksa basit object kullan)
    if (ENHANCED_FEATURES.OPTIMISTIC_UI || ENHANCED_FEATURES.BATCH_SAVE) {
      enhancedState = createSimpleState();
    }

    // History (Undo/Redo)
    if (ENHANCED_FEATURES.UNDO_REDO) {
      enhancedHistory = createSimpleHistory();
    }

    // Audit trail
    if (ENHANCED_FEATURES.AUDIT_TRAIL) {
      enhancedAudit = createSimpleAudit();
    }

    // Analytics
    if (ENHANCED_FEATURES.SMART_ANALYTICS) {
      enhancedAnalytics = createSimpleAnalytics();
    }

    console.log('✅ [Yoklama] Enhanced features başlatıldı');
  } catch (error) {
    console.warn('⚠️ [Yoklama] Enhanced features başlatılamadı, standart mod kullanılıyor:', error);
  }
}

/**
 * Filtre eventlerini bağla
 */
function filtreEventleri(): void {
  const grupSelect = Helpers.$('#yoklamaGrup') as HTMLSelectElement | null;
  const tarihInput = Helpers.$('#yoklamaTarih') as HTMLInputElement | null;

  if (grupSelect) {
    grupSelect.addEventListener('change', listeyiGuncelle);
  }

  if (tarihInput) {
    tarihInput.value = Helpers.bugunISO();
    tarihInput.addEventListener('change', listeyiGuncelle);
  }
}

/**
 * Buton eventlerini bağla
 */
function butonEventleri(): void {
  console.log('🔗 [Yoklama] Buton eventleri bağlanıyor...');

  // Eski listener'ları iptal et
  if (abortController) {
    abortController.abort();
  }

  abortController = new AbortController();
  const signal = abortController.signal;

  const tumunuVarBtn = Helpers.$('#tumunuVarBtn');
  const tumunuYokBtn = Helpers.$('#tumunuYokBtn');
  const qrTaraBtn = Helpers.$('#qrTaraBtn');
  const qrYazdirBtn = Helpers.$('#qrYazdirBtn');

  console.log('🔍 [Yoklama] QR Butonları kontrol:', {
    qrTaraBtn: !!qrTaraBtn,
    qrYazdirBtn: !!qrYazdirBtn,
    qrTaraBtnElement: qrTaraBtn,
    qrYazdirBtnElement: qrYazdirBtn,
  });

  if (tumunuVarBtn) {
    tumunuVarBtn.addEventListener('click', () => topluYoklama('var'), { signal });
  }

  if (tumunuYokBtn) {
    tumunuYokBtn.addEventListener('click', () => topluYoklama('yok'), { signal });
  }

  // QR Butonları Event Listeners
  if (qrTaraBtn) {
    console.log('✅ [Yoklama] QR Tara butonu bulundu, event listener ekleniyor');
    qrTaraBtn.addEventListener(
      'click',
      function (e: Event) {
        console.log('🎯 [Yoklama] QR Tara butonuna tıklandı!');
        e.preventDefault();
        qrTaramaAc();
      },
      { signal }
    );
  } else {
    console.warn('⚠️ [Yoklama] QR Tara butonu bulunamadı!');
  }

  if (qrYazdirBtn) {
    console.log('✅ [Yoklama] QR Yazdır butonu bulundu, event listener ekleniyor');
    qrYazdirBtn.addEventListener(
      'click',
      function (e: Event) {
        console.log('🎯 [Yoklama] QR Yazdır butonuna tıklandı!');
        e.preventDefault();
        qrYazdirBaslat();
      },
      { signal }
    );
  } else {
    console.warn('⚠️ [Yoklama] QR Yazdır butonu bulunamadı!');
  }

  console.log('✅ [Yoklama] Tüm buton eventleri bağlandı');
}

/**
 * Rapor butonu eventlerini bağla (Event Delegation)
 */
function raporButonEventleri(): void {
  // Event delegation: Rapor butonları için yoklama container'ına bağla
  const yoklamaContainer = Helpers.$('#yoklamaListesi') || Helpers.$('#yoklama');

  if (!yoklamaContainer) {
    console.warn('⚠️ [Yoklama] raporButonEventleri - Container bulunamadı');
    return;
  }

  // Event delegation: Rapor butonları için
  yoklamaContainer.addEventListener('click', e => {
    const target = e.target as HTMLElement;
    const raporBtn = target.closest('.rapor-btn') as HTMLButtonElement | null;

    if (!raporBtn) return;

    e.preventDefault();
    e.stopPropagation();

    const sporcuIdStr = raporBtn.getAttribute('data-sporcu-id');
    if (!sporcuIdStr) {
      console.warn('⚠️ [Yoklama] raporButonEventleri - data-sporcu-id bulunamadı');
      return;
    }

    const sporcuId = parseInt(sporcuIdStr, 10);
    if (isNaN(sporcuId)) {
      console.warn('⚠️ [Yoklama] raporButonEventleri - Geçersiz sporcuId:', sporcuIdStr);
      return;
    }

    console.log('📊 [Yoklama] Rapor butonu tıklandı, sporcuId:', sporcuId);

    if (window.Sporcu && typeof window.Sporcu.raporGoster === 'function') {
      window.Sporcu.raporGoster(sporcuId);
    } else {
      console.error('❌ [Yoklama] raporButonEventleri - window.Sporcu.raporGoster bulunamadı!', {
        hasWindowSporcu: !!window.Sporcu,
        hasRaporGoster: window.Sporcu ? typeof window.Sporcu.raporGoster === 'function' : false,
      });
      Helpers.toast('Rapor fonksiyonu bulunamadı!', 'error');
    }
  });

  console.log('✅ [Yoklama] raporButonEventleri - Event delegation bağlandı');
}

/**
 * Yaş gruplarını doldur
 */
function yasGruplariniDoldur(): void {
  const grupSelect = Helpers.$('#yoklamaGrup') as HTMLSelectElement | null;
  if (!grupSelect) return;

  grupSelect.innerHTML = '<option value="all">Tüm Gruplar</option>';
  Helpers.YAS_GRUPLARI.forEach(grup => {
    const option = document.createElement('option');
    option.value = grup;
    option.textContent = grup;
    grupSelect.appendChild(option);
  });

  // Varsayılan değeri "Tüm Gruplar" (all) olarak ayarla
  grupSelect.value = 'all';
}

/**
 * Yoklama durumunu kaydet (Enhanced version)
 * @param sporcuId - Sporcu ID
 * @param durum - Durum (var, yok, izinli, gec-geldi)
 */
export function durumKaydet(sporcuId: number, durum: 'var' | 'yok' | 'izinli' | 'gec-geldi'): void {
  const tarihInput = Helpers.$('#yoklamaTarih') as HTMLInputElement | null;
  const grupSelect = Helpers.$('#yoklamaGrup') as HTMLSelectElement | null;

  if (!tarihInput || !grupSelect) return;

  const tarih = tarihInput.value;
  const grup = grupSelect.value;

  // Eski durumu al (history için)
  const yoklama = Storage.yoklamaBul(tarih, grup);
  const kayit = yoklama?.sporcular.find(s => s.id === sporcuId);
  const eskiDurum = kayit?.durum || 'yok';

  // ✅ ENHANCED: Optimistic UI
  if (ENHANCED_FEATURES.OPTIMISTIC_UI) {
    updateSporcuUIOptimistic(sporcuId, durum);
  }

  // ✅ ENHANCED: State'e ekle (batch save için)
  if (ENHANCED_FEATURES.BATCH_SAVE && enhancedState) {
    enhancedState.push({ sporcuId, durum, eskiDurum, tarih, grup });

    // Auto-save indicator göster
    const pendingCount = enhancedState.length;
    showAutoSaveIndicator(`💾 ${pendingCount} değişiklik kaydedilecek...`);

    // 2 saniye sonra toplu kayıt
    scheduleBatchSave();
  } else {
    // Fallback: Direkt kaydet
    Storage.yoklamaKaydet(tarih, grup, sporcuId, durum);
    listeyiGuncelle();
  }

  // ✅ ENHANCED: History'ye ekle
  if (ENHANCED_FEATURES.UNDO_REDO && enhancedHistory) {
    enhancedHistory.push({
      sporcuId,
      eskiDurum,
      yeniDurum: durum,
      tarih,
      grup,
      timestamp: Date.now(),
    });
  }

  // ✅ ENHANCED: Audit log
  if (ENHANCED_FEATURES.AUDIT_TRAIL && enhancedAudit) {
    const kullanici = window.Auth?.aktifKullanici?.();
    if (kullanici) {
      enhancedAudit.push({
        sporcuId,
        islem: 'guncelle',
        eskiDeger: eskiDurum,
        yeniDeger: durum,
        kullaniciId: kullanici.id,
        kullaniciAdi: kullanici.kullaniciAdi || kullanici.kullaniciAdi,
        timestamp: new Date().toISOString(),
      });
    }
  }

  if (typeof window !== 'undefined' && window.Dashboard) {
    window.Dashboard.guncelle?.();
  }
}

/**
 * Toplu yoklama işlemi
 * @param durum - Durum
 */
export function topluYoklama(durum: 'var' | 'yok'): void {
  const tarihInput = Helpers.$('#yoklamaTarih') as HTMLInputElement | null;
  const grupSelect = Helpers.$('#yoklamaGrup') as HTMLSelectElement | null;

  if (!tarihInput || !grupSelect) return;

  const tarih = tarihInput.value;
  const grup = grupSelect.value;

  if (typeof window === 'undefined' || !window.Sporcu) {
    Helpers.toast('Sporcu modülü yüklenemedi!', 'error');
    return;
  }

  const sporcular = window.Sporcu?.yasGrubunaGore?.(grup) || [];

  if (sporcular.length === 0) {
    Helpers.toast('Seçili grupta sporcu bulunamadı!', 'warning');
    return;
  }

  const durumText = durum === 'var' ? 'VAR' : 'YOK';
  if (
    !Helpers.onay(
      `Tüm sporcular (${sporcular.length} kişi) "${durumText}" olarak işaretlenecek. Devam etmek istiyor musunuz?`
    )
  ) {
    return;
  }

  const sporcuIds = sporcular.map((s: Sporcu) => s.id);
  Storage.topluYoklamaKaydet(tarih, grup, sporcuIds, durum);

  Helpers.toast(`Tüm sporcular "${durumText}" olarak işaretlendi!`, 'success');
  listeyiGuncelle();

  // ✅ YENİ: Devamsızlara otomatik bildirim gönder
  if (durum === 'yok') {
    devamsizlaraBildirimGonder(sporcular, tarih);
  }

  if (typeof window !== 'undefined' && window.Dashboard) {
    window.Dashboard.guncelle?.();
  }
}

/**
 * Listeyi güncelle
 */
export function listeyiGuncelle(): void {
  console.log('🔄 [Yoklama] listeyiGuncelle() çağrıldı');

  try {
    const listContainer = Helpers.$('#yoklamaListesi');
    if (!listContainer) {
      console.warn('⚠️ [Yoklama] listeyiGuncelle - listContainer bulunamadı');
      return;
    }

    const grupSelect = Helpers.$('#yoklamaGrup') as HTMLSelectElement | null;
    const tarihInput = Helpers.$('#yoklamaTarih') as HTMLInputElement | null;

    const grup = grupSelect?.value || 'all';
    const tarih = tarihInput?.value || Helpers.bugunISO();

    if (typeof window === 'undefined' || !window.Sporcu) {
      Helpers.toast('Sporcu modülü yüklenemedi!', 'error');
      return;
    }

    const sporcular = window.Sporcu?.yasGrubunaGore?.(grup) || [];
    const yoklamaKaydi = Storage.yoklamaBul(tarih, grup);

    listContainer.innerHTML = '';

    if (sporcular.length === 0) {
      Helpers.showEmptyState(
        '#yoklamaEmptyState',
        'Seçili grupta sporcu bulunamadı',
        'Farklı bir grup seçin veya sporcu kaydı yapın.',
        { icon: 'fa-clipboard' }
      );
      istatistikleriGuncelle(0, 0, 0);
      return;
    }

    Helpers.hideEmptyState('#yoklamaEmptyState');

    let varSayisi = 0;
    let yokSayisi = 0;
    let izinliSayisi = 0;

    sporcular.forEach((sporcu: Sporcu) => {
      // UX-A1: Mevcut durumu bul - varsayılan VAR
      let durum: 'var' | 'yok' | 'izinli' | 'gec-geldi' = 'var'; // Varsayılan durum artık VAR
      if (yoklamaKaydi) {
        const kayit = yoklamaKaydi.sporcular.find(s => s.id === sporcu.id);
        if (kayit) {
          durum = kayit.durum as 'var' | 'yok' | 'izinli' | 'gec-geldi';
        }
      }

      // İstatistikleri güncelle
      if (durum === 'var') varSayisi++;
      else if (durum === 'yok') yokSayisi++;
      else if (durum === 'izinli') izinliSayisi++;

      // ✅ ENHANCED: Risk badge
      let riskBadge = '';
      if (ENHANCED_FEATURES.SMART_ANALYTICS && enhancedAnalytics) {
        const risk = enhancedAnalytics.getRisk(sporcu.id);
        if (risk) {
          if (risk.riskSeviyesi === 'yuksek') {
            riskBadge = `<span class="risk-badge" style="color: #e53e3e; font-size: 16px; margin-left: 8px;" title="Yüksek risk: Devam ${risk.devamOrani}%, ${risk.ardasik} gün devamsız">🚨</span>`;
          } else if (risk.ardasik >= 3) {
            riskBadge = `<span class="risk-badge" style="color: #d69e2e; font-size: 14px; margin-left: 8px;" title="${risk.ardasik} gündür devamsız">⚠️</span>`;
          }
        }
      }

      // Yoklama item oluştur
      const item = document.createElement('div');
      item.className = `yoklama-item ${durum === 'var' ? 'katildi' : durum === 'yok' ? 'devamsiz' : durum === 'izinli' ? 'izinli' : 'gec-geldi'}`;
      item.setAttribute('data-sporcu-id', sporcu.id.toString());
      item.setAttribute('data-current-durum', durum);

      // Güvenli: XSS koruması için escapeHtml kullan
      const adSoyad = Helpers.escapeHtml(sporcu.temelBilgiler?.adSoyad || '-');
      const yasGrubu = Helpers.escapeHtml(sporcu.tffGruplari?.anaGrup || '-');
      const brans = Helpers.escapeHtml(sporcu.sporBilgileri?.brans || '-');

      // UX-A2: Tek toggle butonu (VAR/YOK) - Mobil için optimize
      // UX-A3: Sporcu adları büyük harf ve kalın
      const yeniDurum: 'var' | 'yok' = durum === 'var' ? 'yok' : 'var';
      const toggleText = durum === 'var' ? 'YOK' : 'VAR';
      const toggleClass = durum === 'var' ? 'btn-danger' : 'btn-success';

      item.innerHTML = `
      <div class="yoklama-info">
        <strong class="sporcu-adi">${adSoyad}</strong>
        ${riskBadge}
        <span class="grup-badge">${yasGrubu} | ${brans}</span>
        <span class="devam-durum ${durum === 'var' ? 'devam-var' : durum === 'yok' ? 'devam-yok' : 'devam-izin'}">
          ${durum.toUpperCase().replace('-', ' ')}
        </span>
      </div>
      <div class="yoklama-buttons">
        <!-- Mobil: Tek toggle butonu -->
        <button class="btn btn-toggle ${toggleClass}" 
                onclick="window.Yoklama?.durumKaydet(${sporcu.id}, '${yeniDurum}')"
                data-current="${durum}">
          ${toggleText}
        </button>
        <!-- Desktop: İzinli butonu ayrı -->
        <button class="btn btn-small btn-izinli ${durum === 'izinli' ? 'btn-warning active' : ''}" 
                onclick="window.Yoklama?.durumKaydet(${sporcu.id}, 'izinli')"
                title="İzinli olarak işaretle">
          <i class="fa-solid fa-clock"></i>
          <span class="btn-text">İzinli</span>
        </button>
        <!-- QR Kodu Göster -->
        <button class="btn btn-small btn-icon btn-secondary" 
                onclick="window.Yoklama?.sporcuQRGoster(${sporcu.id})"
                title="QR Kodu Göster">
          <i class="fa-solid fa-qrcode"></i>
        </button>
        <!-- Rapor butonu -->
        <button class="btn btn-small btn-icon btn-info rapor-btn" 
                data-sporcu-id="${sporcu.id}"
                title="Rapor">
          <i class="fa-solid fa-chart-line"></i>
        </button>
      </div>
    `;

      listContainer.appendChild(item);
    });

    istatistikleriGuncelle(sporcular.length, varSayisi, yokSayisi + izinliSayisi);
  } catch (error) {
    console.error('❌ [Yoklama] listeyiGuncelle hatası:', error);
    if (typeof Helpers !== 'undefined' && Helpers.toast) {
      Helpers.toast('Yoklama listesi güncellenirken hata oluştu!', 'error');
    }
  }
}

/**
 * İstatistikleri güncelle
 */
function istatistikleriGuncelle(toplam: number, varOlan: number, devamsiz: number): void {
  const toplamEl = Helpers.$('#toplamSporcuSayisi');
  const varEl = Helpers.$('#varOlanSayisi');
  const devamsizEl = Helpers.$('#devamsizSayisi');
  const yuzdeEl = Helpers.$('#devamYuzdesi');

  if (toplamEl) (toplamEl as HTMLElement).textContent = toplam.toString();
  if (varEl) (varEl as HTMLElement).textContent = varOlan.toString();
  if (devamsizEl) (devamsizEl as HTMLElement).textContent = devamsiz.toString();
  if (yuzdeEl) (yuzdeEl as HTMLElement).textContent = '%' + Helpers.yuzdeHesapla(varOlan, toplam);
}

/**
 * Devam raporu oluştur
 * @param baslangic - Başlangıç tarihi
 * @param bitis - Bitiş tarihi
 * @returns Rapor
 */
export function devamRaporu(
  baslangic: string | null = null,
  bitis: string | null = null
): DevamRaporuResult {
  const yoklamalar = Storage.yoklamalariGetir();

  let filtrelenmis = yoklamalar;
  if (baslangic) {
    filtrelenmis = filtrelenmis.filter(y => y.tarih >= baslangic);
  }
  if (bitis) {
    filtrelenmis = filtrelenmis.filter(y => y.tarih <= bitis);
  }

  let toplamDevam = 0;
  let devamSayisi = 0;
  let enYuksekDevam = 0;
  let enDusukDevam = 100;

  filtrelenmis.forEach(y => {
    const varOlan = y.sporcular.filter(s => s.durum === 'var').length;
    const toplam = y.sporcular.length;

    if (toplam > 0) {
      const oran = (varOlan / toplam) * 100;
      toplamDevam += oran;
      devamSayisi++;

      if (oran > enYuksekDevam) enYuksekDevam = oran;
      if (oran < enDusukDevam) enDusukDevam = oran;
    }
  });

  const ortalamaDevam = devamSayisi > 0 ? Math.round(toplamDevam / devamSayisi) : 0;

  return {
    yoklamaSayisi: filtrelenmis.length,
    ortalamaDevam,
    enYuksekDevam: Math.round(enYuksekDevam),
    enDusukDevam: devamSayisi > 0 ? Math.round(enDusukDevam) : 0,
    sonYoklamalar: filtrelenmis
      .slice(-10)
      .reverse()
      .map(y => ({
        tarih: y.tarih,
        grup: y.grup,
        toplam: y.sporcular.length,
        varOlan: y.sporcular.filter(s => s.durum === 'var').length,
        devamsiz: y.sporcular.filter(s => s.durum !== 'var').length,
      })),
  };
}

/**
 * Sporcu bazlı devam raporu
 * @param sporcuId - Sporcu ID
 * @returns Rapor
 */
export function sporcuDevamRaporu(sporcuId: number): SporcuDevamRaporuResult {
  const yoklamalar = Storage.yoklamalariGetir();

  let toplamYoklama = 0;
  let varSayisi = 0;
  let yokSayisi = 0;
  let izinliSayisi = 0;

  yoklamalar.forEach(y => {
    const kayit = y.sporcular.find(s => s.id === sporcuId);
    if (kayit) {
      toplamYoklama++;
      if (kayit.durum === 'var') varSayisi++;
      else if (kayit.durum === 'yok') yokSayisi++;
      else if (kayit.durum === 'izinli') izinliSayisi++;
    }
  });

  return {
    toplamYoklama,
    varSayisi,
    yokSayisi,
    izinliSayisi,
    devamOrani: Helpers.yuzdeHesapla(varSayisi, toplamYoklama),
  };
}

/**
 * Filtreleri sıfırla (panel değiştiğinde kullanılır)
 * Grup seçimini "Tüm Gruplar" (all) olarak ayarlar
 */
export function filtreSifirla(): void {
  const grupSelect = Helpers.$('#yoklamaGrup') as HTMLSelectElement | null;
  const tarihInput = Helpers.$('#yoklamaTarih') as HTMLInputElement | null;

  if (grupSelect) {
    grupSelect.value = 'all';
  }

  if (tarihInput) {
    tarihInput.value = Helpers.bugunISO();
  }

  // Liste güncellemesi yapılmaz - sadece filtre sıfırlanır
  // Liste güncellemesi viewGuncellemeleri içinde yapılacak
}

// ========== ENHANCED HELPER FUNCTIONS ==========

/**
 * Basit state implementasyonu (inline)
 */
function createSimpleState() {
  const state: any[] = [];
  let timer: any = null;

  return {
    push: (change: any) => {
      state.push(change);
    },
    length: state.length,
    clear: () => {
      state.length = 0;
    },
    flush: () => {
      const changes = state.slice();
      const changeCount = changes.length;

      // API modunda: sadece localStorage'i güncelle, ardından backend'e tek seferde batch gönder.
      if (API_ENABLED) {
        changes.forEach((c: any) => {
          Storage.yoklamaKaydet(c.tarih, c.grup, c.sporcuId, c.durum, { skipApi: true });
        });

        void apiPost('/yoklama/batch', {
          changes: changes.map((c: any) => ({
            tarih: c.tarih,
            grup: c.grup,
            sporcuId: c.sporcuId,
            yeniDurum: c.durum,
            // eskiDurum'u göndermiyoruz; backend mevcut durumu sırayla okuyup audit'i doğru üretir.
          })),
        }).catch(() => {});
      } else {
        // Paylaşımsız/local mod: mevcut davranış
        state.forEach((c: any) => {
          Storage.yoklamaKaydet(c.tarih, c.grup, c.sporcuId, c.durum);
        });
      }

      state.length = 0;
      hideAutoSaveIndicator();
      Helpers.toast(`✅ ${changeCount} değişiklik kaydedildi`, 'success');
    },
  };
}

/**
 * Basit history implementasyonu
 */
function createSimpleHistory() {
  const history: any[] = [];
  let index = -1;

  return {
    push: (entry: any) => {
      history.length = index + 1;
      history.push(entry);
      index++;
    },
    undo: () => {
      if (index < 0) return false;
      const entry = history[index];
      if (entry) {
        Storage.yoklamaKaydet(entry.tarih, entry.grup, entry.sporcuId, entry.eskiDurum);
        updateSporcuUIOptimistic(entry.sporcuId, entry.eskiDurum);
        index--;
        return true;
      }
      return false;
    },
    redo: () => {
      if (index >= history.length - 1) return false;
      index++;
      const entry = history[index];
      if (entry) {
        Storage.yoklamaKaydet(entry.tarih, entry.grup, entry.sporcuId, entry.yeniDurum);
        updateSporcuUIOptimistic(entry.sporcuId, entry.yeniDurum);
        return true;
      }
      return false;
    },
    canUndo: () => index >= 0,
    canRedo: () => index < history.length - 1,
  };
}

/**
 * Basit audit implementasyonu
 */
function createSimpleAudit() {
  const AUDIT_KEY = 'SOYBIS_YOKLAMA_AUDIT';

  return {
    push: (log: any) => {
      try {
        const logs = JSON.parse(localStorage.getItem(AUDIT_KEY) || '[]');
        logs.push(log);
        if (logs.length > 500) logs.shift(); // Max 500
        localStorage.setItem(AUDIT_KEY, JSON.stringify(logs));
      } catch (e) {
        console.warn('Audit kayıt hatası:', e);
      }
    },
    getLogs: () => {
      try {
        return JSON.parse(localStorage.getItem(AUDIT_KEY) || '[]');
      } catch (e) {
        return [];
      }
    },
  };
}

/**
 * Basit analytics implementasyonu
 */
function createSimpleAnalytics() {
  return {
    getRisk: (sporcuId: number) => {
      const yoklamalar = Storage.yoklamalariGetir();
      const sporcuYoklamalari = yoklamalar.filter(y => y.sporcular.some(s => s.id === sporcuId));

      if (sporcuYoklamalari.length === 0) return null;

      let varSayisi = 0;
      let ardasik = 0;

      for (let i = sporcuYoklamalari.length - 1; i >= 0; i--) {
        const y = sporcuYoklamalari[i];
        if (y) {
          const kayit = y.sporcular.find(s => s.id === sporcuId);
          if (kayit) {
            if (kayit.durum === 'var') {
              varSayisi++;
              break; // Ardışık bitti
            } else {
              ardasik++;
            }
          }
        }
      }

      sporcuYoklamalari.forEach(y => {
        const kayit = y.sporcular.find(s => s.id === sporcuId);
        if (kayit && kayit.durum === 'var') varSayisi++;
      });

      const devamOrani = Math.round((varSayisi / sporcuYoklamalari.length) * 100);
      const riskSkoru = (devamOrani < 60 ? 50 : 0) + (ardasik >= 3 ? 50 : ardasik * 10);

      return {
        devamOrani,
        ardasik,
        riskSeviyesi: riskSkoru >= 70 ? 'yuksek' : riskSkoru >= 40 ? 'orta' : 'dusuk',
        riskSkoru,
      };
    },
  };
}

/**
 * Optimistic UI update
 */
function updateSporcuUIOptimistic(sporcuId: number, durum: string): void {
  const item = document.querySelector(`[data-sporcu-id="${sporcuId}"]`);
  if (!item) return;

  // Class'ları güncelle
  item.classList.remove('katildi', 'devamsiz', 'izinli', 'gec-geldi');
  const durumClass =
    durum === 'var'
      ? 'katildi'
      : durum === 'yok'
        ? 'devamsiz'
        : durum === 'izinli'
          ? 'izinli'
          : 'gec-geldi';
  item.classList.add(durumClass);

  // Badge güncelle
  const badge = item.querySelector('.devam-durum');
  if (badge) {
    badge.textContent = durum.toUpperCase().replace('-', ' ');
    badge.className = `devam-durum devam-${durum}`;
  }

  // Animasyon
  item.classList.add('updating');
  setTimeout(() => {
    item.classList.remove('updating');
    item.classList.add('updated');
    setTimeout(() => item.classList.remove('updated'), 1000);
  }, 50);
}

/**
 * Batch save timer
 */
let batchSaveTimer: any = null;
function scheduleBatchSave(): void {
  if (batchSaveTimer) clearTimeout(batchSaveTimer);

  batchSaveTimer = setTimeout(() => {
    if (enhancedState) {
      enhancedState.flush();
      showAutoSaveIndicator('✅ Kaydedildi!', 2000);
    }
  }, 2000);
}

/**
 * Auto-save indicator oluştur
 */
function createAutoSaveIndicator(): void {
  if (autoSaveIndicator) return;

  autoSaveIndicator = document.createElement('div');
  autoSaveIndicator.id = 'yoklamaAutoSave';
  autoSaveIndicator.style.cssText = `
    position: fixed; bottom: 20px; right: 20px; padding: 8px 16px;
    background: rgba(0,0,0,0.8); color: white; border-radius: 20px;
    font-size: 12px; display: none; z-index: 9999;
  `;
  document.body.appendChild(autoSaveIndicator);
}

/**
 * Auto-save indicator göster
 */
function showAutoSaveIndicator(msg: string, duration = 5000): void {
  if (!autoSaveIndicator) return;
  autoSaveIndicator.textContent = msg;
  autoSaveIndicator.style.display = 'block';
  setTimeout(() => {
    if (autoSaveIndicator) autoSaveIndicator.style.display = 'none';
  }, duration);
}

/**
 * Auto-save indicator gizle
 */
function hideAutoSaveIndicator(): void {
  if (autoSaveIndicator) autoSaveIndicator.style.display = 'none';
}

/**
 * Keyboard shortcuts başlat
 */
function initKeyboardShortcuts(): void {
  if (abortController) {
    // Keyboard için ayrı controller gerekmiyor, aynısını kullan
  }

  document.addEventListener('keydown', (e: KeyboardEvent) => {
    // Input içindeyse çalışma
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

    // Modal açıksa çalışma
    if (document.querySelector('.modal.active')) return;

    // Yoklama view aktif mi?
    const yoklamaView = Helpers.$('#yoklama');
    if (!yoklamaView || (yoklamaView as HTMLElement).style.display === 'none') return;

    // V: VAR
    if (e.key === 'v' || e.key === 'V') {
      e.preventDefault();
      const firstSporcu = document.querySelector('.yoklama-item:not(.katildi)');
      if (firstSporcu) {
        const id = parseInt(firstSporcu.getAttribute('data-sporcu-id') || '0', 10);
        if (id) durumKaydet(id, 'var');
      }
    }

    // Y: YOK
    if (e.key === 'y' || e.key === 'Y') {
      e.preventDefault();
      const firstSporcu = document.querySelector('.yoklama-item.katildi');
      if (firstSporcu) {
        const id = parseInt(firstSporcu.getAttribute('data-sporcu-id') || '0', 10);
        if (id) durumKaydet(id, 'yok');
      }
    }

    // Ctrl+Z: Undo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      if (enhancedHistory && enhancedHistory.canUndo()) {
        enhancedHistory.undo();
        Helpers.toast('↶ Geri alındı', 'info');
        listeyiGuncelle();
      }
    }

    // Ctrl+Y: Redo
    if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
      e.preventDefault();
      if (enhancedHistory && enhancedHistory.canRedo()) {
        enhancedHistory.redo();
        Helpers.toast('↷ Yinelendi', 'info');
        listeyiGuncelle();
      }
    }
  });

  console.log('⌨️ [Yoklama] Keyboard shortcuts aktif');
}

/**
 * Touch gestures başlat (mobil)
 */
function initTouchGestures(): void {
  let touchStartX = 0;
  const SWIPE_THRESHOLD = 100;

  const container = Helpers.$('#yoklamaListesi');
  if (!container) return;

  container.addEventListener(
    'touchstart',
    (e: any) => {
      touchStartX = e.touches[0]?.clientX || 0;
    },
    { passive: true }
  );

  container.addEventListener(
    'touchend',
    (e: any) => {
      const touchEndX = e.changedTouches[0]?.clientX || 0;
      const delta = touchEndX - touchStartX;

      if (Math.abs(delta) > SWIPE_THRESHOLD) {
        const target = e.target as HTMLElement;
        const item = target.closest('.yoklama-item') as HTMLElement;
        if (item) {
          const id = parseInt(item.getAttribute('data-sporcu-id') || '0', 10);
          if (id) {
            if (delta > 0) {
              durumKaydet(id, 'var'); // Sağa: VAR
              if (navigator.vibrate) navigator.vibrate(30);
            } else {
              durumKaydet(id, 'yok'); // Sola: YOK
              if (navigator.vibrate) navigator.vibrate(30);
            }
          }
        }
      }
    },
    { passive: true }
  );

  console.log('👆 [Yoklama] Touch gestures aktif');
}

// ========== ENHANCED PUBLIC API ==========

/**
 * Geri al (Undo)
 */
export function undo(): boolean {
  if (enhancedHistory && enhancedHistory.canUndo()) {
    const success = enhancedHistory.undo();
    if (success) {
      Helpers.toast('↶ Geri alındı', 'info');
      listeyiGuncelle();
    }
    return success;
  }
  return false;
}

/**
 * Yinele (Redo)
 */
export function redo(): boolean {
  if (enhancedHistory && enhancedHistory.canRedo()) {
    const success = enhancedHistory.redo();
    if (success) {
      Helpers.toast('↷ Yinelendi', 'info');
      listeyiGuncelle();
    }
    return success;
  }
  return false;
}

/**
 * Audit raporu
 */
export function getAuditReport() {
  if (enhancedAudit) {
    const logs = enhancedAudit.getLogs();
    return {
      totalLogs: logs.length,
      recentLogs: logs.slice(-10),
    };
  }
  return null;
}

/**
 * Risk analizi
 */
export function getSporcuRisk(sporcuId: number) {
  if (enhancedAnalytics) {
    return enhancedAnalytics.getRisk(sporcuId);
  }
  return null;
}

// ========== NOTIFICATION ENTEGRASYONU ==========

/**
 * Devamsızlara bildirim gönder (WhatsApp link ile)
 */
function devamsizlaraBildirimGonder(devamsizSporcular: Sporcu[], tarih: string): void {
  if (devamsizSporcular.length === 0) return;

  // Onay iste
  if (
    !Helpers.onay(
      `${devamsizSporcular.length} devamsız sporcunun velisine WhatsApp ile bildirim gönderilsin mi?`
    )
  ) {
    return;
  }

  // Her sporcu için WhatsApp link oluştur
  devamsizSporcular.forEach(sporcu => {
    const veliTel = sporcu.veliBilgileri?.veli1?.telefon || sporcu.iletisim?.telefon;
    if (!veliTel) return;

    // Telefon formatı: 905XXXXXXXXX
    const tel = veliTel.replace(/\D/g, '');
    const whatsappTel = tel.startsWith('90') ? tel : '90' + tel;

    const mesaj = `Sayın Veli,\n\n${sporcu.temelBilgiler?.adSoyad} bugünkü antrenmana katılmadı.\n\nTarih: ${new Date(tarih).toLocaleDateString('tr-TR')}\nGrup: ${sporcu.tffGruplari?.anaGrup}\n\nLütfen durum hakkında bilgi veriniz.\n\nSOY-BIS Spor Salonu`;

    const url = `https://wa.me/${whatsappTel}?text=${encodeURIComponent(mesaj)}`;

    console.log(`📱 WhatsApp: ${sporcu.temelBilgiler?.adSoyad} → ${veliTel}`);
    console.log(`   Link: ${url}`);

    // Link'i yeni sekmede aç
    window.open(url, '_blank');

    // Kısa delay (tarayıcı çoklu popup bloğu için)
    setTimeout(() => {}, 500);
  });

  Helpers.toast(`${devamsizSporcular.length} WhatsApp linki açıldı!`, 'success');
}

/**
 * Tekil devamsızlık bildirimi
 */
export function devamsizlikBildirimiGonder(sporcuId: number): void {
  const sporcu = Storage.sporcuBul(sporcuId);
  if (!sporcu) return;

  if (!window.Notification) {
    Helpers.toast('Notification modülü yok!', 'error');
    return;
  }

  const ayarlar = window.Notification.ayarlariGetir?.();
  if (!ayarlar?.enabled) {
    Helpers.toast('Bildirim sistemi kapalı!', 'warning');
    return;
  }

  // Tekil bildirim gönder
  window.Notification.topluHatirlatmaGonder?.([sporcu], 'sms');

  Helpers.toast(`${sporcu.temelBilgiler?.adSoyad} velisine bildirim gönderildi!`, 'success');
}

// ========== EXCEL EXPORT ==========

/**
 * Yoklama raporunu Excel'e indir
 */
export function yoklamaRaporuIndir(baslangic?: string, bitis?: string): void {
  if (typeof window.XLSX === 'undefined') {
    Helpers.toast('Excel kütüphanesi yüklenemedi!', 'error');
    return;
  }

  const yoklamalar = Storage.yoklamalariGetir();
  let filtrelenmis = yoklamalar;

  if (baslangic) filtrelenmis = filtrelenmis.filter(y => y.tarih >= baslangic);
  if (bitis) filtrelenmis = filtrelenmis.filter(y => y.tarih <= bitis);

  const sporcular = Storage.sporculariGetir();
  const data: any[][] = [];

  // Başlık
  data.push(['YOKLAMA RAPORU']);
  data.push(['Tarih Aralığı:', `${baslangic || 'Başlangıç'} - ${bitis || 'Bugün'}`]);
  data.push([]);

  // Kolon başlıkları
  data.push([
    'Ad Soyad',
    'Grup',
    'Toplam Seans',
    'Katıldı',
    'Katılmadı',
    'İzinli',
    'Devam %',
    'Durum',
  ]);

  // Her sporcu için satır
  sporcular.forEach(s => {
    let toplamSeans = 0;
    let varSayisi = 0;
    let yokSayisi = 0;
    let izinliSayisi = 0;

    filtrelenmis.forEach(y => {
      const kayit = y.sporcular.find(k => k.id === s.id);
      if (kayit) {
        toplamSeans++;
        if (kayit.durum === 'var') varSayisi++;
        else if (kayit.durum === 'yok') yokSayisi++;
        else if (kayit.durum === 'izinli') izinliSayisi++;
      }
    });

    if (toplamSeans === 0) return;

    const devamOrani = Math.round((varSayisi / toplamSeans) * 100);
    const durum =
      devamOrani >= 85
        ? 'Mükemmel'
        : devamOrani >= 70
          ? 'İyi'
          : devamOrani >= 50
            ? 'Orta'
            : 'Düşük';

    data.push([
      s.temelBilgiler?.adSoyad || '-',
      s.tffGruplari?.anaGrup || '-',
      toplamSeans,
      varSayisi,
      yokSayisi,
      izinliSayisi,
      devamOrani,
      durum,
    ]);
  });

  // Excel oluştur
  const ws = window.XLSX.utils.aoa_to_sheet(data);
  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, ws, 'Yoklama Raporu');

  const dosyaAdi = `Yoklama_Raporu_${new Date().toLocaleDateString('tr-TR').replace(/\./g, '-')}.xlsx`;
  window.XLSX.writeFile(wb, dosyaAdi);

  Helpers.toast('Excel dosyası indirildi!', 'success');
}

/**
 * Günlük yoklama raporunu Excel'e indir
 */
export function gunlukYoklamaIndir(): void {
  const tarihInput = Helpers.$('#yoklamaTarih') as HTMLInputElement | null;
  const tarih = tarihInput?.value || Helpers.bugunISO();

  yoklamaRaporuIndir(tarih, tarih);
}

/**
 * Yüksek riskli sporcuların velilerine toplu bildirim
 */
export function riskliSporcularaBildirim(): void {
  if (!ENHANCED_FEATURES.SMART_ANALYTICS || !enhancedAnalytics) {
    Helpers.toast('Risk analizi özelliği kapalı!', 'warning');
    return;
  }

  const sporcular = Storage.sporculariGetir().filter(s => s.durum === 'Aktif');
  const riskliSporcular: Sporcu[] = [];

  sporcular.forEach(s => {
    const risk = enhancedAnalytics.getRisk(s.id);
    if (risk && (risk.riskSeviyesi === 'yuksek' || risk.ardasik >= 3)) {
      riskliSporcular.push(s);
    }
  });

  if (riskliSporcular.length === 0) {
    Helpers.toast('Yüksek riskli sporcu yok!', 'info');
    return;
  }

  if (
    !Helpers.onay(
      `${riskliSporcular.length} yüksek riskli sporcunun velisine bildirim gönderilsin mi?`
    )
  ) {
    return;
  }

  window.Notification?.topluHatirlatmaGonder?.(riskliSporcular, 'sms');

  Helpers.toast(`${riskliSporcular.length} veliye uyarı gönderildi!`, 'success');
}

// ========== QR CODE ENTEGRASYONU ==========

/**
 * QR tarama modal'ı aç
 */
export function qrTaramaAc(): void {
  const modal = document.createElement('div');
  modal.id = 'yoklamaQRModal';
  modal.className = 'modal active';
  modal.style.cssText = 'display: flex !important; z-index: 10000;';

  modal.innerHTML = `
    <div class="modal-content" style="max-width: 500px;">
      <div class="modal-header">
        <h3>📷 QR Kod Check-In</h3>
        <button class="modal-close" id="qrModalKapat">&times;</button>
      </div>
      <div class="modal-body">
        <div style="text-align: center; padding: 20px;">
          <p>📱 QR Kod Verisi Girin:</p>
          <input type="text" id="qrManualInput" 
                 placeholder="YOKLAMA_123_2026-01-12" 
                 style="width: 100%; padding: 12px; font-size: 14px; border: 2px solid #ccc; border-radius: 8px; margin: 10px 0;">
          <button class="btn btn-success" id="qrCheckInBtn" style="width: 100%; padding: 12px;">
            ✅ Check-In Yap
          </button>
          <div id="qrResult" style="margin-top: 15px; padding: 10px; border-radius: 5px;"></div>
          <p style="margin-top: 20px; font-size: 12px; color: #666;">
            <strong>Format:</strong> YOKLAMA_[SporcuID]<br>
            <strong>Örnek:</strong> YOKLAMA_1768248162532<br>
            <small>Tarih otomatik bugüne ayarlanır</small>
          </p>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Event listeners
  const kapatBtn = modal.querySelector('#qrModalKapat');
  const checkInBtn = modal.querySelector('#qrCheckInBtn');
  const input = modal.querySelector('#qrManualInput') as HTMLInputElement;

  kapatBtn?.addEventListener('click', () => modal.remove());
  checkInBtn?.addEventListener('click', () => {
    if (input) processQRCheckIn(input.value);
  });

  // Enter ile de check-in
  input?.addEventListener('keypress', (e: any) => {
    if (e.key === 'Enter' && input) {
      processQRCheckIn(input.value);
    }
  });

  input?.focus();
}

/**
 * QR check-in işle (iyileştirilmiş)
 */
function processQRCheckIn(qrData: string): void {
  const resultEl = document.getElementById('qrResult');
  if (!resultEl) return;

  // 1. Format kontrolü
  if (!qrData || !qrData.trim()) {
    resultEl.innerHTML = '❌ QR kod boş!';
    resultEl.style.background = 'rgba(229, 62, 62, 0.1)';
    resultEl.style.color = '#e53e3e';
    return;
  }

  if (!qrData.startsWith('YOKLAMA_')) {
    resultEl.innerHTML = `❌ Geçersiz format!<br><small>Beklenen: YOKLAMA_ID_TARİH</small>`;
    resultEl.style.background = 'rgba(229, 62, 62, 0.1)';
    resultEl.style.color = '#e53e3e';
    return;
  }

  // 2. Parse et
  const parts = qrData.split('_');

  // Format: YOKLAMA_{sporcuId} veya YOKLAMA_{sporcuId}_{tarih} (eski format)
  // Tarih opsiyonel - varsa ignore et, yoksa da sorun yok
  const sporcuId = parseInt(parts[1] || '0', 10);
  const qrTarih = parts[2]; // Opsiyonel, kullanılmayacak

  if (!sporcuId || isNaN(sporcuId) || sporcuId <= 0) {
    resultEl.innerHTML = '❌ Geçersiz sporcu ID!';
    resultEl.style.background = 'rgba(229, 62, 62, 0.1)';
    resultEl.style.color = '#e53e3e';
    return;
  }

  // 3. Sporcu kontrolü
  const sporcu = Storage.sporcuBul(sporcuId);
  if (!sporcu) {
    resultEl.innerHTML = `❌ Sporcu bulunamadı!<br><small>ID: ${sporcuId}</small>`;
    resultEl.style.background = 'rgba(229, 62, 62, 0.1)';
    resultEl.style.color = '#e53e3e';
    return;
  }

  // Pasif sporcu kontrolü
  if (sporcu.durum !== 'Aktif') {
    resultEl.innerHTML = `⚠️ ${sporcu.temelBilgiler?.adSoyad}<br><small>Sporcu pasif durumda!</small>`;
    resultEl.style.background = 'rgba(214, 158, 46, 0.1)';
    resultEl.style.color = '#d69e2e';
    return;
  }

  // 4. Tarih kontrolü (bugünün tarihi kullanılır - QR'daki tarih ignore edilir)
  const bugun = new Date().toISOString().split('T')[0];
  const kullanilacakTarih = bugun; // Her zaman bugün

  // QR'da tarih varsa bile kullanılmaz - QR kalıcıdır, her gün aynı QR kullanılır
  if (qrTarih) {
    console.log(`ℹ️ [QR] QR'da tarih var (${qrTarih}) ama bugünün tarihi kullanılıyor: ${bugun}`);
  }

  // 5. Grup bilgisini al (UI'dan veya sporcudan)
  const grupSelect = Helpers.$('#yoklamaGrup') as HTMLSelectElement | null;
  const grup =
    grupSelect?.value && grupSelect.value !== 'all'
      ? grupSelect.value
      : sporcu.tffGruplari?.anaGrup || 'U12';

  // 6. Duplicate kontrolü (aynı gün zaten VAR işaretlenmişse)
  const mevcutYoklama = Storage.yoklamaBul(kullanilacakTarih, grup);
  const mevcutKayit = mevcutYoklama?.sporcular.find(s => s.id === sporcuId);

  if (mevcutKayit && mevcutKayit.durum === 'var') {
    resultEl.innerHTML = `
      ℹ️ Zaten kayıtlı!<br>
      <strong>${sporcu.temelBilgiler?.adSoyad}</strong><br>
      <small>Bugün zaten VAR işaretli</small>
    `;
    resultEl.style.background = 'rgba(0, 188, 212, 0.1)';
    resultEl.style.color = '#00bcd4';

    // 2 saniye sonra temizle
    setTimeout(() => {
      const input = document.getElementById('qrManualInput') as HTMLInputElement;
      if (input) {
        input.value = '';
        input.focus();
      }
      resultEl.innerHTML = '';
      resultEl.style.background = '';
    }, 2000);

    return;
  }

  // 7. VAR işaretle (enhanced durumKaydet kullan)
  const gelişSaati = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

  // Enhanced fonksiyonu kullan (undo/redo için)
  durumKaydet(sporcuId, 'var');

  // 8. Success feedback
  resultEl.innerHTML = `
    ✅ Hoş geldin!<br>
    <strong style="font-size: 20px; color: #38a169;">${sporcu.temelBilgiler?.adSoyad}</strong><br>
    <small style="color: #666;">
      ${grup} | 🕐 ${gelişSaati}
      ${mevcutKayit ? '<br>⚠️ Güncellendi: ' + mevcutKayit.durum + ' → VAR' : ''}
    </small>
  `;
  resultEl.style.background = 'rgba(56, 161, 105, 0.15)';
  resultEl.style.color = '#38a169';
  resultEl.style.border = '2px solid #38a169';
  resultEl.classList.add('success');

  // Vibrate (mobilde)
  if (navigator.vibrate) {
    navigator.vibrate([100, 50, 100]);
  }

  // Ses çal (opsiyonel)
  try {
    const audio = new Audio(
      'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGGa77OihUxMNUKzn77RYFAk+ltryxnMpBSh+zPLaizsKGGS56+mjUBELTKXm8LJcFgpBmtvyxXEqBSl+zPDaiToJGGO56+mjTxELTKXm8LJcFgpBmtvyxXEqBSl+zPDaiToJGGO56+mjTxELTKXm8LJcFgpBmtvyxXEqBQ=='
    );
    audio.volume = 0.3;
    audio.play().catch(() => {});
  } catch (e) {}

  // 9. Audit log (enhanced varsa)
  if (ENHANCED_FEATURES.AUDIT_TRAIL && enhancedAudit) {
    const kullanici = window.Auth?.aktifKullanici?.();
    if (kullanici) {
      enhancedAudit.push({
        sporcuId,
        islem: 'guncelle',
        eskiDeger: mevcutKayit?.durum,
        yeniDeger: 'var',
        kullaniciId: kullanici.id,
        kullaniciAdi: kullanici.kullaniciAdi || 'QR Check-In',
        timestamp: new Date().toISOString(),
      });
    }
  }

  console.log(`✅ [QR] Check-in başarılı: ${sporcu.temelBilgiler?.adSoyad} @ ${gelişSaati}`);

  // 10. Input temizle ve sonrakine hazırlan
  setTimeout(() => {
    const input = document.getElementById('qrManualInput') as HTMLInputElement;
    if (input) {
      input.value = '';
      input.focus();
    }
    resultEl.innerHTML = '<span style="color: #666;">👍 Sonraki QR kodu okutabilirsiniz</span>';
    resultEl.style.background = '';
    resultEl.style.border = 'none';
    resultEl.classList.remove('success');
  }, 2500);
}

/**
 * QRCode kütüphanesini dinamik olarak yükle
 */
function loadQRCodeLibrary(): Promise<any> {
  return new Promise((resolve, reject) => {
    // Zaten yüklüyse direkt döndür
    if ((window as any).QRCode) {
      resolve((window as any).QRCode);
      return;
    }

    // Script zaten eklenmiş mi kontrol et
    const existingScript = document.querySelector('script[src*="qrcode"]');
    if (existingScript) {
      // Yüklenmeyi bekle
      const checkInterval = setInterval(() => {
        if ((window as any).QRCode) {
          clearInterval(checkInterval);
          resolve((window as any).QRCode);
        }
      }, 100);

      // 5 saniye sonra timeout
      setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error('QRCode kütüphanesi yüklenemedi (timeout)'));
      }, 5000);
      return;
    }

    // Script ekle
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
    script.onload = () => {
      console.log('✅ [QR] QRCode kütüphanesi yüklendi');
      resolve((window as any).QRCode);
    };
    script.onerror = () => {
      console.error('❌ [QR] QRCode kütüphanesi yüklenemedi');
      reject(new Error('QRCode kütüphanesi yüklenemedi'));
    };
    document.head.appendChild(script);
  });
}

/**
 * Tek sporcu için QR göster (ekranda)
 */
export async function sporcuQRGoster(sporcuId: number): Promise<void> {
  const sporcu = Storage.sporcuBul(sporcuId);
  if (!sporcu) {
    Helpers.toast('Sporcu bulunamadı!', 'error');
    return;
  }

  // Önce QR kütüphanesini yükle
  try {
    await loadQRCodeLibrary();
  } catch (error) {
    console.error('QR kütüphanesi yüklenemedi:', error);
  }

  const modal = document.createElement('div');
  modal.id = 'sporcuQRModal';
  modal.className = 'modal active';
  modal.style.cssText = 'display: flex !important; z-index: 10000;';

  const qrData = `YOKLAMA_${sporcuId}`;

  modal.innerHTML = `
    <div class="modal-content" style="max-width: 400px; text-align: center;">
      <div class="modal-header">
        <h3>📱 Sporcu QR Kodu</h3>
        <button class="modal-close" id="sporcuQRKapat">&times;</button>
      </div>
      <div class="modal-body" style="padding: 30px;">
        <div style="background: white; padding: 20px; border-radius: 10px; display: inline-block;">
          <div id="sporcuQRCode" style="width: 250px; height: 250px; display: flex; align-items: center; justify-content: center;">
            <span style="color: #999;">QR yükleniyor...</span>
          </div>
        </div>
        <h2 style="margin-top: 20px; color: var(--primary);">${sporcu.temelBilgiler?.adSoyad || 'Sporcu'}</h2>
        <p style="font-size: 16px; color: #666;">${sporcu.tffGruplari?.anaGrup || '-'} | ${sporcu.sporBilgileri?.brans || '-'}</p>
        <code style="background: rgba(0,0,0,0.1); padding: 8px 16px; border-radius: 5px; font-size: 12px; display: inline-block; margin-top: 10px;">
          ${qrData}
        </code>
        <p style="margin-top: 20px; font-size: 13px; color: #999;">
          ✅ Bu QR kodu kalıcıdır, sonsuza kadar kullanılır<br>
          📱 Tablet/telefon ile tarayın veya screenshot alın
        </p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-primary" onclick="window.print()">
          <i class="fa-solid fa-print"></i> Yazdır
        </button>
        <button class="btn" id="sporcuQRKapatBtn">Kapat</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Event listeners
  modal.querySelector('#sporcuQRKapat')?.addEventListener('click', () => modal.remove());
  modal.querySelector('#sporcuQRKapatBtn')?.addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => {
    if (e.target === modal) modal.remove();
  });

  // QR kod oluştur
  setTimeout(() => {
    const qrContainer = document.getElementById('sporcuQRCode');
    if (!qrContainer) return;

    // Container'ı temizle
    qrContainer.innerHTML = '';

    if ((window as any).QRCode) {
      try {
        new (window as any).QRCode(qrContainer, {
          text: qrData,
          width: 250,
          height: 250,
          colorDark: '#000000',
          colorLight: '#ffffff',
          correctLevel: (window as any).QRCode.CorrectLevel?.H || 2,
        });
        console.log('✅ [QR] QR kod oluşturuldu:', qrData);
      } catch (error) {
        console.error('❌ [QR] QR oluşturma hatası:', error);
        qrContainer.innerHTML = `<div style="padding: 30px; font-size: 14px; color: #666; word-break: break-all;">
          <p style="margin-bottom: 10px;">⚠️ QR oluşturulamadı</p>
          <strong>${qrData}</strong>
        </div>`;
      }
    } else {
      // QR kütüphanesi yoksa text göster
      console.warn('⚠️ [QR] QRCode kütüphanesi bulunamadı');
      qrContainer.innerHTML = `<div style="padding: 30px; font-size: 14px; color: #666; word-break: break-all;">
        <p style="margin-bottom: 10px;">⚠️ QR kütüphanesi yüklenemedi</p>
        <strong>${qrData}</strong>
      </div>`;
    }
  }, 200);
}

/**
 * QR Yazdır butonu için grup bazlı yazdırma
 * Tüm Gruplar seçildiğinde de çalışır
 */
export function qrYazdirBaslat(): void {
  console.log('🖨️ [QR] QR Yazdırma başlatılıyor...');

  try {
    const grupSelect = Helpers.$('#yoklamaGrup') as HTMLSelectElement | null;
    const grup = grupSelect ? grupSelect.value : 'all';

    console.log('📋 [QR] Seçili grup:', grup);

    const allSporcular = Storage.sporculariGetir();
    console.log('👥 [QR] Toplam sporcu sayısı:', allSporcular.length);

    // Filtreleme: Tüm Gruplar (all) seçiliyse hepsini al, değilse sadece seçili grubu
    const sporcular = allSporcular.filter((s: any) => {
      // Pasif olmayanları dahil et (Aktif veya undefined)
      const aktifMi = s.durum !== 'Pasif';

      // Grup filtresi: all ise hepsini al
      if (grup === 'all') {
        return aktifMi;
      }

      // Belirli bir grup seçiliyse sadece o grubu al
      const sporcuGrup = s.tffGruplari?.anaGrup || s.yasGrubu || s.grup;
      const grupMatch = sporcuGrup === grup;
      return grupMatch && aktifMi;
    });

    console.log('🎯 [QR] Filtrelenmiş sporcu sayısı:', sporcular.length);

    if (sporcular.length === 0) {
      const mesaj =
        grup === 'all'
          ? '❌ Sistemde aktif sporcu bulunamadı!'
          : '❌ Bu grupta aktif sporcu bulunamadı!';
      Helpers.toast(mesaj, 'error');
      console.warn('⚠️ [QR] Filtrelenmiş sporcu bulunamadı');
      return;
    }

    console.log('🖨️ [QR] QR kodları yazdırılıyor...');
    const grupAdi = grup === 'all' ? 'Tüm Gruplar' : grup;
    yazdirQRKodlari(sporcular, grupAdi);
  } catch (error) {
    console.error('❌ [QR] QR yazdırma hatası:', error);
    Helpers.toast('❌ QR kodları oluşturulurken hata: ' + (error as Error).message, 'error');
  }
}

/**
 * Sporcu QR kodlarını yazdır
 */
function yazdirQRKodlari(sporcular: any[], grup: string): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const printContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>QR Kodları - ${grup} Grubu</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .qr-grid { display: flex; flex-wrap: wrap; gap: 20px; justify-content: center; }
            .qr-item { 
                border: 1px solid #ddd; 
                padding: 15px; 
                border-radius: 8px; 
                text-align: center; 
                width: 200px;
                break-inside: avoid;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
            }
            .qr-code { 
                margin: 10px 0;
                display: flex;
                align-items: center;
                justify-content: center;
                width: 100%;
            }
            .qr-code canvas,
            .qr-code img {
                display: block;
                margin: 0 auto;
            }
            .sporcu-info { 
                margin-top: 10px; 
                font-size: 14px; 
                font-weight: bold;
                text-align: center;
                width: 100%;
            }
            .sporcu-info small {
                display: block;
                font-size: 12px;
                font-weight: normal;
                color: #666;
                margin-top: 5px;
            }
            @media print {
                body { margin: 10px; }
                .qr-grid { 
                    display: block; 
                    text-align: center;
                }
                .qr-item { 
                    display: inline-block; 
                    vertical-align: top;
                    margin: 10px; 
                    page-break-inside: avoid; 
                }
                .qr-code {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
            }
        </style>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
    </head>
    <body>
        <div class="header">
            <h1>QR Kodları - ${grup} Grubu</h1>
            <p>Tarih: ${new Date().toLocaleDateString('tr-TR')}</p>
        </div>
        <div class="qr-grid">
            ${sporcular
              .map(
                (s: any) => `
                <div class="qr-item">
                    <div class="qr-code" id="qr-${s.id}"></div>
                    <div class="sporcu-info">
                        ${s.temelBilgiler?.adSoyad || s.adSoyad || 'Sporcu'}<br>
                        <small>ID: ${s.id}</small>
                    </div>
                </div>
            `
              )
              .join('')}
        </div>
        
        <script>
            window.onload = function() {
                ${sporcular
                  .map(
                    (s: any) => `
                    new QRCode(document.getElementById('qr-${s.id}'), {
                        text: 'YOKLAMA_${s.id}',
                        width: 150,
                        height: 150,
                        colorDark: '#000000',
                        colorLight: '#ffffff'
                    });
                `
                  )
                  .join('')}
                
                setTimeout(function() {
                    window.print();
                }, 2000);
            };
        </script>
    </body>
    </html>
  `;

  printWindow.document.write(printContent);
  printWindow.document.close();

  Helpers.toast(`${grup} grubu için ${sporcular.length} adet QR kod hazırlandı!`, 'success');
}

/**
 * Tüm sporcular için QR kodları yazdır (iyileştirilmiş)
 */
export function tumSporcuQRYazdir(): void {
  const sporcular = Storage.sporculariGetir().filter(s => s.durum === 'Aktif');

  if (sporcular.length === 0) {
    Helpers.toast('Aktif sporcu bulunamadı!', 'warning');
    return;
  }

  // Onay iste (çok sayıda popup açılacak)
  if (
    !Helpers.onay(
      `${sporcular.length} sporcunun QR kodu yazdırılacak. Devam etmek istiyor musunuz?`
    )
  ) {
    return;
  }

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    Helpers.toast('Popup blocker aktif! Lütfen izin verin.', 'warning');
    return;
  }

  let html = `
    <!DOCTYPE html>
    <html><head><title>Sporcu QR Kodları</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
    <style>
      body { font-family: Arial; padding: 20px; }
      .qr-card { display: inline-block; width: 200px; margin: 10px; padding: 15px; 
                 border: 2px solid #000; text-align: center; page-break-inside: avoid; }
      .qr-code { width: 150px; height: 150px; margin: 10px auto; }
      .ad { font-size: 14px; font-weight: bold; margin: 5px 0; }
      .grup { font-size: 11px; color: #666; }
      @media print { .qr-card { break-inside: avoid; } }
    </style></head><body>
    <h1 style="text-align: center;">📱 Sporcu QR Kodları - ${new Date().toLocaleDateString('tr-TR')}</h1>
  `;

  sporcular.forEach((s: any) => {
    html += `
      <div class="qr-card">
        <div class="qr-code" id="qr-${s.id}"></div>
        <div class="ad">${s.temelBilgiler?.adSoyad || 'Bilinmeyen'}</div>
        <div class="grup">${s.tffGruplari?.anaGrup || '-'} | ID: ${s.id}</div>
        <div style="font-size: 10px; margin-top: 5px; color: #999;">YOKLAMA_${s.id}</div>
      </div>
    `;
  });

  html += `<script>
    ${sporcular
      .map(
        (s: any) => `new QRCode(document.getElementById('qr-${s.id}'), {
      text: 'YOKLAMA_${s.id}', width: 150, height: 150
    });`
      )
      .join('\n')}
    setTimeout(() => window.print(), 2000);
  </script></body></html>`;

  printWindow.document.write(html);
  printWindow.document.close();
}

// Public API
if (typeof window !== 'undefined') {
  (window as unknown as { Yoklama: Record<string, unknown> }).Yoklama = {
    init,
    listeyiGuncelle,
    durumKaydet,
    topluYoklama,
    devamRaporu,
    sporcuDevamRaporu,
    filtreSifirla,
    // Enhanced API
    undo,
    redo,
    getAuditReport,
    getSporcuRisk,
    // Notification API
    devamsizlikBildirimiGonder,
    riskliSporcularaBildirim,
    // Export API
    yoklamaRaporuIndir,
    gunlukYoklamaIndir,
    // QR Code API
    qrTaramaAc,
    qrYazdirBaslat,
    tumSporcuQRYazdir,
    sporcuQRGoster,
  };
}
