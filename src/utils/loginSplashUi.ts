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
      splash.classList.add('hidden');
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
  }
  const appContainer = Helpers.$('.app-container');
  if (appContainer) {
    (appContainer as HTMLElement).style.display = 'none';
  }
  const splash = Helpers.$('#splashScreen');
  if (splash) {
    (splash as HTMLElement).style.display = 'none';
    splash.classList.add('hidden');
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
    (appContainer as HTMLElement).style.display = 'flex';
  }
}
