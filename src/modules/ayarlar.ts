/**
 * SOY-BIS - Ayarlar Modülü (ayarlar.ts)
 * Sistem ayarları (Hatırlatma ayarları, Başlangıç Bakiyesi vb.)
 */

import * as Storage from '../utils/storage';
import * as Helpers from '../utils/helpers';
import type { Ayarlar } from '../types';
import { STORAGE_KEYS } from '../types';

/**
 * Modülü başlat
 */
export function init(): void {
  baslangicBakiyesiFormuBaslat();
  topluZamButonuOlustur();

  setTimeout(() => topluZamButonuOlustur(), 500);
  setTimeout(() => topluZamButonuOlustur(), 1500);
}

/**
 * Başlangıç bakiyesi formunu başlat
 */
function baslangicBakiyesiFormuBaslat(): void {
  const form = Helpers.$('#baslangicBakiyesiForm') as HTMLFormElement | null;
  const nakitInput = Helpers.$('#baslangicNakit') as HTMLInputElement | null;
  const bankaInput = Helpers.$('#baslangicBanka') as HTMLInputElement | null;
  const tarihInput = Helpers.$('#baslangicBakiyeTarih') as HTMLInputElement | null;
  const kaydetBtn = Helpers.$('#baslangicBakiyeKaydet') as HTMLButtonElement | null;

  if (!form || !nakitInput || !bankaInput || !tarihInput || !kaydetBtn) {
    return;
  }

  const mevcutBakiye = baslangicBakiyesiGetir();
  if (mevcutBakiye) {
    nakitInput.value = Helpers.paraFormat(mevcutBakiye.nakit);
    bankaInput.value = Helpers.paraFormat(mevcutBakiye.banka);
    tarihInput.value = mevcutBakiye.tarih || Helpers.bugunISO();
  } else {
    tarihInput.value = Helpers.bugunISO();
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    baslangicBakiyesiKaydet();
  });

  kaydetBtn.addEventListener('click', () => {
    baslangicBakiyesiKaydet();
  });
}

/**
 * Başlangıç bakiyesi kaydet
 */
function baslangicBakiyesiKaydet(): void {
  const nakitInput = Helpers.$('#baslangicNakit') as HTMLInputElement | null;
  const bankaInput = Helpers.$('#baslangicBanka') as HTMLInputElement | null;
  const tarihInput = Helpers.$('#baslangicBakiyeTarih') as HTMLInputElement | null;

  if (!nakitInput || !bankaInput || !tarihInput) {
    Helpers.toast('Form alanları bulunamadı!', 'error');
    return;
  }

  const nakit = Helpers.paraCoz(nakitInput.value);
  const banka = Helpers.paraCoz(bankaInput.value);
  const tarih = tarihInput.value;

  if (nakit < 0 || banka < 0) {
    Helpers.toast('Bakiye değerleri negatif olamaz!', 'error');
    return;
  }

  const bakiyeler = { nakit, banka, tarih };

  Storage.kaydet(STORAGE_KEYS.BASLANGIC_BAKIYESI, bakiyeler);

  const ayarlar = Storage.oku<Ayarlar>(STORAGE_KEYS.AYARLAR, {});
  ayarlar.baslangicBakiyesi = bakiyeler;
  Storage.kaydet(STORAGE_KEYS.AYARLAR, ayarlar);

  Helpers.toast(
    `Başlangıç bakiyesi kaydedildi! Nakit: ${Helpers.paraFormat(nakit)} TL, Banka: ${Helpers.paraFormat(banka)} TL`,
    'success'
  );

  if (window.App && typeof window.App.viewGoster === 'function') {
    const dashboardView = Helpers.$('#dashboard');
    if (dashboardView && dashboardView.style.display !== 'none') {
      const Dashboard = (window as any).Dashboard;
      if (Dashboard && typeof Dashboard.init === 'function') {
        Dashboard.init();
      }
    }
  }
}

/**
 * Başlangıç bakiyesi getir
 */
export function baslangicBakiyesiGetir(): { nakit: number; banka: number; tarih: string } | null {
  const bakiyeler = Storage.oku<{ nakit: number; banka: number; tarih: string }>(
    STORAGE_KEYS.BASLANGIC_BAKIYESI,
    { nakit: 0, banka: 0, tarih: Helpers.bugunISO() }
  );

  if (!bakiyeler || (bakiyeler.nakit === 0 && bakiyeler.banka === 0)) {
    const ayarlar = Storage.oku<Ayarlar>(STORAGE_KEYS.AYARLAR, {});
    if (ayarlar.baslangicBakiyesi) {
      return ayarlar.baslangicBakiyesi;
    }
  }

  return bakiyeler && bakiyeler.nakit === 0 && bakiyeler.banka === 0 ? null : bakiyeler;
}

/**
 * Ayarlar container'ını bul
 */
function ayarlarContainerBul(): HTMLElement {
  let container: HTMLElement | null = Helpers.$('#ayarlar');

  if (!container) {
    container = document.querySelector('[data-view="ayarlar"]') as HTMLElement | null;
  }
  if (!container) {
    container = document.querySelector('.ayarlar-container') as HTMLElement | null;
  }
  if (!container) {
    const yedekleBtn = Helpers.$('#yedekleBtn') as HTMLElement | null;
    if (yedekleBtn?.parentElement) {
      container = yedekleBtn.parentElement as HTMLElement;
    }
  }
  if (!container) {
    const geriYukleBtn = Helpers.$('#geriYukleBtn') as HTMLElement | null;
    if (geriYukleBtn?.parentElement) {
      container = geriYukleBtn.parentElement as HTMLElement;
    }
  }
  if (!container) {
    const viewContainers = document.querySelectorAll('[data-view]');
    viewContainers.forEach(viewContainer => {
      if (
        viewContainer.querySelector('#yedekleBtn') ||
        viewContainer.querySelector('#geriYukleBtn')
      ) {
        container = viewContainer as HTMLElement;
      }
    });
  }

  return container || document.body;
}

/**
 * Fixed pozisyon stilleri (Profesyonel tasarım)
 */
const FIXED_BUTON_STYLES = `
  position: fixed !important;
  top: 10px !important;
  left: 10px !important;
  z-index: 9999999 !important;
  max-width: 380px !important;
  box-shadow: 0 8px 24px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08) !important;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
  border: none !important;
  border-radius: 16px !important;
  padding: 0 !important;
  margin-bottom: 0 !important;
  overflow: hidden !important;
  transition: transform 0.3s ease, box-shadow 0.3s ease !important;
`;

/**
 * Normal buton wrapper stilleri (Profesyonel tasarım)
 */
const NORMAL_BUTON_STYLES = `
  padding: 0 !important;
  border: none !important;
  margin-bottom: 24px !important;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
  border-radius: 16px !important;
  display: block !important;
  visibility: visible !important;
  opacity: 1 !important;
  position: relative !important;
  box-shadow: 0 8px 24px rgba(102, 126, 234, 0.25), 0 2px 8px rgba(118, 75, 162, 0.15) !important;
  overflow: hidden !important;
  transition: transform 0.3s ease, box-shadow 0.3s ease !important;
`;

/**
 * Toplu zam butonunu ayarlar sayfasına ekle
 */
export function topluZamButonuOlustur(): void {
  const mevcutButon = Helpers.$('#topluZamBtn') as HTMLElement | null;
  if (mevcutButon && document.body.contains(mevcutButon)) {
    return;
  }

  if (mevcutButon) {
    mevcutButon.remove();
  }
  const eskiWrapper = Helpers.$('#topluZamSettingItem');
  if (eskiWrapper) {
    eskiWrapper.remove();
  }

  const ayarlarContainer = ayarlarContainerBul();

  const butonWrapper = document.createElement('div');
  butonWrapper.className = 'setting-item';
  butonWrapper.id = 'topluZamSettingItem';
  butonWrapper.style.cssText = NORMAL_BUTON_STYLES;

  // Hover efekti
  butonWrapper.addEventListener('mouseenter', () => {
    butonWrapper.style.transform = 'translateY(-2px)';
    butonWrapper.style.boxShadow =
      '0 12px 32px rgba(102, 126, 234, 0.35), 0 4px 12px rgba(118, 75, 162, 0.2)';
  });
  butonWrapper.addEventListener('mouseleave', () => {
    butonWrapper.style.transform = 'translateY(0)';
    butonWrapper.style.boxShadow = '';
  });

  // İçerik wrapper (beyaz arka plan)
  const icerikWrapper = document.createElement('div');
  icerikWrapper.style.cssText = `
    background: rgba(255, 255, 255, 0.98) !important;
    margin: 3px !important;
    border-radius: 13px !important;
    padding: 24px !important;
    position: relative !important;
    overflow: hidden !important;
  `;

  // Dekoratif ikon arka planı
  const dekoratifIkon = document.createElement('div');
  dekoratifIkon.style.cssText = `
    position: absolute !important;
    top: -20px !important;
    right: -20px !important;
    width: 120px !important;
    height: 120px !important;
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%) !important;
    border-radius: 50% !important;
    opacity: 0.6 !important;
    pointer-events: none !important;
  `;
  icerikWrapper.appendChild(dekoratifIkon);

  // Başlık container
  const baslikContainer = document.createElement('div');
  baslikContainer.style.cssText = `
    display: flex !important;
    align-items: center !important;
    margin-bottom: 12px !important;
    position: relative !important;
    z-index: 1 !important;
  `;

  // İkon
  const ikon = document.createElement('div');
  ikon.style.cssText = `
    width: 48px !important;
    height: 48px !important;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
    border-radius: 12px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    margin-right: 16px !important;
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3) !important;
  `;
  ikon.innerHTML = '<i class="fa-solid fa-percent" style="color: #ffffff; font-size: 20px;"></i>';

  // Başlık
  const butonLabel = document.createElement('label');
  butonLabel.style.cssText = `
    display: block !important;
    font-weight: 700 !important;
    font-size: 18px !important;
    color: #1a202c !important;
    margin: 0 !important;
    line-height: 1.3 !important;
  `;
  butonLabel.textContent = 'Toplu Zam İşlemleri';

  baslikContainer.appendChild(ikon);
  baslikContainer.appendChild(butonLabel);

  // Açıklama
  const butonDescription = document.createElement('p');
  butonDescription.style.cssText = `
    margin: 0 0 20px 0 !important;
    color: #4a5568 !important;
    font-size: 14px !important;
    line-height: 1.6 !important;
    position: relative !important;
    z-index: 1 !important;
  `;
  butonDescription.textContent =
    'Tüm sporculara veya seçili filtreye göre toplu zam yapabilirsiniz. Sabit tutar, yüzdelik veya enflasyon bazlı zam seçenekleri mevcuttur.';

  // Buton
  const buton = document.createElement('button');
  buton.id = 'topluZamBtn';
  buton.type = 'button';
  buton.innerHTML = '<i class="fa-solid fa-arrow-right" style="margin-left: 8px;"></i> Zam Yap';
  buton.setAttribute('title', 'Toplu zam yap');
  buton.style.cssText = `
    width: 100% !important;
    padding: 14px 24px !important;
    font-size: 15px !important;
    font-weight: 600 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
    color: #ffffff !important;
    border: none !important;
    border-radius: 10px !important;
    cursor: pointer !important;
    transition: all 0.3s ease !important;
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3) !important;
    position: relative !important;
    z-index: 1 !important;
    text-transform: none !important;
  `;

  // Buton hover efekti
  buton.addEventListener('mouseenter', () => {
    buton.style.transform = 'translateY(-2px)';
    buton.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)';
  });
  buton.addEventListener('mouseleave', () => {
    buton.style.transform = 'translateY(0)';
    buton.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
  });
  buton.addEventListener('mousedown', () => {
    buton.style.transform = 'translateY(0)';
  });

  buton.addEventListener('click', () => {
    const SporcuModule = (window as any).Sporcu;
    if (SporcuModule?.topluZamModalAc) {
      SporcuModule.topluZamModalAc();
    } else {
      Helpers.toast(
        'Toplu zam özelliği henüz yüklenmedi. Lütfen birkaç saniye bekleyip tekrar deneyin.',
        'warning'
      );
      setTimeout(() => {
        const retrySporcu = (window as any).Sporcu;
        if (retrySporcu?.topluZamModalAc) {
          retrySporcu.topluZamModalAc();
        } else {
          Helpers.toast('Sporcu modülü yüklenemedi. Sayfayı yenileyin.', 'error');
        }
      }, 2000);
    }
  });

  icerikWrapper.appendChild(baslikContainer);
  icerikWrapper.appendChild(butonDescription);
  icerikWrapper.appendChild(buton);
  butonWrapper.appendChild(icerikWrapper);

  const yedekleBtn = Helpers.$('#yedekleBtn') as HTMLElement | null;
  const geriYukleBtn = Helpers.$('#geriYukleBtn') as HTMLElement | null;

  if (yedekleBtn?.parentElement) {
    yedekleBtn.parentElement.insertBefore(butonWrapper, yedekleBtn.parentElement.firstChild);
    return;
  }

  if (geriYukleBtn?.parentElement) {
    geriYukleBtn.parentElement.insertBefore(butonWrapper, geriYukleBtn.parentElement.firstChild);
    return;
  }

  if (ayarlarContainer !== document.body) {
    if (ayarlarContainer.firstChild) {
      ayarlarContainer.insertBefore(butonWrapper, ayarlarContainer.firstChild);
    } else {
      ayarlarContainer.appendChild(butonWrapper);
    }
    return;
  }

  // Fixed pozisyon için stil güncellemesi
  butonWrapper.style.cssText = FIXED_BUTON_STYLES;
  const icerikDiv = butonWrapper.querySelector('div') as HTMLElement;
  if (icerikDiv) {
    icerikDiv.style.margin = '3px';
  }
  document.body.appendChild(butonWrapper);
}

if (typeof window !== 'undefined') {
  (window as any).Ayarlar = {
    init,
    baslangicBakiyesiGetir,
    baslangicBakiyesiKaydet,
    topluZamButonuOlustur,
  };
}
