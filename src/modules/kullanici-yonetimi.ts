/**
 * SOY-BIS - Kullanıcı Yönetimi Modülü (kullanici-yonetimi.ts)
 * Kullanıcı ekleme, düzenleme, silme işlemleri - TypeScript Version
 */

import * as Helpers from '../utils/helpers';
import * as Storage from '../utils/storage';
import type { User } from '../types';

import type { Session } from '../types';

// Global window objesi için type declaration
declare global {
  interface Window {
    Auth?: {
      yetkiKontrol: (yetki: string) => boolean;
      isAdmin: () => boolean;
      aktifKullanici: () => Session | null;
    };
    Storage?: {
      kullanicilariGetir?: () => User[];
      kullaniciBul?: (id: number) => User | null;
      kullaniciAdiIleBul?: (kullaniciAdi: string) => User | null;
      kullaniciKaydet?: (kullanici: Partial<User> & { sifre?: string }) => Promise<void>;
      kullaniciSil?: (id: number) => void;
    };
    KullaniciYonetimi?: {
      init?: () => void;
      paneliGoster?: () => void;
      kullaniciListesiniGuncelle?: () => void;
      kullaniciDuzenle?: (id: number) => void;
      kullaniciSil?: (id: number) => void;
      kullaniciSifreDegistir?: (id: number) => Promise<void>;
    };
  }
}

// Güncellenecek kullanıcı ID'si
let guncellenecekKullaniciId: number | null = null;

/** init() birden çağrıldığında (startup + view geçişi) submit dinleyicisi tekrar eklenmesin; aksi halde çift toast ve boş validasyon hatası oluşur. */
let kullaniciFormEventleriBagli = false;

/**
 * Modülü başlat
 */
export function init(): void {
  console.log('✅ [KullaniciYonetimi] Modül başlatılıyor...');
  // Kullanıcı yönetimi eventlerini bağla
  kullaniciYonetimiEventleri();

  // Sadece Yönetici kullanıcı yönetimini görebilir
  if (typeof window !== 'undefined' && window.Auth && window.Auth?.isAdmin()) {
    kullaniciListesiniGuncelle();
  }
  console.log('✅ [KullaniciYonetimi] Modül başlatıldı');
}

/**
 * Kullanıcı yönetimi eventlerini bağla
 */
function kullaniciYonetimiEventleri(): void {
  if (kullaniciFormEventleriBagli) {
    return;
  }

  const form = Helpers.$('#kullaniciEkleForm');
  if (!form) {
    return;
  }

  form.addEventListener('submit', async function (e: Event) {
    e.preventDefault();
    await kullaniciKaydet();
  });

  const temizleBtn = Helpers.$('#kullaniciFormTemizle');
  const sifreInput = Helpers.$('#yeniSifre') as HTMLInputElement | null;
  const sifreTekrarInput = Helpers.$('#yeniSifreTekrar') as HTMLInputElement | null;

  if (temizleBtn) {
    temizleBtn.addEventListener('click', formuTemizle);
  }

  // Şifre eşleşme kontrolü (gerçek zamanlı)
  if (sifreInput && sifreTekrarInput) {
    const sifreUyusmazlikEl = Helpers.$('#sifreUyusmazlik');

    function sifreKontrol(): void {
      const sifre = sifreInput?.value || '';
      const sifreTekrar = sifreTekrarInput?.value || '';

      if (sifreTekrar.length > 0) {
        if (sifre !== sifreTekrar) {
          if (sifreUyusmazlikEl) (sifreUyusmazlikEl as HTMLElement).classList.add('is-visible');
          if (sifreTekrarInput) {
            sifreTekrarInput.setCustomValidity('Şifreler eşleşmiyor');
            sifreTekrarInput.classList.add('error');
          }
        } else {
          if (sifreUyusmazlikEl) (sifreUyusmazlikEl as HTMLElement).classList.remove('is-visible');
          if (sifreTekrarInput) {
            sifreTekrarInput.setCustomValidity('');
            sifreTekrarInput.classList.remove('error');
            if (sifre.length >= 4) {
              sifreTekrarInput.classList.add('validated-success');
            }
          }
        }
      } else {
        if (sifreUyusmazlikEl) (sifreUyusmazlikEl as HTMLElement).classList.remove('is-visible');
        if (sifreTekrarInput) {
          sifreTekrarInput.setCustomValidity('');
          sifreTekrarInput.classList.remove('error', 'validated-success');
        }
      }
    }

    if (sifreInput) {
      sifreInput.addEventListener('input', sifreKontrol);
    }
    if (sifreTekrarInput) {
      sifreTekrarInput.addEventListener('input', sifreKontrol);
    }
  }

  kullaniciFormEventleriBagli = true;
}

/**
 * Kullanıcı kaydet
 */
async function kullaniciKaydet(): Promise<void> {
  const kullaniciAdiInput = Helpers.$('#yeniKullaniciAdi') as HTMLInputElement | null;
  const sifreInput = Helpers.$('#yeniSifre') as HTMLInputElement | null;
  const sifreTekrarInput = Helpers.$('#yeniSifreTekrar') as HTMLInputElement | null;
  const adSoyadInput = Helpers.$('#yeniAdSoyad') as HTMLInputElement | null;
  const rolSelect = Helpers.$('#yeniRol') as HTMLSelectElement | null;
  const emailInput = Helpers.$('#yeniEmail') as HTMLInputElement | null;

  if (
    !kullaniciAdiInput ||
    !sifreInput ||
    !sifreTekrarInput ||
    !adSoyadInput ||
    !rolSelect ||
    !emailInput
  ) {
    Helpers.toast('Form alanları bulunamadı!', 'error');
    return;
  }

  const kullaniciAdi = kullaniciAdiInput.value.trim();
  const sifre = sifreInput.value;
  const sifreTekrar = sifreTekrarInput.value;
  const adSoyad = adSoyadInput.value.trim();
  const rol = rolSelect.value as 'Yönetici' | 'Antrenör' | 'Muhasebe';
  const email = emailInput.value.trim();

  // Validasyon
  if (!kullaniciAdi || kullaniciAdi.length < 3) {
    Helpers.toast('Kullanıcı adı en az 3 karakter olmalıdır!', 'error');
    return;
  }

  if (!sifre || sifre.length < 4) {
    Helpers.toast('Şifre en az 4 karakter olmalıdır!', 'error');
    return;
  }

  // Şifre eşleşme kontrolü
  if (sifre !== sifreTekrar) {
    Helpers.toast('Şifreler eşleşmiyor!', 'error');
    const sifreUyusmazlikEl = Helpers.$('#sifreUyusmazlik');
    if (sifreUyusmazlikEl) (sifreUyusmazlikEl as HTMLElement).classList.add('is-visible');
    return;
  }

  if (!rol) {
    Helpers.toast('Lütfen rol seçin!', 'error');
    return;
  }

  // Kullanıcı adı kontrolü
  const mevcutKullanici = Storage.kullaniciAdiIleBul(kullaniciAdi);
  if (mevcutKullanici && mevcutKullanici.id !== guncellenecekKullaniciId) {
    Helpers.toast('Bu kullanıcı adı zaten kullanılıyor!', 'error');
    return;
  }

  // Kullanıcı objesi
  const kullanici: Partial<User> & { sifre?: string } = {
    id: guncellenecekKullaniciId || undefined,
    kullaniciAdi: kullaniciAdi,
    sifre: sifre, // Hash'lenecek
    adSoyad: adSoyad || kullaniciAdi,
    rol: rol,
    email: email || undefined,
    aktif: true,
  };

  try {
    await Storage.kullaniciKaydet(kullanici);
    const mesaj = guncellenecekKullaniciId ? 'Kullanıcı güncellendi!' : 'Kullanıcı eklendi!';
    Helpers.toast(mesaj, 'success');

    formuTemizle();
    kullaniciListesiniGuncelle();
  } catch (error) {
    console.error('Kullanıcı kaydetme hatası:', error);
    Helpers.toast('Kullanıcı kaydedilirken hata oluştu!', 'error');
  }
}

/**
 * Formu temizle
 */
export function formuTemizle(): void {
  const form = Helpers.$('#kullaniciEkleForm');
  if (form && form instanceof HTMLFormElement) {
    form.reset();
  }

  // Şifre uyuşmazlık mesajını gizle
  const sifreUyusmazlikEl = Helpers.$('#sifreUyusmazlik');
  if (sifreUyusmazlikEl) (sifreUyusmazlikEl as HTMLElement).classList.remove('is-visible');

  // Input class'larını temizle
  const sifreInput = Helpers.$('#yeniSifre') as HTMLInputElement | null;
  const sifreTekrarInput = Helpers.$('#yeniSifreTekrar') as HTMLInputElement | null;
  if (sifreInput) sifreInput.classList.remove('error', 'validated-success');
  if (sifreTekrarInput) sifreTekrarInput.classList.remove('error', 'validated-success');

  guncellenecekKullaniciId = null;

  const kaydetBtn = form?.querySelector('button[type="submit"]');
  if (kaydetBtn) {
    kaydetBtn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Kullanıcı Ekle';
    kaydetBtn.classList.remove('btn-warning');
    kaydetBtn.classList.add('btn-success');
  }
}

/**
 * Kullanıcı listesini güncelle
 */
export function kullaniciListesiniGuncelle(): void {
  console.log('🔄 [KullaniciYonetimi] kullaniciListesiniGuncelle() çağrıldı');

  try {
    const tbody = Helpers.$('#kullaniciTableBody');
    const emptyState = Helpers.$('#kullaniciEmptyState');

    if (!tbody) {
      console.error("kullaniciTableBody bulunamadı! Element DOM'da yok olabilir.");
      return;
    }

    if (typeof window === 'undefined' || !window.Storage || !window.Auth) {
      console.error('Storage veya Auth modülü bulunamadı!');
      return;
    }

    const kullanicilar = Storage.kullanicilariGetir();
    const aktifOturum = window.Auth?.aktifKullanici?.();
    // Session'dan User'a dönüştür
    const aktifKullanici = aktifOturum ? Storage.kullaniciBul?.(aktifOturum.id) : null;

    tbody.innerHTML = '';

    if (!kullanicilar || !Array.isArray(kullanicilar) || kullanicilar.length === 0) {
      if (Helpers.showEmptyState) {
        Helpers.showEmptyState(
          '#kullaniciEmptyState',
          'Henüz kullanıcı bulunmuyor',
          'Yukarıdaki formdan yeni kullanıcı ekleyin.',
          { icon: 'fa-users' }
        );
      } else if (emptyState) {
        (emptyState as HTMLElement).style.display = 'block';
        emptyState.innerHTML = `
        <i class="fa-solid fa-users"></i>
        <h3>Henüz kullanıcı bulunmuyor</h3>
        <p>Yukarıdaki formdan yeni kullanıcı ekleyin.</p>
      `;
      }
      return;
    }

    if (emptyState) {
      (emptyState as HTMLElement).style.display = 'none';
    }

    kullanicilar.forEach((kullanici: User) => {
      // Güvenli: XSS koruması
      const kullaniciAdi = Helpers.escapeHtml(kullanici.kullaniciAdi);
      const adSoyad = Helpers.escapeHtml(kullanici.adSoyad || kullanici.kullaniciAdi);
      const email = Helpers.escapeHtml(kullanici.email || '-');
      const rol = Helpers.escapeHtml(kullanici.rol);

      const durumBadge = kullanici.aktif
        ? Helpers.createBadge('success', 'Aktif')
        : Helpers.createBadge('danger', 'Pasif');

      const rolBadge =
        kullanici.rol === 'Yönetici'
          ? Helpers.createBadge('warning', rol)
          : kullanici.rol === 'Antrenör'
            ? Helpers.createBadge('info', rol)
            : Helpers.createBadge('info', rol);

      // Kendi hesabını silme
      const kendiHesabi = aktifKullanici && aktifKullanici.id === kullanici.id;

      // Mobil kart görünümü için labels ekle
      const tr = Helpers.createTableRow(
        [
          `<strong class="card-name">${kullaniciAdi}</strong>`,
          adSoyad,
          rolBadge,
          email,
          durumBadge,
          `<div class="action-buttons">
        ${
          !kendiHesabi
            ? `
          <button class="btn btn-small btn-icon btn-warning" onclick="window.KullaniciYonetimi?.kullaniciDuzenle(${kullanici.id})" title="Düzenle">
            <i class="fa-solid fa-edit"></i>
          </button>
          <button class="btn btn-small btn-icon btn-danger" onclick="window.KullaniciYonetimi?.kullaniciSil(${kullanici.id})" title="Sil">
            <i class="fa-solid fa-trash"></i>
          </button>
        `
            : `
          <span class="text-muted" style="font-size: var(--font-size-xs);">Kendi hesabınız</span>
        `
        }
      </div>`,
        ],
        {
          labels: ['Kullanıcı Adı', 'Ad Soyad', 'Rol', 'E-posta', 'Durum', 'İşlemler'],
        }
      );

      tbody.appendChild(tr);
    });
  } catch (error) {
    console.error('❌ [KullaniciYonetimi] kullaniciListesiniGuncelle hatası:', error);
    if (typeof Helpers !== 'undefined' && Helpers.toast) {
      Helpers.toast('Kullanıcı listesi güncellenirken hata oluştu!', 'error');
    }
  }
}

/**
 * Kullanıcı düzenle
 * @param id - Kullanıcı ID
 */
export function kullaniciDuzenle(id: number): void {
  const kullanici = Storage.kullaniciBul(id);
  if (!kullanici) {
    Helpers.toast('Kullanıcı bulunamadı!', 'error');
    return;
  }

  guncellenecekKullaniciId = id;

  const kullaniciAdiInput = Helpers.$('#yeniKullaniciAdi') as HTMLInputElement | null;
  const sifreInput = Helpers.$('#yeniSifre') as HTMLInputElement | null;
  const sifreTekrarInput = Helpers.$('#yeniSifreTekrar') as HTMLInputElement | null;
  const adSoyadInput = Helpers.$('#yeniAdSoyad') as HTMLInputElement | null;
  const rolSelect = Helpers.$('#yeniRol') as HTMLSelectElement | null;
  const emailInput = Helpers.$('#yeniEmail') as HTMLInputElement | null;

  if (kullaniciAdiInput) kullaniciAdiInput.value = kullanici.kullaniciAdi || '';
  if (sifreInput) sifreInput.value = ''; // Şifre gösterilmez
  if (sifreTekrarInput) sifreTekrarInput.value = ''; // Şifre tekrar gösterilmez
  if (adSoyadInput) adSoyadInput.value = kullanici.adSoyad || '';
  if (rolSelect) rolSelect.value = kullanici.rol || '';
  if (emailInput) emailInput.value = kullanici.email || '';

  // Şifre uyuşmazlık mesajını gizle
  const sifreUyusmazlikEl = Helpers.$('#sifreUyusmazlik');
  if (sifreUyusmazlikEl) (sifreUyusmazlikEl as HTMLElement).classList.remove('is-visible');

  const form = Helpers.$('#kullaniciEkleForm');
  const kaydetBtn = form?.querySelector('button[type="submit"]');
  if (kaydetBtn) {
    kaydetBtn.innerHTML = '<i class="fa-solid fa-rotate"></i> Güncelle';
    kaydetBtn.classList.remove('btn-success');
    kaydetBtn.classList.add('btn-warning');
  }

  // Forma scroll
  if (form) {
    form.scrollIntoView({ behavior: 'smooth' });
  }
}

/**
 * Kullanıcı sil
 * @param id - Kullanıcı ID
 */
export function kullaniciSil(id: number): void {
  const kullanici = Storage.kullaniciBul(id);
  if (!kullanici) return;

  if (typeof window === 'undefined' || !window.Auth) {
    Helpers.toast('Auth modülü bulunamadı!', 'error');
    return;
  }

  const aktifOturum = window.Auth?.aktifKullanici?.();
  const aktifKullanici = aktifOturum ? Storage.kullaniciBul?.(aktifOturum.id) : null;
  if (aktifKullanici && aktifKullanici.id === id) {
    Helpers.toast('Kendi hesabınızı silemezsiniz!', 'error');
    return;
  }

  if (
    !Helpers.onay(`"${kullanici.kullaniciAdi}" kullanıcısını silmek istediğinize emin misiniz?`)
  ) {
    return;
  }

  Storage.kullaniciSil(id);
  Helpers.toast('Kullanıcı silindi!', 'success');
  kullaniciListesiniGuncelle();
}

/**
 * Kullanıcı şifresini değiştir
 * @param id - Kullanıcı ID
 */
export async function kullaniciSifreDegistir(id: number): Promise<void> {
  const kullanici = Storage.kullaniciBul(id);
  if (!kullanici) return;

  const yeniSifre = Helpers.girdi('Yeni şifreyi girin (en az 4 karakter):');
  if (!yeniSifre || yeniSifre.length < 4) {
    Helpers.toast('Şifre en az 4 karakter olmalıdır!', 'error');
    return;
  }

  try {
    await Storage.kullaniciKaydet({
      id: id,
      sifre: yeniSifre,
    });
    Helpers.toast('Şifre değiştirildi!', 'success');
  } catch (error) {
    console.error('Şifre değiştirme hatası:', error);
    Helpers.toast('Şifre değiştirilirken hata oluştu!', 'error');
  }
}

/**
 * Paneli göster ve listeyi güncelle
 */
export function paneliGoster(): void {
  console.log('🔄 [KullaniciYonetimi] paneliGoster() çağrıldı');

  try {
    // View'ın görünür olmasını bekle
    setTimeout(() => {
      // View'ın görünür olduğundan emin ol
      const view = Helpers.$('#kullanici-yonetimi');

      if (view) {
        (view as HTMLElement).style.display = 'block';
        view.classList.add('active');
      }

      if (typeof window !== 'undefined' && window.Auth && window.Auth?.isAdmin()) {
        kullaniciListesiniGuncelle();
      }
    }, 200);
  } catch (error) {
    console.error('❌ [KullaniciYonetimi] paneliGoster hatası:', error);
    if (typeof Helpers !== 'undefined' && Helpers.toast) {
      Helpers.toast('Kullanıcı yönetimi paneli açılırken hata oluştu!', 'error');
    }
  }
}

// Public API
if (typeof window !== 'undefined') {
  (window as unknown as { KullaniciYonetimi: Record<string, unknown> }).KullaniciYonetimi = {
    init,
    paneliGoster,
    kullaniciListesiniGuncelle,
    kullaniciDuzenle,
    kullaniciSil,
    kullaniciSifreDegistir,
  };
}
