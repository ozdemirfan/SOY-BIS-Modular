import * as Helpers from '../utils/helpers';
import { handleResize } from '../utils/responsiveLayout';

export function toggleDesktopSidebar(): void {
  const sidebar = Helpers.$('#sidebar');
  if (!sidebar) return;

  const isClosed = sidebar.classList.contains('sidebar-closed');

  if (isClosed) {
    sidebar.classList.remove('sidebar-closed');
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('sidebarOpen', 'true');
    }
  } else {
    sidebar.classList.add('sidebar-closed');
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('sidebarOpen', 'false');
    }
  }
}

export function masaustuSidebarYonetimi(): void {
  const sidebar = Helpers.$('#sidebar');

  if (!sidebar) {
    setTimeout(() => {
      masaustuSidebarYonetimi();
    }, 200);
    return;
  }

  const desktopSidebarToggle = Helpers.$('#desktopSidebarToggle');
  const desktopMenuToggle = Helpers.$('#desktopMenuToggle');

  const sidebarPref =
    typeof localStorage !== 'undefined' ? localStorage.getItem('sidebarOpen') : null;
  const shouldBeOpen = sidebarPref === null ? true : sidebarPref === 'true';

  if (shouldBeOpen) {
    sidebar.classList.remove('sidebar-closed');
  } else {
    sidebar.classList.add('sidebar-closed');
  }

  if (desktopSidebarToggle && !desktopSidebarToggle.hasAttribute('data-sidebar-listener')) {
    desktopSidebarToggle.setAttribute('data-sidebar-listener', 'true');
    desktopSidebarToggle.addEventListener('click', function (e: Event) {
      e.stopPropagation();
      toggleDesktopSidebar();
    });
  }

  if (desktopMenuToggle && !desktopMenuToggle.hasAttribute('data-menu-listener')) {
    desktopMenuToggle.setAttribute('data-menu-listener', 'true');
    desktopMenuToggle.addEventListener('click', function (e: Event) {
      e.stopPropagation();
      toggleDesktopSidebar();
    });
  }

  let resizeTimer: ReturnType<typeof setTimeout>;
  if (typeof window !== 'undefined') {
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

    (window as any).__soybis_resize_handler = resizeHandler;

    window.addEventListener('resize', resizeHandler);
    setTimeout(() => handleResize(), 100);
  }
}
