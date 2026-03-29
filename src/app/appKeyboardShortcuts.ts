import * as Helpers from '../utils/helpers';

/**
 * Keyboard shortcuts (viewGoster dışarıdan verilir — döngüsel import önlenir)
 */
export function klavyeKisayollari(
  viewGoster: (viewId: string, ilkBaslatma?: boolean) => void
): void {
  document.addEventListener('keydown', function (e: KeyboardEvent) {
    const activeModal = document.querySelector('.modal.active');
    if (activeModal) {
      if (e.key === 'Escape') {
        const closeBtn = activeModal.querySelector('.modal-close');
        if (closeBtn) (closeBtn as HTMLElement).click();
      }
      return;
    }

    const target = e.target as HTMLElement;
    const isInput =
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable;

    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      const activeForm = document.querySelector('form:not([style*="display: none"])');
      if (activeForm) {
        const submitBtn = activeForm.querySelector('button[type="submit"]');
        if (submitBtn && !(submitBtn as HTMLButtonElement).disabled) {
          (submitBtn as HTMLElement).click();
          Helpers.toast('Form kaydediliyor...', 'info');
        }
      }
      return;
    }

    if (isInput) return;

    if (e.key >= '1' && e.key <= '9' && !e.ctrlKey && !e.altKey) {
      const navButtons = Helpers.$$('#mainNav button');
      const index = parseInt(e.key, 10) - 1;
      if (navButtons[index]) {
        (navButtons[index] as HTMLElement).click();
      }
    }

    if (e.key === 'g' || e.key === 'G') {
      if (!e.ctrlKey && !e.altKey) {
        viewGoster('dashboard');
      }
    }

    if ((e.ctrlKey && e.key === 'k') || e.key === '/') {
      e.preventDefault();
      const searchBox = document.querySelector('.search-box, #searchBox, #aidatArama');
      if (searchBox) {
        (searchBox as HTMLElement).focus();
        if (searchBox instanceof HTMLInputElement) {
          searchBox.select();
        }
      }
    }
  });
}
