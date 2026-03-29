import * as Helpers from './helpers';

/** Mobil menü kontrolü - sadece mobilde çalışmalı */
export function isMobile(): boolean {
  return typeof window !== 'undefined' && window.innerWidth < 769;
}

/** Window resize event handler - ekran boyutu değiştiğinde menüyü güncelle */
export function handleResize(): void {
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
    if (overlay) {
      overlay.classList.remove('active');
    }
    document.body.style.overflow = '';
    return;
  }

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
