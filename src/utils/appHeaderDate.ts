import * as Helpers from './helpers';

/** Üst bardaki #nowDate alanını bugünün tarihiyle günceller */
export function tarihiGuncelle(): void {
  const tarihEl = Helpers.$('#nowDate');
  if (tarihEl) {
    tarihEl.textContent = new Date().toLocaleDateString('tr-TR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
}
