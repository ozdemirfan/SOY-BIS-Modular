/**
 * SOY-BIS - Ana Uygulama Dosyası (app.ts)
 * Tüm modülleri birleştirir ve uygulamayı başlatır - TypeScript Version
 * Versiyon: 3.0.0
 */

import * as Helpers from './utils/helpers';
import * as Storage from './utils/storage';
import * as Auth from './utils/auth';
import { isMobile } from './utils/responsiveLayout';
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
import { navigasyonEventleriBagla } from './app/appNavEvents';
import { kullaniciBilgileriniGoster, rolBazliMenuGizle } from './app/appUserRbac';
import { antrenmanGruplariPaneliniGuncelle, grupAtamaPaneliniGuncelle } from './modules/ayarlar';

export { toggleMobileMenu, openMobileMenu, closeMobileMenu };
export { masaustuSidebarYonetimi, toggleDesktopSidebar };
export { navIndicatorGuncelle };
export { rolBazliMenuGizle };

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

function navigasyonEventleri(): void {
  navigasyonEventleriBagla(viewGoster);
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
// kullaniciBilgileriniGoster / rolBazliMenuGizle → app/appUserRbac

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

  antrenmanGruplariPaneliniGuncelle();
  grupAtamaPaneliniGuncelle();
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
