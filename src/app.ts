/**
 * SOY-BIS - Ana Uygulama Dosyası (app.ts)
 * Tüm modülleri birleştirir ve uygulamayı başlatır - TypeScript Version
 * Versiyon: 3.0.0
 */

import * as Helpers from './utils/helpers';
import * as Storage from './utils/storage';
import * as Auth from './utils/auth';
import type { UserRole } from './types';

import { isMobile } from './utils/responsiveLayout';
import { canAccessView } from './app/viewAccess';
import { aramaKutulariniTemizle, formInputlariniTemizle } from './utils/appFormCleanup';
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
import { hatirlatmaAyarlariGoster } from './app/appNotificationSettingsUi';
import { attachModulesToWindow } from './app/appWindowExpose';

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
  attachModulesToWindow(App);
}

// Logo yükleme hatalarını kontrol et ve düzelt (HTML'de onerror handler kullanılıyor)
