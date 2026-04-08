import type { UserRole } from '../types';

/** Rol başına erişilebilir view id listesi (tek kaynak). */
export const APP_VIEW_YETKILERI: Record<UserRole, string[]> = {
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

export function izinliViewlarForRol(rol: UserRole): string[] {
  return APP_VIEW_YETKILERI[rol] ?? [];
}

/**
 * sporcu-detay-raporu: sporcu-listesi yetkisi olanlar için açık (alt sayfa).
 */
export function canAccessView(viewId: string, rol: UserRole): boolean {
  const izinli = izinliViewlarForRol(rol);
  if (izinli.includes(viewId)) return true;
  if (viewId === 'sporcu-detay-raporu' && izinli.includes('sporcu-listesi')) return true;
  return false;
}

/** Yetkisiz istekte rolün varsayılan view'u */
export function defaultViewIdForRole(rol: UserRole): string {
  if (rol === 'Antrenör') return 'sporcu-listesi';
  return 'dashboard';
}
