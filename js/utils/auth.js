/**
 * SOY-BIS - Kimlik Doğrulama ve Yetkilendirme Modülü (auth.js)
 * Giriş, çıkış, oturum yönetimi ve rol bazlı yetkilendirme
 */

const Auth = (function() {
    'use strict';

    // Oturum anahtarları
    const SESSION_KEY = 'soybis_oturum';
    const CURRENT_USER_KEY = 'soybis_aktifKullanici';

    /**
     * Giriş yap
     * GÜVENLİK: Oturum sadece sessionStorage'da tutulur, localStorage kullanılmaz
     * @param {string} kullaniciAdi - Kullanıcı adı
     * @param {string} sifre - Şifre
     * @returns {Promise<Object|null>} Kullanıcı objesi veya null
     */
    async function girisYap(kullaniciAdi, sifre) {
        if (!kullaniciAdi || !sifre) {
            return null;
        }

        try {
            const kullanici = await Storage.kullaniciSifreDogrula(kullaniciAdi, sifre);
            
            if (!kullanici) {
                return null;
            }

            // Aktif kontrolü
            if (!kullanici.aktif) {
                throw new Error('Kullanıcı hesabı pasif durumda!');
            }

            // Oturum bilgilerini kaydet (şifre hash'i hariç)
            // GÜVENLİK: Sadece sessionStorage kullan - tarayıcı kapatıldığında oturum sonlanır
            const oturumBilgisi = {
                id: kullanici.id,
                kullaniciAdi: kullanici.kullaniciAdi,
                rol: kullanici.rol,
                adSoyad: kullanici.adSoyad || kullanici.kullaniciAdi,
                email: kullanici.email || '',
                girisTarihi: new Date().toISOString()
            };

            sessionStorage.setItem(SESSION_KEY, JSON.stringify(oturumBilgisi));
            // GÜVENLİK: localStorage'a oturum bilgisi KAYDETME - bypass açığını önler
            // localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(oturumBilgisi)); // KALDIRILDI

            return oturumBilgisi;
        } catch (error) {
            console.error('Giriş hatası:', error);
            return null;
        }
    }

    /**
     * Çıkış yap
     */
    function cikisYap() {
        sessionStorage.removeItem(SESSION_KEY);
        localStorage.removeItem(CURRENT_USER_KEY);
        localStorage.removeItem('soybis_aktifView'); // Aktif view'u da temizle
        location.reload();
    }

    /**
     * Oturum kontrolü - Giriş yapılmış mı?
     * GÜVENLİK: Sadece sessionStorage kullanılır, localStorage'dan oturum okunmaz
     * @returns {Object|null} Kullanıcı bilgisi veya null
     */
    function oturumKontrol() {
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

            const oturumVerisi = JSON.parse(oturum);
            
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
     * @param {Object} oturumVerisi - Kontrol edilecek oturum verisi
     * @returns {boolean} Geçerli mi?
     */
    function oturumDogrula(oturumVerisi) {
        // Temel veri kontrolü
        if (!oturumVerisi || !oturumVerisi.id || !oturumVerisi.kullaniciAdi) {
            return false;
        }

        // Storage modülü yüklü değilse, temel kontrolü geç (başlangıç aşaması)
        if (!window.Storage || typeof Storage.kullanicilariGetir !== 'function') {
            return true;
        }

        try {
            // Kullanıcının veritabanında var olup olmadığını kontrol et
            const kullanicilar = Storage.kullanicilariGetir();
            const mevcutKullanici = kullanicilar.find(k => 
                k.id === oturumVerisi.id && 
                k.kullaniciAdi === oturumVerisi.kullaniciAdi
            );

            // Kullanıcı bulunamadı
            if (!mevcutKullanici) {
                console.warn('Güvenlik: Oturum verisi geçersiz kullanıcıya ait');
                return false;
            }

            // Kullanıcı pasif durumda
            if (!mevcutKullanici.aktif) {
                console.warn('Güvenlik: Kullanıcı hesabı pasif durumda');
                return false;
            }

            // Rol değişikliği kontrolü (oturumdaki rol ile veritabanındaki rol eşleşmeli)
            if (oturumVerisi.rol !== mevcutKullanici.rol) {
                console.warn('Güvenlik: Kullanıcı rol değişikliği algılandı');
                return false;
            }

            return true;
        } catch (error) {
            console.error('Oturum doğrulama hatası:', error);
            return false;
        }
    }

    /**
     * Aktif kullanıcıyı getir
     * @returns {Object|null} Kullanıcı bilgisi
     */
    function aktifKullanici() {
        return oturumKontrol();
    }

    /**
     * Rol kontrolü - Kullanıcının belirtilen role sahip olup olmadığını kontrol et
     * @param {string|Array} roller - Kontrol edilecek rol(ler)
     * @returns {boolean} Yetkisi var mı?
     */
    function hasRole(roller) {
        const kullanici = oturumKontrol();
        if (!kullanici) return false;

        const kullaniciRolu = kullanici.rol;
        
        if (Array.isArray(roller)) {
            return roller.includes(kullaniciRolu);
        }
        
        return kullaniciRolu === roller;
    }

    /**
     * Yönetici kontrolü
     * @returns {boolean} Yönetici mi?
     */
    function isAdmin() {
        return hasRole('Yönetici');
    }

    /**
     * Antrenör kontrolü
     * @returns {boolean} Antrenör mü?
     */
    function isAntrenor() {
        return hasRole('Antrenör');
    }

    /**
     * Muhasebe kontrolü
     * @returns {boolean} Muhasebe mi?
     */
    function isMuhasebe() {
        return hasRole('Muhasebe');
    }

    /**
     * Yetki kontrolü - Belirli bir işlem için yetki var mı?
     * @param {string} islem - İşlem adı (örn: 'aidat_gorebilir', 'sporcu_silebilir')
     * @returns {boolean} Yetkisi var mı?
     */
    function yetkiKontrol(islem) {
        const kullanici = oturumKontrol();
        if (!kullanici) return false;

        const rol = kullanici.rol;

        // Yetki matrisi - Uluslararası RBAC normlarına göre
        const yetkiler = {
            'Yönetici': [
                // Tam erişim - Tüm işlemler
                'dashboard_gorebilir',
                'aidat_gorebilir', 'aidat_ekleyebilir', 'aidat_silebilir',
                'gider_gorebilir', 'gider_ekleyebilir', 'gider_silebilir',
                'sporcu_gorebilir', 'sporcu_ekleyebilir', 'sporcu_duzenleyebilir', 'sporcu_silebilir',
                'yoklama_gorebilir', 'yoklama_ekleyebilir',
                'antrenor_gorebilir', 'antrenor_ekleyebilir', 'antrenor_silebilir',
                'rapor_gorebilir',
                'ayarlar_gorebilir', 'kullanici_yonetebilir'
            ],
            'Antrenör': [
                // Sadece operasyonel işlemler - Finansal bilgilere erişim yok
                'sporcu_gorebilir', // Sadece kendi sporcularını görebilir (ileride filtreleme eklenecek)
                'yoklama_gorebilir', 'yoklama_ekleyebilir'
                // Dashboard YOK - Finansal bilgiler içeriyor
            ],
            'Muhasebe': [
                // Sadece finansal işlemler - Operasyonel işlemlere erişim yok
                'dashboard_gorebilir', // Finansal özet için
                'aidat_gorebilir', 'aidat_ekleyebilir',
                'gider_gorebilir', 'gider_ekleyebilir', 'gider_silebilir',
                'rapor_gorebilir'
                // Sporcu ekleme/düzenleme YOK, Yoklama YOK
            ]
        };

        return yetkiler[rol]?.includes(islem) || false;
    }

    /**
     * Giriş kontrolü - Sayfa yüklendiğinde çağrılır
     * @returns {boolean} Giriş yapılmış mı?
     */
    function kontrol() {
        return oturumKontrol() !== null;
    }

    // Public API
    return {
        girisYap,
        cikisYap,
        oturumKontrol,
        aktifKullanici,
        hasRole,
        isAdmin,
        isAntrenor,
        isMuhasebe,
        yetkiKontrol,
        kontrol
    };
})();

// Global erişim
window.Auth = Auth;
