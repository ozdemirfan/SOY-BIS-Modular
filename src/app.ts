/**
 * SOY-BIS - Ana Uygulama Dosyası (app.ts)
 * Tüm modülleri birleştirir ve uygulamayı başlatır - TypeScript Version
 * Versiyon: 3.0.0
 */

import * as Helpers from './utils/helpers';
import * as Storage from './utils/storage';
import * as Auth from './utils/auth';
import type { UserRole } from './types';

// Import modules
import * as Dashboard from './modules/dashboard';
import * as Sporcu from './modules/sporcu';
import * as Aidat from './modules/aidat';
import * as Yoklama from './modules/yoklama';
import * as Gider from './modules/gider';
import * as Antrenor from './modules/antrenor';
import * as Rapor from './modules/rapor';
import * as Ayarlar from './modules/ayarlar';
import * as KullaniciYonetimi from './modules/kullanici-yonetimi';
import * as Notification from './modules/notification';
import { isMobile } from './utils/responsiveLayout';
import { canAccessView } from './app/viewAccess';
import { aramaKutulariniTemizle, formInputlariniTemizle } from './utils/appFormCleanup';
import { temaDegistir, temaYonetiminiBaslat } from './app/appTheme';
import { toggleMobileMenu, openMobileMenu, closeMobileMenu } from './app/appMobileNav';
import { masaustuSidebarYonetimi, toggleDesktopSidebar } from './app/appDesktopSidebar';
import type { LoginFlowHooks } from './app/appLoginFlow';
import {
  viewGoster as viewGosterCore,
  navIndicatorGuncelle,
  type ViewNavigationContext,
} from './app/appViewNavigation';
import { modulleriBaslat, tumunuGuncelle } from './app/appModulesInit';
import { bootstrapApp } from './app/appBootstrap';

export { toggleMobileMenu, openMobileMenu, closeMobileMenu };
export { masaustuSidebarYonetimi, toggleDesktopSidebar };
export { navIndicatorGuncelle };

// ========== TYPES & INTERFACES ==========

interface AppState {
  aktifView: string;
  yuklendi: boolean;
}

// Global window types are already declared in other modules
// We don't declare App interface here to avoid conflicts

// ========== STATE ==========

const state: AppState = {
  aktifView: 'dashboard',
  yuklendi: false,
};

// ========== HELPER FUNCTIONS ==========
// tarihiGuncelle → utils/appHeaderDate

// ========== NAVIGATION ==========

/**
 * Navigasyon eventlerini bağla
 */
function navigasyonEventleri(): void {
  const mainNav = Helpers.$('#mainNav');
  if (!mainNav) {
    console.warn('navigasyonEventleri: #mainNav bulunamadı');
    // DOM henüz hazır değilse, kısa bir süre sonra tekrar dene
    setTimeout(() => {
      navigasyonEventleri();
    }, 200);
    return;
  }

  const navButtons = Helpers.$$('#mainNav button');

  if (navButtons.length === 0) {
    console.warn('navigasyonEventleri: Hiç buton bulunamadı!');
    return;
  }

  navButtons.forEach(btn => {
    // Çift event listener eklenmesini önle
    if (btn.hasAttribute('data-nav-listener')) {
      return;
    }

    btn.setAttribute('data-nav-listener', 'true');

    btn.addEventListener('click', function (e: Event) {
      e.preventDefault();
      e.stopPropagation();
      const targetView = this.getAttribute('data-target');
      if (targetView) {
        viewGoster(targetView);
      } else {
        console.warn("navigasyonEventleri: Buton data-target attribute'u yok!");
      }
    });
  });
}

function viewNavigationContext(): ViewNavigationContext {
  return {
    getAktifView: () => state.aktifView,
    setAktifView: id => {
      state.aktifView = id;
    },
    ayarlariGuncelle,
  };
}

/** View göster — uygulama state'i ViewNavigationContext ile bağlanır */
function viewGoster(viewId: string, ilkBaslatma = false): void {
  viewGosterCore(viewNavigationContext(), viewId, ilkBaslatma);
}

// aramaKutulariniTemizle / formInputlariniTemizle → utils/appFormCleanup
// modulleriBaslat / tumunuGuncelle → app/appModulesInit

/**
 * Kullanıcı bilgilerini header'da göster
 */
function kullaniciBilgileriniGoster(): void {
  const kullanici = Auth.aktifKullanici();
  if (!kullanici) return;

  const userNameEl = Helpers.$('#userName');
  const userRoleBadgeEl = Helpers.$('#userRoleBadge');
  const headerUserEl = Helpers.$('#headerUser');
  const logoutBtn = Helpers.$('#logoutBtn');

  if (userNameEl) {
    userNameEl.textContent = kullanici.adSoyad || kullanici.kullaniciAdi || 'Sistem Yöneticisi';
  }

  if (userRoleBadgeEl) {
    userRoleBadgeEl.textContent = kullanici.rol || 'Yönetici';
  }

  if (headerUserEl) {
    (headerUserEl as HTMLElement).style.display = 'flex';
  }

  if (logoutBtn) {
    (logoutBtn as HTMLElement).style.display = 'flex';
  }
}

/**
 * Rol bazlı menü gizleme
 */
export function rolBazliMenuGizle(): void {
  const kullanici = Auth.aktifKullanici();
  if (!kullanici) return;

  const rol = kullanici.rol as UserRole;
  const navButtons = Helpers.$$('#mainNav button[data-rol]');

  navButtons.forEach(btn => {
    const izinVerilenRoller = btn.getAttribute('data-rol');

    if (izinVerilenRoller === 'all') {
      // Tüm roller erişebilir
      (btn as HTMLElement).style.display = '';
    } else {
      // Belirli roller erişebilir
      const roller = izinVerilenRoller?.split(',').map(r => r.trim()) || [];
      if (roller.includes(rol)) {
        (btn as HTMLElement).style.display = '';
      } else {
        (btn as HTMLElement).style.display = 'none';
      }
    }
  });

  // View'lara erişimi kontrol et
  viewYetkiKontrol();
}

/**
 * View erişim yetkisi kontrolü
 */
function viewYetkiKontrol(): void {
  const kullanici = Auth.aktifKullanici();
  if (!kullanici) return;

  const rol = kullanici.rol as UserRole;

  const views = Helpers.$$('.view');
  views.forEach(view => {
    const viewId = view.id;
    if (!canAccessView(viewId, rol)) {
      (view as HTMLElement).style.display = 'none';
    } else {
      const viewEl = view as HTMLElement;
      if (viewEl.style.display === 'none') {
        viewEl.style.display = '';
      }
    }
  });
}

/**
 * Ayarları güncelle
 */
function ayarlariGuncelle(): void {
  const istatistikler = Storage.istatistikler();

  const sporcuEl = Helpers.$('#istatSporcu');
  const odemeEl = Helpers.$('#istatOdeme');
  const yoklamaEl = Helpers.$('#istatYoklama');
  const giderEl = Helpers.$('#istatGider');
  const depolamaEl = Helpers.$('#istatDepolama');

  if (sporcuEl) sporcuEl.textContent = istatistikler.sporcuSayisi.toString();
  if (odemeEl) odemeEl.textContent = istatistikler.odemeSayisi.toString();
  if (yoklamaEl) yoklamaEl.textContent = istatistikler.yoklamaSayisi.toString();
  if (giderEl) giderEl.textContent = istatistikler.giderSayisi.toString();
  if (depolamaEl) depolamaEl.textContent = istatistikler.depolamaKB + ' KB';

  // Hatırlatma ayarlarını göster
  hatirlatmaAyarlariGoster();
}

/**
 * Hatırlatma ayarlarını göster - Profesyonel Panel
 */
export function hatirlatmaAyarlariGoster(): void {
  const container = Helpers.$('#notificationSettings');
  if (!container) {
    console.warn('Hatırlatma ayarları container bulunamadı');
    return;
  }

  if (typeof window === 'undefined' || !window.Notification) {
    container.innerHTML =
      '<div class="empty-state"><i class="fa-solid fa-exclamation-triangle"></i><p>Bildirim modülü yüklenemedi</p></div>';
    return;
  }

  // Güncel ayarları al (her seferinde fresh data)
  let ayarlar: any;
  try {
    if (typeof Notification.ayarlariGetir === 'function') {
      ayarlar = Notification.ayarlariGetir();
    } else {
      container.innerHTML =
        '<div class="empty-state"><i class="fa-solid fa-exclamation-triangle"></i><p>Ayarlar fonksiyonu bulunamadı</p></div>';
      return;
    }
  } catch (error) {
    console.error('Ayarlar alınamadı:', error);
    container.innerHTML =
      '<div class="empty-state"><i class="fa-solid fa-exclamation-triangle"></i><p>Ayarlar yüklenemedi</p></div>';
    return;
  }

  if (!ayarlar) {
    container.innerHTML =
      '<div class="empty-state"><i class="fa-solid fa-exclamation-triangle"></i><p>Ayarlar bulunamadı</p></div>';
    return;
  }

  container.innerHTML = `
    <!-- Ana Toggle - Kompakt -->
    <div class="notification-compact-toggle">
      <div class="notification-compact-toggle-content">
        <span class="notification-compact-label">Hatırlatma Sistemi</span>
        <span class="notification-compact-desc">Otomatik hatırlatmaları aktifleştir</span>
      </div>
      <label class="toggle-switch">
        <input type="checkbox" id="notificationEnabled" ${ayarlar.enabled ? 'checked' : ''} 
               onchange="if(window.Notification && window.Notification.ayarlariGuncelle) window.Notification.ayarlariGuncelle({enabled: this.checked});">
        <span class="toggle-slider"></span>
      </label>
    </div>
    
    <!-- Bildirim Yöntemleri -->
    <div class="notification-compact-section">
      <h5 class="notification-compact-section-title">
        <i class="fa-solid fa-paper-plane"></i>
        Bildirim Kanalları
      </h5>
      <div class="notification-methods-grid-compact">
        <div class="notification-method-compact ${ayarlar.methods?.sms ? 'active' : ''}">
          <div class="notification-method-icon-compact sms">
            <i class="fa-solid fa-sms"></i>
          </div>
          <span class="notification-method-name-compact">SMS</span>
          <label class="toggle-switch-small">
            <input type="checkbox" ${ayarlar.methods?.sms ? 'checked' : ''} 
                   onchange="if(window.Notification && window.Notification.ayarlariGuncelle) window.Notification.ayarlariGuncelle({methods: {sms: this.checked}});">
            <span class="toggle-slider-small"></span>
          </label>
        </div>
        
        <div class="notification-method-compact ${ayarlar.methods?.email ? 'active' : ''}">
          <div class="notification-method-icon-compact email">
            <i class="fa-solid fa-envelope"></i>
          </div>
          <span class="notification-method-name-compact">E-posta</span>
          <label class="toggle-switch-small">
            <input type="checkbox" ${ayarlar.methods?.email ? 'checked' : ''} 
                   onchange="if(window.Notification && window.Notification.ayarlariGuncelle) window.Notification.ayarlariGuncelle({methods: {email: this.checked}});">
            <span class="toggle-slider-small"></span>
          </label>
        </div>
        
        <div class="notification-method-compact ${ayarlar.methods?.whatsapp ? 'active' : ''}">
          <div class="notification-method-icon-compact whatsapp">
            <i class="fa-brands fa-whatsapp"></i>
          </div>
          <span class="notification-method-name-compact">WhatsApp</span>
          <label class="toggle-switch-small">
            <input type="checkbox" ${ayarlar.methods?.whatsapp ? 'checked' : ''} 
                   onchange="if(window.Notification && window.Notification.ayarlariGuncelle) window.Notification.ayarlariGuncelle({methods: {whatsapp: this.checked}});">
            <span class="toggle-slider-small"></span>
          </label>
        </div>
        
        <div class="notification-method-compact ${ayarlar.methods?.inApp ? 'active' : ''}">
          <div class="notification-method-icon-compact inapp">
            <i class="fa-solid fa-bell"></i>
          </div>
          <span class="notification-method-name-compact">Uygulama İçi</span>
          <label class="toggle-switch-small">
            <input type="checkbox" ${ayarlar.methods?.inApp ? 'checked' : ''} 
                   onchange="if(window.Notification && window.Notification.ayarlariGuncelle) window.Notification.ayarlariGuncelle({methods: {inApp: this.checked}});">
            <span class="toggle-slider-small"></span>
          </label>
        </div>
      </div>
    </div>
    
    <!-- Zamanlama Ayarları - Kompakt -->
    <div class="notification-compact-section">
      <h5 class="notification-compact-section-title">
        <i class="fa-solid fa-clock"></i>
        Zamanlama
      </h5>
      <div class="notification-timing-grid-compact">
        <div class="notification-timing-compact">
          <div class="notification-timing-icon-compact">
            <i class="fa-solid fa-calendar-minus"></i>
          </div>
          <div class="notification-timing-content-compact">
            <label class="notification-timing-label-compact">Önceden Hatırlat</label>
            <div class="notification-timing-input-compact">
              <input type="number" id="notifDaysBefore" min="0" max="30" value="${ayarlar.timing?.daysBefore || 0}" 
                     class="notification-number-input-compact"
                     onchange="if(window.Notification && window.Notification.ayarlariGuncelle) window.Notification.ayarlariGuncelle({timing: {daysBefore: parseInt(this.value) || 0}});">
              <span class="notification-timing-unit-compact">gün</span>
            </div>
          </div>
        </div>
        
        <div class="notification-timing-compact">
          <div class="notification-timing-icon-compact today">
            <i class="fa-solid fa-calendar-day"></i>
          </div>
          <div class="notification-timing-content-compact">
            <label class="notification-timing-label-compact">Ödeme Günü</label>
            <label class="toggle-switch-small">
              <input type="checkbox" id="notifOnDueDate" ${ayarlar.timing?.onDueDate ? 'checked' : ''}
                     onchange="if(window.Notification && window.Notification.ayarlariGuncelle) window.Notification.ayarlariGuncelle({timing: {onDueDate: this.checked}});">
              <span class="toggle-slider-small"></span>
            </label>
          </div>
        </div>
        
        <div class="notification-timing-compact">
          <div class="notification-timing-icon-compact warning">
            <i class="fa-solid fa-calendar-xmark"></i>
          </div>
          <div class="notification-timing-content-compact">
            <label class="notification-timing-label-compact">Gecikme Hatırlatması</label>
            <div class="notification-timing-input-compact">
              <input type="number" id="notifDaysAfter" min="0" max="30" value="${ayarlar.timing?.daysAfter || 0}" 
                     class="notification-number-input-compact"
                     onchange="if(window.Notification && window.Notification.ayarlariGuncelle) window.Notification.ayarlariGuncelle({timing: {daysAfter: parseInt(this.value) || 0}});">
              <span class="notification-timing-unit-compact">gün</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Aktif view'u getir
 * @returns Aktif view ID
 */
function aktifViewGetir(): string {
  return state.aktifView;
}

/**
 * Uygulama yüklendi mi?
 * @returns boolean
 */
function yuklendiMi(): boolean {
  return state.yuklendi;
}

function loginFlowHooks(): LoginFlowHooks {
  return {
    navigasyonEventleri,
    modulleriBaslat,
    viewGoster,
    navIndicatorGuncelle,
    kullaniciBilgileriniGoster,
    rolBazliMenuGizle,
    setYuklendi: v => {
      state.yuklendi = v;
    },
  };
}

// ========== MAIN INITIALIZATION ==========

/**
 * Uygulamayı başlat
 */
export async function init(): Promise<void> {
  await bootstrapApp({
    loginFlowHooks,
    navigasyonEventleri,
    rolBazliMenuGizle,
    kullaniciBilgileriniGoster,
    viewGoster,
    setYuklendi: v => {
      state.yuklendi = v;
    },
  });
}

// ========== EXPORTS ==========

// Public API
export const App = {
  init,
  viewGoster,
  tumunuGuncelle,
  aktifViewGetir,
  yuklendiMi,
  hatirlatmaAyarlariGoster,
  rolBazliMenuGizle,
  kullaniciBilgileriniGoster,
  toggleMobileMenu,
  openMobileMenu,
  closeMobileMenu,
  toggleDesktopSidebar,
  masaustuSidebarYonetimi,
  isMobile,
};

/**
 * Modülleri window'a expose et (backward compatibility için)
 */
export function exposeModulesToWindow(): void {
  if (typeof window !== 'undefined') {
    // Set modules on window for backward compatibility
    // Use type assertion to avoid conflicts with existing interface definitions
    (window as any).Storage = Storage;
    (window as any).Auth = Auth;
    (window as any).Helpers = Helpers;

    // Tema yönetimi fonksiyonlarını expose et
    (window as any).temaDegistir = temaDegistir;
    (window as any).temaYonetiminiBaslat = temaYonetiminiBaslat;
    (window as any).Dashboard = Dashboard;
    const existingSporcu = (window as any).Sporcu;
    (window as any).Sporcu = {
      ...Sporcu,
      ...(existingSporcu?.kaydet && { kaydet: existingSporcu.kaydet }),
      ...(existingSporcu?.raporGoster && { raporGoster: existingSporcu.raporGoster }),
      ...(existingSporcu?.sporcuMalzemeEkleModalKapat && {
        sporcuMalzemeEkleModalKapat: existingSporcu.sporcuMalzemeEkleModalKapat,
      }),
      ...(existingSporcu?.sporcuMalzemeKaydet && {
        sporcuMalzemeKaydet: existingSporcu.sporcuMalzemeKaydet,
      }),
    };
    // Aidat modülünü expose et - butonlar window.Aidat.odemeModalAc() şeklinde çağırıyor
    // Hem modül yüklendiğinde hem de burada expose ediyoruz (güvenlik için)
    (window as any).Aidat = {
      init: Aidat.init,
      listeyiGuncelle: Aidat.listeyiGuncelle,
      hizliFiltrele: Aidat.hizliFiltrele,
      filtreSifirla: Aidat.filtreSifirla,
      odemeModalAc: Aidat.odemeModalAc,
      gecmisModalAc: Aidat.gecmisModalAc,
      donemRaporu: Aidat.donemRaporu,
      takvimiOlustur: Aidat.takvimiOlustur,
      aylikOzetOlustur: Aidat.aylikOzetOlustur,
      monthlyListToggle: Aidat.monthlyListToggle,
      monthlyTabSwitch: Aidat.monthlyTabSwitch,
      monthlySearchFilter: Aidat.monthlySearchFilter,
      monthlyDebtFilter: Aidat.monthlyDebtFilter,
      monthlyPaidFilter: Aidat.monthlyPaidFilter,
      gunSecildi: Aidat.gunSecildi,
      smsGonderTekil: Aidat.smsGonderTekil,
      topluSmsGonder: Aidat.topluSmsGonder,
      gunDetaylariKapat: Aidat.gunDetaylariKapat,
    };
    (window as any).Yoklama = Yoklama;
    (window as any).Gider = Gider;
    (window as any).Antrenor = Antrenor;
    (window as any).Rapor = Rapor;
    (window as any).Ayarlar = Ayarlar;
    (window as any).KullaniciYonetimi = KullaniciYonetimi;
    (window as any).Notification = Notification;
    window.App = App;
  }
}

// Logo yükleme hatalarını kontrol et ve düzelt (HTML'de onerror handler kullanılıyor)
