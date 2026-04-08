/**
 * Tam index.html kabuğu (sidebar + nav) DOM'a bağlanana kadar bekler.
 * Yanlış sayfa / erken init / önizleme ortamlarında modüller boş document ile çalışmasın.
 */

const SHELL_PROBE_MS = 50;
const SHELL_MAX_WAIT_MS = 20000;

/** id silinmiş / farklı şablon olsa bile sidebar içindeki nav’u bul */
export function resolveMainNavEl(): HTMLElement | null {
  return (
    document.getElementById('mainNav') ??
    document.querySelector<HTMLElement>('aside#sidebar nav.nav') ??
    null
  );
}

function appShellPresent(): boolean {
  return (
    !!resolveMainNavEl() &&
    !!document.getElementById('sidebar') &&
    !!document.querySelector('.app-container')
  );
}

/**
 * Kabuk hazır olunca `onReady` çağrılır; süre aşımında tek bir hata mesajı ve `onTimeout`.
 */
export function whenAppShellReady(onReady: () => void, onTimeout?: () => void): void {
  if (typeof document === 'undefined') {
    return;
  }

  if (appShellPresent()) {
    queueMicrotask(onReady);
    return;
  }

  const t0 = performance.now();
  let stopped = false;

  const tryLater = (): void => {
    if (stopped) return;
    if (appShellPresent()) {
      stopped = true;
      onReady();
      return;
    }
    if (performance.now() - t0 >= SHELL_MAX_WAIT_MS) {
      stopped = true;
      console.error(
        '[SOY-BIS] Ana kabuk bulunamadı (#mainNav, #sidebar, .app-container). ' +
          'Uygulama yalnızca proje kökündeki index.html üzerinden çalışır: `npm run dev` ile açın (ör. http://localhost:3000). ' +
          'Doğrudan .ts dosyası veya eksik HTML ile bu öğeler yüklenmez.'
      );
      try {
        const b = document.body;
        console.info('[SOY-BIS] Teşhis:', {
          readyState: document.readyState,
          bodyChildren: b ? b.children.length : 0,
          hasLoginForm: !!document.getElementById('loginForm'),
        });
      } catch {
        /* ignore */
      }
      onTimeout?.();
      return;
    }
    window.setTimeout(tryLater, SHELL_PROBE_MS);
  };

  console.warn('[SOY-BIS] Kabuk henüz yok; kısa süre bekleniyor…');

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => tryLater(), { once: true });
  } else {
    tryLater();
  }
}
