import * as Helpers from '../utils/helpers';
import * as Auth from '../utils/auth';
import type { UserRole } from '../types';
import * as Dashboard from '../modules/dashboard';
import * as Sporcu from '../modules/sporcu';
import * as Aidat from '../modules/aidat';
import * as Yoklama from '../modules/yoklama';
import * as Gider from '../modules/gider';
import * as Antrenor from '../modules/antrenor';
import * as Rapor from '../modules/rapor';
import * as KullaniciYonetimi from '../modules/kullanici-yonetimi';
import { loginOverlayGoster } from '../utils/loginSplashUi';
import { canAccessView, defaultViewIdForRole } from './viewAccess';
import { aramaKutulariniTemizle, formInputlariniTemizle } from '../utils/appFormCleanup';

/** app.ts state + ayarlar paneli ile köprü (döngüsel import önlenir) */
export interface ViewNavigationContext {
  getAktifView: () => string;
  setAktifView: (viewId: string) => void;
  ayarlariGuncelle: () => void;
}

export function viewGoster(ctx: ViewNavigationContext, viewId: string, ilkBaslatma = false): void {
  const oncekiView = ctx.getAktifView();

  // Yetki kontrolü
  const kullanici = Auth.aktifKullanici();
  if (!kullanici) {
    loginOverlayGoster();
    return;
  }

  const rol = kullanici.rol as UserRole;

  if (!canAccessView(viewId, rol)) {
    Helpers.toast('Bu sayfaya erişim yetkiniz yok!', 'error');
    viewId = defaultViewIdForRole(rol);
  }

  if (!ilkBaslatma) {
    try {
      // Tüm arama kutularını ve form input'larını temizle (sadece panel değiştiğinde)
      aramaKutulariniTemizle();
      formInputlariniTemizle();
    } catch (e) {
      console.warn('Input temizleme hatası:', e);
    }
  }

  // Aktif nav butonunu güncelle
  Helpers.$$('#mainNav button').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-target') === viewId);
  });

  // Aktif view'u güncelle
  Helpers.$$('.view').forEach(view => {
    const isActive = view.id === viewId;
    view.classList.toggle('active', isActive);
    // Display özelliğini de ayarla
    if (isActive) {
      // Özel durum: sporcu-detay-raporu view'i .content-area içine taşı (sadece masaüstünde)
      if (view.id === 'sporcu-detay-raporu') {
        const raporView = view as HTMLElement;
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        const isMobile = windowWidth <= 768;
        const isTablet = windowWidth > 768 && windowWidth <= 1024;
        const contentArea = Helpers.$('.content-area');
        const currentParent = raporView.parentElement;

        // İçeriği korumak için clone et
        const raporContent = raporView.querySelector('#raporContent') as HTMLElement | null;
        let savedContent: string | null = null;
        // İçeriği kaydet - sadece children.length > 0 değil, innerHTML de kontrol et
        if (raporContent) {
          const hasContent =
            raporContent.children.length > 0 ||
            (raporContent.innerHTML &&
              raporContent.innerHTML.trim() !== '' &&
              !raporContent.innerHTML.includes('İçerik dinamik olarak doldurulacak'));
          if (hasContent) {
            savedContent = raporContent.innerHTML;
          }
        }

        // Mobil/desktop geçişinde içeriğin kaybolmaması için
        // Eğer içerik boşsa ve son açılan rapor ID'si varsa, raporu yeniden render et
        const lastRaporSporcuId = localStorage.getItem('lastRaporSporcuId');
        const shouldRestoreReport =
          (!savedContent || !raporContent || raporContent.children.length === 0) &&
          lastRaporSporcuId &&
          window.Sporcu &&
          typeof window.Sporcu.raporGoster === 'function';

        // Tüm ekran boyutlarına göre DOM move ve display ayarları
        if (isMobile) {
          // Mobilde: View body'nin sonunda kalmalı (bottom sheet pattern için)
          // Eğer .content-area içindeyse, body'ye geri taşı
          if (currentParent === contentArea) {
            const body = document.body;
            if (body && currentParent) {
              body.appendChild(raporView);
            }
          }
          // CSS override'ını önlemek için !important kullan
          raporView.style.setProperty('display', 'flex', 'important');
          // Mobilde viewport height'ı dinamik ayarla
          raporView.style.height = `${windowHeight}px`;
        } else if (isTablet) {
          // Tablette: View .content-area içine taşınmalı
          if (contentArea && currentParent !== contentArea) {
            contentArea.appendChild(raporView);
          }
          raporView.style.setProperty('display', 'block', 'important');
          // Tablette height'ı reset et
          raporView.style.height = '';
        } else {
          // Masaüstünde: View .content-area içine taşınmalı
          if (contentArea && currentParent !== contentArea) {
            contentArea.appendChild(raporView);
          }
          raporView.style.setProperty('display', 'block', 'important');
          // Masaüstünde height'ı reset et
          raporView.style.height = '';
        }

        // İçeriği geri yükle (eğer kaydedildiyse)
        if (savedContent && raporContent) {
          raporContent.innerHTML = savedContent;
        }

        // Eğer içerik hala boşsa ve son açılan rapor ID'si varsa, raporu yeniden render et
        if (shouldRestoreReport) {
          const sporcuId = parseInt(lastRaporSporcuId, 10);
          if (!isNaN(sporcuId)) {
            // Raporu yeniden render et (DOM move'dan sonra) - Daha güvenilir mekanizma
            // Önce kısa bir delay ile kontrol et, sonra daha uzun delay ile tekrar dene
            let restoreAttempts = 0;
            const maxRestoreAttempts = 3;
            const restoreReport = () => {
              restoreAttempts++;
              const raporContentAfterMove = raporView.querySelector(
                '#raporContent'
              ) as HTMLElement | null;
              const hasContentAfterMove =
                raporContentAfterMove &&
                (raporContentAfterMove.children.length > 0 ||
                  (raporContentAfterMove.innerHTML &&
                    raporContentAfterMove.innerHTML.trim() !== '' &&
                    !raporContentAfterMove.innerHTML.includes(
                      'İçerik dinamik olarak doldurulacak'
                    )));

              if (!hasContentAfterMove && restoreAttempts <= maxRestoreAttempts) {
                window.Sporcu.raporGoster(sporcuId);
                // Eğer hala boşsa, tekrar dene
                if (restoreAttempts < maxRestoreAttempts) {
                  setTimeout(restoreReport, 200 * restoreAttempts);
                }
              }
            };

            // İlk deneme: 100ms sonra
            setTimeout(restoreReport, 100);
          }
        }

        // Butonların görünürlüğünü garanti et
        requestAnimationFrame(() => {
          const geriBtn = raporView.querySelector('#raporGeriBtn') as HTMLButtonElement | null;
          const yazdirBtn = raporView.querySelector('#raporYazdirBtn') as HTMLButtonElement | null;

          if (geriBtn) {
            geriBtn.style.display = 'flex';
            geriBtn.style.visibility = 'visible';
            geriBtn.style.opacity = '1';
          }

          if (yazdirBtn) {
            yazdirBtn.style.display = 'flex';
            yazdirBtn.style.visibility = 'visible';
            yazdirBtn.style.opacity = '1';
          }

          // View'in görünürlüğünü tekrar garanti et (CSS override'larına karşı)
          // Tüm ekran boyutlarına göre dinamik ayarla
          if (isMobile) {
            raporView.style.setProperty('display', 'flex', 'important');
            raporView.style.setProperty('height', `${windowHeight}px`, 'important');
          } else if (isTablet) {
            raporView.style.setProperty('display', 'block', 'important');
            raporView.style.setProperty('height', 'auto', 'important');
          } else {
            raporView.style.setProperty('display', 'block', 'important');
            raporView.style.setProperty('height', 'auto', 'important');
          }

          // Container height'ı da ekran boyutuna göre ayarla
          const container = raporView.querySelector(
            '.sporcu-rapor-container'
          ) as HTMLElement | null;
          if (container) {
            if (isMobile) {
              container.style.setProperty('height', `${windowHeight}px`, 'important');
              container.style.setProperty('max-height', `${windowHeight}px`, 'important');
            } else if (isTablet) {
              container.style.setProperty('height', 'auto', 'important');
              container.style.setProperty('max-height', `${windowHeight * 0.9}px`, 'important');
            } else {
              container.style.setProperty('height', 'auto', 'important');
              container.style.setProperty('max-height', 'none', 'important');
            }
          }
        });
      } else {
        // Diğer view'ler için normal işlem - !important ile CSS override'ını önle
        const viewEl = view as HTMLElement;
        viewEl.style.setProperty('display', 'block', 'important');
        viewEl.style.setProperty('visibility', 'visible', 'important');
        viewEl.style.setProperty('opacity', '1', 'important');
      }
    } else {
      (view as HTMLElement).style.display = 'none';
    }
  });

  // Nav indicator'ı güncelle
  navIndicatorGuncelle(viewId);

  ctx.setAktifView(viewId);

  // Scroll pozisyonunu en üste sıfırla (view değiştiğinde)
  if (!ilkBaslatma) {
    // Scroll sıfırlamayı biraz gecikmeyle yap (DOM'un güncellenmesini bekle)
    setTimeout(() => {
      // Aktif view element'ini en üste scroll et
      const aktifView = Helpers.$(`#${viewId}`);
      if (aktifView) {
        aktifView.scrollTop = 0;
      }

      // Ana içerik alanını en üste scroll et
      const contentArea = Helpers.$('.content-area');
      if (contentArea) {
        contentArea.scrollTop = 0;
      }

      // Ana içerik container'ını en üste scroll et
      const mainContent = Helpers.$('.main-content');
      if (mainContent) {
        mainContent.scrollTop = 0;
      }

      // Body'yi de en üste scroll et
      if (document.body) {
        document.body.scrollTop = 0;
        document.documentElement.scrollTop = 0;
      }

      // Window'u da en üste scroll et (mobil ve masaüstü için)
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'instant' });
      }
    }, 100);
  }

  // Aktif view'u localStorage'a kaydet (sayfa yenilendiğinde aynı yerde kalsın)
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('soybis_aktifView', viewId);
  }

  // Panel değiştiğinde modül formlarını ve filtrelerini sıfırla
  if (!ilkBaslatma) {
    try {
      // Sporcu modülü form temizleme
      if (
        typeof window !== 'undefined' &&
        window.Sporcu &&
        typeof (window.Sporcu as any).formuTemizle === 'function'
      ) {
        (window.Sporcu as any).formuTemizle();
      }

      // Sporcu listesi filtreleri: (1) listeden çıkınca (2) başka sayfadan listeye girince
      // Sadece (1) yetmediği oluyor: tekrar listeye dönünce select eski kaldığı için viewGuncellemesi yanlış filtreyle çiziyordu.
      // viewGuncellemeleri() bu bloktan sonra çalıştığı için sıfırlama burada senkron kalmalı.
      if (
        typeof window !== 'undefined' &&
        window.Sporcu &&
        typeof (window.Sporcu as { listeFiltreleriniSifirla?: () => void })
          .listeFiltreleriniSifirla === 'function'
      ) {
        const spListReset = (window.Sporcu as { listeFiltreleriniSifirla: () => void })
          .listeFiltreleriniSifirla;
        const listedenCikis = oncekiView === 'sporcu-listesi' && viewId !== 'sporcu-listesi';
        const listeyeGiris = viewId === 'sporcu-listesi' && oncekiView !== 'sporcu-listesi';
        if (listedenCikis || listeyeGiris) {
          spListReset();
        }
      }

      // Aidat modülü filtre sıfırlama
      if (
        typeof window !== 'undefined' &&
        window.Aidat &&
        typeof Aidat.filtreSifirla === 'function'
      ) {
        Aidat.filtreSifirla();
      }

      // Yoklama modülü filtre sıfırlama
      if (
        typeof window !== 'undefined' &&
        window.Yoklama &&
        typeof (window.Yoklama as any).filtreSifirla === 'function'
      ) {
        (window.Yoklama as any).filtreSifirla();
      }

      // Gider modülü form/filtre temizleme (varsa)
      if (
        typeof window !== 'undefined' &&
        window.Gider &&
        typeof (window.Gider as any).formuTemizle === 'function'
      ) {
        (window.Gider as any).formuTemizle();
      }

      // Antrenör modülü form temizleme (varsa)
      if (
        typeof window !== 'undefined' &&
        window.Antrenor &&
        typeof (window.Antrenor as any).formuTemizle === 'function'
      ) {
        (window.Antrenor as any).formuTemizle();
      }

      // Kullanıcı yönetimi modülü form temizleme (varsa)
      if (
        typeof window !== 'undefined' &&
        window.KullaniciYonetimi &&
        typeof (window.KullaniciYonetimi as any).formuTemizle === 'function'
      ) {
        (window.KullaniciYonetimi as any).formuTemizle();
      }
    } catch (e) {
      console.warn('Modül form/filtre temizleme hatası:', e);
    }
  }

  // Dashboard'dan çıkıldığında chart'ları temizle (bellek sızıntısı önleme)
  if (
    viewId !== 'dashboard' &&
    typeof window !== 'undefined' &&
    window.Dashboard &&
    typeof Dashboard.tumChartlariTemizle === 'function'
  ) {
    Dashboard.tumChartlariTemizle();
  }

  // View'a özgü güncellemeler
  viewGuncellemeleri(ctx, viewId);
}

/**
 * Nav indicator pozisyonunu güncelle
 * @param viewId - View ID
 */
export function navIndicatorGuncelle(viewId: string): void {
  const indicator = Helpers.$('#navIndicator');
  const activeBtn = Helpers.$(`#mainNav button[data-target="${viewId}"]`);

  if (indicator && activeBtn) {
    const nav = Helpers.$('#mainNav');
    if (!nav) return;

    const navRect = nav.getBoundingClientRect();
    const btnRect = activeBtn.getBoundingClientRect();

    // Butonun nav içindeki pozisyonunu hesapla
    const topOffset = btnRect.top - navRect.top;

    (indicator as HTMLElement).style.top = topOffset + 'px';
    (indicator as HTMLElement).style.height = btnRect.height + 'px';
  }
}

/**
 * View'a özgü güncellemeler
 * @param viewId - View ID
 */
export function viewGuncellemeleri(ctx: ViewNavigationContext, viewId: string): void {
  console.log(`🔄 [App] viewGuncellemeleri çağrıldı: ${viewId}`);

  try {
    switch (viewId) {
      case 'dashboard':
        console.log('📊 [App] Dashboard güncelleniyor...');
        if (typeof window !== 'undefined' && window.Dashboard) {
          // Chart'lar yoksa yeniden oluştur
          if (typeof Dashboard.grafikleriOlustur === 'function') {
            Dashboard.grafikleriOlustur();
          }
          if (typeof Dashboard.guncelle === 'function') {
            Dashboard.guncelle();
          }
        }
        break;
      case 'sporcu-kayit':
        console.log('👤 [App] Sporcu Kayıt güncelleniyor...');
        // Sporcu kayıt formu gösterildiğinde form eventlerini yeniden bağla
        if (
          typeof window !== 'undefined' &&
          window.Sporcu &&
          typeof (window.Sporcu as any).formEventleriniYenidenBagla === 'function'
        ) {
          // Kısa bir gecikme ile form'un DOM'da olmasını garanti et
          setTimeout(() => {
            (window.Sporcu as any).formEventleriniYenidenBagla();
            // Debug: Buton durumunu kontrol et
            if (typeof (window.Sporcu as any).butonDurumunuKontrolEt === 'function') {
              (window.Sporcu as any).butonDurumunuKontrolEt();
            }
          }, 100);
        }
        break;
      case 'sporcu-listesi':
        console.log('👥 [App] Sporcu Listesi güncelleniyor...');
        if (
          typeof window !== 'undefined' &&
          window.Sporcu &&
          typeof Sporcu.listeyiGuncelle === 'function'
        ) {
          Sporcu.listeyiGuncelle();
        } else {
          console.warn('⚠️ [App] Sporcu.listeyiGuncelle bulunamadı!', {
            windowSporcu: !!window.Sporcu,
            hasListeyiGuncelle: typeof Sporcu.listeyiGuncelle === 'function',
          });
        }
        break;
      case 'aidat':
        console.log('💰 [App] Aidat güncelleniyor...');
        if (typeof window !== 'undefined' && window.Aidat) {
          if (typeof Aidat.listeyiGuncelle === 'function') {
            Aidat.listeyiGuncelle();
          } else {
            console.warn('⚠️ Aidat.listeyiGuncelle fonksiyonu bulunamadı');
          }
          if (typeof Aidat.takvimiOlustur === 'function') {
            Aidat.takvimiOlustur();
          }
        } else {
          console.warn('⚠️ window.Aidat bulunamadı');
        }
        break;
      case 'yoklama':
        console.log('📋 [App] Yoklama güncelleniyor...');
        if (
          typeof window !== 'undefined' &&
          window.Yoklama &&
          typeof Yoklama.listeyiGuncelle === 'function'
        ) {
          Yoklama.listeyiGuncelle();
        } else {
          console.warn('⚠️ [App] Yoklama.listeyiGuncelle bulunamadı!', {
            windowYoklama: !!window.Yoklama,
            hasListeyiGuncelle: typeof Yoklama.listeyiGuncelle === 'function',
          });
        }
        break;
      case 'giderler':
        console.log('💸 [App] Giderler view güncellemeleri yapılıyor...');
        // Gider view'ına geçildiğinde modülü başlat - DOM hazır olması için kısa gecikme
        setTimeout(() => {
          if (typeof window !== 'undefined' && window.Gider) {
            if (typeof Gider.init === 'function') {
              console.log('✅ [App] Gider modülü yeniden başlatılıyor...');
              Gider.init();
              console.log('✅ [App] Gider modülü başlatıldı');
            } else {
              console.warn('⚠️ [App] Gider.init fonksiyonu bulunamadı!');
            }
          } else {
            console.warn('⚠️ [App] window.Gider bulunamadı!');
          }
        }, 100);
        break;
      case 'raporlar':
        console.log('📊 [App] Raporlar view güncellemeleri yapılıyor...');
        // Raporlar view'ına geçildiğinde modülü başlat (init içinde guncelle() çağrılıyor) - DOM hazır olması için kısa gecikme
        setTimeout(() => {
          if (typeof window !== 'undefined' && window.Rapor) {
            if (typeof Rapor.init === 'function') {
              console.log('✅ [App] Rapor modülü yeniden başlatılıyor...');
              Rapor.init();
              console.log('✅ [App] Rapor modülü başlatıldı');
            } else {
              console.warn('⚠️ [App] Rapor.init fonksiyonu bulunamadı!');
            }
          } else {
            console.warn('⚠️ [App] window.Rapor bulunamadı!');
          }
        }, 100);
        break;
      case 'antrenorler':
        console.log('👔 [App] Antrenörler view güncellemeleri yapılıyor...');
        // Antrenörler view'ına geçildiğinde modülü başlat - DOM hazır olması için kısa gecikme
        setTimeout(() => {
          if (typeof window !== 'undefined' && window.Antrenor) {
            if (typeof Antrenor.init === 'function') {
              console.log('✅ [App] Antrenör modülü yeniden başlatılıyor...');
              Antrenor.init();
              console.log('✅ [App] Antrenör modülü başlatıldı');
            } else {
              console.warn('⚠️ [App] Antrenor.init fonksiyonu bulunamadı!');
            }
          } else {
            console.warn('⚠️ [App] window.Antrenor bulunamadı!');
          }
        }, 100);
        break;
      case 'ayarlar':
        console.log('⚙️ [App] Ayarlar güncelleniyor...');
        // Ayarlar view'ında tüm ayarları güncelle
        ctx.ayarlariGuncelle();
        break;
      case 'kullanici-yonetimi':
        console.log('👥 [App] Kullanıcı Yönetimi view güncellemeleri yapılıyor...');
        // Kullanıcı yönetimi view'ına geçildiğinde modülü başlat - DOM hazır olması için kısa gecikme
        setTimeout(() => {
          if (typeof window !== 'undefined' && window.KullaniciYonetimi) {
            if (typeof KullaniciYonetimi.init === 'function') {
              console.log('✅ [App] Kullanıcı Yönetimi modülü yeniden başlatılıyor...');
              KullaniciYonetimi.init();
              console.log('✅ [App] Kullanıcı Yönetimi modülü başlatıldı');
            } else {
              console.warn('⚠️ [App] KullaniciYonetimi.init fonksiyonu bulunamadı!');
            }
            // Panel göster (liste güncellemesi için)
            if (typeof KullaniciYonetimi.paneliGoster === 'function') {
              console.log('✅ [App] Kullanıcı yönetimi paneli gösteriliyor...');
              KullaniciYonetimi.paneliGoster();
            } else if (typeof KullaniciYonetimi.kullaniciListesiniGuncelle === 'function') {
              console.log('✅ [App] Kullanıcı listesi güncelleniyor...');
              KullaniciYonetimi.kullaniciListesiniGuncelle();
            }
          } else {
            console.warn('⚠️ [App] KullaniciYonetimi modülü bulunamadı!');
          }
        }, 100);
        break;
      case 'sporcu-detay-raporu':
        console.log('📊 [App] Sporcu Detay Raporu görüntüleniyor...');
        // Rapor view'ı - içerik zaten raporGoster fonksiyonu tarafından dolduruluyor
        // Scroll pozisyonunu en üste sıfırla
        setTimeout(() => {
          const raporView = Helpers.$('#sporcu-detay-raporu');
          if (raporView) {
            raporView.scrollTop = 0;

            // Mobilde bottom sheet içindeki content area'yı scroll et
            const contentArea = raporView.querySelector('.rapor-content') as HTMLElement;
            if (contentArea) {
              contentArea.scrollTop = 0;
            }

            // Container'ı da scroll et
            const container = raporView.querySelector('.sporcu-rapor-container') as HTMLElement;
            if (container) {
              container.scrollTop = 0;
            }
          }

          // Window scroll pozisyonunu da sıfırla (masaüstü için)
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, behavior: 'instant' });
          }
        }, 150);
        break;
    }
  } catch (e) {
    console.warn('View güncelleme hatası:', e);
  }
}
