import { resolveMainNavEl } from './appShellReady';

/**
 * Ana nav butonlarını viewGoster ile bağlar (döngüsel import önlenir)
 * Not: `main.ts` kabuk hazır olmadan `init` çalıştırmaz; burada tekrar deneme döngüsü yok.
 */
export function navigasyonEventleriBagla(
  viewGoster: (viewId: string, ilkBaslatma?: boolean) => void
): void {
  const mainNav = resolveMainNavEl();
  if (!mainNav) {
    console.error(
      'navigasyonEventleri: Ana menü (nav) bulunamadı — tam index.html / sidebar gerekli.'
    );
    return;
  }

  const navButtons = mainNav.querySelectorAll('button');

  if (navButtons.length === 0) {
    console.warn('navigasyonEventleri: Hiç buton bulunamadı!');
    return;
  }

  navButtons.forEach(btn => {
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
