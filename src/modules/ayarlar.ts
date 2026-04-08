/**
 * SOY-BIS - Ayarlar Modülü (ayarlar.ts)
 * Sistem ayarları (Hatırlatma ayarları, Başlangıç Bakiyesi vb.)
 */

import * as Storage from '../utils/storage';
import * as Helpers from '../utils/helpers';
import type { Ayarlar, AntrenmanGrubu, Sporcu } from '../types';
import { STORAGE_KEYS } from '../types';

let antrenmanGrupYonetimBaglandi = false;
let grupAtamaYonetimBaglandi = false;

/**
 * Modülü başlat
 */
export function init(): void {
  baslangicBakiyesiFormuBaslat();
  antrenmanGruplariYonetiminiBaslat();
  grupAtamaYonetiminiBaslat();
  antrenmanGruplariPaneliniGuncelle();
  grupAtamaPaneliniGuncelle();
}

function sporcuModuluAntrenmanUiYenile(): void {
  const Sporcu = (window as unknown as { Sporcu?: { antrenmanGruplariUiYenile?: () => void } }).Sporcu;
  if (Sporcu?.antrenmanGruplariUiYenile) {
    Sporcu.antrenmanGruplariUiYenile();
  }
}

/**
 * Ayarlar ekranı açıldığında veya veri değişince tabloyu yeniler (app.ts).
 */
export function antrenmanGruplariPaneliniGuncelle(): void {
  const tbody = Helpers.$('#ayarlarAntrenmanGrupTabloBody');
  const emptyEl = Helpers.$('#ayarlarAntrenmanGrupEmpty');
  if (!tbody) return;

  try {
    const gruplar = Storage.antrenmanGruplariGetir()
      .slice()
      .sort((a, b) => {
        const bb = String(a.brans || '').localeCompare(String(b.brans || ''), 'tr');
        if (bb !== 0) return bb;
        return String(a.ad || '').localeCompare(String(b.ad || ''), 'tr');
      });

    if (gruplar.length === 0) {
      tbody.innerHTML = '';
      if (emptyEl) emptyEl.hidden = false;
      return;
    }
    if (emptyEl) emptyEl.hidden = true;

    tbody.innerHTML = gruplar
      .map((g: AntrenmanGrubu) => {
        const br = g.brans ? Helpers.escapeHtml(g.brans) : '—';
        const ad = Helpers.escapeHtml(g.ad);
        const id = Helpers.escapeHtml(g.id);
        return `<tr data-grup-id="${id}">
        <td data-label="Branş">${br}</td>
        <td data-label="Grup adı">${ad}</td>
        <td class="settings-antrenman-grup-table__actions" data-label="İşlem">
          <button type="button" class="btn btn-small btn-danger" data-action="ayarlar-antrenman-grup-sil" data-grup-id="${id}" title="Grubu sil">
            <i class="fa-solid fa-trash-alt" aria-hidden="true"></i> Sil
          </button>
        </td>
      </tr>`;
      })
      .join('');
  } catch (e) {
    console.error('[Ayarlar] antrenmanGruplariPaneliniGuncelle:', e);
  }
}

function antrenmanGrubuBransEslesirMi(grup: AntrenmanGrubu, sporcuBrans: string): boolean {
  const gb = (grup.brans || '').trim().toLowerCase();
  const sb = sporcuBrans.trim().toLowerCase();
  if (!gb) return true;
  if (!sb) return false;
  return gb === sb;
}

function antrenmanGruplariSporcuBransinaGore(sporcuBrans: string): AntrenmanGrubu[] {
  return Storage.antrenmanGruplariGetir()
    .filter(g => antrenmanGrubuBransEslesirMi(g, sporcuBrans))
    .sort((a, b) => a.ad.localeCompare(b.ad, 'tr'));
}

/** U-7, U-8, U-9… sayısal sıra */
function yasGrubuSiralamaKarsilastir(a: string, b: string): number {
  const na = parseInt(String(a).replace(/\D/g, ''), 10);
  const nb = parseInt(String(b).replace(/\D/g, ''), 10);
  if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb;
  return a.localeCompare(b, 'tr');
}

/**
 * Seçili branşa göre (veya tümü) veride görünen TFF ana grup değerleriyle yaş filtresi doldurulur.
 */
function grupAtamaYasFiltreSecenekleriniDoldur(): void {
  const sel = Helpers.$('#ayarlarGrupAtamaYasFiltre') as HTMLSelectElement | null;
  if (!sel) return;

  const bransFiltre = (
    Helpers.$('#ayarlarGrupAtamaBransFiltre') as HTMLSelectElement | null
  )?.value?.trim() || '';
  const bransFiltreLower = bransFiltre.toLowerCase();
  let kaynak = Storage.sporculariGetir().filter((s: Sporcu) => s.durum !== 'Ayrıldı');
  if (bransFiltre) {
    kaynak = kaynak.filter(
      s => (s.sporBilgileri?.brans || '').trim().toLowerCase() === bransFiltreLower
    );
  }

  const set = new Set<string>();
  for (const s of kaynak) {
    const y = (s.tffGruplari?.anaGrup || '').trim();
    if (y && y !== 'Hesaplanacak') set.add(y);
  }
  const list = Array.from(set).sort(yasGrubuSiralamaKarsilastir);
  const prev = sel.value;

  sel.innerHTML = '<option value="">Tüm yaş grupları</option>';
  for (const y of list) {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = y;
    sel.appendChild(opt);
  }

  if (prev && list.some(x => x === prev)) {
    sel.value = prev;
  } else {
    sel.value = '';
  }
}

/**
 * Ayarlar → Antrenman grubu atamaları tablosunu doldurur (liste görünümünde atama yok).
 */
export function grupAtamaPaneliniGuncelle(): void {
  const tbody = Helpers.$('#ayarlarGrupAtamaTabloBody');
  const emptyEl = Helpers.$('#ayarlarGrupAtamaEmpty');
  const filtre = Helpers.$('#ayarlarGrupAtamaBransFiltre') as HTMLSelectElement | null;
  const yasSel = Helpers.$('#ayarlarGrupAtamaYasFiltre') as HTMLSelectElement | null;
  if (!tbody) return;

  grupAtamaYasFiltreSecenekleriniDoldur();

  const bransFiltre = (filtre?.value || '').trim();
  const bransFiltreLower = bransFiltre.toLowerCase();
  const yasFiltre = (yasSel?.value || '').trim();
  let sporcular = Storage.sporculariGetir().filter((s: Sporcu) => s.durum !== 'Ayrıldı');
  if (bransFiltre) {
    sporcular = sporcular.filter(
      s =>
        (s.sporBilgileri?.brans || '').trim().toLowerCase() === bransFiltreLower
    );
  }
  if (yasFiltre) {
    const yLower = yasFiltre.toLowerCase();
    sporcular = sporcular.filter(
      s =>
        (s.tffGruplari?.anaGrup || '').trim().toLowerCase() === yLower
    );
  }
  sporcular.sort((a, b) =>
    (a.temelBilgiler.adSoyad || '').localeCompare(b.temelBilgiler.adSoyad || '', 'tr')
  );

  if (sporcular.length === 0) {
    tbody.innerHTML = '';
    if (emptyEl) emptyEl.hidden = false;
    return;
  }
  if (emptyEl) emptyEl.hidden = true;

  tbody.innerHTML = sporcular
    .map((s: Sporcu) => {
      const ad = Helpers.escapeHtml(s.temelBilgiler.adSoyad || '');
      const brans = Helpers.escapeHtml((s.sporBilgileri?.brans || '').trim() || '—');
      const yas = Helpers.escapeHtml(s.tffGruplari?.anaGrup || '—');
      const sb = (s.sporBilgileri?.brans || '').trim();
      let gruplar = antrenmanGruplariSporcuBransinaGore(sb);
      const selected = s.antrenmanGrubuId || '';
      if (selected && !gruplar.some(g => g.id === selected)) {
        const o = Storage.antrenmanGrubuBul(selected);
        if (o) {
          gruplar = [...gruplar, o].sort((a, b) =>
            String(a.ad || '').localeCompare(String(b.ad || ''), 'tr')
          );
        } else {
          gruplar = [
            ...gruplar,
            { id: selected, ad: 'Tanımsız grup (silinmiş veya eksik)', brans: undefined },
          ].sort((a, b) => String(a.ad || '').localeCompare(String(b.ad || ''), 'tr'));
        }
      }
      let opts = '<option value="">— Atanmadı —</option>';
      for (const g of gruplar) {
        const sel = g.id === selected ? ' selected' : '';
        const label = g.brans ? `${g.ad} (${g.brans})` : g.ad;
        opts += `<option value="${Helpers.escapeHtml(g.id)}"${sel}>${Helpers.escapeHtml(label)}</option>`;
      }
      return `<tr>
        <td data-label="Sporcu">${ad}</td>
        <td data-label="Branş">${brans}</td>
        <td data-label="Yaş grubu">${yas}</td>
        <td data-label="Antrenman grubu">
          <select class="form-control settings-grup-atama-select" data-sporcu-id="${s.id}" aria-label="Antrenman grubu">${opts}</select>
        </td>
      </tr>`;
    })
    .join('');
}

function grupAtamaYonetiminiBaslat(): void {
  if (grupAtamaYonetimBaglandi) return;
  const card = Helpers.$('#ayarlarGrupAtamaCard');
  const filtre = Helpers.$('#ayarlarGrupAtamaBransFiltre') as HTMLSelectElement | null;
  const yasFiltre = Helpers.$('#ayarlarGrupAtamaYasFiltre') as HTMLSelectElement | null;
  if (!card || !filtre) return;
  grupAtamaYonetimBaglandi = true;

  filtre.addEventListener('change', () => {
    grupAtamaPaneliniGuncelle();
  });

  if (yasFiltre) {
    yasFiltre.addEventListener('change', () => {
      grupAtamaPaneliniGuncelle();
    });
  }

  card.addEventListener('change', e => {
    const t = e.target as HTMLElement;
    if (!t.classList.contains('settings-grup-atama-select')) return;
    const sel = t as HTMLSelectElement;
    const idStr = sel.getAttribute('data-sporcu-id');
    if (!idStr) return;
    const sporcuId = parseInt(idStr, 10);
    if (isNaN(sporcuId)) return;
    const sporcu = Storage.sporcuBul(sporcuId);
    if (!sporcu) return;
    const val = sel.value.trim();
    Storage.sporcuKaydet({
      ...sporcu,
      antrenmanGrubuId: val || undefined,
    });
    sporcuModuluAntrenmanUiYenile();
    Helpers.toast('Antrenman grubu güncellendi.', 'success');
  });
}

function antrenmanGruplariYonetiminiBaslat(): void {
  if (antrenmanGrupYonetimBaglandi) return;
  const card = Helpers.$('#ayarlarAntrenmanGrupCard');
  const ekleBtn = Helpers.$('#ayarlarAntrenmanGrupEkleBtn');
  if (!card || !ekleBtn) return;

  antrenmanGrupYonetimBaglandi = true;

  ekleBtn.addEventListener('click', () => {
    const bransSel = Helpers.$('#ayarlarAntrenmanGrupBrans') as HTMLSelectElement | null;
    const adInput = Helpers.$('#ayarlarAntrenmanGrupAd') as HTMLInputElement | null;
    const brans = (bransSel?.value || '').trim();
    const ad = (adInput?.value || '').trim();
    if (!brans) {
      Helpers.toast('Branş seçin.', 'warning');
      bransSel?.focus();
      return;
    }
    if (!ad) {
      Helpers.toast('Grup adı girin.', 'warning');
      adInput?.focus();
      return;
    }
    const g = Storage.antrenmanGrubuEkle(ad, brans);
    if (!g) return;
    if (adInput) adInput.value = '';
    antrenmanGruplariPaneliniGuncelle();
    grupAtamaPaneliniGuncelle();
    sporcuModuluAntrenmanUiYenile();
    Helpers.toast('Antrenman grubu eklendi.', 'success');
  });

  card.addEventListener('click', e => {
    const btn = (e.target as HTMLElement).closest(
      '[data-action="ayarlar-antrenman-grup-sil"]'
    ) as HTMLButtonElement | null;
    if (!btn) return;
    e.preventDefault();
    const gid = btn.getAttribute('data-grup-id');
    if (!gid) return;
    if (
      !confirm(
        'Bu antrenman grubunu silmek istediğinize emin misiniz? Bu gruba atanmış sporcuların grup ataması kaldırılır.'
      )
    ) {
      return;
    }
    Storage.antrenmanGrubuSil(gid);
    antrenmanGruplariPaneliniGuncelle();
    grupAtamaPaneliniGuncelle();
    sporcuModuluAntrenmanUiYenile();
    Helpers.toast('Grup silindi.', 'success');
  });
}

/**
 * Başlangıç bakiyesi formunu başlat
 */
function baslangicBakiyesiFormuBaslat(): void {
  const form = Helpers.$('#baslangicBakiyesiForm') as HTMLFormElement | null;
  const nakitInput = Helpers.$('#baslangicNakit') as HTMLInputElement | null;
  const bankaInput = Helpers.$('#baslangicBanka') as HTMLInputElement | null;
  const tarihInput = Helpers.$('#baslangicBakiyeTarih') as HTMLInputElement | null;
  const kaydetBtn = Helpers.$('#baslangicBakiyeKaydet') as HTMLButtonElement | null;

  if (!form || !nakitInput || !bankaInput || !tarihInput || !kaydetBtn) {
    return;
  }

  const mevcutBakiye = baslangicBakiyesiGetir();
  if (mevcutBakiye) {
    nakitInput.value = Helpers.paraFormat(mevcutBakiye.nakit);
    bankaInput.value = Helpers.paraFormat(mevcutBakiye.banka);
    tarihInput.value = mevcutBakiye.tarih || Helpers.bugunISO();
  } else {
    tarihInput.value = Helpers.bugunISO();
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    baslangicBakiyesiKaydet();
  });

  kaydetBtn.addEventListener('click', () => {
    baslangicBakiyesiKaydet();
  });
}

/**
 * Başlangıç bakiyesi kaydet
 */
function baslangicBakiyesiKaydet(): void {
  const nakitInput = Helpers.$('#baslangicNakit') as HTMLInputElement | null;
  const bankaInput = Helpers.$('#baslangicBanka') as HTMLInputElement | null;
  const tarihInput = Helpers.$('#baslangicBakiyeTarih') as HTMLInputElement | null;

  if (!nakitInput || !bankaInput || !tarihInput) {
    Helpers.toast('Form alanları bulunamadı!', 'error');
    return;
  }

  const nakit = Helpers.paraCoz(nakitInput.value);
  const banka = Helpers.paraCoz(bankaInput.value);
  const tarih = tarihInput.value;

  if (nakit < 0 || banka < 0) {
    Helpers.toast('Bakiye değerleri negatif olamaz!', 'error');
    return;
  }

  const bakiyeler = { nakit, banka, tarih };

  Storage.kaydet(STORAGE_KEYS.BASLANGIC_BAKIYESI, bakiyeler);

  const ayarlar = Storage.oku<Ayarlar>(STORAGE_KEYS.AYARLAR, {});
  ayarlar.baslangicBakiyesi = bakiyeler;
  Storage.kaydet(STORAGE_KEYS.AYARLAR, ayarlar);

  Helpers.toast(
    `Başlangıç bakiyesi kaydedildi! Nakit: ${Helpers.paraFormat(nakit)} TL, Banka: ${Helpers.paraFormat(banka)} TL`,
    'success'
  );

  if (window.App && typeof window.App.viewGoster === 'function') {
    const dashboardView = Helpers.$('#dashboard');
    if (dashboardView && dashboardView.classList.contains('active')) {
      const Dashboard = (window as any).Dashboard;
      if (Dashboard && typeof Dashboard.init === 'function') {
        Dashboard.init();
      }
    }
  }
}

/**
 * Başlangıç bakiyesi getir
 */
export function baslangicBakiyesiGetir(): { nakit: number; banka: number; tarih: string } | null {
  const bakiyeler = Storage.oku<{ nakit: number; banka: number; tarih: string }>(
    STORAGE_KEYS.BASLANGIC_BAKIYESI,
    { nakit: 0, banka: 0, tarih: Helpers.bugunISO() }
  );

  if (!bakiyeler || (bakiyeler.nakit === 0 && bakiyeler.banka === 0)) {
    const ayarlar = Storage.oku<Ayarlar>(STORAGE_KEYS.AYARLAR, {});
    if (ayarlar.baslangicBakiyesi) {
      return ayarlar.baslangicBakiyesi;
    }
  }

  return bakiyeler && bakiyeler.nakit === 0 && bakiyeler.banka === 0 ? null : bakiyeler;
}

/** Uzun açıklama — bilgi ikonuna tıklanınca toast (tüm ekranlar) */
const TOPLU_ZAM_TOOLTIP =
  'Tüm sporculara veya seçili filtreye göre toplu zam yapabilirsiniz. Sabit tutar, yüzdelik veya enflasyon bazlı zam seçenekleri mevcuttur.';

/**
 * Aidat KPI şeridinde (#topluZamAidatSlot) kompakt toplu zam + bilgi (toast).
 */
export function topluZamButonuOlustur(): void {
  const slot = Helpers.$('#topluZamAidatSlot') as HTMLElement | null;
  const mevcutButon = Helpers.$('#topluZamBtn') as HTMLElement | null;
  if (mevcutButon && slot?.contains(mevcutButon)) {
    return;
  }

  document.getElementById('topluZamAidatCard')?.remove();
  document.getElementById('topluZamSettingItem')?.remove();
  if (mevcutButon) {
    mevcutButon.closest('.toplu-zam-aidat-mini')?.remove();
    mevcutButon.closest('.toplu-zam-settings-card')?.remove();
  }

  const wrap = document.createElement('div');
  wrap.id = 'topluZamAidatCard';
  wrap.className = 'toplu-zam-aidat-mini';

  const buton = document.createElement('button');
  buton.id = 'topluZamBtn';
  buton.type = 'button';
  buton.className = 'toplu-zam-aidat-mini__btn';
  buton.setAttribute(
    'aria-label',
    'Toplu zam yap — Tüm sporculara veya seçili filtreye göre zam uygula'
  );
  buton.innerHTML =
    '<span class="toplu-zam-aidat-mini__ico" aria-hidden="true"><i class="fa-solid fa-percent"></i></span>' +
    '<span class="toplu-zam-aidat-mini__lbl">Toplu Zam Yap</span>';

  const bilgiBtn = document.createElement('button');
  bilgiBtn.type = 'button';
  bilgiBtn.className = 'toplu-zam-aidat-mini__hint';
  bilgiBtn.setAttribute('aria-label', 'Toplu zam hakkında bilgi');
  bilgiBtn.innerHTML = '<i class="fa-solid fa-circle-info" aria-hidden="true"></i>';
  bilgiBtn.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    Helpers.toast(TOPLU_ZAM_TOOLTIP, 'info', 10000);
  });

  buton.addEventListener('click', () => {
    const SporcuModule = (window as any).Sporcu;
    if (SporcuModule?.topluZamModalAc) {
      SporcuModule.topluZamModalAc();
    } else {
      Helpers.toast(
        'Toplu zam özelliği henüz yüklenmedi. Lütfen birkaç saniye bekleyip tekrar deneyin.',
        'warning'
      );
      setTimeout(() => {
        const retrySporcu = (window as any).Sporcu;
        if (retrySporcu?.topluZamModalAc) {
          retrySporcu.topluZamModalAc();
        } else {
          Helpers.toast('Sporcu modülü yüklenemedi. Sayfayı yenileyin.', 'error');
        }
      }, 2000);
    }
  });

  wrap.appendChild(buton);
  wrap.appendChild(bilgiBtn);

  if (slot) {
    slot.appendChild(wrap);
    return;
  }

  const headerTop = Helpers.$('.aidat-header-top') as HTMLElement | null;
  const actions = headerTop?.querySelector('.aidat-header-top-actions') as HTMLElement | null;
  if (actions) {
    actions.insertBefore(wrap, actions.firstChild);
    return;
  }

  const listCard = Helpers.$('#aidatListCard') as HTMLElement | null;
  const content = listCard?.querySelector('.aidat-content') as HTMLElement | null;
  if (listCard && content) {
    listCard.insertBefore(wrap, content);
    return;
  }

  wrap.classList.add('toplu-zam-aidat-mini--fixed');
  document.body.appendChild(wrap);
}

if (typeof window !== 'undefined') {
  (window as any).Ayarlar = {
    init,
    baslangicBakiyesiGetir,
    baslangicBakiyesiKaydet,
    topluZamButonuOlustur,
    antrenmanGruplariPaneliniGuncelle,
    grupAtamaPaneliniGuncelle,
  };
}
