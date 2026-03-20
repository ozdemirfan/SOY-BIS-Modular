/**
 * SOY-BIS - Veri Depolama Modülü (storage.js)
 * LocalStorage yönetimi, yedekleme ve geri yükleme
 */

const Storage = (function() {
    'use strict';

    // Depolama anahtarları
    const KEYS = {
        SPORCULAR: 'soybis_sporcular',
        AIDATLAR: 'soybis_aidatlar',
        YOKLAMALAR: 'soybis_yoklamalar',
        GIDERLER: 'soybis_giderler',
        ANTRENORLER: 'soybis_antrenorler',
        AYARLAR: 'soybis_ayarlar',
        KULLANICILAR: 'soybis_kullanicilar'
    };
    
    /**
     * Şifreyi hash'le (SHA-256)
     * @param {string} sifre - Düz metin şifre
     * @returns {Promise<string>} Hash'lenmiş şifre
     */
    async function sifreHash(sifre) {
        if (!sifre) return '';
        try {
            const encoder = new TextEncoder();
            const data = encoder.encode(sifre);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        } catch (error) {
            console.error('Şifre hash hatası:', error);
            // Fallback: Base64 encoding (daha az güvenli ama çalışır)
            return btoa(sifre);
        }
    }

    /**
     * LocalStorage'a veri kaydet
     * @param {string} key - Anahtar
     * @param {*} data - Veri
     */
    function kaydet(key, data) {
        try {
            const jsonData = JSON.stringify(data);
            localStorage.setItem(key, jsonData);
            return true;
        } catch (error) {
            console.error('Kayıt hatası:', error);
            if (error.name === 'QuotaExceededError') {
                Helpers.toast('Depolama alanı dolu! Lütfen bazı verileri silin.', 'error');
            }
            return false;
        }
    }

    /**
     * LocalStorage'dan veri oku
     * @param {string} key - Anahtar
     * @param {*} defaultValue - Varsayılan değer
     * @returns {*} Veri
     */
    function oku(key, defaultValue = null) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : defaultValue;
        } catch (error) {
            console.error('Okuma hatası:', error);
            return defaultValue;
        }
    }

    /**
     * LocalStorage'dan veri sil
     * @param {string} key - Anahtar
     */
    function sil(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error('Silme hatası:', error);
            return false;
        }
    }

    // ========== SPORCU İŞLEMLERİ ==========

    // Kayıt tarihi olmayan sporcuları normalize et
    function sporcuKayitTarihiNormalize(sporcu) {
        if (sporcu && !sporcu.kayitTarihi) {
            const adaylar = [
                sporcu?.kayitBilgileri?.kayitTarihi,
                sporcu?.createdAt,
                sporcu?.olusturulmaTarihi,
                sporcu?.eklenmeTarihi
            ];
            const bulunan = adaylar.find(Boolean);
            sporcu.kayitTarihi = bulunan || Helpers.bugunISO();
        }
        return sporcu;
    }

    function sporculariGetir() {
        const list = oku(KEYS.SPORCULAR, []);
        let degisti = false;
        const normalized = list.map(s => {
            const onceki = s?.kayitTarihi;
            const guncel = sporcuKayitTarihiNormalize({ ...s });
            if (!onceki && guncel?.kayitTarihi) degisti = true;
            return guncel;
        });
        if (degisti) kaydet(KEYS.SPORCULAR, normalized);
        return normalized;
    }

    /**
     * Sporcu kaydet
     * @param {Object} sporcu - Sporcu verisi
     * @returns {Object} Kaydedilen sporcu
     */
    function sporcuKaydet(sporcu) {
        const sporcular = sporculariGetir();
        
        if (sporcu.id) {
            // Güncelleme
            const index = sporcular.findIndex(s => s.id === sporcu.id);
            if (index > -1) {
                const merged = { ...sporcular[index], ...sporcu };
                // KRİTİK: kayitTarihi ASLA değiştirilmez - Bu tarih borç hesaplaması için kullanılır
                // Sisteme kayıt tarihi korunmalı, sadece arsivBilgileri.ilkKayitTarihi güncellenebilir
                merged.kayitTarihi = sporcular[index].kayitTarihi || Helpers.bugunISO();
                // Kayıt tarihi yoksa (eski kayıtlar için) bugünün tarihini ata ama güncelleme sırasında değiştirme
                if (!sporcular[index].kayitTarihi) {
                    merged.kayitTarihi = Helpers.bugunISO();
                }
                sporcular[index] = merged;
            }
        } else {
            // Yeni kayıt - kayitTarihi (sisteme giriş tarihi) her zaman bugünün tarihi olarak atanır
            sporcu.id = Date.now();
            sporcu.kayitTarihi = Helpers.bugunISO(); // Borç hesaplaması için sisteme giriş tarihi
            sporcu.durum = 'Aktif';
            sporcular.push(sporcu);
        }
        
        kaydet(KEYS.SPORCULAR, sporcular);
        return sporcu;
    }

    /**
     * Sporcu sil
     * @param {number} id - Sporcu ID
     */
    function sporcuSil(id) {
        const sporcular = sporculariGetir().filter(s => s.id !== id);
        kaydet(KEYS.SPORCULAR, sporcular);
        
        // İlişkili verileri de temizle
        const aidatlar = aidatlariGetir().filter(a => a.sporcuId !== id);
        kaydet(KEYS.AIDATLAR, aidatlar);
        
        // Yoklamalardaki referansları temizle
        const yoklamalar = yoklamalariGetir();
        yoklamalar.forEach(y => {
            y.sporcular = y.sporcular.filter(s => s.id !== id);
        });
        kaydet(KEYS.YOKLAMALAR, yoklamalar.filter(y => y.sporcular.length > 0));
    }

    /**
     * Sporcu bul
     * @param {number} id - Sporcu ID
     * @returns {Object|null} Sporcu
     */
    function sporcuBul(id) {
        return sporculariGetir().find(s => s.id === id) || null;
    }

    /**
     * TC ile sporcu kontrol
     * @param {string} tc - TC Kimlik No
     * @param {number} excludeId - Hariç tutulacak ID
     * @returns {boolean} Var mı?
     */
    function tcKontrol(tc, excludeId = null) {
        const sporcular = sporculariGetir();
        return sporcular.some(s => 
            s.temelBilgiler?.tcKimlik === tc && 
            (excludeId ? s.id !== excludeId : true)
        );
    }

    // ========== AİDAT İŞLEMLERİ ==========

    /**
     * Tüm aidatları getir
     * @returns {Array} Aidatlar
     */
    function aidatlariGetir() {
        return oku(KEYS.AIDATLAR, []);
    }

    /**
     * Aidat kaydet
     * @param {Object} aidat - Aidat verisi
     * @returns {Object} Kaydedilen aidat
     */
    function aidatKaydet(aidat) {
        console.log('📝 aidatKaydet çağrıldı:', {
            sporcuId: aidat.sporcuId,
            tutar: aidat.tutar,
            donemAy: aidat.donemAy,
            donemYil: aidat.donemYil,
            islem_turu: aidat.islem_turu,
            aciklama: aidat.aciklama
        });
        
        const aidatlar = aidatlariGetir();
        
        // NOT: Geçmiş aylar için borç/malzeme ekleme kontrolü artık modal seviyesinde yapılıyor
        // Burada sadece loglama yapıyoruz
        const tutar = aidat.tutar || 0;
        const isBorc = (aidat.islem_turu === 'Aidat' || aidat.islem_turu === 'Malzeme') || 
                       (!aidat.islem_turu && tutar > 0 && aidat.islem_turu !== 'Tahsilat');
        
        console.log('🔍 Aidat kayıt:', {
            isBorc: isBorc,
            islem_turu: aidat.islem_turu,
            tutar: tutar,
            sporcuId: aidat.sporcuId,
            donemAy: aidat.donemAy,
            donemYil: aidat.donemYil
        });
        
        if (aidat.sporcuId) {
            const sporcu = sporcuBul(aidat.sporcuId);
            if (sporcu) {
                console.log('✅ Sporcu bulundu:', sporcu.temelBilgiler?.adSoyad || 'Bilinmeyen');
            } else {
                console.warn('⚠️ Sporcu bulunamadı! SporcuId: ' + aidat.sporcuId);
            }
        } else {
            console.log('⏭️ Kontrol atlandı (sporcuId yok):', {
                sporcuId: aidat.sporcuId,
                isBorc: isBorc,
                sebep: !aidat.sporcuId ? 'sporcuId yok' : (!isBorc ? 'borç kaydı değil' : 'bilinmeyen')
            });
        }
        
        aidat.id = aidat.id || (Date.now() + Math.floor(Math.random() * 1000)); // ID çakışma riskini azalt
        aidat.kayitTarihi = aidat.kayitTarihi || new Date().toISOString();
        
        aidatlar.push(aidat);
        kaydet(KEYS.AIDATLAR, aidatlar);
        
        console.log('✅ Aidat kaydedildi:', {
            id: aidat.id,
            sporcuId: aidat.sporcuId,
            donemAy: aidat.donemAy,
            donemYil: aidat.donemYil
        });
        
        return aidat;
    }

    /**
     * Aidat sil
     * @param {number} id - Aidat ID
     */
    function aidatSil(id) {
        const aidatlar = aidatlariGetir().filter(a => a.id !== id);
        kaydet(KEYS.AIDATLAR, aidatlar);
    }

    /**
     * Sporcunun aidatlarını getir
     * @param {number} sporcuId - Sporcu ID
     * @returns {Array} Aidatlar
     */
    function sporcuAidatlari(sporcuId) {
        return aidatlariGetir().filter(a => a.sporcuId === sporcuId);
    }

    /**
     * Dönem aidatlarını getir
     * @param {number} ay - Ay (1-12)
     * @param {number} yil - Yıl
     * @returns {Array} Aidatlar
     */
    function donemAidatlari(ay, yil) {
        return aidatlariGetir().filter(a => 
            a.donemAy === ay && a.donemYil === yil
        );
    }

    // ========== YOKLAMA İŞLEMLERİ ==========

    /**
     * Tüm yoklamaları getir
     * @returns {Array} Yoklamalar
     */
    function yoklamalariGetir() {
        return oku(KEYS.YOKLAMALAR, []);
    }

    /**
     * Yoklama kaydet/güncelle
     * @param {string} tarih - Tarih
     * @param {string} grup - Grup
     * @param {number} sporcuId - Sporcu ID
     * @param {string} durum - Durum (var, yok, izinli)
     */
    function yoklamaKaydet(tarih, grup, sporcuId, durum) {
        let yoklamalar = yoklamalariGetir();
        let kayit = yoklamalar.find(y => y.tarih === tarih && y.grup === grup);
        
        if (!kayit) {
            kayit = {
                id: Date.now(),
                tarih: tarih,
                grup: grup,
                sporcular: []
            };
            yoklamalar.push(kayit);
        }
        
        const sporcuIndex = kayit.sporcular.findIndex(s => s.id === sporcuId);
        if (sporcuIndex > -1) {
            kayit.sporcular[sporcuIndex].durum = durum;
        } else {
            kayit.sporcular.push({ id: sporcuId, durum: durum });
        }
        
        kaydet(KEYS.YOKLAMALAR, yoklamalar);
    }

    /**
     * Toplu yoklama kaydet
     * @param {string} tarih - Tarih
     * @param {string} grup - Grup
     * @param {Array} sporcuIds - Sporcu ID'leri
     * @param {string} durum - Durum
     */
    function topluYoklamaKaydet(tarih, grup, sporcuIds, durum) {
        sporcuIds.forEach(id => yoklamaKaydet(tarih, grup, id, durum));
    }

    /**
     * Tarih ve grup için yoklama getir
     * @param {string} tarih - Tarih
     * @param {string} grup - Grup
     * @returns {Object|null} Yoklama
     */
    function yoklamaBul(tarih, grup) {
        return yoklamalariGetir().find(y => y.tarih === tarih && y.grup === grup) || null;
    }

    // ========== GİDER İŞLEMLERİ ==========

    /**
     * Tüm giderleri getir
     * @returns {Array} Giderler
     */
    function giderleriGetir() {
        return oku(KEYS.GIDERLER, []);
    }

    /**
     * Gider kaydet
     * @param {Object} gider - Gider verisi
     * @returns {Object} Kaydedilen gider
     */
    function giderKaydet(gider) {
        const giderler = giderleriGetir();
        
        gider.id = gider.id || Date.now();
        gider.kayitTarihi = gider.kayitTarihi || new Date().toISOString();
        
        giderler.push(gider);
        kaydet(KEYS.GIDERLER, giderler);
        
        return gider;
    }

    /**
     * Gider sil
     * @param {number} id - Gider ID
     */
    function giderSil(id) {
        const giderler = giderleriGetir().filter(g => g.id !== id);
        kaydet(KEYS.GIDERLER, giderler);
    }

    /**
     * Dönem giderlerini getir
     * @param {number} ay - Ay (1-12)
     * @param {number} yil - Yıl
     * @returns {Array} Giderler
     */
    function donemGiderleri(ay, yil) {
        return giderleriGetir().filter(g => {
            const tarih = new Date(g.tarih);
            return tarih.getMonth() + 1 === ay && tarih.getFullYear() === yil;
        });
    }

    // ========== ANTRENÖR İŞLEMLERİ ==========

    /**
     * Tüm antrenörleri getir
     * @returns {Array} Antrenörler
     */
    function antrenorleriGetir() {
        return oku(KEYS.ANTRENORLER, []);
    }

    /**
     * Antrenör kaydet
     * @param {Object} antrenor - Antrenör verisi
     * @returns {Object} Kaydedilen antrenör
     */
    function antrenorKaydet(antrenor) {
        const antrenorler = antrenorleriGetir();
        
        if (antrenor.id) {
            // Güncelleme
            const index = antrenorler.findIndex(a => a.id === antrenor.id);
            if (index > -1) {
                antrenorler[index] = { ...antrenorler[index], ...antrenor };
            }
        } else {
            // Yeni kayıt
            antrenor.id = Date.now();
            antrenor.kayitTarihi = new Date().toISOString();
            antrenor.durum = 'Aktif';
            antrenorler.push(antrenor);
        }
        
        kaydet(KEYS.ANTRENORLER, antrenorler);
        return antrenor;
    }

    /**
     * Antrenör sil
     * @param {number} id - Antrenör ID
     */
    function antrenorSil(id) {
        const antrenorler = antrenorleriGetir().filter(a => a.id !== id);
        kaydet(KEYS.ANTRENORLER, antrenorler);
    }

    /**
     * Antrenör bul
     * @param {number} id - Antrenör ID
     * @returns {Object|null} Antrenör
     */
    function antrenorBul(id) {
        return antrenorleriGetir().find(a => a.id === id) || null;
    }

    // ========== YEDEKLEME İŞLEMLERİ ==========

    /**
     * Tüm verileri yedekle
     * @returns {Object} Yedek verisi
     */
    function yedekOlustur() {
        const yedek = {
            versiyon: '2.1.0',
            tarih: new Date().toISOString(),
            veriler: {
                sporcular: sporculariGetir(),
                aidatlar: aidatlariGetir(),
                yoklamalar: yoklamalariGetir(),
                giderler: giderleriGetir(),
                antrenorler: antrenorleriGetir()
            }
        };
        
        return yedek;
    }

    /**
     * Yedeği dosya olarak indir
     */
    function yedekIndir() {
        const yedek = yedekOlustur();
        const blob = new Blob([JSON.stringify(yedek, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `SOYBIS_Yedek_${new Date().toLocaleDateString('tr-TR').replace(/\./g, '-')}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        Helpers.toast('Yedek dosyası indirildi!', 'success');
    }

    /**
     * Yedekten geri yükle
     * @param {Object} yedek - Yedek verisi
     * @returns {boolean} Başarılı mı?
     */
    function yedekYukle(yedek) {
        try {
            if (!yedek || !yedek.veriler) {
                throw new Error('Geçersiz yedek dosyası: veriler bulunamadı');
            }
            
            const { sporcular, aidatlar, yoklamalar, giderler, antrenorler } = yedek.veriler;
            
            // Veri doğrulama: Her alan array olmalı (varsa)
            if (sporcular !== undefined && !Array.isArray(sporcular)) {
                throw new Error('Geçersiz yedek dosyası: sporcular array olmalı');
            }
            if (aidatlar !== undefined && !Array.isArray(aidatlar)) {
                throw new Error('Geçersiz yedek dosyası: aidatlar array olmalı');
            }
            if (yoklamalar !== undefined && !Array.isArray(yoklamalar)) {
                throw new Error('Geçersiz yedek dosyası: yoklamalar array olmalı');
            }
            if (giderler !== undefined && !Array.isArray(giderler)) {
                throw new Error('Geçersiz yedek dosyası: giderler array olmalı');
            }
            if (antrenorler !== undefined && !Array.isArray(antrenorler)) {
                throw new Error('Geçersiz yedek dosyası: antrenorler array olmalı');
            }
            
            // Sadece array olan verileri kaydet
            if (sporcular) kaydet(KEYS.SPORCULAR, sporcular);
            if (aidatlar) kaydet(KEYS.AIDATLAR, aidatlar);
            if (yoklamalar) kaydet(KEYS.YOKLAMALAR, yoklamalar);
            if (giderler) kaydet(KEYS.GIDERLER, giderler);
            if (antrenorler) kaydet(KEYS.ANTRENORLER, antrenorler);
            
            Helpers.toast('Veriler başarıyla geri yüklendi!', 'success');
            return true;
        } catch (error) {
            console.error('Geri yükleme hatası:', error);
            Helpers.toast('Geri yükleme başarısız: ' + error.message, 'error');
            return false;
        }
    }

    /**
     * Dosyadan yedek yükle
     * @param {File} file - Dosya
     * @returns {Promise} Promise
     */
    function dosyadanYukle(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = function(e) {
                try {
                    const yedek = JSON.parse(e.target.result);
                    resolve(yedek);
                } catch (error) {
                    reject(new Error('Dosya okunamadı veya geçersiz format'));
                }
            };
            
            reader.onerror = function() {
                reject(new Error('Dosya okuma hatası'));
            };
            
            reader.readAsText(file);
        });
    }

    // ========== SİSTEM İŞLEMLERİ ==========

    // ========== KULLANICI İŞLEMLERİ ==========

    /**
     * Tüm kullanıcıları getir
     * @returns {Array} Kullanıcılar
     */
    function kullanicilariGetir() {
        return oku(KEYS.KULLANICILAR, []);
    }

    /**
     * Kullanıcı kaydet
     * @param {Object} kullanici - Kullanıcı verisi
     * @returns {Promise<Object>} Kaydedilen kullanıcı
     */
    async function kullaniciKaydet(kullanici) {
        const kullanicilar = kullanicilariGetir();
        
        // Şifreyi hash'le
        if (kullanici.sifre && !kullanici.sifre.startsWith('$')) {
            kullanici.sifreHash = await sifreHash(kullanici.sifre);
            delete kullanici.sifre; // Düz metin şifreyi sil
        }
        
        if (kullanici.id) {
            // Güncelleme
            const index = kullanicilar.findIndex(k => k.id === kullanici.id);
            if (index > -1) {
                // Şifre değiştirilmediyse eski hash'i koru
                if (!kullanici.sifreHash) {
                    kullanici.sifreHash = kullanicilar[index].sifreHash;
                }
                kullanicilar[index] = { ...kullanicilar[index], ...kullanici };
            }
        } else {
            // Yeni kayıt
            kullanici.id = Date.now();
            kullanici.olusturmaTarihi = new Date().toISOString();
            kullanicilar.push(kullanici);
        }
        
        kaydet(KEYS.KULLANICILAR, kullanicilar);
        return kullanici;
    }

    /**
     * Kullanıcı sil
     * @param {number} id - Kullanıcı ID
     */
    function kullaniciSil(id) {
        const kullanicilar = kullanicilariGetir().filter(k => k.id !== id);
        kaydet(KEYS.KULLANICILAR, kullanicilar);
    }

    /**
     * Kullanıcı bul
     * @param {number} id - Kullanıcı ID
     * @returns {Object|null} Kullanıcı
     */
    function kullaniciBul(id) {
        return kullanicilariGetir().find(k => k.id === id) || null;
    }

    /**
     * Kullanıcı adı ile kullanıcı bul
     * @param {string} kullaniciAdi - Kullanıcı adı
     * @returns {Object|null} Kullanıcı
     */
    function kullaniciAdiIleBul(kullaniciAdi) {
        return kullanicilariGetir().find(k => k.kullaniciAdi === kullaniciAdi) || null;
    }

    /**
     * Şifre doğrula (kullanıcı için)
     * @param {string} kullaniciAdi - Kullanıcı adı
     * @param {string} girilenSifre - Girilen şifre
     * @returns {Promise<Object|null>} Kullanıcı objesi veya null
     */
    async function kullaniciSifreDogrula(kullaniciAdi, girilenSifre) {
        const kullanici = kullaniciAdiIleBul(kullaniciAdi);
        if (!kullanici) return null;
        
        const hash = await sifreHash(girilenSifre);
        if (hash === kullanici.sifreHash) {
            return kullanici;
        }
        return null;
    }

    /**
     * Varsayılan admin kullanıcısını oluştur (ilk çalıştırmada)
     */
    async function varsayilanAdminOlustur() {
        const kullanicilar = kullanicilariGetir();
        
        // Zaten kullanıcı varsa oluşturma
        if (kullanicilar.length > 0) return;
        
        // Varsayılan admin oluştur
        const admin = {
            kullaniciAdi: 'admin',
            sifre: '1234', // Hash'lenecek
            rol: 'Yönetici',
            adSoyad: 'Sistem Yöneticisi',
            email: '',
            aktif: true
        };
        
        await kullaniciKaydet(admin);
        console.log('Varsayılan admin kullanıcısı oluşturuldu (admin/1234)');
    }

    /**
     * Sistemi sıfırla
     * @param {string} kullaniciAdi - Kullanıcı adı
     * @param {string} sifre - Şifre
     * @returns {Promise<boolean>} Başarılı mı?
     */
    async function sistemSifirla(kullaniciAdi, sifre) {
        const kullanici = await kullaniciSifreDogrula(kullaniciAdi, sifre);
        if (!kullanici || kullanici.rol !== 'Yönetici') {
            Helpers.toast('Yetkiniz yok veya hatalı bilgi!', 'error');
            return false;
        }
        
        // Kullanıcıları hariç tut (sadece veri sıfırla)
        const kullanicilar = kullanicilariGetir();
        Object.values(KEYS).forEach(key => {
            if (key !== KEYS.KULLANICILAR) {
                sil(key);
            }
        });
        Helpers.toast('Sistem sıfırlandı!', 'success');
        return true;
    }

    /**
     * Depolama istatistiklerini getir
     * @returns {Object} İstatistikler
     */
    function istatistikler() {
        const sporcular = sporculariGetir();
        const aidatlar = aidatlariGetir();
        const yoklamalar = yoklamalariGetir();
        const giderler = giderleriGetir();
        
        // Toplam boyut hesapla
        let toplamBoyut = 0;
        Object.values(KEYS).forEach(key => {
            const data = localStorage.getItem(key);
            if (data) {
                toplamBoyut += new Blob([data]).size;
            }
        });
        
        return {
            sporcuSayisi: sporcular.length,
            odemeSayisi: aidatlar.length,
            yoklamaSayisi: yoklamalar.length,
            giderSayisi: giderler.length,
            depolamaKB: Math.round(toplamBoyut / 1024 * 100) / 100
        };
    }

    /**
     * Eski verileri temizle (migration)
     * Eski key yapısından yenisine geçiş
     */
    function veriMigration() {
        // Eski keyler
        const eskiKeyler = ['sporcular', 'aidatlar', 'yoklamalar', 'giderler'];
        
        eskiKeyler.forEach(eskiKey => {
            const eskiVeri = oku(eskiKey, null);
            if (eskiVeri) {
                // Yeni key'e taşı
                const yeniKey = KEYS[eskiKey.toUpperCase()];
                if (yeniKey) {
                    kaydet(yeniKey, eskiVeri);
                    sil(eskiKey);
                    console.log(`Migration: ${eskiKey} -> ${yeniKey}`);
                }
            }
        });
    }

    /**
     * Sistem başlatma - Varsayılan admin oluştur
     */
    async function sistemBaslat() {
        await varsayilanAdminOlustur();
    }

    // Public API
    return {
        KEYS,
        
        // Genel
        kaydet,
        oku,
        sil,
        
        // Sporcu
        sporculariGetir,
        sporcuKaydet,
        sporcuSil,
        sporcuBul,
        tcKontrol,
        
        // Aidat
        aidatlariGetir,
        aidatKaydet,
        aidatSil,
        sporcuAidatlari,
        donemAidatlari,
        
        // Yoklama
        yoklamalariGetir,
        yoklamaKaydet,
        topluYoklamaKaydet,
        yoklamaBul,
        
        // Gider
        giderleriGetir,
        giderKaydet,
        giderSil,
        donemGiderleri,
        
        // Antrenör
        antrenorleriGetir,
        antrenorKaydet,
        antrenorSil,
        antrenorBul,
        
        // Yedekleme
        yedekOlustur,
        yedekIndir,
        yedekYukle,
        dosyadanYukle,
        
        // Sistem
        sistemSifirla,
        istatistikler,
        veriMigration,
        sistemBaslat,
        
        // Kullanıcı
        kullanicilariGetir,
        kullaniciKaydet,
        kullaniciSil,
        kullaniciBul,
        kullaniciAdiIleBul,
        kullaniciSifreDogrula,
        sifreHash
    };
})();

// Global erişim
window.Storage = Storage;
