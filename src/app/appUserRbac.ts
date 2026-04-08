import * as Helpers from '../utils/helpers';
import * as Auth from '../utils/auth';
import type { UserRole } from '../types';
import { canAccessView } from './viewAccess';

/**
 * Kullanıcı bilgilerini header'da göster
 */
export function kullaniciBilgileriniGoster(): void {
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

function viewYetkiKontrol(): void {
  const kullanici = Auth.aktifKullanici();
  if (!kullanici) return;

  const rol = kullanici.rol as UserRole;

  const views = Helpers.$$('.view');
  views.forEach(view => {
    const viewId = view.id;
    if (!canAccessView(viewId, rol)) {
      (view as HTMLElement).style.display = 'none';
    } else {
      const viewEl = view as HTMLElement;
      if (viewEl.style.display === 'none') {
        viewEl.style.display = '';
      }
    }
  });
}

/**
 * Rol bazlı menü gizleme ve view erişim satırları
 */
export function rolBazliMenuGizle(): void {
  const kullanici = Auth.aktifKullanici();
  if (!kullanici) return;

  const rol = kullanici.rol as UserRole;
  const navButtons = Helpers.$$('#mainNav button[data-rol]');

  navButtons.forEach(btn => {
    const izinVerilenRoller = btn.getAttribute('data-rol');

    if (izinVerilenRoller === 'all') {
      (btn as HTMLElement).style.display = '';
    } else {
      const roller = izinVerilenRoller?.split(',').map(r => r.trim()) || [];
      if (roller.includes(rol)) {
        (btn as HTMLElement).style.display = '';
      } else {
        (btn as HTMLElement).style.display = 'none';
      }
    }
  });

  viewYetkiKontrol();
}
