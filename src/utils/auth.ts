/**
 * SOY-BIS - Kimlik Doğrulama ve Yetkilendirme Modülü (auth.ts)
 * Giriş, çıkış, oturum yönetimi ve rol bazlı yetkilendirme - TypeScript Version
 */

import type { Session, UserRole } from '../types';
import {
  syncLocalCacheFromServerAfterAuth,
  kullaniciSifreDogrula,
  kullanicilariGetir,
  sifreHash,
} from './storage';
import { apiPost } from '../services/apiClient';
import { toast } from './helpers';

// Oturum anahtarları
const SESSION_KEY = 'soybis_oturum';
const CURRENT_USER_KEY = 'soybis_aktifKullanici';

// Hostingte env gömülmese bile shared DB modunun zorunlu çalışması için true.
const API_ENABLED = true;

/** Son başarısız giriş denemesi için kullanıcıya gösterilecek mesaj (başarılı girişte sıfırlanır). */
let sonGirisUyari: string | null = null;

export function sonGirisUyariMetni(): string | null {
  return sonGirisUyari;
}

/**
 * Giriş yap
 * GÜVENLİK: Oturum sadece sessionStorage'da tutulur, localStorage kullanılmaz
 */
export async function girisYap(kullaniciAdi: string, sifre: string): Promise<Session | null> {
  sonGirisUyari = null;

  if (!kullaniciAdi || !sifre) {
    return null;
  }

  try {
    if (API_ENABLED) {
      const computedHash = await sifreHash(sifre);
      const resp = await apiPost<{ user: Session } | { ok: boolean; user: any }>('/auth/login', {
        kullaniciAdi,
        sifreHash: computedHash,
      });

      const user = (resp as any)?.user ?? resp;
      if (!user?.id || !user?.kullaniciAdi || !user?.rol) {
        sonGirisUyari = 'Giriş yanıtı geçersiz. Lütfen tekrar deneyin.';
        return null;
      }

      const oturumBilgisi: Session = {
        id: Number(user.id),
        kullaniciAdi: String(user.kullaniciAdi),
        rol: String(user.rol),
        adSoyad: String(user.adSoyad ?? user.kullaniciAdi),
        email: String(user.email ?? ''),
        girisTarihi: new Date().toISOString(),
      };

      sessionStorage.setItem(SESSION_KEY, JSON.stringify(oturumBilgisi));
      // Önce yerel uygulama önbelleğini temizle, sunucudan doldur (paylaşımlı DB tek kaynak).
      const warmed = await syncLocalCacheFromServerAfterAuth();
      if (!warmed) {
        toast(
          'Sunucu verisi yüklenemedi; liste boş görünebilir. Bağlantıyı kontrol edip sayfayı yenileyin.',
          'warning'
        );
      }
      return oturumBilgisi;
    }

    // Local mode: mevcut davranış (localStorage üzerinden)
    // (Not: bu branch sadece paylaşımsız kullanım içindir.)
    const kullanici = await kullaniciSifreDogrula(kullaniciAdi, sifre);
    if (!kullanici) {
      sonGirisUyari = 'Kullanıcı adı veya şifre hatalı.';
      return null;
    }

    if (!kullanici.aktif) throw new Error('Kullanıcı pasif');

    const oturumBilgisi: Session = {
      id: kullanici.id,
      kullaniciAdi: kullanici.kullaniciAdi,
      rol: kullanici.rol,
      adSoyad: kullanici.adSoyad || kullanici.kullaniciAdi,
      email: kullanici.email || '',
      girisTarihi: new Date().toISOString(),
    };

    sessionStorage.setItem(SESSION_KEY, JSON.stringify(oturumBilgisi));
    return oturumBilgisi;
  } catch (error) {
    console.error('Giriş hatası:', error);
    const msg = error instanceof Error ? error.message : String(error);

    if (
      msg.includes('Sunucuya bağlanılamadı') ||
      msg.includes('yanıt okunamadı') ||
      msg.includes('API adresini')
    ) {
      sonGirisUyari =
        'Sunucuya ulaşılamıyor. Ağ bağlantınızı veya API adresini (VITE_SOYBIS_API_BASE) kontrol edin.';
    } else if (msg.includes('pasif')) {
      sonGirisUyari = 'Bu hesap pasif. Yöneticinize başvurun.';
    } else if (
      msg.includes('Kullanıcı adı') ||
      msg.includes('şifre hatalı') ||
      msg === 'Unauthorized'
    ) {
      sonGirisUyari = 'Kullanıcı adı veya şifre hatalı.';
    } else if (msg.length > 0) {
      sonGirisUyari = msg;
    } else {
      sonGirisUyari = 'Giriş yapılamadı. Lütfen tekrar deneyin.';
    }
    return null;
  }
}

/**
 * Çıkış yap
 */
export function cikisYap(): void {
  // Backend'den çıkış denemesi (MVP: başarısızsa yine de UI'yi temizliyoruz)
  if (API_ENABLED) {
    void apiPost('/auth/logout', {}).catch(err => {
      console.warn('[SOY-BIS API] Çıkış isteği tamamlanamadı (oturum yine de temizlenir):', err);
    });
  }

  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(CURRENT_USER_KEY);
  localStorage.removeItem('soybis_aktifView'); // Aktif view'u da temizle
  location.reload();
}

/**
 * Oturum kontrolü - Giriş yapılmış mı?
 * GÜVENLİK: Sadece sessionStorage kullanılır, localStorage'dan oturum okunmaz
 */
export function oturumKontrol(): Session | null {
  try {
    // GÜVENLİK: İlk çalıştırmada eski localStorage oturum verilerini temizle
    // Bu, bypass açığını önler - eski oturum verileri kullanılamaz
    if (localStorage.getItem(CURRENT_USER_KEY)) {
      console.warn('Güvenlik: Eski localStorage oturum verisi temizlendi');
      localStorage.removeItem(CURRENT_USER_KEY);
    }

    // GÜVENLİK: Sadece sessionStorage'dan kontrol et
    // localStorage kullanılmaz - tarayıcı kapatıldığında oturum sonlanır
    const oturum = sessionStorage.getItem(SESSION_KEY);

    if (!oturum) {
      return null;
    }

    const oturumVerisi = JSON.parse(oturum) as Session;

    // GÜVENLİK: Oturum verisini doğrula
    if (oturumDogrula(oturumVerisi)) {
      return oturumVerisi;
    }

    // Geçersiz oturum - temizle
    sessionStorage.removeItem(SESSION_KEY);
    return null;
  } catch (error) {
    console.error('Oturum kontrolü hatası:', error);
    // Hata durumunda oturum verilerini temizle
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(CURRENT_USER_KEY);
    return null;
  }
}

/**
 * Oturum verisinin geçerliliğini doğrula
 * GÜVENLİK: Kullanıcının veritabanında var olduğunu ve aktif olduğunu kontrol eder
 */
function oturumDogrula(oturumVerisi: Session): boolean {
  // Temel veri kontrolü
  if (!oturumVerisi || !oturumVerisi.id || !oturumVerisi.kullaniciAdi) {
    return false;
  }

  // Shared DB modunda: sessionStorage doğrulamasını sync tutmak için yalnızca temel alanları kontrol ediyoruz.
  // Backend tarafında 401 döndüğünde apiClient otomatik logout yapacak.
  if (API_ENABLED) {
    return typeof oturumVerisi.rol === 'string' && oturumVerisi.rol.length > 0;
  }

  try {
    const kullanicilar = kullanicilariGetir();
    const mevcutKullanici = kullanicilar.find(
      (k: any) => k.id === oturumVerisi.id && k.kullaniciAdi === oturumVerisi.kullaniciAdi
    );

    if (!mevcutKullanici) return false;
    if (!mevcutKullanici.aktif) return false;
    if (oturumVerisi.rol !== mevcutKullanici.rol) return false;
    return true;
  } catch (error) {
    console.error('Oturum doğrulama hatası:', error);
    return false;
  }
}

/**
 * Aktif kullanıcıyı getir
 */
export function aktifKullanici(): Session | null {
  return oturumKontrol();
}

/**
 * Rol kontrolü - Kullanıcının belirtilen role sahip olup olmadığını kontrol et
 */
export function hasRole(roller: UserRole | UserRole[]): boolean {
  const kullanici = oturumKontrol();
  if (!kullanici) return false;

  const kullaniciRolu = kullanici.rol as UserRole;

  if (Array.isArray(roller)) {
    return roller.includes(kullaniciRolu);
  }

  return kullaniciRolu === roller;
}

/**
 * Yönetici kontrolü
 */
export function isAdmin(): boolean {
  return hasRole('Yönetici');
}

/**
 * Antrenör kontrolü
 */
export function isAntrenor(): boolean {
  return hasRole('Antrenör');
}

/**
 * Muhasebe kontrolü
 */
export function isMuhasebe(): boolean {
  return hasRole('Muhasebe');
}

// Yetki tipleri
type YetkiIslemi =
  | 'dashboard_gorebilir'
  | 'aidat_gorebilir'
  | 'aidat_ekleyebilir'
  | 'aidat_silebilir'
  | 'gider_gorebilir'
  | 'gider_ekleyebilir'
  | 'gider_silebilir'
  | 'sporcu_gorebilir'
  | 'sporcu_ekleyebilir'
  | 'sporcu_duzenleyebilir'
  | 'sporcu_silebilir'
  | 'yoklama_gorebilir'
  | 'yoklama_ekleyebilir'
  | 'antrenor_gorebilir'
  | 'antrenor_ekleyebilir'
  | 'antrenor_silebilir'
  | 'rapor_gorebilir'
  | 'ayarlar_gorebilir'
  | 'kullanici_yonetebilir';

/**
 * Yetki kontrolü - Belirli bir işlem için yetki var mı?
 * Uluslararası RBAC normlarına göre
 */
export function yetkiKontrol(islem: YetkiIslemi): boolean {
  const kullanici = oturumKontrol();
  if (!kullanici) return false;

  const rol = kullanici.rol as UserRole;

  // Yetki matrisi - Uluslararası RBAC normlarına göre
  const yetkiler: Record<UserRole, YetkiIslemi[]> = {
    Yönetici: [
      // Tam erişim - Tüm işlemler
      'dashboard_gorebilir',
      'aidat_gorebilir',
      'aidat_ekleyebilir',
      'aidat_silebilir',
      'gider_gorebilir',
      'gider_ekleyebilir',
      'gider_silebilir',
      'sporcu_gorebilir',
      'sporcu_ekleyebilir',
      'sporcu_duzenleyebilir',
      'sporcu_silebilir',
      'yoklama_gorebilir',
      'yoklama_ekleyebilir',
      'antrenor_gorebilir',
      'antrenor_ekleyebilir',
      'antrenor_silebilir',
      'rapor_gorebilir',
      'ayarlar_gorebilir',
      'kullanici_yonetebilir',
    ],
    Antrenör: [
      // Sadece operasyonel işlemler - Finansal bilgilere erişim yok
      'sporcu_gorebilir', // Sadece kendi sporcularını görebilir (ileride filtreleme eklenecek)
      'yoklama_gorebilir',
      'yoklama_ekleyebilir',
      // Dashboard YOK - Finansal bilgiler içeriyor
    ],
    Muhasebe: [
      // Sadece finansal işlemler - Operasyonel işlemlere erişim yok
      'dashboard_gorebilir', // Finansal özet için
      'aidat_gorebilir',
      'aidat_ekleyebilir',
      'gider_gorebilir',
      'gider_ekleyebilir',
      'gider_silebilir',
      'rapor_gorebilir',
      // Sporcu ekleme/düzenleme YOK, Yoklama YOK
    ],
  };

  return yetkiler[rol]?.includes(islem) || false;
}

/**
 * Giriş kontrolü - Sayfa yüklendiğinde çağrılır
 */
export function kontrol(): boolean {
  return oturumKontrol() !== null;
}

// Global erişim için (backward compatibility)
if (typeof window !== 'undefined') {
  (window as unknown as { Auth: Record<string, unknown> }).Auth = {
    girisYap,
    sonGirisUyariMetni,
    cikisYap,
    oturumKontrol,
    aktifKullanici,
    hasRole,
    isAdmin,
    isAntrenor,
    isMuhasebe,
    yetkiKontrol,
    kontrol,
  };
}
