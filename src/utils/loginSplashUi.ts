import * as Helpers from './helpers';

/**
 * Splash screen'i göster
 */
export function splashScreenGoster(): void {
  const splash = document.getElementById('splashScreen');
  if (splash) {
    splash.classList.remove('hidden');
    (splash as HTMLElement).style.display = 'flex';
    (splash as HTMLElement).style.setProperty('display', 'flex', 'important');
  }
}

/**
 * Splash screen'i kapat
 */
export function splashScreenKapat(): void {
  const splash = document.getElementById('splashScreen');
  if (splash) {
    setTimeout(() => {
      const el = splash as HTMLElement;
      el.classList.add('hidden');
      /* splashScreenGoster() display:flex !important bırakıyor; kaldırılmazsa gizleme uygulanmaz */
      el.style.removeProperty('display');
      el.style.setProperty('display', 'none', 'important');
      setTimeout(() => {
        splash.remove();
      }, 500);
    }, 1800);
  }
}

/**
 * Login overlay'i göster
 */
export function loginOverlayGoster(): void {
  const overlay = Helpers.$('#loginOverlay');
  if (overlay) {
    overlay.classList.remove('hidden');
    (overlay as HTMLElement).style.display = 'flex';
    (overlay as HTMLElement).style.setProperty('display', 'flex', 'important');

    const loginLogo = overlay.querySelector('.login-logo') as HTMLImageElement;
    if (loginLogo) {
      loginLogo.style.display = '';
    }

    // Klavye akışı: overlay görünür olduktan sonra ilk input'a focus
    const odakla = (): void => {
      const kullaniciAdiInput = overlay.querySelector(
        '#loginKullaniciAdi'
      ) as HTMLInputElement | null;
      if (kullaniciAdiInput) {
        kullaniciAdiInput.focus();
        kullaniciAdiInput.select();
      }
    };

    requestAnimationFrame(() => {
      odakla();
      setTimeout(odakla, 30);
    });
  }
  const appContainer = Helpers.$('.app-container');
  if (appContainer) {
    appContainer.classList.add('app-container--prelogin');
  }
  const splash = Helpers.$('#splashScreen');
  if (splash) {
    const s = splash as HTMLElement;
    s.style.removeProperty('display');
    s.classList.add('hidden');
    s.style.setProperty('display', 'none', 'important');
  }
}

/**
 * Login overlay'i gizle
 */
export function loginOverlayGizle(): void {
  const overlay = Helpers.$('#loginOverlay');
  if (overlay) {
    overlay.classList.add('hidden');
    (overlay as HTMLElement).style.display = 'none';
    (overlay as HTMLElement).style.setProperty('display', 'none', 'important');

    const loginLogo = overlay.querySelector('.login-logo') as HTMLImageElement;
    if (loginLogo) {
      loginLogo.style.display = 'none';
    }
  }
  const appContainer = Helpers.$('.app-container');
  if (appContainer) {
    appContainer.classList.remove('app-container--prelogin');
  }
}
