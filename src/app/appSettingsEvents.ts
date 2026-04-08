import * as Helpers from '../utils/helpers';
import * as Storage from '../utils/storage';
import * as Auth from '../utils/auth';

/**
 * Ayarlar eventlerini bağla
 */
export function ayarlarEventleri(): void {
  const yedekleBtn = Helpers.$('#yedekleBtn');
  if (yedekleBtn) {
    yedekleBtn.addEventListener('click', function () {
      Storage.yedekIndir();
    });
  }

  const geriYukleBtn = Helpers.$('#geriYukleBtn');
  const yedekDosya = Helpers.$('#yedekDosya') as HTMLInputElement | null;

  if (geriYukleBtn && yedekDosya) {
    geriYukleBtn.addEventListener('click', function () {
      yedekDosya.click();
    });

    yedekDosya.addEventListener('change', async function (e: Event) {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) return;

      try {
        const yedek = await Storage.dosyadanYukle(file);

        if (
          Helpers.onay(
            'Mevcut veriler yedekteki verilerle değiştirilecek. Devam etmek istiyor musunuz?'
          )
        ) {
          if (Storage.yedekYukle(yedek)) {
            location.reload();
          }
        }
      } catch (error: any) {
        Helpers.toast(error.message || 'Yedek yükleme hatası', 'error');
      }

      target.value = '';
    });
  }

  const sifirlaBtn = Helpers.$('#sistemiSifirlaBtn');
  if (sifirlaBtn) {
    sifirlaBtn.addEventListener('click', async function () {
      if (
        !Helpers.onay(
          '⚠️ DİKKAT!\n\nTüm veriler kalıcı olarak silinecek. Bu işlem geri alınamaz!\n\nDevam etmek istiyor musunuz?'
        )
      ) {
        return;
      }

      const kullaniciAdi = Helpers.girdi(
        '⚠️ SİSTEM SIFIRLAMA\n\nYönetici kullanıcı adınızı girin:\n(Varsayılan: admin)',
        'admin'
      );
      if (kullaniciAdi === null || !kullaniciAdi.trim()) {
        Helpers.toast('İşlem iptal edildi!', 'warning');
        return;
      }

      if (kullaniciAdi.trim().toLowerCase() !== 'admin') {
        if (
          !Helpers.onay(
            `⚠️ UYARI!\n\nGirdiğiniz kullanıcı adı "${kullaniciAdi}" değil, "admin" olmalı!\n\nDevam etmek istiyor musunuz?`
          )
        ) {
          return;
        }
      }

      const sifre = Helpers.girdi('⚠️ SİSTEM SIFIRLAMA\n\nYönetici şifrenizi girin:');
      if (sifre === null || !sifre.trim()) {
        Helpers.toast('Şifre girilmedi! İşlem iptal edildi.', 'warning');
        return;
      }

      const basarili = await Storage.sistemSifirla(kullaniciAdi.trim(), sifre.trim());
      if (basarili) {
        setTimeout(() => location.reload(), 1000);
      }
    });
  }

  const logoutBtn = Helpers.$('#logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function () {
      if (Helpers.onay('Çıkış yapmak istediğinize emin misiniz?')) {
        Auth.cikisYap();
      }
    });
  }
}
