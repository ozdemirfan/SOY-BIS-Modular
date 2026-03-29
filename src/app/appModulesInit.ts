import * as Dashboard from '../modules/dashboard';
import * as Sporcu from '../modules/sporcu';
import * as Aidat from '../modules/aidat';
import * as Yoklama from '../modules/yoklama';
import * as Gider from '../modules/gider';
import * as Antrenor from '../modules/antrenor';
import * as Rapor from '../modules/rapor';
import * as KullaniciYonetimi from '../modules/kullanici-yonetimi';
import * as Notification from '../modules/notification';

/**
 * Tüm feature modüllerinin init çağrıları (window üzerinden expose edilmiş modüller)
 */
export function modulleriBaslat(): void {
  try {
    if (typeof window !== 'undefined' && window.Dashboard && typeof Dashboard.init === 'function') {
      Dashboard.init();
    }
  } catch (e) {
    console.warn('Dashboard init hatası:', e);
  }

  try {
    if (typeof window !== 'undefined' && window.Sporcu && typeof Sporcu.init === 'function') {
      Sporcu.init();
    }
  } catch (e) {
    console.warn('Sporcu init hatası:', e);
  }

  try {
    if (typeof window !== 'undefined' && window.Aidat && typeof Aidat.init === 'function') {
      Aidat.init();
    }
  } catch (e) {
    console.warn('Aidat init hatası:', e);
  }

  try {
    if (typeof window !== 'undefined' && window.Yoklama && typeof Yoklama.init === 'function') {
      Yoklama.init();
    }
  } catch (e) {
    console.warn('Yoklama init hatası:', e);
  }

  try {
    if (typeof window !== 'undefined' && window.Gider && typeof Gider.init === 'function') {
      Gider.init();
    }
  } catch (e) {
    console.warn('Gider init hatası:', e);
  }

  try {
    if (typeof window !== 'undefined' && window.Antrenor && typeof Antrenor.init === 'function') {
      Antrenor.init();
    }
  } catch (e) {
    console.warn('Antrenor init hatası:', e);
  }

  try {
    if (typeof window !== 'undefined' && window.Rapor && typeof Rapor.init === 'function') {
      Rapor.init();
    }
  } catch (e) {
    console.warn('Rapor init hatası:', e);
  }

  try {
    if (
      typeof window !== 'undefined' &&
      window.Notification &&
      typeof Notification.init === 'function'
    ) {
      Notification.init();
    }
  } catch (e) {
    console.warn('Notification init hatası:', e);
  }

  try {
    const w = window as unknown as { Ayarlar?: { init?: () => void } };
    if (typeof window !== 'undefined' && w.Ayarlar && typeof w.Ayarlar.init === 'function') {
      w.Ayarlar.init();
    }
  } catch (e) {
    console.warn('Ayarlar init hatası:', e);
  }

  try {
    if (
      typeof window !== 'undefined' &&
      window.KullaniciYonetimi &&
      typeof KullaniciYonetimi.init === 'function'
    ) {
      KullaniciYonetimi.init();
    }
  } catch (e) {
    console.warn('Kullanıcı Yönetimi init hatası:', e);
  }
}

/**
 * Liste / özet ekranlarını toplu yenile
 */
export function tumunuGuncelle(): void {
  if (typeof window !== 'undefined') {
    if (window.Dashboard && typeof Dashboard.guncelle === 'function') Dashboard.guncelle();
    if (window.Sporcu && typeof Sporcu.listeyiGuncelle === 'function') Sporcu.listeyiGuncelle();
    if (window.Aidat && typeof Aidat.listeyiGuncelle === 'function') Aidat.listeyiGuncelle();
    if (window.Yoklama && typeof Yoklama.listeyiGuncelle === 'function') Yoklama.listeyiGuncelle();
    if (window.Gider && typeof Gider.listeyiGuncelle === 'function') Gider.listeyiGuncelle();
    if (window.Rapor && typeof Rapor.guncelle === 'function') Rapor.guncelle();
  }
}
