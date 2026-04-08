import * as Helpers from './helpers';

/**
 * Tüm arama kutularını temizle
 */
export function aramaKutulariniTemizle(): void {
  const searchBox = Helpers.$('#searchBox') as HTMLInputElement | null;
  if (searchBox) {
    searchBox.value = '';
  }

  const aidatArama = Helpers.$('#aidatArama') as HTMLInputElement | null;
  if (aidatArama) {
    aidatArama.value = '';
  }

  document
    .querySelectorAll('.search-box, input[type="search"], input[placeholder*="ara" i]')
    .forEach(input => {
      const htmlInput = input as HTMLInputElement;
      if (htmlInput.id !== 'searchBox' && htmlInput.id !== 'aidatArama') {
        htmlInput.value = '';
      }
    });
}

/**
 * Tüm form input'larını temizle (validation class'ları dahil)
 */
export function formInputlariniTemizle(): void {
  try {
    const forms = document.querySelectorAll('form');

    forms.forEach(form => {
      try {
        const isSearchForm =
          form.classList.contains('search-form') ||
          form.id === 'searchForm' ||
          form.querySelector('input[type="search"]');

        if (!isSearchForm) {
          form.reset();
        }
      } catch (e) {
        console.warn('Form reset hatası:', e);
      }
    });

    const inputs = document.querySelectorAll('input, select, textarea');
    if (!inputs || inputs.length === 0) return;

    inputs.forEach(input => {
      try {
        const htmlInput = input as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
        const isSearchBox =
          htmlInput.classList.contains('search-box') ||
          htmlInput.id === 'searchBox' ||
          htmlInput.id === 'aidatArama' ||
          (htmlInput instanceof HTMLInputElement && htmlInput.type === 'search');

        if (!isSearchBox && htmlInput.id) {
          htmlInput.classList.remove('validated-success', 'error');

          const errorEl = document.getElementById(htmlInput.id + 'Error');
          if (errorEl) {
            errorEl.textContent = '';
          }
        }
      } catch (e) {
        console.warn('Input temizleme hatası (tek eleman):', e);
      }
    });
  } catch (e) {
    console.warn('Form input temizleme hatası:', e);
  }
}
