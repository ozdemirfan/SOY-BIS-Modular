import * as Helpers from '../utils/helpers';
import { isMobile } from '../utils/responsiveLayout';

export function toggleMobileMenu(): void {
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

export function openMobileMenu(): void {
  if (!isMobile()) return;

  const fabBtn = Helpers.$('#hamburgerBtn');
  const sidebar = Helpers.$('#sidebar');
  const overlay = Helpers.$('#mobileMenuOverlay');

  if (!fabBtn || !sidebar || !overlay) return;

  sidebar.classList.remove('sidebar-closed');

  fabBtn.classList.add('active');
  fabBtn.setAttribute('aria-expanded', 'true');
  sidebar.classList.add('open');
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

export function closeMobileMenu(): void {
  if (!isMobile()) return;

  const fabBtn = Helpers.$('#hamburgerBtn');
  const sidebar = Helpers.$('#sidebar');
  const overlay = Helpers.$('#mobileMenuOverlay');

  if (!fabBtn || !sidebar || !overlay) return;

  fabBtn.classList.remove('active');
  fabBtn.setAttribute('aria-expanded', 'false');
  sidebar.classList.remove('open');
  overlay.classList.remove('active');
  document.body.style.overflow = '';
}

export function hamburgerMenuEventleri(): void {
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

  hamburgerBtn.addEventListener('click', function (e: Event) {
    e.stopPropagation();
    if (isMobile()) {
      toggleMobileMenu();
    }
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', function (e: Event) {
      e.stopPropagation();
      if (isMobile()) {
        closeMobileMenu();
      }
    });
  }

  overlay.addEventListener('click', function () {
    if (isMobile()) {
      closeMobileMenu();
    }
  });

  document.addEventListener('keydown', function (e: KeyboardEvent) {
    if (e.key === 'Escape' && isMobile() && sidebar && sidebar.classList.contains('open')) {
      closeMobileMenu();
    }
  });

  const navButtons = Helpers.$$('#mainNav button');
  navButtons.forEach(btn => {
    btn.addEventListener(
      'click',
      function () {
        if (isMobile()) {
          closeMobileMenu();
        }
      },
      { capture: false }
    );
  });

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

    if (
      touchStartX < 30 &&
      swipeDistance > swipeThreshold &&
      sidebar &&
      !sidebar.classList.contains('open')
    ) {
      openMobileMenu();
    }

    if (swipeDistance < -swipeThreshold && sidebar && sidebar.classList.contains('open')) {
      closeMobileMenu();
    }
  }
}
