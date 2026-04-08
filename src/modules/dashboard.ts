/**
 * SOY-BIS - Dashboard Modülü (dashboard.ts)
 * Gösterge paneli ve hızlı erişim işlemleri
 */

import Chart from 'chart.js/auto';
import type { Chart as ChartType } from 'chart.js';
import * as Storage from '../utils/storage';
import * as Helpers from '../utils/helpers';
import { aidatGuncelDonemKpiOzet } from './aidat';
import { Sporcu } from '../types';
import type { Session } from '../types';

// Global window types (temporary until all modules are migrated)
declare global {
  interface Window {
    Auth?: {
      yetkiKontrol: (yetki: string) => boolean;
      isAdmin: () => boolean;
      aktifKullanici: () => Session | null;
    };
    App?: {
      viewGoster: (view: string, ilkBaslatma?: boolean) => void;
    };
    Dashboard?: {
      guncelle: () => void;
      malzemeModalKapatF?: () => void;
      malzemeKaydet?: () => void;
    };
    Sporcu?: {
      init?: () => void;
      kaydet?: () => void;
      duzenle?: (id: number) => void;
      sil?: (id: number) => void;
      tekrarAktifEt?: (id: number) => void;
      durumDegistir?: (id: number) => void;
      formuTemizle?: () => void;
      listeyiGuncelle?: () => void;
      aktifSporcuSayisi?: () => number;
      yasGrubunaGore?: (yasGrubu: string) => Sporcu[];
      sporcuMalzemeEkleModalKapat?: () => void;
      sporcuMalzemeKaydet?: () => void;
      raporGoster?: (sporcuId: number) => void;
      antrenmanGruplariUiYenile?: () => void;
    };
    Ayarlar?: {
      baslangicBakiyesiGetir?: () => { nakit: number; banka: number; tarih: string } | null;
      baslangicBakiyesiKaydet?: () => void;
    };
    hatirlatilacaklarListesi?: Sporcu[];
  }
}

// Chart instances interface
interface Charts {
  tahsilat: ChartType | null;
  brans: ChartType | null;
  trend: ChartType | null;
  yasGrubu: ChartType | null;
}

// Grafik instance'ları
const charts: Charts = {
  tahsilat: null,
  brans: null,
  trend: null,
  yasGrubu: null,
};

// Chart.js varsayılan ayarları
const chartColors = {
  primary: '#3182ce',
  success: '#38a169',
  warning: '#d69e2e',
  danger: '#e53e3e',
  info: '#00bcd4',
  purple: '#9f7aea',
  pink: '#ed64a6',
  orange: '#ed8936',
  teal: '#38b2ac',
  cyan: '#0dcaf0',
} as const;

interface TarihParcala {
  ay: number;
  yil: number;
}

interface BelgeUyari {
  id: number;
  ad: string;
  tip: string;
  mesaj: string;
  seviye: 'danger' | 'warning' | 'info';
  gun: number;
}

interface DonemOzeti {
  beklenenCiro: number;
  tahsilEdilen: number;
  kalanBorc: number;
  tahsilatOrani: number;
  toplamGider: number;
  netKar: number;
}

/**
 * Dashboard'u başlat
 */
export function init(): void {
  // Yetki kontrolü - Dashboard sadece Yönetici ve Muhasebe görebilir
  if (window.Auth && !window.Auth.yetkiKontrol('dashboard_gorebilir')) {
    const dashboardView = Helpers.$('#dashboard');
    if (dashboardView) {
      dashboardView.style.display = 'none';
    }
    return;
  }

  hizliErisimOlustur();
  malzemeEventleri();
  malzemeListesiniGuncelle();
  guncelle();
  grafikleriOlustur();
}

/**
 * Dashboard'u güncelle
 */
export function guncelle(): void {
  // ÖNCE: Geçmiş aylardan oluşturulmuş hatalı borç kayıtlarını temizle
  // Bu işlem önce yapılmalı ki otomatik aidat yenileme doğru çalışsın
  try {
    const sonuc = Storage.gecmisAyBorclariniTemizle();
    if (sonuc.temizlenen > 0) {
      console.log(`✅ ${sonuc.temizlenen} geçmiş ay borcu temizlendi.`);
    }
  } catch (error) {
    console.error('Geçmiş ay borçları temizlenirken hata:', error);
  }

  // SONRA: Otomatik aylık aidat yenileme - Ödeme günü geldiğinde otomatik borç kaydı oluştur
  // Otomatik aidat yenileme (sadece gelecek aylar için)
  // NOT: Bu fonksiyon sadece kayıt tarihinden SONRAKİ aylar için borç oluşturur
  Storage.otomatikAidatYenile();

  temelIstatistikler();
  finansalIstatistikler();
  belgeUyarilari();
  hatirlatilacaklariGoster();
  malzemeListesiniGuncelle();
  grafikleriGuncelle();
}

/**
 * Temel istatistikleri güncelle
 */
export function temelIstatistikler(): void {
  const sporcular = Storage.sporculariGetir();
  const aktifler = sporcular.filter(s => s.durum === 'Aktif');

  const toplamSporcuEl = Helpers.$('#toplamSporcu');
  const aktifSporcuEl = Helpers.$('#aktifSporcu');

  if (toplamSporcuEl) toplamSporcuEl.textContent = sporcular.length.toString();
  if (aktifSporcuEl) aktifSporcuEl.textContent = aktifler.length.toString();
}

/**
 * Tarih string'inden ay ve yıl çıkar (timezone sorunlarını önlemek için)
 * @param tarihStr - Tarih string'i (çeşitli formatları destekler)
 * @returns {ay, yil}
 */
function tarihParcala(tarihStr: string | null | undefined): TarihParcala {
  if (!tarihStr) return { ay: 0, yil: 0 };

  // ISO format veya Date string ise önce parse et
  if (tarihStr.includes('T') || tarihStr.length > 10) {
    const date = new Date(tarihStr);
    if (!isNaN(date.getTime())) {
      return {
        yil: date.getFullYear(),
        ay: date.getMonth() + 1,
      };
    }
  }

  // YYYY-MM-DD formatı
  const parcalar = tarihStr.split('-');
  if (parcalar.length >= 2) {
    return {
      yil: parseInt(parcalar[0] || '0', 10) || 0,
      ay: parseInt(parcalar[1] || '0', 10) || 0,
    };
  }

  // DD.MM.YYYY formatı (TR)
  const trParcalar = tarihStr.split('.');
  if (trParcalar.length === 3) {
    return {
      yil: parseInt(trParcalar[2] || '0', 10) || 0,
      ay: parseInt(trParcalar[1] || '0', 10) || 0,
    };
  }

  return { ay: 0, yil: 0 };
}

/**
 * Finansal istatistikleri güncelle
 * Basit ve anlaşılır: Tahsilat, Gider, Kasa
 */
function finansalIstatistikler(): void {
  const aidatlar = Storage.aidatlariGetir();
  const giderler = Storage.giderleriGetir();

  // Güncel ay — Aidat ile aynı motor (aidatDonemKpiOzet); takvimde başka ay seçiliyken Aidat farklı dönem gösterebilir
  const kpi = aidatGuncelDonemKpiOzet();
  const beklenenAidat = kpi.beklenen;
  const tahsilat = kpi.tahsilat;
  const kalanAlacak = kpi.kalan;
  const kalanAlacakToplami = kpi.kalan;

  const tahsilatOrani =
    beklenenAidat > 0
      ? Math.min(100, Math.round((tahsilat / beklenenAidat) * 100))
      : tahsilat > 0
        ? 100
        : 0;

  // Toplam Gider (Tüm zamanlar)
  const gider = giderler.reduce((t, g) => t + (g.miktar || 0), 0);

  // ========== NAKİT VE BANKA HESAPLAMALARI ==========

  // Nakit Tahsilat: Ödeme Yöntemi 'Nakit' olan tahsilatlar (negatif tutarlar) - YENİ MANTIK
  const nakitTahsilat = aidatlar
    .filter(a => a.yontem === 'Nakit' && ((a.tutar || 0) < 0 || a.islem_turu === 'Tahsilat'))
    .reduce((t, a) => t + Math.abs(a.tutar || 0), 0); // Mutlak değer al

  // Banka Tahsilat: Ödeme Yöntemi 'Banka / Havale' olan tahsilatlar (negatif tutarlar) - YENİ MANTIK
  const bankaTahsilat = aidatlar
    .filter(
      a =>
        (a.yontem === 'Banka / Havale' || a.odemeYontemi === 'Banka / Havale') &&
        ((a.tutar || 0) < 0 || a.islem_turu === 'Tahsilat')
    )
    .reduce((t, a) => t + Math.abs(a.tutar || 0), 0); // Mutlak değer al

  // Nakit Gider: Ödeme Kaynağı 'Nakit Kasa' olan tüm giderler
  const nakitGider = giderler
    .filter(g => g.yontem === 'Nakit Kasa')
    .reduce((t, g) => t + (g.miktar || 0), 0);

  // Banka Gider: Ödeme Kaynağı 'Banka Hesabı' olan giderler
  // Sadece açıkça 'Banka Hesabı' olarak işaretlenmiş giderleri say
  const bankaGider = giderler
    .filter(g => g.yontem === 'Banka Hesabı')
    .reduce((t, g) => t + (g.miktar || 0), 0);

  // Başlangıç bakiyesi - Sistem kurulumunda girilen ilk bakiye
  const baslangicBakiyesi = (window as any).Ayarlar?.baslangicBakiyesiGetir?.() || null;
  const baslangicNakit = baslangicBakiyesi?.nakit || 0;
  const baslangicBanka = baslangicBakiyesi?.banka || 0;

  // Nakit Durumu = Başlangıç Nakit + Nakit Tahsilat - Nakit Gider
  // Pozitif: Nakit kasada para var, Negatif: Nakit kasa borçlu
  const nakitDurum = baslangicNakit + nakitTahsilat - nakitGider;

  // Banka Durumu = Başlangıç Banka + Banka Tahsilat - Banka Gider
  // Pozitif: Banka hesabında para var, Negatif: Banka hesabı borçlu
  const bankaDurum = baslangicBanka + bankaTahsilat - bankaGider;

  // Toplam Kasa = Nakit Durumu + Banka Durumu
  // Bu, toplam finansal durumu gösterir (Nakit + Banka bakiyesi)
  const toplamKasa = nakitDurum + bankaDurum;

  // DEBUG: Nakit ve Banka hesaplamalarını konsola yazdır
  console.log('💰 NAKİT VE BANKA DURUMU:', {
    baslangicNakit,
    baslangicBanka,
    nakitTahsilat,
    nakitGider,
    nakitDurum,
    bankaTahsilat,
    bankaGider,
    bankaDurum,
    toplamKasa,
  });

  // ========== DOM GÜNCELLEMELERİ ==========

  // Tahsilat kartı
  const tahsilatEl = Helpers.$('#tahsilat');
  const tahsilatOraniEl = Helpers.$('#tahsilatOrani');
  const kalanAlacakEl = Helpers.$('#kalanAlacak');
  const progressBar = Helpers.$('#tahsilatProgress') as HTMLElement | null;
  const tahsilatCard = Helpers.$('#tahsilatCard');

  // Tam sayı formatı kullan (binlik ayırıcı ile)
  if (tahsilatEl) tahsilatEl.textContent = Helpers.paraFormat(tahsilat) + ' TL';
  if (tahsilatOraniEl) tahsilatOraniEl.textContent = '%' + tahsilatOrani;
  if (kalanAlacakEl) kalanAlacakEl.textContent = Helpers.paraFormat(kalanAlacak) + ' TL';

  // Tahsilat kartı rengi
  if (tahsilatCard) {
    if (tahsilatOrani >= 100) {
      tahsilatCard.className = 'stat-card-large stat-card-success';
    } else {
      tahsilatCard.className = 'stat-card-large';
    }
  }

  // Progress bar - %100'ü aşmamalı
  if (progressBar) {
    const progressYuzde = Math.min(tahsilatOrani, 100);
    progressBar.style.width = progressYuzde + '%';
    progressBar.style.backgroundColor =
      progressYuzde >= 80
        ? 'var(--success)'
        : progressYuzde >= 50
          ? 'var(--warning)'
          : 'var(--danger)';
  }

  // Gider kartı
  const giderEl = Helpers.$('#gider');
  if (giderEl) giderEl.textContent = Helpers.paraFormat(gider) + ' TL';

  // Kalan Alacak Toplamı kartı
  const kalanAlacakToplamiEl = Helpers.$('#kalanAlacakToplami');
  if (kalanAlacakToplamiEl) {
    kalanAlacakToplamiEl.textContent = Helpers.paraFormat(kalanAlacakToplami) + ' TL';
  }

  // Finansal Durum kartı (Nakit ve Banka)
  const kasaCard = Helpers.$('#kasaCard');
  const nakitEl = Helpers.$('#nakitDurum');
  const bankaEl = Helpers.$('#bankaDurum');
  const toplamKasaEl = Helpers.$('#toplamKasa');

  // Nakit durumu göster
  if (nakitEl) {
    nakitEl.textContent = Helpers.paraFormat(nakitDurum) + ' TL';
    nakitEl.className =
      nakitDurum >= 0 ? 'financial-value financial-positive' : 'financial-value financial-negative';
  }

  // Banka durumu göster (mavi renk için özel class)
  if (bankaEl) {
    bankaEl.textContent = Helpers.paraFormat(bankaDurum) + ' TL';
    // Banka için pozitif durumda mavi, negatif durumda kırmızı
    if (bankaDurum >= 0) {
      bankaEl.className = 'financial-value financial-positive banka-durum';
    } else {
      bankaEl.className = 'financial-value financial-negative';
    }
  }

  // Toplam Kasa göster (Nakit + Banka)
  if (toplamKasaEl) {
    toplamKasaEl.textContent = Helpers.paraFormat(toplamKasa) + ' TL';
    toplamKasaEl.className =
      toplamKasa >= 0 ? 'financial-value financial-positive' : 'financial-value financial-negative';
  }

  // Kart rengi (toplam duruma göre)
  if (kasaCard) {
    kasaCard.className =
      toplamKasa >= 0 ? 'stat-card-large stat-card-success' : 'stat-card-large stat-card-danger';
  }
}

/**
 * Belge uyarılarını kontrol et ve göster
 */
function belgeUyarilari(): void {
  const container = Helpers.$('#belgeUyariList');
  const card = Helpers.$('#belgeUyariCard');
  if (!container || !card) return;

  const sporcular = Storage.sporculariGetir().filter(s => s.durum === 'Aktif');
  const bugun = new Date();
  const uyariGunu = 30; // 30 gün kala uyarı ver
  const uyarilar: BelgeUyari[] = [];

  sporcular.forEach(sporcu => {
    const belgeler = sporcu.belgeler || {};
    const ad = sporcu.temelBilgiler?.adSoyad || 'Bilinmiyor';
    const id = sporcu.id;

    // Sağlık raporu kontrolü
    if (belgeler.saglikRaporu) {
      const tarih = new Date(belgeler.saglikRaporu);
      const kalanGun = Math.ceil((tarih.getTime() - bugun.getTime()) / (1000 * 60 * 60 * 24));

      if (kalanGun < 0) {
        uyarilar.push({
          id,
          ad,
          tip: 'Sağlık Raporu',
          mesaj: 'SÜRESİ GEÇTİ',
          seviye: 'danger',
          gun: kalanGun,
        });
      } else if (kalanGun <= uyariGunu) {
        uyarilar.push({
          id,
          ad,
          tip: 'Sağlık Raporu',
          mesaj: `${kalanGun} gün kaldı`,
          seviye: kalanGun <= 7 ? 'warning' : 'info',
          gun: kalanGun,
        });
      }
    }

    // Lisans kontrolü
    if (belgeler.lisans) {
      const tarih = new Date(belgeler.lisans);
      const kalanGun = Math.ceil((tarih.getTime() - bugun.getTime()) / (1000 * 60 * 60 * 24));

      if (kalanGun < 0) {
        uyarilar.push({
          id,
          ad,
          tip: 'Lisans',
          mesaj: 'SÜRESİ GEÇTİ',
          seviye: 'danger',
          gun: kalanGun,
        });
      } else if (kalanGun <= uyariGunu) {
        uyarilar.push({
          id,
          ad,
          tip: 'Lisans',
          mesaj: `${kalanGun} gün kaldı`,
          seviye: kalanGun <= 7 ? 'warning' : 'info',
          gun: kalanGun,
        });
      }
    }

    // Sigorta kontrolü
    if (belgeler.sigorta) {
      const tarih = new Date(belgeler.sigorta);
      const kalanGun = Math.ceil((tarih.getTime() - bugun.getTime()) / (1000 * 60 * 60 * 24));

      if (kalanGun < 0) {
        uyarilar.push({
          id,
          ad,
          tip: 'Sigorta',
          mesaj: 'SÜRESİ GEÇTİ',
          seviye: 'danger',
          gun: kalanGun,
        });
      } else if (kalanGun <= uyariGunu) {
        uyarilar.push({
          id,
          ad,
          tip: 'Sigorta',
          mesaj: `${kalanGun} gün kaldı`,
          seviye: kalanGun <= 7 ? 'warning' : 'info',
          gun: kalanGun,
        });
      }
    }
  });

  // Uyarı yoksa gizle
  if (uyarilar.length === 0) {
    (card as HTMLElement).style.display = 'none';
    return;
  }

  // Uyarıları önceliğe göre sırala (geçmiş olanlar önce)
  uyarilar.sort((a, b) => a.gun - b.gun);

  (card as HTMLElement).style.display = 'block';
  container.innerHTML = uyarilar
    .map(u => {
      // Güvenli: XSS koruması için escapeHtml kullan
      const ad = Helpers.escapeHtml(u.ad);
      const tip = Helpers.escapeHtml(u.tip);
      const mesaj = Helpers.escapeHtml(u.mesaj);

      return `
                <div class="belge-uyari-item belge-uyari-${u.seviye}">
                    <div class="belge-uyari-icon">
                        <i class="fa-solid ${
                          u.seviye === 'danger'
                            ? 'fa-circle-exclamation'
                            : u.seviye === 'warning'
                              ? 'fa-triangle-exclamation'
                              : 'fa-circle-info'
                        }"></i>
                    </div>
                    <div class="belge-uyari-content">
                        <div class="belge-uyari-title">${ad}</div>
                        <div class="belge-uyari-detail">${tip}: <strong>${mesaj}</strong></div>
                    </div>
                    <button class="btn btn-small" onclick="window.Sporcu.duzenle(${u.id})">
                        <i class="fa-solid fa-edit"></i> Güncelle
                    </button>
                </div>
            `;
    })
    .join('');
}

/**
 * Hatırlatılacakları göster
 */
function hatirlatilacaklariGoster(): void {
  const container = Helpers.$('#hatirlatilacaklarList');
  const card = Helpers.$('#hatirlatilacaklarCard');
  const topluBtn = Helpers.$('#topluHatirlatmaBtn');

  if (!container || !card) return;

  // Notification modülü yüklü mü kontrol et
  if (!window.Notification) {
    (card as HTMLElement).style.display = 'none';
    return;
  }

  const hatirlatilacaklar = window.Notification?.hatirlatilacaklariGetir?.();

  // hatirlatilacaklar undefined veya null olabilir, kontrol et
  if (!hatirlatilacaklar || !Array.isArray(hatirlatilacaklar) || hatirlatilacaklar.length === 0) {
    (card as HTMLElement).style.display = 'none';
    if (topluBtn) (topluBtn as HTMLElement).style.display = 'none';
    return;
  }

  (card as HTMLElement).style.display = 'block';
  if (topluBtn) {
    (topluBtn as HTMLElement).style.display = 'block';
    // Global değişken (onclick için)
    window.hatirlatilacaklarListesi = hatirlatilacaklar.map(h => h.sporcu);
  }

  // Önceliğe göre sırala (danger > warning > info)
  const oncelikSira: Record<string, number> = { danger: 3, warning: 2, info: 1 };
  hatirlatilacaklar.sort((a, b) => (oncelikSira[b.oncelik] || 0) - (oncelikSira[a.oncelik] || 0));

  container.innerHTML = hatirlatilacaklar
    .map(h => {
      const oncelikClass =
        h.oncelik === 'danger'
          ? 'belge-uyari-danger'
          : h.oncelik === 'warning'
            ? 'belge-uyari-warning'
            : 'belge-uyari-info';
      const icon =
        h.oncelik === 'danger'
          ? 'fa-bell'
          : h.oncelik === 'warning'
            ? 'fa-clock'
            : 'fa-info-circle';
      // Mevcut ay için beklenen borç hesapla (gelecek ayın zamlı aidatı değil, mevcut ayın beklenen borcu)
      const bugun = new Date();
      const { ay: buAy, yil: buYil } = Helpers.suAnkiDonem();
      const aidatlar = Storage.aidatlariGetir();
      const mevcutAyOdemeleri = aidatlar.filter(
        a => a.sporcuId === h.sporcu.id && a.donemAy === buAy && a.donemYil === buYil
      );
      const mevcutAyBorclari = mevcutAyOdemeleri
        .filter(a => (a.tutar || 0) > 0 && (a.islem_turu === 'Aidat' || !a.islem_turu))
        .reduce((t, a) => t + (a.tutar || 0), 0);
      // Mevcut ay için beklenen borç: Borç kaydı varsa onu kullan, yoksa mevcut aylık ücreti kullan
      // NOT: Gelecek ayın zamlı aidatı değil, mevcut ayın beklenen borcu gösterilmeli
      const beklenenBorc =
        mevcutAyBorclari > 0 ? mevcutAyBorclari : h.sporcu.odemeBilgileri?.aylikUcret || 0;

      // Güvenli: XSS koruması için escapeHtml kullan
      const adSoyad = Helpers.escapeHtml(h.sporcu.temelBilgiler?.adSoyad || 'Bilinmiyor');
      const mesaj = Helpers.escapeHtml(h.mesaj);

      return `
                <div class="belge-uyari-item ${oncelikClass}">
                    <div class="belge-uyari-icon">
                        <i class="fa-solid ${icon}"></i>
                    </div>
                    <div class="belge-uyari-content">
                        <div class="belge-uyari-title">${adSoyad}</div>
                        <div class="belge-uyari-detail">
                            <strong>${mesaj}</strong> · ${Helpers.paraFormat(beklenenBorc)} TL
                        </div>
                    </div>
                    <button class="btn btn-small btn-success odeme-al-btn" data-sporcu-id="${h.sporcu.id}">
                        <i class="fa-solid fa-credit-card"></i> Ödeme Al
                    </button>
                </div>
            `;
    })
    .join('');
}

/**
 * Hızlı erişim butonlarını oluştur
 */
function hizliErisimOlustur(): void {
  const container = Helpers.$('#quickActions');
  if (!container) return;

  interface Buton {
    text: string;
    icon: string;
    class: string;
    action: () => void;
  }

  const butonlar: Buton[] = [
    {
      text: 'Yeni Sporcu',
      icon: 'fa-user-plus',
      class: '',
      action: () => {
        if (window.App) window.App.viewGoster('sporcu-kayit');
      },
    },
    {
      text: 'Aidat Ödeme',
      icon: 'fa-credit-card',
      class: 'btn-success',
      action: () => {
        if (window.App) {
          window.App.viewGoster('aidat');
          setTimeout(() => {
            if (window.Aidat) window.Aidat.odemeModalAc?.();
          }, 100);
        }
      },
    },
    {
      text: 'Yoklama Al',
      icon: 'fa-clipboard-check',
      class: 'btn-warning',
      action: () => {
        if (window.App) window.App.viewGoster('yoklama');
      },
    },
    {
      text: 'Gider Ekle',
      icon: 'fa-money-bill-wave',
      class: 'btn-danger',
      action: () => {
        if (window.App) window.App.viewGoster('giderler');
      },
    },
    {
      text: 'Rapor Görüntüle',
      icon: 'fa-chart-bar',
      class: '',
      action: () => {
        if (window.App) window.App.viewGoster('raporlar');
      },
    },
  ];

  container.innerHTML = '';

  butonlar.forEach(btn => {
    // HTML içerik kullan (icon'lar için güvenli)
    const button = Helpers.createElement(
      'button',
      {
        className: `btn ${btn.class}`,
        onClick: btn.action,
      },
      `<i class="fa-solid ${btn.icon}"></i> ${btn.text}`,
      true
    );

    container.appendChild(button);
  });
}

/**
 * Net kar hesapla
 * @returns Net kar
 */
export function netKarHesapla(): number {
  const aidatlar = Storage.aidatlariGetir();
  const giderler = Storage.giderleriGetir();

  // Toplam Gelir - YENİ MANTIK: Sadece negatif tutarları topla (tahsilatlar)
  const toplamGelir = aidatlar
    .filter(a => (a.tutar || 0) < 0 || a.islem_turu === 'Tahsilat')
    .reduce((t, a) => t + Math.abs(a.tutar || 0), 0); // Mutlak değer al
  const toplamGider = giderler.reduce((t, g) => t + (g.miktar || 0), 0);

  return toplamGelir - toplamGider;
}

/**
 * Dönem bazlı finansal özet
 * @param ay - Ay
 * @param yil - Yıl
 * @returns Özet
 */
export function donemOzeti(ay: number, yil: number): DonemOzeti {
  const sporcular = Storage.sporculariGetir();
  const aidatlar = Storage.aidatlariGetir();
  const giderler = Storage.giderleriGetir();

  // Bu dönemin aidatları (dönem bazlı)
  const donemAidatlar = aidatlar.filter(a => {
    // Önce dönem bazlı kontrol et
    if (a.donemAy && a.donemYil) {
      return a.donemAy === ay && a.donemYil === yil;
    }
    // Dönem yoksa ödeme tarihine bak (eski kayıtlar için)
    if (a.tarih) {
      const parcalar = tarihParcala(a.tarih);
      return parcalar.ay === ay && parcalar.yil === yil;
    }
    return false;
  });

  // Bu dönemin giderleri
  const donemGiderler = giderler.filter(g => {
    if (g.tarih) {
      const parcalar = tarihParcala(g.tarih);
      return parcalar.ay === ay && parcalar.yil === yil;
    }
    return false;
  });

  // Beklenen ciro
  const beklenenCiro = sporcular
    .filter(s => s.durum === 'Aktif' && !s.odemeBilgileri?.burslu)
    .reduce((t, s) => t + (s.odemeBilgileri?.aylikUcret || 0), 0);

  // Tahsil edilen - YENİ MANTIK: Sadece negatif tutarları topla (tahsilatlar)
  const tahsilEdilen = donemAidatlar
    .filter(a => (a.tutar || 0) < 0 || a.islem_turu === 'Tahsilat')
    .reduce((t, a) => t + Math.abs(a.tutar || 0), 0); // Mutlak değer al

  // Toplam gider
  const toplamGider = donemGiderler.reduce((t, g) => t + (g.miktar || 0), 0);

  return {
    beklenenCiro,
    tahsilEdilen,
    kalanBorc: beklenenCiro - tahsilEdilen,
    tahsilatOrani: Math.min(100, Helpers.yuzdeHesapla(tahsilEdilen, beklenenCiro)),
    toplamGider,
    netKar: tahsilEdilen - toplamGider,
  };
}

// ========== GRAFİK FONKSİYONLARI ==========

/**
 * Grafikleri oluştur
 */
export function grafikleriOlustur(): void {
  if (typeof Chart === 'undefined') {
    console.warn('Chart.js yüklenmedi');
    return;
  }

  // Chart.js global ayarları - Profesyonel görünüm
  Chart.defaults.color = '#718096';
  Chart.defaults.borderColor = 'rgba(160, 174, 192, 0.15)';
  Chart.defaults.font.family = "'Inter', 'Segoe UI', system-ui, sans-serif";
  (Chart.defaults.font as any).size = 12;
  (Chart.defaults.plugins.tooltip as any).backgroundColor = 'rgba(26, 32, 44, 0.95)';
  (Chart.defaults.plugins.tooltip as any).titleColor = '#fff';
  (Chart.defaults.plugins.tooltip as any).bodyColor = '#e2e8f0';
  (Chart.defaults.plugins.tooltip as any).borderColor = 'rgba(255,255,255,0.1)';
  (Chart.defaults.plugins.tooltip as any).borderWidth = 1;
  (Chart.defaults.plugins.tooltip as any).cornerRadius = 8;
  (Chart.defaults.plugins.tooltip as any).padding = 12;
  (Chart.defaults.animation as any).duration = 750;
  (Chart.defaults.animation as any).easing = 'easeOutQuart';

  tahsilatGrafigi();
  bransGrafigi();
  trendGrafigi();
  yasGrubuGrafigi();
}

/**
 * Grafikleri güncelle
 */
export function grafikleriGuncelle(): void {
  if (typeof Chart === 'undefined') return;

  tahsilatGrafigi();
  bransGrafigi();
  trendGrafigi();
  yasGrubuGrafigi();
}

/**
 * Chart instance'ını güvenli şekilde temizle (bellek sızıntısı önleme)
 * @param chartInstance - Chart instance
 */
function chartTemizle(chartInstance: ChartType | null): void {
  if (!chartInstance) return;

  try {
    // Chart'ı destroy et
    chartInstance.destroy();
  } catch (error) {
    console.warn('Chart temizleme hatası:', error);
  }
}

/**
 * Tüm chart'ları temizle (view değiştiğinde çağrılmalı)
 */
export function tumChartlariTemizle(): void {
  Object.keys(charts).forEach(key => {
    const chartKey = key as keyof Charts;
    chartTemizle(charts[chartKey]);
    charts[chartKey] = null;
  });
}

/**
 * Gradient oluştur
 */
function gradientOlustur(
  ctx: CanvasRenderingContext2D,
  color1: string,
  color2: string,
  height = 250
): CanvasGradient {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, color1);
  gradient.addColorStop(1, color2);
  return gradient;
}

/**
 * Aylık Tahsilat Grafiği (Bar Chart)
 */
function tahsilatGrafigi(): void {
  const canvas = document.getElementById('tahsilatChart') as HTMLCanvasElement | null;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const aidatlar = Storage.aidatlariGetir();
  const bugun = new Date();
  const labels: string[] = [];
  const veriler: number[] = [];

  for (let i = 5; i >= 0; i--) {
    const tarih = new Date(bugun.getFullYear(), bugun.getMonth() - i, 1);
    const ay = tarih.getMonth() + 1;
    const yil = tarih.getFullYear();

    labels.push(Helpers.ayAdi(ay).substring(0, 3) + ' ' + String(yil).slice(-2));

    // Bu ay için tahsilatlar (sadece negatif tutarlar veya islem_turu='Tahsilat')
    const aylikTahsilat = aidatlar
      .filter(a => {
        if (a.donemAy && a.donemYil) {
          return a.donemAy === ay && a.donemYil === yil;
        }
        if (a.tarih) {
          const p = tarihParcala(a.tarih);
          return p.ay === ay && p.yil === yil;
        }
        return false;
      })
      .filter(a => (a.tutar || 0) < 0 || a.islem_turu === 'Tahsilat') // Sadece tahsilatları al
      .reduce((t, a) => t + Math.abs(a.tutar || 0), 0); // Mutlak değer al (pozitif yap)

    veriler.push(aylikTahsilat);
  }

  chartTemizle(charts.tahsilat);

  // Gradient
  const gradient = gradientOlustur(ctx, 'rgba(56, 161, 105, 0.8)', 'rgba(56, 161, 105, 0.2)');

  charts.tahsilat = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Tahsilat',
          data: veriler,
          backgroundColor: gradient,
          borderColor: chartColors.success,
          borderWidth: 2,
          borderRadius: 8,
          borderSkipped: false,
          hoverBackgroundColor: chartColors.success,
          hoverBorderWidth: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context: any) => ' ' + Helpers.paraFormat(context.raw) + ' ₺',
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { weight: 'bold' } },
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(160, 174, 192, 0.1)' },
          ticks: {
            callback: (v: any) => Helpers.paraFormat(v) + ' ₺',
            font: { size: 11 },
          },
        },
      },
    },
  });
}

/**
 * Branş Dağılımı Grafiği (Doughnut Chart)
 */
function bransGrafigi(): void {
  const canvas = document.getElementById('bransChart') as HTMLCanvasElement | null;
  if (!canvas) return;

  const sporcular = Storage.sporculariGetir().filter(s => s.durum === 'Aktif');
  const branslar: Record<string, number> = {};

  sporcular.forEach(s => {
    const brans = s.sporBilgileri?.brans || 'Belirsiz';
    branslar[brans] = (branslar[brans] || 0) + 1;
  });

  const labels = Object.keys(branslar);
  const veriler = Object.values(branslar);
  const toplam = veriler.reduce((a, b) => a + b, 0);

  // Profesyonel renk paleti
  const renkler = [
    '#4299e1',
    '#48bb78',
    '#ed8936',
    '#ed64a6',
    '#9f7aea',
    '#38b2ac',
    '#f56565',
    '#ecc94b',
  ];

  if (charts.brans) {
    charts.brans.destroy();
  }

  charts.brans = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [
        {
          data: veriler,
          backgroundColor: renkler.slice(0, labels.length),
          borderColor: '#1a202c',
          borderWidth: 3,
          hoverBorderColor: '#fff',
          hoverBorderWidth: 4,
          hoverOffset: 8,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 1.2,
      layout: {
        padding: 10,
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 15,
            usePointStyle: true,
            pointStyle: 'circle',
            font: { size: 12, weight: 'bold' },
          },
        },
        tooltip: {
          callbacks: {
            label: (context: any) => {
              const yuzde = ((context.raw / toplam) * 100).toFixed(1);
              return ` ${context.label}: ${context.raw} sporcu (${yuzde}%)`;
            },
          },
        },
      },
      cutout: '65%',
      animation: {
        animateRotate: true,
        animateScale: true,
      },
    },
  });
}

/**
 * Gelir-Gider Trend Grafiği (Line Chart)
 */
function trendGrafigi(): void {
  const canvas = document.getElementById('trendChart') as HTMLCanvasElement | null;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const aidatlar = Storage.aidatlariGetir();
  const giderler = Storage.giderleriGetir();
  const bugun = new Date();
  const labels: string[] = [];
  const gelirVerileri: number[] = [];
  const giderVerileri: number[] = [];

  for (let i = 5; i >= 0; i--) {
    const tarih = new Date(bugun.getFullYear(), bugun.getMonth() - i, 1);
    const ay = tarih.getMonth() + 1;
    const yil = tarih.getFullYear();

    labels.push(Helpers.ayAdi(ay).substring(0, 3));

    // Bu ay için gelir (sadece tahsilatlar - negatif tutarlar veya islem_turu='Tahsilat')
    const aylikGelir = aidatlar
      .filter(a => {
        if (a.donemAy && a.donemYil) {
          return a.donemAy === ay && a.donemYil === yil;
        }
        if (a.tarih) {
          const p = tarihParcala(a.tarih);
          return p.ay === ay && p.yil === yil;
        }
        return false;
      })
      .filter(a => (a.tutar || 0) < 0 || a.islem_turu === 'Tahsilat') // Sadece tahsilatları al
      .reduce((t, a) => t + Math.abs(a.tutar || 0), 0); // Mutlak değer al (pozitif yap)

    const aylikGider = giderler
      .filter(g => {
        if (g.tarih) {
          const p = tarihParcala(g.tarih);
          return p.ay === ay && p.yil === yil;
        }
        return false;
      })
      .reduce((t, g) => t + (g.miktar || 0), 0);

    gelirVerileri.push(aylikGelir);
    giderVerileri.push(aylikGider);
  }

  chartTemizle(charts.trend);

  // Gradient'lar
  const gelirGradient = gradientOlustur(ctx, 'rgba(72, 187, 120, 0.4)', 'rgba(72, 187, 120, 0.02)');
  const giderGradient = gradientOlustur(
    ctx,
    'rgba(245, 101, 101, 0.4)',
    'rgba(245, 101, 101, 0.02)'
  );

  charts.trend = new Chart(canvas, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Gelir',
          data: gelirVerileri,
          borderColor: '#48bb78',
          backgroundColor: gelirGradient,
          fill: true,
          tension: 0.4,
          borderWidth: 3,
          pointRadius: 5,
          pointBackgroundColor: '#48bb78',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointHoverRadius: 8,
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: '#48bb78',
          pointHoverBorderWidth: 3,
        },
        {
          label: 'Gider',
          data: giderVerileri,
          borderColor: '#f56565',
          backgroundColor: giderGradient,
          fill: true,
          tension: 0.4,
          borderWidth: 3,
          pointRadius: 5,
          pointBackgroundColor: '#f56565',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointHoverRadius: 8,
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: '#f56565',
          pointHoverBorderWidth: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: {
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 20,
            font: { size: 12, weight: 'bold' },
          },
        },
        tooltip: {
          callbacks: {
            label: (context: any) =>
              ` ${context.dataset.label}: ${Helpers.paraFormat(context.raw)} ₺`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { weight: 'bold' } },
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(160, 174, 192, 0.1)' },
          ticks: {
            callback: (v: any) => Helpers.paraFormat(v) + ' ₺',
            font: { size: 11 },
          },
        },
      },
      interaction: {
        intersect: false,
        mode: 'index',
      },
    },
  });
}

/**
 * Yaş Grubu Dağılımı Grafiği (Pie Chart - daha simetrik)
 */
function yasGrubuGrafigi(): void {
  const canvas = document.getElementById('yasGrubuChart') as HTMLCanvasElement | null;
  if (!canvas) return;

  const sporcular = Storage.sporculariGetir().filter(s => s.durum === 'Aktif');
  const gruplar: Record<string, number> = {};

  sporcular.forEach(s => {
    const grup = s.tffGruplari?.anaGrup || 'Belirsiz';
    gruplar[grup] = (gruplar[grup] || 0) + 1;
  });

  // Sırala (U7, U8, U9...)
  const siraliGruplar = Object.entries(gruplar).sort((a, b) => {
    const numA = parseInt(a[0].replace(/\D/g, '')) || 99;
    const numB = parseInt(b[0].replace(/\D/g, '')) || 99;
    return numA - numB;
  });

  const labels = siraliGruplar.map(g => g[0]);
  const veriler = siraliGruplar.map(g => g[1]);
  const toplam = veriler.reduce((a, b) => a + b, 0);

  // Profesyonel renk paleti
  const renkler = [
    '#667eea',
    '#00bcd4',
    '#38b2ac',
    '#48bb78',
    '#ecc94b',
    '#ed8936',
    '#f56565',
    '#ed64a6',
    '#9f7aea',
  ];

  if (charts.yasGrubu) {
    charts.yasGrubu.destroy();
  }

  charts.yasGrubu = new Chart(canvas, {
    type: 'pie',
    data: {
      labels: labels,
      datasets: [
        {
          data: veriler,
          backgroundColor: renkler.slice(0, labels.length),
          borderColor: '#1a202c',
          borderWidth: 3,
          hoverBorderColor: '#fff',
          hoverBorderWidth: 4,
          hoverOffset: 12,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 1.2,
      layout: {
        padding: 10,
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 12,
            usePointStyle: true,
            pointStyle: 'circle',
            font: { size: 11, weight: 'bold' },
          },
        },
        tooltip: {
          callbacks: {
            label: (context: any) => {
              const yuzde = ((context.raw / toplam) * 100).toFixed(1);
              return ` ${context.label}: ${context.raw} sporcu (${yuzde}%)`;
            },
          },
        },
      },
      animation: {
        animateRotate: true,
        animateScale: true,
      },
    },
  });
}

/**
 * Malzeme eventlerini bağla
 */
function malzemeEventleri(): void {
  // Malzeme ekle butonu - sadece dashboard sayfasında çalışmalı
  const dashboardView = Helpers.$('#dashboard');

  if (dashboardView) {
    // Dashboard'daki malzeme ekle butonu
    dashboardView.addEventListener('click', e => {
      const target = e.target as HTMLElement;
      const btn = target.closest('#malzemeEkleBtn') as HTMLElement | null;

      if (btn && dashboardView.classList.contains('active')) {
        e.preventDefault();
        e.stopPropagation();
        malzemeModalAc();
      }
    });
  }

  // NOT: Modal eventleri (kapat, kaydet, iptal) app.ts'de merkezi olarak tanımlı
  // Çakışmayı önlemek için burada eklemiyoruz
}

/**
 * Malzeme modal'ını aç (dashboard için)
 */
function malzemeModalAc(): void {
  const modal = Helpers.$('#malzemeEkleModal');
  if (!modal) return;

  // Context bilgisi ekle (dashboard'dan açıldığını belirt)
  modal.setAttribute('data-modal-context', 'dashboard');

  // Sporcu seçimini göster (dashboard için)
  const malzemeSporcuSelect = Helpers.$('#malzemeSporcuSelect') as HTMLSelectElement | null;
  if (malzemeSporcuSelect) {
    (malzemeSporcuSelect as HTMLElement).style.display = '';
    const label = document.querySelector('label[for="malzemeSporcuSelect"]');
    if (label) (label as HTMLElement).style.display = '';
    // Sporcu seçimi zorunlu yap
    malzemeSporcuSelect.required = true;
  }

  // Sporcu seçim listesini doldur
  malzemeSporcuListesiniDoldur();

  // Modal'ı aç
  (modal as HTMLElement).style.display = 'flex';
  (modal as HTMLElement).setAttribute('style', 'display: flex !important;');

  // Form alanlarını temizle
  const malzemeAd = Helpers.$('#malzemeAd') as HTMLInputElement | null;
  const malzemeTutar = Helpers.$('#malzemeTutar') as HTMLInputElement | null;

  if (malzemeAd) malzemeAd.value = '';
  if (malzemeTutar) malzemeTutar.value = '';
  if (malzemeSporcuSelect) malzemeSporcuSelect.value = '';

  // İlk input'a focus
  if (malzemeSporcuSelect) {
    malzemeSporcuSelect.focus();
  } else if (malzemeAd) {
    malzemeAd.focus();
  }
}

/**
 * Malzeme modal'ı için sporcu listesini doldur
 */
function malzemeSporcuListesiniDoldur(): void {
  const malzemeSporcuSelect = Helpers.$('#malzemeSporcuSelect') as HTMLSelectElement | null;

  if (!malzemeSporcuSelect) {
    console.warn('malzemeSporcuSelect bulunamadı');
    return;
  }

  // Aktif sporcuları al
  const sporcular = Storage.sporculariGetir().filter(s => s.durum === 'Aktif');

  // Sporcu listesini doldur
  malzemeSporcuSelect.innerHTML = '<option value="">Sporcu Seçin</option>';

  sporcular.forEach(sporcu => {
    const option = Helpers.createElement('option', {
      value: sporcu.id?.toString() || '',
    });
    option.textContent = sporcu.temelBilgiler?.adSoyad || 'Bilinmeyen Sporcu';
    malzemeSporcuSelect.appendChild(option);
  });
}

/**
 * Malzeme modal'ını kapat (dashboard için)
 */
function malzemeModalKapatF(): void {
  const modal = Helpers.$('#malzemeEkleModal');
  if (modal) {
    (modal as HTMLElement).style.display = 'none';
  }

  // Sporcu seçimini tekrar göster (dashboard için)
  const malzemeSporcuSelect = Helpers.$('#malzemeSporcuSelect');
  if (malzemeSporcuSelect) {
    (malzemeSporcuSelect as HTMLElement).style.display = '';
    const label = document.querySelector('label[for="malzemeSporcuSelect"]');
    if (label) (label as HTMLElement).style.display = '';
  }
}

/**
 * Malzeme kaydet
 */
function malzemeKaydet(): void {
  const malzemeAd = Helpers.$('#malzemeAd') as HTMLInputElement | null;
  const malzemeTutar = Helpers.$('#malzemeTutar') as HTMLInputElement | null;
  const malzemeSporcuSelect = Helpers.$('#malzemeSporcuSelect') as HTMLSelectElement | null;

  if (!malzemeAd || !malzemeTutar) {
    Helpers.toast('Form alanları bulunamadı!', 'error');
    return;
  }

  const ad = malzemeAd.value.trim();
  const tutarStr = malzemeTutar.value.trim();
  const sporcuId = malzemeSporcuSelect ? parseInt(malzemeSporcuSelect.value, 10) : null;

  // Validasyon
  if (!ad) {
    Helpers.toast('Lütfen malzeme adı girin!', 'error');
    malzemeAd.focus();
    return;
  }

  if (!tutarStr) {
    Helpers.toast('Lütfen tutar girin!', 'error');
    malzemeTutar.focus();
    return;
  }

  const tutar = Helpers.paraCoz(tutarStr);
  if (!tutar || tutar <= 0) {
    Helpers.toast('Geçerli bir tutar girin!', 'error');
    malzemeTutar.focus();
    return;
  }

  if (!sporcuId || isNaN(sporcuId)) {
    Helpers.toast('Lütfen sporcu seçin!', 'error');
    if (malzemeSporcuSelect) malzemeSporcuSelect.focus();
    return;
  }

  // Sporcu bilgisini al
  const sporcu = Storage.sporcuBul(sporcuId);
  if (!sporcu) {
    Helpers.toast('Sporcu bulunamadı!', 'error');
    return;
  }

  // Bugünün tarihi
  const bugun = new Date();
  const donemAy = bugun.getMonth() + 1;
  const donemYil = bugun.getFullYear();

  // Malzeme borcu ekle
  const malzemeBorcu: Partial<import('../types').Aidat> = {
    sporcuId: sporcuId,
    tutar: tutar, // POZİTİF tutar (borç)
    tarih: Helpers.bugunISO(),
    donemAy: donemAy,
    donemYil: donemYil,
    aciklama: ad,
    tip: 'ekucret',
    islem_turu: 'Malzeme',
    odemeDurumu: 'Ödenmedi',
    kayitTarihi: Helpers.bugunISO(),
  };

  Storage.aidatKaydet(malzemeBorcu);
  Helpers.toast(
    `${ad} borcu (${Helpers.paraFormat(tutar)} TL) ${sporcu.temelBilgiler?.adSoyad || 'sporcu'} için eklendi.`,
    'success'
  );

  // Modal'ı kapat
  malzemeModalKapatF();

  // Listeyi güncelle
  malzemeListesiniGuncelle();

  // Dashboard'u güncelle
  finansalIstatistikler();

  // Aidat modülünü güncelle (eğer yüklüyse)
  if (window.Aidat && typeof window.Aidat.listeyiGuncelle === 'function') {
    window.Aidat.listeyiGuncelle();
  }

  // Rapor modülünü güncelle (eğer yüklüyse)
  if (window.Rapor && typeof window.Rapor.guncelle === 'function') {
    window.Rapor.guncelle();
  }
}

/**
 * Malzeme listesini güncelle
 */
function malzemeListesiniGuncelle(): void {
  const listeContainer = Helpers.$('#malzemelerListesi');
  const ozetMalzemeler = Helpers.$('#ozetMalzemeler');

  if (!listeContainer) return;

  const aidatlar = Storage.aidatlariGetir();

  // Malzeme borçlarını filtrele (pozitif tutarlı ve islem_turu='Malzeme')
  const malzemeBorclari = aidatlar.filter(a => (a.tutar || 0) > 0 && a.islem_turu === 'Malzeme');

  // Toplam malzeme borcu
  const toplamMalzemeBorcu = malzemeBorclari.reduce((t, a) => t + (a.tutar || 0), 0);

  // Özet güncelle
  if (ozetMalzemeler) {
    ozetMalzemeler.textContent = Helpers.paraFormat(toplamMalzemeBorcu) + ' TL';
  }

  // Liste güncelle
  if (malzemeBorclari.length === 0) {
    listeContainer.innerHTML = `
      <div class="empty-state-malzeme">
        <div class="empty-state-icon">
          <i class="fa-solid fa-box-open"></i>
        </div>
        <h4>Henüz malzeme eklenmedi</h4>
        <p>Malzeme eklemek için "Ekle" butonuna tıklayın</p>
      </div>
    `;
    return;
  }

  // Malzemeleri göster
  // Son eklenenler önce (tarihe göre sırala)
  const siraliMalzemeler = [...malzemeBorclari].sort((a, b) => {
    const tarihA = a.tarih ? new Date(a.tarih).getTime() : 0;
    const tarihB = b.tarih ? new Date(b.tarih).getTime() : 0;
    return tarihB - tarihA;
  });

  // İlk 5 malzemeyi göster (veya tümünü)
  const gosterilecekMalzemeler = siraliMalzemeler.slice(0, 10);

  listeContainer.innerHTML = gosterilecekMalzemeler
    .map(a => {
      const aciklama = Helpers.escapeHtml(a.aciklama || a.sporcuAd || 'Malzeme');
      const tutar = Helpers.paraFormat(a.tutar || 0);
      const tarih = a.tarih ? Helpers.tarihFormat(a.tarih) : '-';

      return `
        <div class="malzeme-item">
          <div class="malzeme-item-icon">
            <i class="fa-solid fa-box"></i>
          </div>
          <div class="malzeme-item-content">
            <div class="malzeme-item-name">${aciklama}</div>
            <div class="malzeme-item-amount">${tutar} TL</div>
          </div>
        </div>
      `;
    })
    .join('');

  // Eğer daha fazla malzeme varsa göster
  if (siraliMalzemeler.length > 10) {
    const dahaFazlaBtn = Helpers.createElement(
      'div',
      { className: 'text-center', style: 'margin-top: 1rem;' },
      `<button class="btn btn-small" onclick="window.App?.viewGoster('aidat')">
        Tümünü Gör (${siraliMalzemeler.length})
      </button>`,
      true
    );
    listeContainer.appendChild(dahaFazlaBtn);
  }
}

// Temporary global access for backward compatibility
// This will be removed once app.ts is migrated
if (typeof window !== 'undefined') {
  (window as any).Dashboard = {
    init,
    guncelle,
    temelIstatistikler,
    finansalIstatistikler,
    netKarHesapla,
    donemOzeti,
    grafikleriGuncelle,
    grafikleriOlustur,
    tumChartlariTemizle,
    malzemeModalKapatF,
    malzemeKaydet,
  };
}
