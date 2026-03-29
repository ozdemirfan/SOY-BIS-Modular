import * as Helpers from '../utils/helpers';

let themeAbortController: AbortController | null = null;

function temaIkonunuGuncelle(): void {
  const themeIcon = Helpers.$('#themeIcon');
  if (!themeIcon) return;

  const isLightMode = document.body.classList.contains('light-mode');

  if (isLightMode) {
    themeIcon.className = 'fa-solid fa-sun';
    if (themeIcon.parentElement) {
      (themeIcon.parentElement as HTMLElement).setAttribute('title', 'Koyu moda geç');
      (themeIcon.parentElement as HTMLElement).setAttribute('aria-label', 'Koyu moda geç');
    }
  } else {
    themeIcon.className = 'fa-solid fa-moon';
    if (themeIcon.parentElement) {
      (themeIcon.parentElement as HTMLElement).setAttribute('title', 'Aydınlık moda geç');
      (themeIcon.parentElement as HTMLElement).setAttribute('aria-label', 'Aydınlık moda geç');
    }
  }
}

export function temaDegistir(): void {
  const isLightMode = document.body.classList.contains('light-mode');

  if (isLightMode) {
    document.body.classList.remove('light-mode');
    localStorage.setItem('soybis_theme', 'dark');
  } else {
    document.body.classList.add('light-mode');
    localStorage.setItem('soybis_theme', 'light');
  }

  temaIkonunuGuncelle();
}

export function temaYonetiminiBaslat(): void {
  if (themeAbortController) {
    themeAbortController.abort();
  }

  themeAbortController = new AbortController();
  const signal = themeAbortController.signal;

  const kayitliTema = localStorage.getItem('soybis_theme');
  const sistemTemasi = window.matchMedia('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark';
  const tema = kayitliTema || sistemTemasi;

  if (tema === 'light') {
    document.body.classList.add('light-mode');
  } else {
    document.body.classList.remove('light-mode');
  }

  temaIkonunuGuncelle();

  const themeToggle = Helpers.$('#themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', temaDegistir, { signal });
  }

  if (!kayitliTema) {
    window.matchMedia('(prefers-color-scheme: light)').addEventListener(
      'change',
      e => {
        if (!localStorage.getItem('soybis_theme')) {
          if (e.matches) {
            document.body.classList.add('light-mode');
          } else {
            document.body.classList.remove('light-mode');
          }
          temaIkonunuGuncelle();
        }
      },
      { signal }
    );
  }
}
