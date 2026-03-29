/**
 * SOY-BIS - Ana Uygulama Dosyası (app.ts)
 * Tüm modülleri birleştirir ve uygulamayı başlatır - TypeScript Version
 * Versiyon: 3.0.0
 */

import * as Helpers from './utils/helpers';
import * as Storage from './utils/storage';
import * as Auth from './utils/auth';
import type { UserRole } from './types';

// Import modules
import * as Dashboard from './modules/dashboard';
import * as Sporcu from './modules/sporcu';
import * as Aidat from './modules/aidat';
import * as Yoklama from './modules/yoklama';
import * as Gider from './modules/gider';
import * as Antrenor from './modules/antrenor';
import * as Rapor from './modules/rapor';
import * as Ayarlar from './modules/ayarlar';
import * as KullaniciYonetimi from './modules/kullanici-yonetimi';
import * as Notification from './modules/notification';

// ========== TYPES & INTERFACES ==========

interface AppState {
  aktifView: string;
  yuklendi: boolean;
}

interface ViewYetkileri {
  [key: string]: string[];
}

// Global window types are already declared in other modules
// We don't declare App interface here to avoid conflicts

// ========== STATE ==========

const state: AppState = {
  aktifView: 'dashboard',
  yuklendi: false,
};

// AbortController for cleanup
let quickAmountAbortController: AbortController | null = null;
let resizeAbortController: AbortController | null = null;
let themeAbortController: AbortController | null = null;

// ========== HELPER FUNCTIONS ==========

/**
 * Mobil menü kontrolü - sadece mobilde çalışmalı
 */
function isMobile(): boolean {
  return typeof window !== 'undefined' && window.innerWidth < 769;
}

/**
 * Window resize event handler - ekran boyutu değiştiğinde menüyü güncelle
 */
function handleResize(): void {
  const sidebar = Helpers.$('#sidebar');
  const fabBtn = Helpers.$('#hamburgerBtn');
  const overlay = Helpers.$('#mobileMenuOverlay');

  if (!sidebar) return;

  // Eğer desktop moduna geçildiyse (769px ve üzeri)
  if (window.innerWidth >= 769) {
    // Mobil menüyü kapat
    if (fabBtn) {
      fabBtn.classList.remove('active');
      fabBtn.setAttribute('aria-expanded', 'false');
    }
    if (sidebar) {
      sidebar.classList.remove('open');
      // Masaüstü modunda sidebar-closed class'ını kontrol et
      const sidebarOpen =
        typeof localStorage !== 'undefined' ? localStorage.getItem('sidebarOpen') : null;
      const shouldBeOpen = sidebarOpen === null ? true : sidebarOpen === 'true';
      if (shouldBeOpen) {
        sidebar.classList.remove('sidebar-closed');
      } else {
        sidebar.classList.add('sidebar-closed');
      }
    }
    if (overlay) {
      overlay.classList.remove('active');
    }
    document.body.style.overflow = '';
  } else {
    // Mobil moduna geçildiyse, sidebar'ı normal haline getir
    sidebar.classList.remove('sidebar-closed');
    // Eğer açık değilse kapat
    if (!sidebar.classList.contains('open')) {
      if (fabBtn) {
        fabBtn.classList.remove('active');
        fabBtn.setAttribute('aria-expanded', 'false');
      }
      if (overlay) {
        overlay.classList.remove('active');
      }
      document.body.style.overflow = '';
    }
  }
}

/**
 * Splash screen'i göster
 */
function splashScreenGoster(): void {
  const splash = document.getElementById('splashScreen');
  if (splash) {
    splash.classList.remove('hidden');
    (splash as HTMLElement).style.display = 'flex';
    (splash as HTMLElement).style.setProperty('display', 'flex', 'important');
  }
}

/**
 * Splash screen'i kapat
 */
function splashScreenKapat(): void {
  const splash = document.getElementById('splashScreen');
  if (splash) {
    // Animasyonun bitmesini bekle
    setTimeout(() => {
      splash.classList.add('hidden');
      // Tamamen kaldır
      setTimeout(() => {
        splash.remove();
      }, 500);
    }, 1800); // Loading bar animasyonu + biraz bekleme
  }
}

/**
 * Tarihi güncelle
 */
function tarihiGuncelle(): void {
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

// ========== NAVIGATION ==========

/**
 * Navigasyon eventlerini bağla
 */
function navigasyonEventleri(): void {
  const mainNav = Helpers.$('#mainNav');
  if (!mainNav) {
    console.warn('navigasyonEventleri: #mainNav bulunamadı');
    // DOM henüz hazır değilse, kısa bir süre sonra tekrar dene
    setTimeout(() => {
      navigasyonEventleri();
    }, 200);
    return;
  }

  const navButtons = Helpers.$$('#mainNav button');

  if (navButtons.length === 0) {
    console.warn('navigasyonEventleri: Hiç buton bulunamadı!');
    return;
  }

  navButtons.forEach(btn => {
    // Çift event listener eklenmesini önle
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

/**
 * View göster
 * @param viewId - View ID
 * @param ilkBaslatma - İlk başlatma mı (input temizleme yapılmasın)
 */
function viewGoster(viewId: string, ilkBaslatma = false): void {
  const oncekiView = state.aktifView;

  // Yetki kontrolü
  const kullanici = Auth.aktifKullanici();
  if (!kullanici) {
    loginOverlayGoster();
    return;
  }

  const rol = kullanici.rol as UserRole;
  // Uluslararası RBAC normlarına göre view yetkileri
  const yetkiler: ViewYetkileri = {
    Yönetici: [
      'dashboard',
      'sporcu-kayit',
      'sporcu-listesi',
      'aidat',
      'yoklama',
      'giderler',
      'antrenorler',
      'raporlar',
      'ayarlar',
      'kullanici-yonetimi',
    ],
    Antrenör: ['sporcu-listesi', 'yoklama'], // Dashboard YOK - Finansal bilgiler içeriyor
    Muhasebe: ['dashboard', 'aidat', 'giderler', 'raporlar'], // Finansal işlemler için dashboard gerekli
  };

  const izinliViewlar = yetkiler[rol] || [];

  // Özel durum: sporcu-detay-raporu view'i sporcu-listesi yetkisine sahip olanlar için erişilebilir
  // Bu bir alt sayfa olduğu için, sporcu-listesi yetkisi yeterli
  const isRaporView = viewId === 'sporcu-detay-raporu';
  const hasSporcuListesiAccess = izinliViewlar.includes('sporcu-listesi');

  if (!izinliViewlar.includes(viewId) && !(isRaporView && hasSporcuListesiAccess)) {
    Helpers.toast('Bu sayfaya erişim yetkiniz yok!', 'error');
    // Rol bazlı varsayılan view'a yönlendir
    if (rol === 'Antrenör') {
      viewId = 'sporcu-listesi'; // Antrenör için varsayılan
    } else if (rol === 'Muhasebe') {
      viewId = 'dashboard'; // Muhasebe için varsayılan
    } else {
      viewId = 'dashboard'; // Yönetici için varsayılan
    }
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
        const isDesktop = windowWidth > 1024;
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

  state.aktifView = viewId;

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
  viewGuncellemeleri(viewId);
}

/**
 * Nav indicator pozisyonunu güncelle
 * @param viewId - View ID
 */
function navIndicatorGuncelle(viewId: string): void {
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
function viewGuncellemeleri(viewId: string): void {
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
        ayarlariGuncelle();
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

/**
 * Tüm arama kutularını temizle
 */
function aramaKutulariniTemizle(): void {
  let temizlenenAramaKutusu = 0;

  // Sporcu listesi arama kutusu
  const searchBox = Helpers.$('#searchBox') as HTMLInputElement | null;
  if (searchBox) {
    searchBox.value = '';
    temizlenenAramaKutusu++;
  }

  // Aidat arama kutusu
  const aidatArama = Helpers.$('#aidatArama') as HTMLInputElement | null;
  if (aidatArama) {
    aidatArama.value = '';
    temizlenenAramaKutusu++;
  }

  // Diğer arama kutuları (varsa)
  document
    .querySelectorAll('.search-box, input[type="search"], input[placeholder*="ara" i]')
    .forEach(input => {
      const htmlInput = input as HTMLInputElement;
      if (htmlInput.id !== 'searchBox' && htmlInput.id !== 'aidatArama') {
        htmlInput.value = '';
        temizlenenAramaKutusu++;
      }
    });
}

/**
 * Tüm form input'larını temizle (validation class'ları dahil)
 */
function formInputlariniTemizle(): void {
  try {
    // Önce tüm form'ları reset et
    const forms = document.querySelectorAll('form');
    let resetlenenFormSayisi = 0;
    let atlananFormSayisi = 0;

    forms.forEach(form => {
      try {
        // Arama formları hariç (arama kutuları genelde form içinde değil)
        const isSearchForm =
          form.classList.contains('search-form') ||
          form.id === 'searchForm' ||
          form.querySelector('input[type="search"]');

        if (!isSearchForm) {
          form.reset();
          resetlenenFormSayisi++;
        } else {
          atlananFormSayisi++;
        }
      } catch (e) {
        console.warn('Form reset hatası:', e);
      }
    });

    // Tüm input, select, textarea elementlerini bul
    const inputs = document.querySelectorAll('input, select, textarea');
    if (!inputs || inputs.length === 0) return;

    let temizlenenInputSayisi = 0;
    let atlananInputSayisi = 0;

    inputs.forEach(input => {
      try {
        const htmlInput = input as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
        // Sadece form içindeki input'ları temizle (arama kutuları hariç)
        const isSearchBox =
          htmlInput.classList.contains('search-box') ||
          htmlInput.id === 'searchBox' ||
          htmlInput.id === 'aidatArama' ||
          (htmlInput instanceof HTMLInputElement && htmlInput.type === 'search');

        if (!isSearchBox && htmlInput.id) {
          // Validation class'larını kaldır
          htmlInput.classList.remove('validated-success', 'error');

          // Error text'leri temizle
          const errorEl = document.getElementById(htmlInput.id + 'Error');
          if (errorEl) {
            errorEl.textContent = '';
          }
          temizlenenInputSayisi++;
        } else {
          atlananInputSayisi++;
        }
      } catch (e) {
        // Tek bir input'ta hata olsa bile devam et
        console.warn('Input temizleme hatası (tek eleman):', e);
      }
    });
  } catch (e) {
    // Genel hata durumunda sessizce devam et
    console.warn('Form input temizleme hatası:', e);
  }
}

// ========== MODULE INITIALIZATION ==========

/**
 * Modülleri başlat
 */
function modulleriBaslat(): void {
  // Dashboard
  try {
    if (typeof window !== 'undefined' && window.Dashboard && typeof Dashboard.init === 'function') {
      Dashboard.init();
    }
  } catch (e) {
    console.warn('Dashboard init hatası:', e);
  }

  // Sporcu
  try {
    if (typeof window !== 'undefined' && window.Sporcu && typeof Sporcu.init === 'function') {
      Sporcu.init();
    }
  } catch (e) {
    console.warn('Sporcu init hatası:', e);
  }

  // Aidat
  try {
    if (typeof window !== 'undefined' && window.Aidat && typeof Aidat.init === 'function') {
      Aidat.init();
    }
  } catch (e) {
    console.warn('Aidat init hatası:', e);
  }

  // Yoklama
  try {
    if (typeof window !== 'undefined' && window.Yoklama && typeof Yoklama.init === 'function') {
      Yoklama.init();
    }
  } catch (e) {
    console.warn('Yoklama init hatası:', e);
  }

  // Gider
  try {
    if (typeof window !== 'undefined' && window.Gider && typeof Gider.init === 'function') {
      Gider.init();
    }
  } catch (e) {
    console.warn('Gider init hatası:', e);
  }

  // Antrenör
  try {
    if (typeof window !== 'undefined' && window.Antrenor && typeof Antrenor.init === 'function') {
      Antrenor.init();
    }
  } catch (e) {
    console.warn('Antrenor init hatası:', e);
  }

  // Rapor
  try {
    if (typeof window !== 'undefined' && window.Rapor && typeof Rapor.init === 'function') {
      Rapor.init();
    }
  } catch (e) {
    console.warn('Rapor init hatası:', e);
  }

  // Notification (Hatırlatma)
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

  // Ayarlar
  try {
    if (
      typeof window !== 'undefined' &&
      (window as any).Ayarlar &&
      typeof (window as any).Ayarlar.init === 'function'
    ) {
      (window as any).Ayarlar.init();
    }
  } catch (e) {
    console.warn('Ayarlar init hatası:', e);
  }

  // Kullanıcı Yönetimi
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

// ========== KEYBOARD SHORTCUTS ==========

/**
 * Keyboard shortcuts
 */
function klavyeKisayollari(): void {
  document.addEventListener('keydown', function (e: KeyboardEvent) {
    // Modal açıksa sadece ESC çalışsın
    const activeModal = document.querySelector('.modal.active');
    if (activeModal) {
      if (e.key === 'Escape') {
        const closeBtn = activeModal.querySelector('.modal-close');
        if (closeBtn) (closeBtn as HTMLElement).click();
      }
      return;
    }

    // Input/textarea içindeyse sadece Ctrl+S çalışsın
    const target = e.target as HTMLElement;
    const isInput =
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable;

    // Ctrl+S: Form kaydet (eğer form varsa)
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

    // Input içindeyken diğer kısayollar çalışmasın
    if (isInput) return;

    // Sayısal tuşlar: Hızlı navigasyon (1-9)
    if (e.key >= '1' && e.key <= '9' && !e.ctrlKey && !e.altKey) {
      const navButtons = Helpers.$$('#mainNav button');
      const index = parseInt(e.key) - 1;
      if (navButtons[index]) {
        (navButtons[index] as HTMLElement).click();
      }
    }

    // G: Dashboard'a git
    if (e.key === 'g' || e.key === 'G') {
      if (!e.ctrlKey && !e.altKey) {
        viewGoster('dashboard');
      }
    }

    // Ctrl+K veya /: Arama kutusuna odaklan
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

// ========== SETTINGS ==========

/**
 * Ayarlar eventlerini bağla
 */
function ayarlarEventleri(): void {
  // Yedekle butonu
  const yedekleBtn = Helpers.$('#yedekleBtn');
  if (yedekleBtn) {
    yedekleBtn.addEventListener('click', function () {
      Storage.yedekIndir();
    });
  }

  // Geri yükle butonu
  const geriYukleBtn = Helpers.$('#geriYukleBtn');
  const yedekDosya = Helpers.$('#yedekDosya') as HTMLInputElement | null;

  if (geriYukleBtn && yedekDosya) {
    geriYukleBtn.addEventListener('click', function () {
      yedekDosya.click();
    });

    yedekDosya.addEventListener('change', async function (e: Event) {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) return;

      try {
        const yedek = await Storage.dosyadanYukle(file);

        if (
          Helpers.onay(
            'Mevcut veriler yedekteki verilerle değiştirilecek. Devam etmek istiyor musunuz?'
          )
        ) {
          if (Storage.yedekYukle(yedek)) {
            location.reload();
          }
        }
      } catch (error: any) {
        Helpers.toast(error.message || 'Yedek yükleme hatası', 'error');
      }

      // Input'u sıfırla
      target.value = '';
    });
  }

  // Sistemi sıfırla butonu
  const sifirlaBtn = Helpers.$('#sistemiSifirlaBtn');
  if (sifirlaBtn) {
    sifirlaBtn.addEventListener('click', async function () {
      if (
        !Helpers.onay(
          '⚠️ DİKKAT!\n\nTüm veriler kalıcı olarak silinecek. Bu işlem geri alınamaz!\n\nDevam etmek istiyor musunuz?'
        )
      ) {
        return;
      }

      const kullaniciAdi = Helpers.girdi(
        '⚠️ SİSTEM SIFIRLAMA\n\nYönetici kullanıcı adınızı girin:\n(Varsayılan: admin)',
        'admin'
      );
      if (kullaniciAdi === null || !kullaniciAdi.trim()) {
        Helpers.toast('İşlem iptal edildi!', 'warning');
        return;
      }

      // Kullanıcı adı kontrolü - eğer "admin" değilse uyarı ver
      if (kullaniciAdi.trim().toLowerCase() !== 'admin') {
        if (
          !Helpers.onay(
            `⚠️ UYARI!\n\nGirdiğiniz kullanıcı adı "${kullaniciAdi}" değil, "admin" olmalı!\n\nDevam etmek istiyor musunuz?`
          )
        ) {
          return;
        }
      }

      // Şifre için varsayılan değer YOK - güvenlik açığı önlendi
      const sifre = Helpers.girdi('⚠️ SİSTEM SIFIRLAMA\n\nYönetici şifrenizi girin:');
      if (sifre === null || !sifre.trim()) {
        Helpers.toast('Şifre girilmedi! İşlem iptal edildi.', 'warning');
        return;
      }

      // Async şifre doğrulama (trim ile temizle)
      const basarili = await Storage.sistemSifirla(kullaniciAdi.trim(), sifre.trim());
      if (basarili) {
        setTimeout(() => location.reload(), 1000);
      }
    });
  }

  // Çıkış butonu
  const logoutBtn = Helpers.$('#logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function () {
      if (Helpers.onay('Çıkış yapmak istediğinize emin misiniz?')) {
        Auth.cikisYap();
      }
    });
  }
}

/**
 * Login overlay'i göster
 */
function loginOverlayGoster(): void {
  const overlay = Helpers.$('#loginOverlay');
  if (overlay) {
    overlay.classList.remove('hidden');
    (overlay as HTMLElement).style.display = 'flex';
    (overlay as HTMLElement).style.setProperty('display', 'flex', 'important');

    // Login logo'yu göster (eğer varsa)
    const loginLogo = overlay.querySelector('.login-logo') as HTMLImageElement;
    if (loginLogo) {
      loginLogo.style.display = '';
    }
  }
  // App container'ı gizle
  const appContainer = Helpers.$('.app-container');
  if (appContainer) {
    (appContainer as HTMLElement).style.display = 'none';
  }
  // Splash screen'i gizle
  const splash = Helpers.$('#splashScreen');
  if (splash) {
    (splash as HTMLElement).style.display = 'none';
    splash.classList.add('hidden');
  }
}

/**
 * Login overlay'i gizle
 */
function loginOverlayGizle(): void {
  const overlay = Helpers.$('#loginOverlay');
  if (overlay) {
    overlay.classList.add('hidden');
    (overlay as HTMLElement).style.display = 'none';
    (overlay as HTMLElement).style.setProperty('display', 'none', 'important');

    // Login logo'yu gizle
    const loginLogo = overlay.querySelector('.login-logo') as HTMLImageElement;
    if (loginLogo) {
      loginLogo.style.display = 'none';
    }
  }
  // App container'ı göster
  const appContainer = Helpers.$('.app-container');
  if (appContainer) {
    (appContainer as HTMLElement).style.display = 'flex';
  }
}

/**
 * Login form eventlerini bağla
 */
function loginEventleri(): void {
  const loginForm = Helpers.$('#loginForm');
  if (!loginForm) {
    console.error('Login form bulunamadı!');
    return;
  }

  // Eski event listener'ı kaldır (eğer varsa)
  const newLoginForm = loginForm.cloneNode(true) as HTMLFormElement;
  if (loginForm.parentNode) {
    loginForm.parentNode.replaceChild(newLoginForm, loginForm);
  }

  newLoginForm.addEventListener('submit', async function (e: Event) {
    e.preventDefault();

    const kullaniciAdiInput = Helpers.$('#loginKullaniciAdi') as HTMLInputElement | null;
    const sifreInput = Helpers.$('#loginSifre') as HTMLInputElement | null;

    const kullaniciAdi = kullaniciAdiInput?.value.trim() || '';
    const sifre = sifreInput?.value || '';

    const errorDiv = Helpers.$('#loginError');
    const errorText = Helpers.$('#loginErrorText');

    // Hata mesajını gizle
    if (errorDiv) (errorDiv as HTMLElement).style.display = 'none';

    if (!kullaniciAdi || !sifre) {
      if (errorDiv && errorText) {
        errorText.textContent = 'Lütfen kullanıcı adı ve şifre girin!';
        (errorDiv as HTMLElement).style.display = 'flex';
      }
      return;
    }

    // Giriş yap
    const kullanici = await Auth.girisYap(kullaniciAdi, sifre);

    if (!kullanici) {
      if (errorDiv && errorText) {
        errorText.textContent = 'Kullanıcı adı veya şifre hatalı!';
        (errorDiv as HTMLElement).style.display = 'flex';
      }
      // Şifre alanını temizle
      if (sifreInput) sifreInput.value = '';
      return;
    }

    // Başarılı giriş - Önce splash screen'i göster
    loginOverlayGizle();
    splashScreenGoster();

    // App container'ı gizle (splash screen gösterilirken)
    const appContainer = Helpers.$('.app-container');
    if (appContainer) {
      (appContainer as HTMLElement).style.display = 'none';
    }

    kullaniciBilgileriniGoster();
    rolBazliMenuGizle();

    // Uygulamayı başlat
    try {
      // Eski verileri migrate et
      if (
        typeof window !== 'undefined' &&
        window.Storage &&
        typeof Storage.veriMigration === 'function'
      ) {
        Storage.veriMigration();
      }

      // Tarihi güncelle
      tarihiGuncelle();

      // Navigasyon eventlerini bağla
      navigasyonEventleri();

      // Modülleri başlat
      modulleriBaslat();

      // Ayarlar eventlerini bağla
      ayarlarEventleri();

      // Keyboard shortcuts'ları bağla
      klavyeKisayollari();

      // Hamburger menü eventlerini bağla (Mobil)
      hamburgerMenuEventleri();

      // Rol bazlı varsayılan view'a yönlendir
      const kullaniciRolu = kullanici.rol as UserRole;
      let varsayilanView = 'dashboard';
      if (kullaniciRolu === 'Antrenör') {
        varsayilanView = 'sporcu-listesi';
      } else if (kullaniciRolu === 'Muhasebe') {
        varsayilanView = 'dashboard';
      } else {
        varsayilanView = 'dashboard';
      }

      viewGoster(varsayilanView, true);

      // Nav indicator pozisyonunu ayarla
      setTimeout(() => {
        navIndicatorGuncelle(varsayilanView);
      }, 100);

      state.yuklendi = true;

      // Splash screen'i kapat ve app container'ı göster
      splashScreenKapat();
      setTimeout(() => {
        const appContainer = Helpers.$('.app-container');
        if (appContainer) {
          (appContainer as HTMLElement).style.display = 'flex';

          // App container görünür olduktan sonra sidebar yönetimini başlat
          // DOM hazır olduğundan emin olmak için biraz bekle
          setTimeout(() => {
            // Tema yönetimini başlat
            temaYonetiminiBaslat();

            // Masaüstü sidebar yönetimi (varsayılan açık + tercih kaydı)
            if (typeof window !== 'undefined' && window.innerWidth >= 769) {
              try {
                masaustuSidebarYonetimi();
              } catch (e) {
                console.warn('Masaüstü sidebar yönetimi hatası:', e);
              }
            }
          }, 100);
        }
      }, 1800); // Splash screen animasyonu bitene kadar bekle
    } catch (error) {
      console.error('Uygulama başlatma hatası:', error);
      Helpers.toast('Uygulama başlatılırken hata oluştu!', 'error');
      // Hata durumunda da app container'ı göster
      const appContainer = Helpers.$('.app-container');
      if (appContainer) {
        (appContainer as HTMLElement).style.display = 'flex';
      }
      splashScreenKapat();
    }
  });
}

/**
 * Kullanıcı bilgilerini header'da göster
 */
function kullaniciBilgileriniGoster(): void {
  const kullanici = Auth.aktifKullanici();
  if (!kullanici) return;

  const userNameEl = Helpers.$('#userName');
  const userRoleBadgeEl = Helpers.$('#userRoleBadge');
  const headerUserEl = Helpers.$('#headerUser');
  const logoutBtn = Helpers.$('#logoutBtn');

  if (userNameEl) {
    userNameEl.textContent = kullanici.adSoyad || kullanici.kullaniciAdi || 'Sistem Yöneticisi';
  }

  if (userRoleBadgeEl) {
    userRoleBadgeEl.textContent = kullanici.rol || 'Yönetici';
  }

  if (headerUserEl) {
    (headerUserEl as HTMLElement).style.display = 'flex';
  }

  if (logoutBtn) {
    (logoutBtn as HTMLElement).style.display = 'flex';
  }
}

/**
 * Rol bazlı menü gizleme
 */
export function rolBazliMenuGizle(): void {
  const kullanici = Auth.aktifKullanici();
  if (!kullanici) return;

  const rol = kullanici.rol as UserRole;
  const navButtons = Helpers.$$('#mainNav button[data-rol]');

  navButtons.forEach(btn => {
    const izinVerilenRoller = btn.getAttribute('data-rol');

    if (izinVerilenRoller === 'all') {
      // Tüm roller erişebilir
      (btn as HTMLElement).style.display = '';
    } else {
      // Belirli roller erişebilir
      const roller = izinVerilenRoller?.split(',').map(r => r.trim()) || [];
      if (roller.includes(rol)) {
        (btn as HTMLElement).style.display = '';
      } else {
        (btn as HTMLElement).style.display = 'none';
      }
    }
  });

  // View'lara erişimi kontrol et
  viewYetkiKontrol();
}

/**
 * View erişim yetkisi kontrolü
 */
function viewYetkiKontrol(): void {
  const kullanici = Auth.aktifKullanici();
  if (!kullanici) return;

  const rol = kullanici.rol as UserRole;

  // Uluslararası RBAC normlarına göre view yetkileri
  const yetkiler: ViewYetkileri = {
    Yönetici: [
      'dashboard',
      'sporcu-kayit',
      'sporcu-listesi',
      'aidat',
      'yoklama',
      'giderler',
      'antrenorler',
      'raporlar',
      'ayarlar',
      'kullanici-yonetimi',
    ],
    Antrenör: ['sporcu-listesi', 'yoklama'], // Dashboard YOK - Finansal bilgiler içeriyor
    Muhasebe: ['dashboard', 'aidat', 'giderler', 'raporlar'], // Finansal işlemler için dashboard gerekli
  };

  const izinliViewlar = yetkiler[rol] || [];

  // Tüm view'ları kontrol et
  const views = Helpers.$$('.view');
  views.forEach(view => {
    const viewId = view.id;
    if (!izinliViewlar.includes(viewId)) {
      // Erişim yok, view'ı gizle (inline style ile - CSS class'dan önce çalışır)
      (view as HTMLElement).style.display = 'none';
    } else {
      // Erişim var - inline style'ı temizle (CSS class'ın çalışmasına izin ver)
      // viewGoster() fonksiyonu aktif view için style.display = 'block' set edecek
      // Burada sadece inline style'ı temizliyoruz, CSS class'ın çalışmasına izin veriyoruz
      const viewEl = view as HTMLElement;
      if (viewEl.style.display === 'none') {
        viewEl.style.display = '';
      }
    }
  });
}

/**
 * Ayarları güncelle
 */
function ayarlariGuncelle(): void {
  const istatistikler = Storage.istatistikler();

  const sporcuEl = Helpers.$('#istatSporcu');
  const odemeEl = Helpers.$('#istatOdeme');
  const yoklamaEl = Helpers.$('#istatYoklama');
  const giderEl = Helpers.$('#istatGider');
  const depolamaEl = Helpers.$('#istatDepolama');

  if (sporcuEl) sporcuEl.textContent = istatistikler.sporcuSayisi.toString();
  if (odemeEl) odemeEl.textContent = istatistikler.odemeSayisi.toString();
  if (yoklamaEl) yoklamaEl.textContent = istatistikler.yoklamaSayisi.toString();
  if (giderEl) giderEl.textContent = istatistikler.giderSayisi.toString();
  if (depolamaEl) depolamaEl.textContent = istatistikler.depolamaKB + ' KB';

  // Hatırlatma ayarlarını göster
  hatirlatmaAyarlariGoster();
}

/**
 * Hatırlatma ayarlarını göster - Profesyonel Panel
 */
export function hatirlatmaAyarlariGoster(): void {
  const container = Helpers.$('#notificationSettings');
  if (!container) {
    console.warn('Hatırlatma ayarları container bulunamadı');
    return;
  }

  if (typeof window === 'undefined' || !window.Notification) {
    container.innerHTML =
      '<div class="empty-state"><i class="fa-solid fa-exclamation-triangle"></i><p>Bildirim modülü yüklenemedi</p></div>';
    return;
  }

  // Güncel ayarları al (her seferinde fresh data)
  let ayarlar: any;
  try {
    if (typeof Notification.ayarlariGetir === 'function') {
      ayarlar = Notification.ayarlariGetir();
    } else {
      container.innerHTML =
        '<div class="empty-state"><i class="fa-solid fa-exclamation-triangle"></i><p>Ayarlar fonksiyonu bulunamadı</p></div>';
      return;
    }
  } catch (error) {
    console.error('Ayarlar alınamadı:', error);
    container.innerHTML =
      '<div class="empty-state"><i class="fa-solid fa-exclamation-triangle"></i><p>Ayarlar yüklenemedi</p></div>';
    return;
  }

  if (!ayarlar) {
    container.innerHTML =
      '<div class="empty-state"><i class="fa-solid fa-exclamation-triangle"></i><p>Ayarlar bulunamadı</p></div>';
    return;
  }

  container.innerHTML = `
    <!-- Ana Toggle - Kompakt -->
    <div class="notification-compact-toggle">
      <div class="notification-compact-toggle-content">
        <span class="notification-compact-label">Hatırlatma Sistemi</span>
        <span class="notification-compact-desc">Otomatik hatırlatmaları aktifleştir</span>
      </div>
      <label class="toggle-switch">
        <input type="checkbox" id="notificationEnabled" ${ayarlar.enabled ? 'checked' : ''} 
               onchange="if(window.Notification && window.Notification.ayarlariGuncelle) window.Notification.ayarlariGuncelle({enabled: this.checked});">
        <span class="toggle-slider"></span>
      </label>
    </div>
    
    <!-- Bildirim Yöntemleri -->
    <div class="notification-compact-section">
      <h5 class="notification-compact-section-title">
        <i class="fa-solid fa-paper-plane"></i>
        Bildirim Kanalları
      </h5>
      <div class="notification-methods-grid-compact">
        <div class="notification-method-compact ${ayarlar.methods?.sms ? 'active' : ''}">
          <div class="notification-method-icon-compact sms">
            <i class="fa-solid fa-sms"></i>
          </div>
          <span class="notification-method-name-compact">SMS</span>
          <label class="toggle-switch-small">
            <input type="checkbox" ${ayarlar.methods?.sms ? 'checked' : ''} 
                   onchange="if(window.Notification && window.Notification.ayarlariGuncelle) window.Notification.ayarlariGuncelle({methods: {sms: this.checked}});">
            <span class="toggle-slider-small"></span>
          </label>
        </div>
        
        <div class="notification-method-compact ${ayarlar.methods?.email ? 'active' : ''}">
          <div class="notification-method-icon-compact email">
            <i class="fa-solid fa-envelope"></i>
          </div>
          <span class="notification-method-name-compact">E-posta</span>
          <label class="toggle-switch-small">
            <input type="checkbox" ${ayarlar.methods?.email ? 'checked' : ''} 
                   onchange="if(window.Notification && window.Notification.ayarlariGuncelle) window.Notification.ayarlariGuncelle({methods: {email: this.checked}});">
            <span class="toggle-slider-small"></span>
          </label>
        </div>
        
        <div class="notification-method-compact ${ayarlar.methods?.whatsapp ? 'active' : ''}">
          <div class="notification-method-icon-compact whatsapp">
            <i class="fa-brands fa-whatsapp"></i>
          </div>
          <span class="notification-method-name-compact">WhatsApp</span>
          <label class="toggle-switch-small">
            <input type="checkbox" ${ayarlar.methods?.whatsapp ? 'checked' : ''} 
                   onchange="if(window.Notification && window.Notification.ayarlariGuncelle) window.Notification.ayarlariGuncelle({methods: {whatsapp: this.checked}});">
            <span class="toggle-slider-small"></span>
          </label>
        </div>
        
        <div class="notification-method-compact ${ayarlar.methods?.inApp ? 'active' : ''}">
          <div class="notification-method-icon-compact inapp">
            <i class="fa-solid fa-bell"></i>
          </div>
          <span class="notification-method-name-compact">Uygulama İçi</span>
          <label class="toggle-switch-small">
            <input type="checkbox" ${ayarlar.methods?.inApp ? 'checked' : ''} 
                   onchange="if(window.Notification && window.Notification.ayarlariGuncelle) window.Notification.ayarlariGuncelle({methods: {inApp: this.checked}});">
            <span class="toggle-slider-small"></span>
          </label>
        </div>
      </div>
    </div>
    
    <!-- Zamanlama Ayarları - Kompakt -->
    <div class="notification-compact-section">
      <h5 class="notification-compact-section-title">
        <i class="fa-solid fa-clock"></i>
        Zamanlama
      </h5>
      <div class="notification-timing-grid-compact">
        <div class="notification-timing-compact">
          <div class="notification-timing-icon-compact">
            <i class="fa-solid fa-calendar-minus"></i>
          </div>
          <div class="notification-timing-content-compact">
            <label class="notification-timing-label-compact">Önceden Hatırlat</label>
            <div class="notification-timing-input-compact">
              <input type="number" id="notifDaysBefore" min="0" max="30" value="${ayarlar.timing?.daysBefore || 0}" 
                     class="notification-number-input-compact"
                     onchange="if(window.Notification && window.Notification.ayarlariGuncelle) window.Notification.ayarlariGuncelle({timing: {daysBefore: parseInt(this.value) || 0}});">
              <span class="notification-timing-unit-compact">gün</span>
            </div>
          </div>
        </div>
        
        <div class="notification-timing-compact">
          <div class="notification-timing-icon-compact today">
            <i class="fa-solid fa-calendar-day"></i>
          </div>
          <div class="notification-timing-content-compact">
            <label class="notification-timing-label-compact">Ödeme Günü</label>
            <label class="toggle-switch-small">
              <input type="checkbox" id="notifOnDueDate" ${ayarlar.timing?.onDueDate ? 'checked' : ''}
                     onchange="if(window.Notification && window.Notification.ayarlariGuncelle) window.Notification.ayarlariGuncelle({timing: {onDueDate: this.checked}});">
              <span class="toggle-slider-small"></span>
            </label>
          </div>
        </div>
        
        <div class="notification-timing-compact">
          <div class="notification-timing-icon-compact warning">
            <i class="fa-solid fa-calendar-xmark"></i>
          </div>
          <div class="notification-timing-content-compact">
            <label class="notification-timing-label-compact">Gecikme Hatırlatması</label>
            <div class="notification-timing-input-compact">
              <input type="number" id="notifDaysAfter" min="0" max="30" value="${ayarlar.timing?.daysAfter || 0}" 
                     class="notification-number-input-compact"
                     onchange="if(window.Notification && window.Notification.ayarlariGuncelle) window.Notification.ayarlariGuncelle({timing: {daysAfter: parseInt(this.value) || 0}});">
              <span class="notification-timing-unit-compact">gün</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Tüm modülleri güncelle
 */
function tumunuGuncelle(): void {
  if (typeof window !== 'undefined') {
    if (window.Dashboard && typeof Dashboard.guncelle === 'function') Dashboard.guncelle();
    if (window.Sporcu && typeof Sporcu.listeyiGuncelle === 'function') Sporcu.listeyiGuncelle();
    if (window.Aidat && typeof Aidat.listeyiGuncelle === 'function') Aidat.listeyiGuncelle();
    if (window.Yoklama && typeof Yoklama.listeyiGuncelle === 'function') Yoklama.listeyiGuncelle();
    if (window.Gider && typeof Gider.listeyiGuncelle === 'function') Gider.listeyiGuncelle();
    if (window.Rapor && typeof Rapor.guncelle === 'function') Rapor.guncelle();
  }
}

/**
 * Aktif view'u getir
 * @returns Aktif view ID
 */
function aktifViewGetir(): string {
  return state.aktifView;
}

/**
 * Uygulama yüklendi mi?
 * @returns boolean
 */
function yuklendiMi(): boolean {
  return state.yuklendi;
}

// ========== MOBILE MENU ==========

/**
 * Hamburger menü eventlerini bağla (Mobile)
 */
function hamburgerMenuEventleri(): void {
  const hamburgerBtn = Helpers.$('#hamburgerBtn');
  const sidebar = Helpers.$('#sidebar');
  const overlay = Helpers.$('#mobileMenuOverlay');
  const closeBtn = Helpers.$('#sidebarCloseBtn');

  if (!hamburgerBtn || !sidebar || !overlay) {
    console.warn('hamburgerMenuEventleri: Butonlar bulunamadı', {
      hamburgerBtn: !!hamburgerBtn,
      sidebar: !!sidebar,
      overlay: !!overlay,
    });
    return;
  }

  // Hamburger butonuna tıklama
  if (hamburgerBtn) {
    hamburgerBtn.addEventListener('click', function (e: Event) {
      e.stopPropagation();
      // Sadece mobilde çalış
      if (isMobile()) {
        toggleMobileMenu();
      }
    });
  }

  // Close butonuna tıklama
  if (closeBtn) {
    closeBtn.addEventListener('click', function (e: Event) {
      e.stopPropagation();
      // Sadece mobilde çalış
      if (isMobile()) {
        closeMobileMenu();
      }
    });
  }

  // Overlay'e tıklayınca menüyü kapat
  if (overlay) {
    overlay.addEventListener('click', function () {
      // Sadece mobilde çalış
      if (isMobile()) {
        closeMobileMenu();
      }
    });
  }

  // ESC tuşu ile menüyü kapat (sadece mobilde)
  document.addEventListener('keydown', function (e: KeyboardEvent) {
    if (e.key === 'Escape' && isMobile() && sidebar && sidebar.classList.contains('open')) {
      closeMobileMenu();
    }
  });

  // Nav butonlarına tıklandığında menüyü kapat (SADECE MOBİLDE)
  // NOT: Bu event listener'lar navigasyonEventleri() ile çakışmamalı
  // Çünkü navigasyonEventleri() zaten tüm butonlara listener ekliyor
  // Burada sadece mobil menüyü kapatmak için ek bir listener ekliyoruz
  const navButtons = Helpers.$$('#mainNav button');
  navButtons.forEach(btn => {
    // Sadece mobil menüyü kapatmak için ek listener (navigasyonEventleri ile çakışmaz)
    btn.addEventListener(
      'click',
      function () {
        // Sadece mobilde menüyü kapat, masaüstünde sidebar açık kalmalı
        if (isMobile()) {
          closeMobileMenu();
        }
      },
      { capture: false }
    ); // capture: false ile navigasyonEventleri'nden sonra çalışır
  });

  // Swipe gesture (sol kenardan sağa çekince aç) - sadece mobilde
  let touchStartX = 0;
  let touchEndX = 0;

  document.addEventListener(
    'touchstart',
    function (e: TouchEvent) {
      if (!isMobile()) return;
      if (e.changedTouches && e.changedTouches[0]) {
        touchStartX = e.changedTouches[0].screenX;
      }
    },
    { passive: true }
  );

  document.addEventListener(
    'touchend',
    function (e: TouchEvent) {
      if (!isMobile()) return;
      if (e.changedTouches && e.changedTouches[0]) {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipeGesture();
      }
    },
    { passive: true }
  );

  function handleSwipeGesture(): void {
    if (!isMobile()) return;

    const swipeThreshold = 80;
    const swipeDistance = touchEndX - touchStartX;

    // Sol kenardan sağa swipe (menü kapalıyken)
    if (
      touchStartX < 30 &&
      swipeDistance > swipeThreshold &&
      sidebar &&
      !sidebar.classList.contains('open')
    ) {
      openMobileMenu();
    }

    // Sağdan sola swipe (menü açıkken)
    if (swipeDistance < -swipeThreshold && sidebar && sidebar.classList.contains('open')) {
      closeMobileMenu();
    }
  }
}

/**
 * Mobil menüyü aç/kapat
 */
export function toggleMobileMenu(): void {
  // Sadece mobilde çalış
  if (!isMobile()) return;

  const hamburgerBtn = Helpers.$('#hamburgerBtn');
  const sidebar = Helpers.$('#sidebar');
  const overlay = Helpers.$('#mobileMenuOverlay');

  if (!hamburgerBtn || !sidebar || !overlay) return;

  const isOpen = sidebar.classList.contains('open');

  if (isOpen) {
    closeMobileMenu();
  } else {
    openMobileMenu();
  }
}

/**
 * Mobil menüyü aç
 */
export function openMobileMenu(): void {
  // Sadece mobilde çalış
  if (!isMobile()) return;

  const fabBtn = Helpers.$('#hamburgerBtn');
  const sidebar = Helpers.$('#sidebar');
  const overlay = Helpers.$('#mobileMenuOverlay');

  if (!fabBtn || !sidebar || !overlay) return;

  // Masaüstü class'larını temizle (çakışmayı önle)
  sidebar.classList.remove('sidebar-closed');

  fabBtn.classList.add('active');
  fabBtn.setAttribute('aria-expanded', 'true');
  sidebar.classList.add('open');
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden'; // Arka plan scroll'unu engelle
}

/**
 * Mobil menüyü kapat
 */
export function closeMobileMenu(): void {
  // Sadece mobilde çalış
  if (!isMobile()) return;

  const fabBtn = Helpers.$('#hamburgerBtn');
  const sidebar = Helpers.$('#sidebar');
  const overlay = Helpers.$('#mobileMenuOverlay');

  if (!fabBtn || !sidebar || !overlay) return;

  fabBtn.classList.remove('active');
  fabBtn.setAttribute('aria-expanded', 'false');
  if (sidebar) {
    sidebar.classList.remove('open');
  }
  overlay.classList.remove('active');
  document.body.style.overflow = ''; // Scroll'u geri aç
}

// ========== DESKTOP SIDEBAR ==========

/**
 * Masaüstü Sidebar Yönetimi
 * - Varsayılan açık
 * - Hamburger ile kapatılabilir
 * - Tercih localStorage'da saklanır
 */
export function masaustuSidebarYonetimi(): void {
  const sidebar = Helpers.$('#sidebar');

  if (!sidebar) {
    // Sidebar bulunamazsa kısa bir süre sonra tekrar dene (DOM henüz hazır olmayabilir)
    setTimeout(() => {
      masaustuSidebarYonetimi();
    }, 200);
    return;
  }

  const desktopSidebarToggle = Helpers.$('#desktopSidebarToggle');
  const desktopMenuToggle = Helpers.$('#desktopMenuToggle');

  // localStorage'dan tercih oku
  const sidebarPref =
    typeof localStorage !== 'undefined' ? localStorage.getItem('sidebarOpen') : null;
  const shouldBeOpen = sidebarPref === null ? true : sidebarPref === 'true'; // Varsayılan: açık

  // Tercihi uygula
  if (shouldBeOpen) {
    sidebar.classList.remove('sidebar-closed');
  } else {
    sidebar.classList.add('sidebar-closed');
  }

  // Event listener'ları sadece bir kez bağla (çift bağlantı önleme)
  // Sidebar içindeki toggle butonu (açıkken görünür)
  if (desktopSidebarToggle && !desktopSidebarToggle.hasAttribute('data-sidebar-listener')) {
    desktopSidebarToggle.setAttribute('data-sidebar-listener', 'true');
    desktopSidebarToggle.addEventListener('click', function (e: Event) {
      e.stopPropagation();
      toggleDesktopSidebar();
    });
  }

  // Floating toggle butonu (kapalıyken görünür)
  if (desktopMenuToggle && !desktopMenuToggle.hasAttribute('data-menu-listener')) {
    desktopMenuToggle.setAttribute('data-menu-listener', 'true');
    desktopMenuToggle.addEventListener('click', function (e: Event) {
      e.stopPropagation();
      toggleDesktopSidebar();
    });
  }

  // Pencere boyutu değiştiğinde kontrol et (masaüstü/mobil geçişi)
  let resizeTimer: ReturnType<typeof setTimeout>;
  if (typeof window !== 'undefined') {
    // Önce mevcut listener'ı temizle (çift bağlantı önleme)
    const existingHandler = (window as any).__soybis_resize_handler;
    if (existingHandler) {
      window.removeEventListener('resize', existingHandler);
    }

    const resizeHandler = function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        handleResize();
      }, 100);
    };

    // Handler'ı window'a kaydet (temizleme için)
    (window as any).__soybis_resize_handler = resizeHandler;

    window.addEventListener('resize', resizeHandler);
    // İlk yüklemede de kontrol et
    setTimeout(() => handleResize(), 100);
  }
}

/**
 * Masaüstü sidebar'ı aç/kapat
 */
export function toggleDesktopSidebar(): void {
  const sidebar = Helpers.$('#sidebar');
  if (!sidebar) return;

  const isClosed = sidebar.classList.contains('sidebar-closed');

  if (isClosed) {
    // Aç
    sidebar.classList.remove('sidebar-closed');
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('sidebarOpen', 'true');
    }
  } else {
    // Kapat
    sidebar.classList.add('sidebar-closed');
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('sidebarOpen', 'false');
    }
  }
}

// ========== MAIN INITIALIZATION ==========

/**
 * Uygulamayı başlat
 */
/**
 * Malzeme modal event listener'larını bağla (merkezi - bir kez)
 */
function malzemeModalEventleriniBagla(): void {
  // Çift eklenmeyi önle
  if ((document as any).__soybis_malzeme_modal_listener_eklendi) {
    return;
  }

  const modalClickHandler = (e: Event) => {
    const target = e.target as HTMLElement;

    // Sadece malzeme modal içindeki butonları işle
    const malzemeModal = Helpers.$('#malzemeEkleModal');
    if (!malzemeModal) return;

    // Tıklanan element malzeme modal içinde değilse, işleme
    // Bu kontrol en önce yapılmalı - modal dışındaki hiçbir şeyi işleme
    if (!malzemeModal.contains(target)) {
      return; // Modal dışındaki tıklamaları hiç işleme - form submit'leri engelleme
    }

    // Buraya geldiysek, tıklanan element malzeme modal içinde
    // Sadece malzeme modal butonlarını işle

    // Buton veya içindeki icon/text elementine tıklanmış olabilir
    const button = target.closest('button') as HTMLButtonElement | null;
    const buttonId = button?.id || target.id;

    // Kapat butonları
    if (
      buttonId === 'malzemeModalKapat' ||
      buttonId === 'malzemeIptal' ||
      target.id === 'malzemeModalKapat' ||
      target.id === 'malzemeIptal'
    ) {
      e.preventDefault();
      e.stopPropagation();

      // Context bilgisini modal'dan oku (data-modal-context attribute)
      const context = malzemeModal.getAttribute('data-modal-context');

      if (context === 'dashboard') {
        // Dashboard modülünden kapat
        if (
          window.Dashboard &&
          typeof (window.Dashboard as any).malzemeModalKapatF === 'function'
        ) {
          (window.Dashboard as any).malzemeModalKapatF();
        }
      } else if (context === 'sporcu-kayit') {
        // Sporcu modülünden kapat
        if (
          window.Sporcu &&
          typeof (window.Sporcu as any).sporcuMalzemeEkleModalKapat === 'function'
        ) {
          (window.Sporcu as any).sporcuMalzemeEkleModalKapat();
        }
      }

      // Context temizle
      malzemeModal.removeAttribute('data-modal-context');
      return;
    }

    // Kaydet butonu
    if (buttonId === 'malzemeEkleKaydet' || target.id === 'malzemeEkleKaydet') {
      e.preventDefault();
      e.stopPropagation();

      // Context bilgisini modal'dan oku
      const context = malzemeModal.getAttribute('data-modal-context');

      if (context === 'dashboard') {
        // Dashboard modülünden kaydet
        if (window.Dashboard && typeof (window.Dashboard as any).malzemeKaydet === 'function') {
          (window.Dashboard as any).malzemeKaydet();
        }
      } else if (context === 'sporcu-kayit') {
        // Sporcu modülünden kaydet
        if (window.Sporcu && typeof (window.Sporcu as any).sporcuMalzemeKaydet === 'function') {
          (window.Sporcu as any).sporcuMalzemeKaydet();
        }
      }
      return;
    }

    // Modal backdrop - sadece malzeme modal'ın kendisine tıklandığında
    if (target === malzemeModal) {
      e.preventDefault();
      e.stopPropagation();

      // Context bilgisini modal'dan oku
      const context = malzemeModal.getAttribute('data-modal-context');

      if (context === 'dashboard') {
        // Dashboard modülünden kapat
        if (
          window.Dashboard &&
          typeof (window.Dashboard as any).malzemeModalKapatF === 'function'
        ) {
          (window.Dashboard as any).malzemeModalKapatF();
        }
      } else if (context === 'sporcu-kayit') {
        // Sporcu modülünden kapat
        if (
          window.Sporcu &&
          typeof (window.Sporcu as any).sporcuMalzemeEkleModalKapat === 'function'
        ) {
          (window.Sporcu as any).sporcuMalzemeEkleModalKapat();
        }
      }

      // Context temizle
      malzemeModal.removeAttribute('data-modal-context');
      return;
    }
  };

  document.addEventListener('click', modalClickHandler);
  (document as any).__soybis_malzeme_modal_listener_eklendi = true;
  (document as any).__soybis_malzeme_modal_listener = modalClickHandler;

  // Tutar input için para formatı
  const inputHandler = (e: Event) => {
    const target = e.target as HTMLElement;
    if (target.id === 'malzemeTutar' && target instanceof HTMLInputElement) {
      Helpers.paraFormatInput(target);
    }
  };

  document.addEventListener('input', inputHandler);
  (document as any).__soybis_malzeme_input_listener = inputHandler;
}

export async function init(): Promise<void> {
  // Uygulama başlatılıyor

  // Malzeme modal event listener'larını merkezi olarak bağla (bir kez)
  malzemeModalEventleriniBagla();

  // Body'ye koyu arka plan rengi ekle (CSS yüklenene kadar beyaz ekranı önle)
  if (document.body) {
    document.body.style.backgroundColor = '#0a0e27';
    document.body.style.color = '#ffffff';
    document.body.style.margin = '0';
    document.body.style.padding = '0';
  }

  // Splash screen ve login overlay'i başlangıçta gizle (sayfa yüklenirken flash etmesin)
  const splash = Helpers.$('#splashScreen');
  if (splash) {
    (splash as HTMLElement).style.display = 'none';
    splash.classList.add('hidden');
  }

  const loginOverlay = Helpers.$('#loginOverlay');
  if (loginOverlay) {
    (loginOverlay as HTMLElement).style.display = 'none';
    loginOverlay.classList.add('hidden');
  }

  // Tüm modal'ları başlangıçta gizle (CSS yüklenmeden önce görünmesin)
  const modals = document.querySelectorAll('.modal');
  modals.forEach(modal => {
    (modal as HTMLElement).style.display = 'none';
    (modal as HTMLElement).style.setProperty('display', 'none', 'important');
  });

  // Önce auth kontrolü yap
  try {
    // Sistem başlatma - varsayılan admin oluştur
    if (typeof Storage.sistemBaslat === 'function') {
      await Storage.sistemBaslat();
    }

    // Auth kontrolü
    const girisYapilmis = Auth.kontrol();

    if (!girisYapilmis) {
      // Giriş yapılmamış, login overlay'i göster (CSS yüklendikten sonra)
      requestAnimationFrame(() => {
        loginOverlayGoster();
        loginEventleri();
      });
      return; // Uygulamayı başlatma
    }

    // Giriş yapılmış, login overlay'i kesinlikle gizle ve uygulamayı başlat
    if (loginOverlay) {
      (loginOverlay as HTMLElement).style.display = 'none';
      loginOverlay.classList.add('hidden');
      (loginOverlay as HTMLElement).style.setProperty('display', 'none', 'important');
    }

    // App container'ı göster (CSS yüklendikten sonra)
    const appContainer = Helpers.$('.app-container');
    if (appContainer) {
      // CSS'in yüklenmesini bekle
      requestAnimationFrame(() => {
        (appContainer as HTMLElement).style.display = 'flex';

        // Logo'ları göster (flash etmemesi için biraz bekle)
        setTimeout(() => {
          const sidebarLogo = Helpers.$('.sidebar-logo');
          if (sidebarLogo) {
            (sidebarLogo as HTMLImageElement).style.display = '';
          }
          const headerLogo = Helpers.$('.header-logo');
          if (headerLogo) {
            (headerLogo as HTMLImageElement).style.display = '';
          }
        }, 100);
      });
    }
    kullaniciBilgileriniGoster();
  } catch (error) {
    console.error('Auth kontrolü hatası:', error);
    loginOverlayGoster();
    loginEventleri();
    return;
  }

  // Sayfa yenilendi (giriş yapılmış), splash screen'i tamamen kaldır
  if (splash) {
    (splash as HTMLElement).style.display = 'none';
    splash.classList.add('hidden');
    // Splash screen'i DOM'dan kaldır (flash etmemesi için)
    setTimeout(() => {
      splash.remove();
    }, 0);
  }

  // Kayıtlı view'u kontrol et (sayfa yenilendi mi?)
  const kayitliView =
    typeof localStorage !== 'undefined' ? localStorage.getItem('soybis_aktifView') : null;

  try {
    // Eski verileri migrate et
    try {
      if (
        typeof window !== 'undefined' &&
        window.Storage &&
        typeof Storage.veriMigration === 'function'
      ) {
        Storage.veriMigration();
      }
    } catch (e) {
      console.warn('Veri migration hatası:', e);
    }

    // Tarihi güncelle
    try {
      tarihiGuncelle();
    } catch (e) {
      console.warn('Tarih güncelleme hatası:', e);
    }

    // Navigasyon eventlerini bağla
    try {
      navigasyonEventleri();
    } catch (e) {
      console.warn('Navigasyon eventleri hatası:', e);
    }

    // Rol bazlı menü gizleme
    rolBazliMenuGizle();

    // Modülleri başlat
    modulleriBaslat();

    // Ayarlar eventlerini bağla
    try {
      ayarlarEventleri();
    } catch (e) {
      console.warn('Ayarlar eventleri hatası:', e);
    }

    // Keyboard shortcuts'ları bağla
    try {
      klavyeKisayollari();
    } catch (e) {
      console.warn('Klavye kısayolları hatası:', e);
    }

    // Tema yönetimini başlat (sayfa yenilendiğinde de çalışsın)
    try {
      temaYonetiminiBaslat();
    } catch (e) {
      console.warn('Tema yönetimi hatası:', e);
    }

    // Hamburger menü eventlerini bağla (Mobil)
    try {
      hamburgerMenuEventleri();
    } catch (e) {
      console.warn('Hamburger menü eventleri hatası:', e);
    }

    // Masaüstü sidebar yönetimi (varsayılan açık + tercih kaydı)
    if (typeof window !== 'undefined' && window.innerWidth >= 769) {
      try {
        masaustuSidebarYonetimi();
      } catch (e) {
        console.warn('Masaüstü sidebar yönetimi hatası:', e);
      }
    }

    // Son görüntülenen view'u localStorage'dan al veya rol bazlı varsayılan göster
    let sonView = kayitliView;
    if (!sonView) {
      const kullanici = Auth.aktifKullanici();
      const rol = kullanici?.rol as UserRole;
      if (rol === 'Antrenör') {
        sonView = 'sporcu-listesi'; // Antrenör için varsayılan
      } else {
        sonView = 'dashboard'; // Yönetici ve Muhasebe için varsayılan
      }
    }
    // İlk başlatmada input temizleme yapma (DOM henüz hazır olmayabilir)
    try {
      viewGoster(sonView, true); // true = ilk başlatma
    } catch (e) {
      console.warn('View gösterme hatası:', e);
    }

    // İlk indicator pozisyonunu ayarla (biraz gecikmeyle DOM'un hazır olmasını bekle)
    setTimeout(() => {
      try {
        // Yetki kontrolü - eğer sonView erişilemezse rol bazlı varsayılan kullan
        const kullanici = Auth.aktifKullanici();
        const rol = kullanici?.rol as UserRole;
        const yetkiler: ViewYetkileri = {
          Yönetici: [
            'dashboard',
            'sporcu-kayit',
            'sporcu-listesi',
            'aidat',
            'yoklama',
            'giderler',
            'antrenorler',
            'raporlar',
            'ayarlar',
            'kullanici-yonetimi',
          ],
          Antrenör: ['sporcu-listesi', 'yoklama'],
          Muhasebe: ['dashboard', 'aidat', 'giderler', 'raporlar'],
        };

        // Özel durum: sporcu-detay-raporu view'i sporcu-listesi yetkisine sahip olanlar için erişilebilir
        const izinliViewlar = yetkiler[rol] || [];
        const isRaporView = sonView === 'sporcu-detay-raporu';
        const hasSporcuListesiAccess = izinliViewlar.includes('sporcu-listesi');
        const gosterilecekView =
          izinliViewlar.includes(sonView || '') || (isRaporView && hasSporcuListesiAccess)
            ? sonView
            : rol === 'Antrenör'
              ? 'sporcu-listesi'
              : 'dashboard';
        if (gosterilecekView) {
          navIndicatorGuncelle(gosterilecekView);
        }
      } catch (e) {
        console.warn('Nav indicator hatası:', e);
      }
    }, 100);

    state.yuklendi = true;

    // Sadece ilk yüklemede splash screen göster (yenilemede değil)
    if (!kayitliView) {
      splashScreenKapat();
    }
  } catch (error: any) {
    // Sadece kritik hatalarda toast göster
    console.error('Uygulama başlatma hatası:', error);
    // Kritik hatalar için toast göster (sadece gerçek kritik hatalarda ve Helpers yüklüyse)
    try {
      if (
        typeof window !== 'undefined' &&
        (window as any).Helpers &&
        typeof (window as any).Helpers.toast === 'function'
      ) {
        if (
          error.message &&
          !error.message.includes('Cannot read property') &&
          !error.message.includes('undefined')
        ) {
          (window as any).Helpers.toast('Uygulama başlatılırken hata oluştu!', 'error');
        }
      }
    } catch (e) {
      // Toast gösterilemezse sessizce devam et
      console.warn('Toast gösterilemedi:', e);
    }
    // Hata olsa bile splash screen'i kapat
    if (!kayitliView) {
      splashScreenKapat();
    }
  }
}

// ========== EXPORTS ==========

// Public API
export const App = {
  init,
  viewGoster,
  tumunuGuncelle,
  aktifViewGetir,
  yuklendiMi,
  hatirlatmaAyarlariGoster,
  rolBazliMenuGizle,
  kullaniciBilgileriniGoster,
  toggleMobileMenu,
  openMobileMenu,
  closeMobileMenu,
  toggleDesktopSidebar,
  masaustuSidebarYonetimi,
  isMobile,
};

/**
 * Modülleri window'a expose et (backward compatibility için)
 */
export function exposeModulesToWindow(): void {
  if (typeof window !== 'undefined') {
    // Set modules on window for backward compatibility
    // Use type assertion to avoid conflicts with existing interface definitions
    (window as any).Storage = Storage;
    (window as any).Auth = Auth;
    (window as any).Helpers = Helpers;

    // Tema yönetimi fonksiyonlarını expose et
    (window as any).temaDegistir = temaDegistir;
    (window as any).temaYonetiminiBaslat = temaYonetiminiBaslat;
    (window as any).Dashboard = Dashboard;
    const existingSporcu = (window as any).Sporcu;
    (window as any).Sporcu = {
      ...Sporcu,
      ...(existingSporcu?.kaydet && { kaydet: existingSporcu.kaydet }),
      ...(existingSporcu?.raporGoster && { raporGoster: existingSporcu.raporGoster }),
      ...(existingSporcu?.sporcuMalzemeEkleModalKapat && {
        sporcuMalzemeEkleModalKapat: existingSporcu.sporcuMalzemeEkleModalKapat,
      }),
      ...(existingSporcu?.sporcuMalzemeKaydet && {
        sporcuMalzemeKaydet: existingSporcu.sporcuMalzemeKaydet,
      }),
    };
    // Aidat modülünü expose et - butonlar window.Aidat.odemeModalAc() şeklinde çağırıyor
    // Hem modül yüklendiğinde hem de burada expose ediyoruz (güvenlik için)
    (window as any).Aidat = {
      init: Aidat.init,
      listeyiGuncelle: Aidat.listeyiGuncelle,
      hizliFiltrele: Aidat.hizliFiltrele,
      filtreSifirla: Aidat.filtreSifirla,
      odemeModalAc: Aidat.odemeModalAc,
      gecmisModalAc: Aidat.gecmisModalAc,
      donemRaporu: Aidat.donemRaporu,
      takvimiOlustur: Aidat.takvimiOlustur,
      aylikOzetOlustur: Aidat.aylikOzetOlustur,
      monthlyListToggle: Aidat.monthlyListToggle,
      monthlyTabSwitch: Aidat.monthlyTabSwitch,
      monthlySearchFilter: Aidat.monthlySearchFilter,
      monthlyDebtFilter: Aidat.monthlyDebtFilter,
      monthlyPaidFilter: Aidat.monthlyPaidFilter,
      gunSecildi: Aidat.gunSecildi,
      smsGonderTekil: Aidat.smsGonderTekil,
      topluSmsGonder: Aidat.topluSmsGonder,
      gunDetaylariKapat: Aidat.gunDetaylariKapat,
    };
    (window as any).Yoklama = Yoklama;
    (window as any).Gider = Gider;
    (window as any).Antrenor = Antrenor;
    (window as any).Rapor = Rapor;
    (window as any).Ayarlar = Ayarlar;
    (window as any).KullaniciYonetimi = KullaniciYonetimi;
    (window as any).Notification = Notification;
    window.App = App;
  }
}

// ========== TEMA YÖNETİMİ ==========

/**
 * Tema yönetimini başlat
 */
function temaYonetiminiBaslat(): void {
  // Eski event listener'ı iptal et
  if (themeAbortController) {
    themeAbortController.abort();
  }

  // Yeni AbortController oluştur
  themeAbortController = new AbortController();
  const signal = themeAbortController.signal;

  // localStorage'dan tema tercihini oku
  const kayitliTema = localStorage.getItem('soybis_theme');
  const sistemTemasi = window.matchMedia('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark';
  const tema = kayitliTema || sistemTemasi;

  // Tema uygula
  if (tema === 'light') {
    document.body.classList.add('light-mode');
  } else {
    document.body.classList.remove('light-mode');
  }

  // Tema ikonunu güncelle
  temaIkonunuGuncelle();

  // Tema değiştirme butonuna event listener ekle
  const themeToggle = Helpers.$('#themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', temaDegistir, { signal });
  }

  // Sistem teması değişikliğini dinle (sadece kullanıcı manuel değiştirmediyse)
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

/**
 * Tema değiştir
 */
function temaDegistir(): void {
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

/**
 * Tema ikonunu güncelle
 */
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

// Logo yükleme hatalarını kontrol et ve düzelt (HTML'de onerror handler kullanılıyor)
