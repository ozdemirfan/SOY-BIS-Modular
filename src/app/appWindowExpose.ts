import * as Helpers from '../utils/helpers';
import * as Storage from '../utils/storage';
import * as Auth from '../utils/auth';
import * as Dashboard from '../modules/dashboard';
import * as Sporcu from '../modules/sporcu';
import * as Aidat from '../modules/aidat';
import * as Yoklama from '../modules/yoklama';
import * as Gider from '../modules/gider';
import * as Antrenor from '../modules/antrenor';
import * as Rapor from '../modules/rapor';
import * as Ayarlar from '../modules/ayarlar';
import * as KullaniciYonetimi from '../modules/kullanici-yonetimi';
import * as Notification from '../modules/notification';
import { temaDegistir, temaYonetiminiBaslat } from './appTheme';

/**
 * Modülleri ve yardımcıları window'a bağlar (HTML / eski kod uyumu).
 * `app` dışarıdan verilir — app.ts ile döngüsel import oluşmaz.
 */
export function attachModulesToWindow(app: object): void {
  if (typeof window === 'undefined') {
    return;
  }

  const w = window as unknown as Record<string, unknown>;

  w.Storage = Storage;
  w.Auth = Auth;
  w.Helpers = Helpers;

  w.temaDegistir = temaDegistir;
  w.temaYonetiminiBaslat = temaYonetiminiBaslat;
  w.Dashboard = Dashboard;

  const existingSporcu = w.Sporcu as Record<string, unknown> | undefined;
  w.Sporcu = {
    ...Sporcu,
    ...(existingSporcu?.kaydet && { kaydet: existingSporcu.kaydet }),
    ...(existingSporcu?.raporGoster && { raporGoster: existingSporcu.raporGoster }),
    ...(existingSporcu?.sporcuMalzemeEkleModalKapat && {
      sporcuMalzemeEkleModalKapat: existingSporcu.sporcuMalzemeEkleModalKapat,
    }),
    ...(existingSporcu?.sporcuMalzemeKaydet && {
      sporcuMalzemeKaydet: existingSporcu.sporcuMalzemeKaydet,
    }),
  };

  w.Aidat = {
    init: Aidat.init,
    listeyiGuncelle: Aidat.listeyiGuncelle,
    hizliFiltrele: Aidat.hizliFiltrele,
    filtreSifirla: Aidat.filtreSifirla,
    odemeModalAc: Aidat.odemeModalAc,
    gecmisModalAc: Aidat.gecmisModalAc,
    donemRaporu: Aidat.donemRaporu,
    takvimiOlustur: Aidat.takvimiOlustur,
    aylikOzetOlustur: Aidat.aylikOzetOlustur,
    monthlyListToggle: Aidat.monthlyListToggle,
    monthlyTabSwitch: Aidat.monthlyTabSwitch,
    monthlySearchFilter: Aidat.monthlySearchFilter,
    monthlyDebtFilter: Aidat.monthlyDebtFilter,
    monthlyPaidFilter: Aidat.monthlyPaidFilter,
    gunSecildi: Aidat.gunSecildi,
    smsGonderTekil: Aidat.smsGonderTekil,
    topluSmsGonder: Aidat.topluSmsGonder,
    gunDetaylariKapat: Aidat.gunDetaylariKapat,
  };

  w.Yoklama = Yoklama;
  w.Gider = Gider;
  w.Antrenor = Antrenor;
  w.Rapor = Rapor;
  w.Ayarlar = Ayarlar;
  w.KullaniciYonetimi = KullaniciYonetimi;
  w.Notification = Notification;
  w.App = app;
}
