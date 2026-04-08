import * as Helpers from '../utils/helpers';
import * as Auth from '../utils/auth';
import * as Storage from '../utils/storage';
import type { UserRole } from '../types';
import { loginOverlayGizle, splashScreenGoster, splashScreenKapat } from '../utils/loginSplashUi';
import { tarihiGuncelle } from '../utils/appHeaderDate';
import { ayarlarEventleri } from './appSettingsEvents';
import { klavyeKisayollari } from './appKeyboardShortcuts';
import { hamburgerMenuEventleri } from './appMobileNav';
import { temaYonetiminiBaslat } from './appTheme';
import { masaustuSidebarYonetimi } from './appDesktopSidebar';
import { bindViewportResizeHandler } from '../utils/responsiveLayout';

/** app.ts içindeki navigasyon / view / state ile köprü — döngüsel import önlenir */
export interface LoginFlowHooks {
  navigasyonEventleri: () => void;
  modulleriBaslat: () => void;
  viewGoster: (viewId: string, ilkBaslatma?: boolean) => void;
  navIndicatorGuncelle: (viewId: string) => void;
  kullaniciBilgileriniGoster: () => void;
  rolBazliMenuGizle: () => void;
  setYuklendi: (value: boolean) => void;
}

/**
 * Login form eventlerini bağla
 */
export function loginEventleri(hooks: LoginFlowHooks): void {
  const loginForm = Helpers.$('#loginForm');
  if (!loginForm) {
    console.error('Login form bulunamadı!');
    return;
  }

  const newLoginForm = loginForm.cloneNode(true) as HTMLFormElement;
  if (loginForm.parentNode) {
    loginForm.parentNode.replaceChild(newLoginForm, loginForm);
  }

  newLoginForm.addEventListener('submit', async function (e: Event) {
    e.preventDefault();

    const kullaniciAdiInput = Helpers.$('#loginKullaniciAdi') as HTMLInputElement | null;
    const sifreInput = Helpers.$('#loginSifre') as HTMLInputElement | null;

    const kullaniciAdi = kullaniciAdiInput?.value.trim() || '';
    const sifre = sifreInput?.value || '';

    const errorDiv = Helpers.$('#loginError');
    const errorText = Helpers.$('#loginErrorText');

    if (errorDiv) (errorDiv as HTMLElement).style.display = 'none';

    if (!kullaniciAdi || !sifre) {
      if (errorDiv && errorText) {
        errorText.textContent = 'Lütfen kullanıcı adı ve şifre girin!';
        (errorDiv as HTMLElement).style.display = 'flex';
      }
      return;
    }

    const kullanici = await Auth.girisYap(kullaniciAdi, sifre);

    if (!kullanici) {
      if (errorDiv && errorText) {
        errorText.textContent = Auth.sonGirisUyariMetni() || 'Kullanıcı adı veya şifre hatalı.';
        (errorDiv as HTMLElement).style.display = 'flex';
      }
      if (sifreInput) sifreInput.value = '';
      return;
    }

    loginOverlayGizle();
    splashScreenGoster();

    const appContainer0 = Helpers.$('.app-container');
    if (appContainer0) {
      appContainer0.classList.add('app-container--prelogin');
    }

    hooks.kullaniciBilgileriniGoster();
    hooks.rolBazliMenuGizle();

    try {
      if (
        typeof window !== 'undefined' &&
        window.Storage &&
        typeof Storage.veriMigration === 'function'
      ) {
        Storage.veriMigration();
      }

      tarihiGuncelle();

      hooks.navigasyonEventleri();

      hooks.modulleriBaslat();

      ayarlarEventleri();

      klavyeKisayollari(hooks.viewGoster);

      hamburgerMenuEventleri();

      const kullaniciRolu = kullanici.rol as UserRole;
      let varsayilanView = 'dashboard';
      if (kullaniciRolu === 'Antrenör') {
        varsayilanView = 'sporcu-listesi';
      } else if (kullaniciRolu === 'Muhasebe') {
        varsayilanView = 'dashboard';
      } else {
        varsayilanView = 'dashboard';
      }

      hooks.viewGoster(varsayilanView, true);

      setTimeout(() => {
        hooks.navIndicatorGuncelle(varsayilanView);
      }, 100);

      hooks.setYuklendi(true);

      splashScreenKapat();
      setTimeout(() => {
        const appContainer = Helpers.$('.app-container');
        if (appContainer) {
          appContainer.classList.remove('app-container--prelogin');

          setTimeout(() => {
            temaYonetiminiBaslat();

            if (typeof window !== 'undefined') {
              if (window.innerWidth >= 769) {
                try {
                  masaustuSidebarYonetimi();
                } catch (err) {
                  console.warn('Masaüstü sidebar yönetimi hatası:', err);
                }
              }
              try {
                bindViewportResizeHandler();
              } catch (err) {
                console.warn('Viewport resize bağlama hatası:', err);
              }
            }
          }, 100);
        }
      }, 1800);
    } catch (error) {
      console.error('Uygulama başlatma hatası:', error);
      Helpers.toast('Uygulama başlatılırken hata oluştu!', 'error');
      const appContainer = Helpers.$('.app-container');
      if (appContainer) {
        appContainer.classList.remove('app-container--prelogin');
      }
      splashScreenKapat();
    }
  });
}
