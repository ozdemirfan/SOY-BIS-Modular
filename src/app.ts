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
import {
  splashScreenGoster,
  splashScreenKapat,
  loginOverlayGoster,
  loginOverlayGizle,
} from './utils/loginSplashUi';
import { canAccessView, defaultViewIdForRole } from './app/viewAccess';
import { tarihiGuncelle } from './utils/appHeaderDate';
import { aramaKutulariniTemizle, formInputlariniTemizle } from './utils/appFormCleanup';
import { temaDegistir, temaYonetiminiBaslat } from './app/appTheme';
import {
  hamburgerMenuEventleri,
  toggleMobileMenu,
  openMobileMenu,
  closeMobileMenu,
} from './app/appMobileNav';
import { masaustuSidebarYonetimi, toggleDesktopSidebar } from './app/appDesktopSidebar';
import { malzemeModalEventleriniBagla } from './app/malzemeModalBridge';
import { klavyeKisayollari } from './app/appKeyboardShortcuts';
import { ayarlarEventleri } from './app/appSettingsEvents';
import { loginEventleri, type LoginFlowHooks } from './app/appLoginFlow';
import {
  viewGoster as viewGosterCore,
  navIndicatorGuncelle,
  type ViewNavigationContext,
} from './app/appViewNavigation';

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

// ========== MODULE INITIALIZATION ==========

/**
 * Modülleri başlat
 */
function modulleriBaslat(): void {
  // Dashboard
  try {
    if (typeof window !== 'undefined' && window.Dashboard && typeof Dashboard.init === 'function') {
      Dashboard.init();
    }
  } catch (e) {
    console.warn('Dashboard init hatası:', e);
  }

  // Sporcu
  try {
    if (typeof window !== 'undefined' && window.Sporcu && typeof Sporcu.init === 'function') {
      Sporcu.init();
    }
  } catch (e) {
    console.warn('Sporcu init hatası:', e);
  }

  // Aidat
  try {
    if (typeof window !== 'undefined' && window.Aidat && typeof Aidat.init === 'function') {
      Aidat.init();
    }
  } catch (e) {
    console.warn('Aidat init hatası:', e);
  }

  // Yoklama
  try {
    if (typeof window !== 'undefined' && window.Yoklama && typeof Yoklama.init === 'function') {
      Yoklama.init();
    }
  } catch (e) {
    console.warn('Yoklama init hatası:', e);
  }

  // Gider
  try {
    if (typeof window !== 'undefined' && window.Gider && typeof Gider.init === 'function') {
      Gider.init();
    }
  } catch (e) {
    console.warn('Gider init hatası:', e);
  }

  // Antrenör
  try {
    if (typeof window !== 'undefined' && window.Antrenor && typeof Antrenor.init === 'function') {
      Antrenor.init();
    }
  } catch (e) {
    console.warn('Antrenor init hatası:', e);
  }

  // Rapor
  try {
    if (typeof window !== 'undefined' && window.Rapor && typeof Rapor.init === 'function') {
      Rapor.init();
    }
  } catch (e) {
    console.warn('Rapor init hatası:', e);
  }

  // Notification (Hatırlatma)
  try {
    if (
      typeof window !== 'undefined' &&
      window.Notification &&
      typeof Notification.init === 'function'
    ) {
      Notification.init();
    }
  } catch (e) {
    console.warn('Notification init hatası:', e);
  }

  // Ayarlar
  try {
    if (
      typeof window !== 'undefined' &&
      (window as any).Ayarlar &&
      typeof (window as any).Ayarlar.init === 'function'
    ) {
      (window as any).Ayarlar.init();
    }
  } catch (e) {
    console.warn('Ayarlar init hatası:', e);
  }

  // Kullanıcı Yönetimi
  try {
    if (
      typeof window !== 'undefined' &&
      window.KullaniciYonetimi &&
      typeof KullaniciYonetimi.init === 'function'
    ) {
      KullaniciYonetimi.init();
    }
  } catch (e) {
    console.warn('Kullanıcı Yönetimi init hatası:', e);
  }
}

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
 * Tüm modülleri güncelle
 */
function tumunuGuncelle(): void {
  if (typeof window !== 'undefined') {
    if (window.Dashboard && typeof Dashboard.guncelle === 'function') Dashboard.guncelle();
    if (window.Sporcu && typeof Sporcu.listeyiGuncelle === 'function') Sporcu.listeyiGuncelle();
    if (window.Aidat && typeof Aidat.listeyiGuncelle === 'function') Aidat.listeyiGuncelle();
    if (window.Yoklama && typeof Yoklama.listeyiGuncelle === 'function') Yoklama.listeyiGuncelle();
    if (window.Gider && typeof Gider.listeyiGuncelle === 'function') Gider.listeyiGuncelle();
    if (window.Rapor && typeof Rapor.guncelle === 'function') Rapor.guncelle();
  }
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
  // Uygulama başlatılıyor

  // Malzeme modal event listener'larını merkezi olarak bağla (bir kez)
  malzemeModalEventleriniBagla();

  // Body'ye koyu arka plan rengi ekle (CSS yüklenene kadar beyaz ekranı önle)
  if (document.body) {
    document.body.style.backgroundColor = '#0a0e27';
    document.body.style.color = '#ffffff';
    document.body.style.margin = '0';
    document.body.style.padding = '0';
  }

  // Splash screen ve login overlay'i başlangıçta gizle (sayfa yüklenirken flash etmesin)
  const splash = Helpers.$('#splashScreen');
  if (splash) {
    (splash as HTMLElement).style.display = 'none';
    splash.classList.add('hidden');
  }

  const loginOverlay = Helpers.$('#loginOverlay');
  if (loginOverlay) {
    (loginOverlay as HTMLElement).style.display = 'none';
    loginOverlay.classList.add('hidden');
  }

  // Tüm modal'ları başlangıçta gizle (CSS yüklenmeden önce görünmesin)
  const modals = document.querySelectorAll('.modal');
  modals.forEach(modal => {
    (modal as HTMLElement).style.display = 'none';
    (modal as HTMLElement).style.setProperty('display', 'none', 'important');
  });

  // Önce auth kontrolü yap
  try {
    // Sistem başlatma - varsayılan admin oluştur
    if (typeof Storage.sistemBaslat === 'function') {
      await Storage.sistemBaslat();
    }

    // Auth kontrolü
    const girisYapilmis = Auth.kontrol();

    if (!girisYapilmis) {
      // Giriş yapılmamış, login overlay'i göster (CSS yüklendikten sonra)
      requestAnimationFrame(() => {
        loginOverlayGoster();
        loginEventleri(loginFlowHooks());
      });
      return; // Uygulamayı başlatma
    }

    // Giriş yapılmış, login overlay'i kesinlikle gizle ve uygulamayı başlat
    if (loginOverlay) {
      (loginOverlay as HTMLElement).style.display = 'none';
      loginOverlay.classList.add('hidden');
      (loginOverlay as HTMLElement).style.setProperty('display', 'none', 'important');
    }

    // App container'ı göster (CSS yüklendikten sonra)
    const appContainer = Helpers.$('.app-container');
    if (appContainer) {
      // CSS'in yüklenmesini bekle
      requestAnimationFrame(() => {
        (appContainer as HTMLElement).style.display = 'flex';

        // Logo'ları göster (flash etmemesi için biraz bekle)
        setTimeout(() => {
          const sidebarLogo = Helpers.$('.sidebar-logo');
          if (sidebarLogo) {
            (sidebarLogo as HTMLImageElement).style.display = '';
          }
          const headerLogo = Helpers.$('.header-logo');
          if (headerLogo) {
            (headerLogo as HTMLImageElement).style.display = '';
          }
        }, 100);
      });
    }
    kullaniciBilgileriniGoster();
  } catch (error) {
    console.error('Auth kontrolü hatası:', error);
    loginOverlayGoster();
    loginEventleri(loginFlowHooks());
    return;
  }

  // Sayfa yenilendi (giriş yapılmış), splash screen'i tamamen kaldır
  if (splash) {
    (splash as HTMLElement).style.display = 'none';
    splash.classList.add('hidden');
    // Splash screen'i DOM'dan kaldır (flash etmemesi için)
    setTimeout(() => {
      splash.remove();
    }, 0);
  }

  // Kayıtlı view'u kontrol et (sayfa yenilendi mi?)
  const kayitliView =
    typeof localStorage !== 'undefined' ? localStorage.getItem('soybis_aktifView') : null;

  try {
    // Eski verileri migrate et
    try {
      if (
        typeof window !== 'undefined' &&
        window.Storage &&
        typeof Storage.veriMigration === 'function'
      ) {
        Storage.veriMigration();
      }
    } catch (e) {
      console.warn('Veri migration hatası:', e);
    }

    // Tarihi güncelle
    try {
      tarihiGuncelle();
    } catch (e) {
      console.warn('Tarih güncelleme hatası:', e);
    }

    // Navigasyon eventlerini bağla
    try {
      navigasyonEventleri();
    } catch (e) {
      console.warn('Navigasyon eventleri hatası:', e);
    }

    // Rol bazlı menü gizleme
    rolBazliMenuGizle();

    // Modülleri başlat
    modulleriBaslat();

    // Ayarlar eventlerini bağla
    try {
      ayarlarEventleri();
    } catch (e) {
      console.warn('Ayarlar eventleri hatası:', e);
    }

    // Keyboard shortcuts'ları bağla
    try {
      klavyeKisayollari(viewGoster);
    } catch (e) {
      console.warn('Klavye kısayolları hatası:', e);
    }

    // Tema yönetimini başlat (sayfa yenilendiğinde de çalışsın)
    try {
      temaYonetiminiBaslat();
    } catch (e) {
      console.warn('Tema yönetimi hatası:', e);
    }

    // Hamburger menü eventlerini bağla (Mobil)
    try {
      hamburgerMenuEventleri();
    } catch (e) {
      console.warn('Hamburger menü eventleri hatası:', e);
    }

    // Masaüstü sidebar yönetimi (varsayılan açık + tercih kaydı)
    if (typeof window !== 'undefined' && window.innerWidth >= 769) {
      try {
        masaustuSidebarYonetimi();
      } catch (e) {
        console.warn('Masaüstü sidebar yönetimi hatası:', e);
      }
    }

    // Son görüntülenen view'u localStorage'dan al veya rol bazlı varsayılan göster
    let sonView = kayitliView;
    if (!sonView) {
      const kullanici = Auth.aktifKullanici();
      const rol = kullanici?.rol as UserRole;
      if (rol === 'Antrenör') {
        sonView = 'sporcu-listesi'; // Antrenör için varsayılan
      } else {
        sonView = 'dashboard'; // Yönetici ve Muhasebe için varsayılan
      }
    }
    // İlk başlatmada input temizleme yapma (DOM henüz hazır olmayabilir)
    try {
      viewGoster(sonView, true); // true = ilk başlatma
    } catch (e) {
      console.warn('View gösterme hatası:', e);
    }

    // İlk indicator pozisyonunu ayarla (biraz gecikmeyle DOM'un hazır olmasını bekle)
    setTimeout(() => {
      try {
        const kullanici = Auth.aktifKullanici();
        if (!kullanici) return;
        const rol = kullanici.rol as UserRole;
        const gosterilecekView =
          sonView && canAccessView(sonView, rol) ? sonView : defaultViewIdForRole(rol);
        navIndicatorGuncelle(gosterilecekView);
      } catch (e) {
        console.warn('Nav indicator hatası:', e);
      }
    }, 100);

    state.yuklendi = true;

    // Sadece ilk yüklemede splash screen göster (yenilemede değil)
    if (!kayitliView) {
      splashScreenKapat();
    }
  } catch (error: any) {
    // Sadece kritik hatalarda toast göster
    console.error('Uygulama başlatma hatası:', error);
    // Kritik hatalar için toast göster (sadece gerçek kritik hatalarda ve Helpers yüklüyse)
    try {
      if (
        typeof window !== 'undefined' &&
        (window as any).Helpers &&
        typeof (window as any).Helpers.toast === 'function'
      ) {
        if (
          error.message &&
          !error.message.includes('Cannot read property') &&
          !error.message.includes('undefined')
        ) {
          (window as any).Helpers.toast('Uygulama başlatılırken hata oluştu!', 'error');
        }
      }
    } catch (e) {
      // Toast gösterilemezse sessizce devam et
      console.warn('Toast gösterilemedi:', e);
    }
    // Hata olsa bile splash screen'i kapat
    if (!kayitliView) {
      splashScreenKapat();
    }
  }
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
