import * as Helpers from '../utils/helpers';

/**
 * Malzeme modal event listener'larını bağla (merkezi - bir kez)
 */
export function malzemeModalEventleriniBagla(): void {
  if ((document as any).__soybis_malzeme_modal_listener_eklendi) {
    return;
  }

  const modalClickHandler = (e: Event) => {
    const target = e.target as HTMLElement;

    const malzemeModal = Helpers.$('#malzemeEkleModal');
    if (!malzemeModal) return;

    if (!malzemeModal.contains(target)) {
      return;
    }

    const button = target.closest('button') as HTMLButtonElement | null;
    const buttonId = button?.id || target.id;

    if (
      buttonId === 'malzemeModalKapat' ||
      buttonId === 'malzemeIptal' ||
      target.id === 'malzemeModalKapat' ||
      target.id === 'malzemeIptal'
    ) {
      e.preventDefault();
      e.stopPropagation();

      const context = malzemeModal.getAttribute('data-modal-context');

      if (context === 'dashboard') {
        if (
          window.Dashboard &&
          typeof (window.Dashboard as any).malzemeModalKapatF === 'function'
        ) {
          (window.Dashboard as any).malzemeModalKapatF();
        }
      } else if (context === 'sporcu-kayit') {
        if (
          window.Sporcu &&
          typeof (window.Sporcu as any).sporcuMalzemeEkleModalKapat === 'function'
        ) {
          (window.Sporcu as any).sporcuMalzemeEkleModalKapat();
        }
      }

      malzemeModal.removeAttribute('data-modal-context');
      return;
    }

    if (buttonId === 'malzemeEkleKaydet' || target.id === 'malzemeEkleKaydet') {
      e.preventDefault();
      e.stopPropagation();

      const context = malzemeModal.getAttribute('data-modal-context');

      if (context === 'dashboard') {
        if (window.Dashboard && typeof (window.Dashboard as any).malzemeKaydet === 'function') {
          (window.Dashboard as any).malzemeKaydet();
        }
      } else if (context === 'sporcu-kayit') {
        if (window.Sporcu && typeof (window.Sporcu as any).sporcuMalzemeKaydet === 'function') {
          (window.Sporcu as any).sporcuMalzemeKaydet();
        }
      }
      return;
    }

    if (target === malzemeModal) {
      e.preventDefault();
      e.stopPropagation();

      const context = malzemeModal.getAttribute('data-modal-context');

      if (context === 'dashboard') {
        if (
          window.Dashboard &&
          typeof (window.Dashboard as any).malzemeModalKapatF === 'function'
        ) {
          (window.Dashboard as any).malzemeModalKapatF();
        }
      } else if (context === 'sporcu-kayit') {
        if (
          window.Sporcu &&
          typeof (window.Sporcu as any).sporcuMalzemeEkleModalKapat === 'function'
        ) {
          (window.Sporcu as any).sporcuMalzemeEkleModalKapat();
        }
      }

      malzemeModal.removeAttribute('data-modal-context');
      return;
    }
  };

  document.addEventListener('click', modalClickHandler);
  (document as any).__soybis_malzeme_modal_listener_eklendi = true;
  (document as any).__soybis_malzeme_modal_listener = modalClickHandler;

  const inputHandler = (e: Event) => {
    const target = e.target as HTMLElement;
    if (target.id === 'malzemeTutar' && target instanceof HTMLInputElement) {
      Helpers.paraFormatInput(target);
    }
  };

  document.addEventListener('input', inputHandler);
  (document as any).__soybis_malzeme_input_listener = inputHandler;
}
