import * as Helpers from '../utils/helpers';
import * as Storage from '../utils/storage';
import * as Auth from '../utils/auth';
import type { UserRole } from '../types';
import { splashScreenKapat, loginOverlayGoster } from '../utils/loginSplashUi';
import { tarihiGuncelle } from '../utils/appHeaderDate';
import { canAccessView, defaultViewIdForRole } from './viewAccess';
import { malzemeModalEventleriniBagla } from './malzemeModalBridge';
import { modulleriBaslat } from './appModulesInit';
import { ayarlarEventleri } from './appSettingsEvents';
import { klavyeKisayollari } from './appKeyboardShortcuts';
import { temaYonetiminiBaslat } from './appTheme';
import { hamburgerMenuEventleri } from './appMobileNav';
import { masaustuSidebarYonetimi } from './appDesktopSidebar';
import { loginEventleri, type LoginFlowHooks } from './appLoginFlow';
import { navIndicatorGuncelle } from './appViewNavigation';

/**
 * app.ts içindeki navigasyon, view ve state ile köprü — döngüsel import yok
 */
export interface AppBootstrapContext {
  loginFlowHooks: () => LoginFlowHooks;
  navigasyonEventleri: () => void;
  rolBazliMenuGizle: () => void;
  kullaniciBilgileriniGoster: () => void;
  viewGoster: (viewId: string, ilkBaslatma?: boolean) => void;
  setYuklendi: (value: boolean) => void;
}

/**
 * Giriş sonrası ana uygulama bootstrap (DOM, auth, modüller, ilk view)
 */
export async function bootstrapApp(ctx: AppBootstrapContext): Promise<void> {
  malzemeModalEventleriniBagla();

  if (document.body) {
    document.body.style.backgroundColor = '#0a0e27';
    document.body.style.color = '#ffffff';
    document.body.style.margin = '0';
    document.body.style.padding = '0';
  }

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

  const modals = document.querySelectorAll('.modal');
  modals.forEach(modal => {
    (modal as HTMLElement).style.display = 'none';
    (modal as HTMLElement).style.setProperty('display', 'none', 'important');
  });

  try {
    if (typeof Storage.sistemBaslat === 'function') {
      await Storage.sistemBaslat();
    }

    const girisYapilmis = Auth.kontrol();

    if (!girisYapilmis) {
      requestAnimationFrame(() => {
        loginOverlayGoster();
        loginEventleri(ctx.loginFlowHooks());
      });
      return;
    }

    if (loginOverlay) {
      (loginOverlay as HTMLElement).style.display = 'none';
      loginOverlay.classList.add('hidden');
      (loginOverlay as HTMLElement).style.setProperty('display', 'none', 'important');
    }

    const appContainer = Helpers.$('.app-container');
    if (appContainer) {
      requestAnimationFrame(() => {
        (appContainer as HTMLElement).style.display = 'flex';

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
    ctx.kullaniciBilgileriniGoster();
  } catch (error) {
    console.error('Auth kontrolü hatası:', error);
    loginOverlayGoster();
    loginEventleri(ctx.loginFlowHooks());
    return;
  }

  if (splash) {
    (splash as HTMLElement).style.display = 'none';
    splash.classList.add('hidden');
    setTimeout(() => {
      splash.remove();
    }, 0);
  }

  const kayitliView =
    typeof localStorage !== 'undefined' ? localStorage.getItem('soybis_aktifView') : null;

  try {
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

    try {
      tarihiGuncelle();
    } catch (e) {
      console.warn('Tarih güncelleme hatası:', e);
    }

    try {
      ctx.navigasyonEventleri();
    } catch (e) {
      console.warn('Navigasyon eventleri hatası:', e);
    }

    ctx.rolBazliMenuGizle();

    modulleriBaslat();

    try {
      ayarlarEventleri();
    } catch (e) {
      console.warn('Ayarlar eventleri hatası:', e);
    }

    try {
      klavyeKisayollari(ctx.viewGoster);
    } catch (e) {
      console.warn('Klavye kısayolları hatası:', e);
    }

    try {
      temaYonetiminiBaslat();
    } catch (e) {
      console.warn('Tema yönetimi hatası:', e);
    }

    try {
      hamburgerMenuEventleri();
    } catch (e) {
      console.warn('Hamburger menü eventleri hatası:', e);
    }

    if (typeof window !== 'undefined' && window.innerWidth >= 769) {
      try {
        masaustuSidebarYonetimi();
      } catch (e) {
        console.warn('Masaüstü sidebar yönetimi hatası:', e);
      }
    }

    let sonView: string | null = kayitliView;
    if (!sonView) {
      const kullanici = Auth.aktifKullanici();
      const rol = kullanici?.rol as UserRole;
      if (rol === 'Antrenör') {
        sonView = 'sporcu-listesi';
      } else {
        sonView = 'dashboard';
      }
    }

    try {
      ctx.viewGoster(sonView, true);
    } catch (e) {
      console.warn('View gösterme hatası:', e);
    }

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

    ctx.setYuklendi(true);

    if (!kayitliView) {
      splashScreenKapat();
    }
  } catch (error: any) {
    console.error('Uygulama başlatma hatası:', error);
    try {
      const w = window as unknown as { Helpers?: { toast?: (m: string, t: string) => void } };
      if (typeof window !== 'undefined' && w.Helpers && typeof w.Helpers.toast === 'function') {
        if (
          error.message &&
          !error.message.includes('Cannot read property') &&
          !error.message.includes('undefined')
        ) {
          w.Helpers.toast('Uygulama başlatılırken hata oluştu!', 'error');
        }
      }
    } catch (e) {
      console.warn('Toast gösterilemedi:', e);
    }
    if (!kayitliView) {
      splashScreenKapat();
    }
  }
}
