/**
 * SOY-BIS - Antrenör Modülü (antrenor.ts)
 * Antrenör kayıt, listeleme ve yönetim işlemleri - TypeScript Version
 */

import * as Helpers from '../utils/helpers';
import * as Storage from '../utils/storage';
import * as Validation from '../utils/validation';
import type { Antrenor, Session } from '../types';

// Global window objesi için type declaration
declare global {
  interface Window {
    Auth?: {
      yetkiKontrol: (yetki: string) => boolean;
      isAdmin: () => boolean;
      aktifKullanici: () => Session | null;
    };
    Antrenor?: {
      init: () => void;
      kaydet: () => void;
      duzenle: (id: number) => void;
      sil: (id: number) => void;
      durumDegistir: (id: number) => void;
      formuTemizle: () => void;
      listeyiGuncelle: () => void;
    };
  }
}

// Güncellenecek antrenör ID'si
let guncellenecekId: number | null = null;

/**
 * Modülü başlat
 */
export function init(): void {
  console.log('✅ [Antrenor] Modül başlatılıyor...');
  // Yetki kontrolü - Antrenör yönetimi sadece Yönetici
  if (typeof window !== 'undefined' && window.Auth && !window.Auth?.isAdmin()) {
    const antrenorView = Helpers.$('#antrenorler');
    if (antrenorView) {
      (antrenorView as HTMLElement).style.display = 'none';
    }
    return;
  }

  formEventleri();
  inputKisitlamalari();
  listeyiGuncelle();
  console.log('✅ [Antrenor] Modül başlatıldı');
}

/**
 * Form eventlerini bağla (GÜVENLİ VERSİYON)
 */
function formEventleri(): void {
  const form = Helpers.$('#antrenorEkleForm');

  // 1. Kaydet butonunu bul (ID veya Class ile)
  let btn = document.getElementById('antrenorKaydetBtn');
  if (!btn && form) {
    btn = form.querySelector('button.btn-primary');
  }

  // 2. Buton bulunduysa, "submit" özelliğini kapat ve tıklamayı elle yönet
  if (btn) {
    btn.setAttribute('type', 'button');
    btn.onclick = function (e) {
      e.preventDefault();
      kaydet();
    };
  }

  // 3. Form submit olursa (Enter tuşu vb.) engelle
  if (form) {
    form.onsubmit = function (e) {
      e.preventDefault();
      if (!btn) kaydet();
    };
  }

  // Temizle butonu
  const temizleBtn = Helpers.$('#antrenorTemizleBtn');
  if (temizleBtn) {
    temizleBtn.addEventListener('click', formuTemizle);
  }

  // Maaş input formatı
  const maasInput = Helpers.$('#antrenorMaas') as HTMLInputElement | null;
  if (maasInput) {
    maasInput.addEventListener('input', function (this: HTMLInputElement) {
      Helpers.paraFormatInput(this);
    });
  }

  // Başlama tarihi default bugün
  const tarihInput = Helpers.$('#antrenorBaslamaTarihi') as HTMLInputElement | null;
  if (tarihInput && !tarihInput.value) {
    tarihInput.value = Helpers.bugunISO();
  }
}

/**
 * Input kısıtlamaları (TC ve Telefon sadece rakam olsun)
 */
function inputKisitlamalari(): void {
  const telefonInput = Helpers.$('#antrenorTelefon') as HTMLInputElement | null;
  if (telefonInput) {
    telefonInput.addEventListener('input', function (this: HTMLInputElement) {
      let val = this.value.replace(/[^0-9]/g, '');
      if (val.length > 10) val = val.substring(0, 10);

      if (val.length > 3 && val.length <= 6) {
        val = val.substring(0, 3) + ' ' + val.substring(3);
      } else if (val.length > 6 && val.length <= 8) {
        val = val.substring(0, 3) + ' ' + val.substring(3, 6) + ' ' + val.substring(6);
      } else if (val.length > 8) {
        val =
          val.substring(0, 3) +
          ' ' +
          val.substring(3, 6) +
          ' ' +
          val.substring(6, 8) +
          ' ' +
          val.substring(8);
      }
      this.value = val;
    });
  }

  const tcInput = Helpers.$('#antrenorTC') as HTMLInputElement | null;
  if (tcInput) {
    tcInput.addEventListener('input', function (this: HTMLInputElement) {
      this.value = this.value.replace(/[^0-9]/g, '').substring(0, 11);
    });
  }
}

/**
 * Antrenör kaydet (DÜZELTİLMİŞ MANTIK)
 */
export function kaydet(): void {
  const adInput = Helpers.$('#antrenorAd') as HTMLInputElement | null;
  const tcInput = Helpers.$('#antrenorTC') as HTMLInputElement | null;
  const telefonInput = Helpers.$('#antrenorTelefon') as HTMLInputElement | null;
  const emailInput = Helpers.$('#antrenorEmail') as HTMLInputElement | null;
  const bransSelect = Helpers.$('#antrenorBrans') as HTMLSelectElement | null;
  const maasInput = Helpers.$('#antrenorMaas') as HTMLInputElement | null;
  const baslamaTarihiInput = Helpers.$('#antrenorBaslamaTarihi') as HTMLInputElement | null;

  if (!adInput || !telefonInput || !bransSelect || !maasInput || !baslamaTarihiInput) {
    Helpers.toast('Form alanları eksik!', 'error');
    return;
  }

  const ad = adInput.value.trim();
  const tc = tcInput ? tcInput.value.trim() : '';
  const telefon = telefonInput.value.replace(/\s/g, '');
  const email = emailInput ? emailInput.value.trim() : '';
  const brans = bransSelect.value;
  const maas = Helpers.paraCoz(maasInput.value);
  const baslamaTarihi = baslamaTarihiInput.value;

  // Validasyon
  const errors: Record<string, string> = {};
  let hasError = false;

  if (!ad || ad.length < 3) {
    errors.antrenorAd = 'Ad Soyad en az 3 karakter olmalıdır!';
    hasError = true;
  }
  if (tc && tc.length !== 11) {
    errors.antrenorTC = 'TC Kimlik No 11 haneli olmalıdır!';
    hasError = true;
  }
  if (!telefon || telefon.length !== 10) {
    errors.antrenorTelefon = 'Geçerli bir telefon numarası girin! (10 haneli)';
    hasError = true;
  }
  if (!brans) {
    errors.antrenorBrans = 'Lütfen branş seçin!';
    hasError = true;
  }
  if (maas < 0) {
    errors.antrenorMaas = 'Geçerli bir maaş tutarı girin!';
    hasError = true;
  }

  // --- ÇİFT KAYIT KONTROLÜ (Mevcut listeyi çekiyoruz) ---
  // Storage.antrenorleriGetir() genellikle güncel listeyi verir
  const mevcutAntrenorler = Storage.antrenorleriGetir();

  // TC Kontrolü
  if (tc) {
    const ayniTC = mevcutAntrenorler.find(a => a.tc === tc && a.id !== guncellenecekId);
    if (ayniTC) {
      Helpers.toast('Bu TC Kimlik numarası ile kayıtlı bir antrenör zaten var!', 'error');
      if (tcInput) tcInput.classList.add('error');
      return;
    }
  }

  // Telefon Kontrolü
  const ayniTelefon = mevcutAntrenorler.find(
    a => a.telefon === telefon && a.id !== guncellenecekId
  );
  if (ayniTelefon) {
    Helpers.toast('Bu telefon numarası zaten sisteme kayıtlı!', 'error');
    return;
  }

  if (hasError) {
    Validation.hatalariGoster(errors);
    Helpers.toast('Lütfen hatalı alanları düzeltin.', 'error');
    return;
  }

  // ==========================================
  // KRİTİK DÜZELTME: KAYIT VE GÜNCELLEME MANTIĞI
  // ==========================================

  if (guncellenecekId) {
    // --- GÜNCELLEME İŞLEMİ ---
    // Listede bu ID'ye sahip kişiyi bul
    const index = mevcutAntrenorler.findIndex(a => a.id === guncellenecekId);

    if (index > -1) {
      // Sadece o indeksteki veriyi güncelle (ID değişmez!)
      mevcutAntrenorler[index] = {
        ...mevcutAntrenorler[index], // Eski verileri koru (tarih vs.)
        adSoyad: ad,
        tc: tc,
        telefon: telefon,
        email: email,
        brans: brans,
        maas: maas,
        kayitTarihi: baslamaTarihi || mevcutAntrenorler[index].kayitTarihi,
      };

      // Listeyi olduğu gibi üzerine yaz
      Storage.kaydet('soybis_antrenorler', mevcutAntrenorler);
      Helpers.toast('Antrenör başarıyla güncellendi!', 'success');
    } else {
      Helpers.toast('Güncellenecek kayıt bulunamadı!', 'error');
      return;
    }
  } else {
    // --- YENİ KAYIT İŞLEMİ ---
    const yeniAntrenor: Antrenor = {
      id: Date.now(), // Benzersiz yeni ID
      adSoyad: ad,
      tc: tc,
      telefon: telefon,
      email: email,
      brans: brans,
      maas: maas,
      durum: 'Aktif',
      kayitTarihi: baslamaTarihi || Helpers.bugunISO(),
    };

    // Listeye ekle
    mevcutAntrenorler.push(yeniAntrenor);

    // Kaydet
    Storage.kaydet('soybis_antrenorler', mevcutAntrenorler);
    Helpers.toast('Antrenör başarıyla eklendi!', 'success');
  }

  formuTemizle();
  listeyiGuncelle();
}

/**
 * Formu temizle
 */
export function formuTemizle(): void {
  const form = Helpers.$('#antrenorEkleForm');
  if (form && form instanceof HTMLFormElement) {
    form.reset();
  }

  guncellenecekId = null;

  const tarihInput = Helpers.$('#antrenorBaslamaTarihi') as HTMLInputElement | null;
  if (tarihInput) {
    tarihInput.value = Helpers.bugunISO();
  }

  const kaydetBtn = Helpers.$('#antrenorKaydetBtn');
  if (kaydetBtn) {
    kaydetBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Antrenör Ekle';
    kaydetBtn.classList.remove('btn-warning');
    kaydetBtn.classList.add('btn-success');
  }
}

/**
 * Antrenör düzenle
 */
export function duzenle(id: number): void {
  const antrenor = Storage.antrenorBul(id);
  if (!antrenor) {
    Helpers.toast('Antrenör bulunamadı!', 'error');
    return;
  }

  guncellenecekId = id; // ID'yi globale al

  const adInput = Helpers.$('#antrenorAd') as HTMLInputElement | null;
  const tcInput = Helpers.$('#antrenorTC') as HTMLInputElement | null;
  const telefonInput = Helpers.$('#antrenorTelefon') as HTMLInputElement | null;
  const emailInput = Helpers.$('#antrenorEmail') as HTMLInputElement | null;
  const bransSelect = Helpers.$('#antrenorBrans') as HTMLSelectElement | null;
  const maasInput = Helpers.$('#antrenorMaas') as HTMLInputElement | null;
  const baslamaTarihiInput = Helpers.$('#antrenorBaslamaTarihi') as HTMLInputElement | null;
  const notlarTextarea = Helpers.$('#antrenorNotlar') as HTMLTextAreaElement | null;

  if (adInput) adInput.value = antrenor.adSoyad || '';
  if (tcInput) tcInput.value = antrenor.tc || '';
  if (telefonInput) telefonInput.value = antrenor.telefon || '';
  if (emailInput) emailInput.value = antrenor.email || '';
  if (bransSelect) bransSelect.value = antrenor.brans || '';
  if (maasInput) maasInput.value = Helpers.paraFormat(antrenor.maas || 0);
  if (baslamaTarihiInput) baslamaTarihiInput.value = antrenor.kayitTarihi || '';
  if (notlarTextarea) notlarTextarea.value = '';

  const kaydetBtn = Helpers.$('#antrenorKaydetBtn');
  if (kaydetBtn) {
    kaydetBtn.innerHTML = '<i class="fa-solid fa-rotate"></i> Güncelle';
    kaydetBtn.classList.remove('btn-success');
    kaydetBtn.classList.add('btn-warning');
  }

  const form = Helpers.$('#antrenorEkleForm');
  if (form) {
    form.scrollIntoView({ behavior: 'smooth' });
  }
}

/**
 * Antrenör sil
 */
export function sil(id: number): void {
  const antrenor = Storage.antrenorBul(id);
  if (!antrenor) return;

  if (!Helpers.onay(`"${antrenor.adSoyad}" isimli antrenörü silmek istediğinize emin misiniz?`)) {
    return;
  }

  // Storage'daki silme fonksiyonunu kullan (ID'ye göre filtreleyip kaydeder)
  Storage.antrenorSil(id);

  Helpers.toast('Antrenör silindi!', 'success');
  listeyiGuncelle();
}

/**
 * Antrenör durumunu değiştir
 */
export function durumDegistir(id: number): void {
  const antrenorler = Storage.antrenorleriGetir();
  const index = antrenorler.findIndex(a => a.id === id);

  if (index > -1 && antrenorler[index]) {
    const antrenor = antrenorler[index];
    if (antrenor) {
      antrenor.durum = antrenor.durum === 'Aktif' ? 'Pasif' : 'Aktif';
      Storage.kaydet('soybis_antrenorler', antrenorler);

      const yeniDurum = antrenor.durum;
      Helpers.toast(`Antrenör durumu "${yeniDurum}" olarak güncellendi.`, 'success');

      listeyiGuncelle();
    }
  }
}

/**
 * Listeyi güncelle
 */
export function listeyiGuncelle(): void {
  console.log('🔄 [Antrenor] listeyiGuncelle() çağrıldı');

  try {
    const tbody = Helpers.$('#antrenorTableBody');
    const tableContainer = Helpers.$('.table-container');
    if (!tbody) {
      console.warn('⚠️ [Antrenor] listeyiGuncelle - tbody bulunamadı');
      return;
    }

    if (tableContainer && tbody.children.length === 0) {
      Helpers.showSkeleton('.table-container', 'table', { rows: 5, cols: 7 });
    }

    const antrenorler = Storage.antrenorleriGetir();

    tbody.innerHTML = '';

    if (antrenorler.length === 0) {
      Helpers.showEmptyState(
        '#antrenorEmptyState',
        'Henüz antrenör kaydı bulunmuyor',
        'İlk antrenör kaydını eklemek için yukarıdaki formu kullanın.',
        { icon: 'fa-user-tie' }
      );
      if (tableContainer) {
        Helpers.hideSkeleton('.table-container');
      }
      ozetGuncelle(0, 0);
      return;
    }

    Helpers.hideEmptyState('#antrenorEmptyState');

    if (tableContainer) {
      Helpers.hideSkeleton('.table-container');
    }

    const toplamMaas = antrenorler
      .filter(a => a.durum === 'Aktif')
      .reduce((t, a) => t + (a.maas || 0), 0);

    antrenorler.forEach((antrenor: Antrenor) => {
      const durumBadge = Helpers.createDurumBadge(antrenor.durum);
      const bransBadge = Helpers.createBadge('info', Helpers.escapeHtml(antrenor.brans || '-'));
      const telefonFormatted = Helpers.telefonFormat(antrenor.telefon || '');
      const ad = Helpers.escapeHtml(antrenor.adSoyad);

      const tr = Helpers.createTableRow(
        [
          `<strong class="card-name">${ad}</strong>`,
          bransBadge,
          telefonFormatted,
          `<span class="financial-negative">${Helpers.paraFormat(antrenor.maas || 0)} TL</span>`,
          antrenor.kayitTarihi ? Helpers.tarihFormat(antrenor.kayitTarihi) : '-',
          durumBadge,
          `<div class="action-buttons">
        <button class="btn btn-small btn-icon btn-warning" onclick="window.Antrenor?.duzenle(${antrenor.id})" title="Düzenle">
          <i class="fa-solid fa-edit"></i>
        </button>
        <button class="btn btn-small btn-icon ${antrenor.durum === 'Aktif' ? 'btn-warning' : 'btn-success'}" 
                onclick="window.Antrenor?.durumDegistir(${antrenor.id})" 
                title="${antrenor.durum === 'Aktif' ? 'Pasif Yap' : 'Aktif Yap'}">
          <i class="fa-solid ${antrenor.durum === 'Aktif' ? 'fa-pause' : 'fa-play'}"></i>
        </button>
        <button class="btn btn-small btn-icon btn-danger" onclick="window.Antrenor?.sil(${antrenor.id})" title="Sil">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>`,
        ],
        {
          labels: ['Ad Soyad', 'Branş', 'Telefon', 'Maaş', 'Başlama', 'Durum', ''],
        }
      );
      tbody.appendChild(tr);
    });

    ozetGuncelle(antrenorler.filter(a => a.durum === 'Aktif').length, toplamMaas);
  } catch (error) {
    console.error('❌ [Antrenor] listeyiGuncelle hatası:', error);
    if (typeof Helpers !== 'undefined' && Helpers.toast) {
      Helpers.toast('Antrenör listesi güncellenirken hata oluştu!', 'error');
    }
  }
}

/**
 * Özet bilgilerini güncelle
 */
function ozetGuncelle(toplamAntrenor: number, toplamMaas: number): void {
  const toplamEl = Helpers.$('#toplamAntrenor');
  const maasEl = Helpers.$('#toplamMaas');

  if (toplamEl) (toplamEl as HTMLElement).textContent = toplamAntrenor.toString();
  if (maasEl) (maasEl as HTMLElement).textContent = Helpers.paraFormat(toplamMaas) + ' TL';
}

// Public API
if (typeof window !== 'undefined') {
  (window as unknown as { Antrenor: Record<string, unknown> }).Antrenor = {
    init,
    kaydet,
    duzenle,
    sil,
    durumDegistir,
    formuTemizle,
    listeyiGuncelle,
  };
}
