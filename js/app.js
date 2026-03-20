/**
 * SOY-BIS - Ana Uygulama Dosyası (app.js)
 * Tüm modülleri birleştirir ve uygulamayı başlatır
 * Versiyon: 2.0.0
 */

const App = (function() {
    'use strict';

    // Uygulama durumu
    const state = {
        aktifView: 'dashboard',
        yuklendi: false
    };

    // Modül yükleme retry sayacı (sonsuz döngüyü önlemek için)
    let modulYuklemeRetry = 0;
    const MAX_MODUL_RETRY = 50; // Maksimum 5 saniye (50 * 100ms)

    /**
     * Uygulamayı başlat
     */
    async function init() {
        console.log('🚀 [App] Uygulama başlatılıyor...');

        // Önce auth kontrolü yap
        try {
            // Storage ve Auth modüllerinin yüklenmesini bekle
            if (!window.Storage || !window.Auth) {
                // Modüller henüz yüklenmemiş, biraz bekle
                modulYuklemeRetry++;
                console.log(`⏳ [App] Modüller bekleniyor... (Retry: ${modulYuklemeRetry}/${MAX_MODUL_RETRY})`);
                if (modulYuklemeRetry > MAX_MODUL_RETRY) {
                    console.error('❌ [App] Modüller yüklenemedi! Storage veya Auth modülü bulunamadı.');
                    loginOverlayGoster();
                    loginEventleri();
                    return;
                }
                setTimeout(() => init(), 100);
                return;
            }
            
            // Modüller yüklendi, retry sayacını sıfırla
            modulYuklemeRetry = 0;
            console.log('✅ [App] Storage ve Auth modülleri yüklendi');

            // Sistem başlatma - varsayılan admin oluştur
            if (typeof Storage.sistemBaslat === 'function') {
                console.log('🔄 [App] Sistem başlatılıyor...');
                await Storage.sistemBaslat();
                console.log('✅ [App] Sistem başlatıldı');
            }

            // Auth kontrolü
            console.log('🔐 [App] Auth kontrolü yapılıyor...');
            const girisYapilmis = Auth.kontrol();
            console.log(`✅ [App] Auth kontrolü tamamlandı. Giriş durumu: ${girisYapilmis ? 'Giriş yapılmış' : 'Giriş yapılmamış'}`);
            
            // Splash screen'i her durumda gizle (sayfa yenilendiğinde gözükmesin)
            const splash = Helpers.$('#splashScreen');
            if (splash) {
                splash.style.display = 'none';
                splash.classList.add('hidden');
            }
            
            if (!girisYapilmis) {
                // Giriş yapılmamış, login overlay'i göster
                console.log('🔒 [App] Giriş yapılmamış, login overlay gösteriliyor');
                loginOverlayGoster();
                loginEventleri();
                return; // Uygulamayı başlatma
            }

            // Giriş yapılmış, login overlay'i gizle ve uygulamayı başlat
            console.log('✅ [App] Giriş yapılmış, uygulama başlatılıyor...');
            loginOverlayGizle();
            // App container'ı göster
            const appContainer = Helpers.$('.app-container');
            if (appContainer) {
                appContainer.style.display = 'flex';
                console.log('✅ [App] App container gösterildi');
            }
            kullaniciBilgileriniGoster();
            console.log('✅ [App] Kullanıcı bilgileri gösterildi');

        } catch (error) {
            console.error('❌ [App] Auth kontrolü hatası:', error);
            loginOverlayGoster();
            loginEventleri();
            return;
        }

        // Eğer daha önce bir view kaydedilmişse (sayfa yenilendi), splash screen'i hemen gizle
        const kayitliView = localStorage.getItem('soybis_aktifView');
        if (kayitliView) {
            const splash = Helpers.$('#splashScreen');
            if (splash) {
                splash.style.display = 'none';
                splash.classList.add('hidden');
                splash.remove();
            }
        }

        try {
            // Eski verileri migrate et
            try {
                if (window.Storage && typeof Storage.veriMigration === 'function') {
                    console.log('🔄 [App] Veri migration yapılıyor...');
                    Storage.veriMigration();
                    console.log('✅ [App] Veri migration tamamlandı');
                }
            } catch (e) {
                console.error('❌ [App] Veri migration hatası:', e);
            }

            // Tarihi güncelle
            try {
                console.log('📅 [App] Tarih güncelleniyor...');
                tarihiGuncelle();
                console.log('✅ [App] Tarih güncellendi');
            } catch (e) {
                console.error('❌ [App] Tarih güncelleme hatası:', e);
            }

            // Navigasyon eventlerini bağla
            try {
                console.log('🧭 [App] Navigasyon eventleri bağlanıyor...');
                navigasyonEventleri();
                console.log('✅ [App] Navigasyon eventleri bağlandı');
            } catch (e) {
                console.error('❌ [App] Navigasyon eventleri hatası:', e);
            }

            // Rol bazlı menü gizleme
            console.log('🔒 [App] Rol bazlı menü kontrolü yapılıyor...');
            rolBazliMenuGizle();
            console.log('✅ [App] Rol bazlı menü kontrolü tamamlandı');

            // Modülleri başlat
            console.log('📦 [App] Tüm modüller başlatılıyor...');
            modulleriBaslat();

            // Ayarlar eventlerini bağla
            try {
                console.log('⚙️ [App] Ayarlar eventleri bağlanıyor...');
                ayarlarEventleri();
                console.log('✅ [App] Ayarlar eventleri bağlandı');
            } catch (e) {
                console.error('❌ [App] Ayarlar eventleri hatası:', e);
            }

            // Tema yönetimini başlat (sayfa yüklendiğinde tercihi uygula)
            try {
                console.log('🎨 [App] Tema yönetimi başlatılıyor...');
                temaYonetimiBaslat();
                temaTercihiniUygula();
                console.log('✅ [App] Tema yönetimi başlatıldı');
            } catch (e) {
                console.error('❌ [App] Tema yönetimi hatası:', e);
            }

            // Keyboard shortcuts'ları bağla
            try {
                console.log('⌨️ [App] Klavye kısayolları bağlanıyor...');
                klavyeKisayollari();
                console.log('✅ [App] Klavye kısayolları bağlandı');
            } catch (e) {
                console.error('❌ [App] Klavye kısayolları hatası:', e);
            }

            // Hamburger menü eventlerini bağla (Mobil)
            try {
                console.log('🍔 [App] Hamburger menü eventleri bağlanıyor...');
                hamburgerMenuEventleri();
                console.log('✅ [App] Hamburger menü eventleri bağlandı');
            } catch (e) {
                console.error('❌ [App] Hamburger menü eventleri hatası:', e);
            }
            
            // Masaüstü sidebar yönetimi (varsayılan açık + tercih kaydı)
            if (window.innerWidth >= 769) {
                try {
                    masaustuSidebarYonetimi();
                } catch (e) {
                    console.warn('Masaüstü sidebar yönetimi hatası:', e);
                }
            }

            // Son görüntülenen view'u localStorage'dan al veya rol bazlı varsayılan göster
            let sonView = kayitliView;
            if (!sonView) {
                const kullanici = Auth.aktifKullanici();
                const rol = kullanici?.rol;
                if (rol === 'Antrenör') {
                    sonView = 'sporcu-listesi'; // Antrenör için varsayılan
                } else {
                    sonView = 'dashboard'; // Yönetici ve Muhasebe için varsayılan
                }
            }
            // İlk başlatmada input temizleme yapma (DOM henüz hazır olmayabilir)
            try {
                console.log(`🔄 [App] İlk view gösteriliyor: ${sonView}`);
                viewGoster(sonView, true); // true = ilk başlatma
                console.log(`✅ [App] İlk view gösterildi: ${sonView}`);
            } catch (e) {
                console.error('❌ [App] View gösterme hatası:', e);
            }

            // İlk indicator pozisyonunu ayarla (biraz gecikmeyle DOM'un hazır olmasını bekle)
            setTimeout(() => {
                try {
                    // Yetki kontrolü - eğer sonView erişilemezse rol bazlı varsayılan kullan
                    const kullanici = Auth.aktifKullanici();
                    const rol = kullanici?.rol;
        const yetkiler = {
            'Yönetici': ['dashboard', 'sporcu-kayit', 'sporcu-listesi', 'aidat', 'yoklama', 'giderler', 'antrenorler', 'raporlar', 'ayarlar', 'kullanici-yonetimi'],
            'Antrenör': ['sporcu-listesi', 'yoklama'],
            'Muhasebe': ['dashboard', 'aidat', 'giderler', 'raporlar']
        };
                    const izinliViewlar = yetkiler[rol] || [];
                    const gosterilecekView = izinliViewlar.includes(sonView) ? sonView : (rol === 'Antrenör' ? 'sporcu-listesi' : 'dashboard');
                    navIndicatorGuncelle(gosterilecekView);
                } catch (e) {
                    console.warn('Nav indicator hatası:', e);
                }
            }, 100);

            state.yuklendi = true;
            console.log('✅ [App] Uygulama başarıyla yüklendi!');

            // Sadece ilk yüklemede splash screen göster (yenilemede değil)
            if (!kayitliView) {
                console.log('🔄 [App] Splash screen kapatılıyor...');
                splashScreenKapat();
            }

        } catch (error) {
            // Sadece kritik hatalarda toast göster
            console.error('❌ [App] Uygulama başlatma hatası:', error);
            // Kritik hatalar için toast göster (sadece gerçek kritik hatalarda ve Helpers yüklüyse)
            try {
                if (window.Helpers && typeof Helpers.toast === 'function') {
                    if (error.message && !error.message.includes('Cannot read property') && !error.message.includes('undefined')) {
                        Helpers.toast('Uygulama başlatılırken hata oluştu!', 'error');
                    }
                }
            } catch (e) {
                // Toast gösterilemezse sessizce devam et
                console.warn('Toast gösterilemedi:', e);
            }
            // Hata olsa bile splash screen'i kapat
            if (!kayitliView) {
                splashScreenKapat();
            }
        }
    }

    /**
     * Splash screen'i göster
     */
    function splashScreenGoster() {
        const splash = document.getElementById('splashScreen');
        if (splash) {
            splash.classList.remove('hidden');
            splash.style.display = 'flex';
        }
    }

    /**
     * Splash screen'i kapat
     */
    function splashScreenKapat() {
        const splash = document.getElementById('splashScreen');
        if (splash) {
            // Animasyonun bitmesini bekle
            setTimeout(() => {
                splash.classList.add('hidden');
                // Tamamen kaldır
                setTimeout(() => {
                    splash.remove();
                }, 500);
            }, 1800); // Loading bar animasyonu + biraz bekleme
        }
    }

    /**
     * Tarihi güncelle
     */
    function tarihiGuncelle() {
        const tarihEl = Helpers.$('#nowDate');
        if (tarihEl) {
            tarihEl.textContent = new Date().toLocaleDateString('tr-TR', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }
    }

    /**
     * Navigasyon eventlerini bağla
     */
    function navigasyonEventleri() {
        const navButtons = Helpers.$$('#mainNav button');
        
        if (!navButtons || navButtons.length === 0) {
            return;
        }
        
        navButtons.forEach((btn) => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                const target = this.dataset.target;
                
                if (target) {
                    viewGoster(target);
                }
            });
        });
    }

    /**
     * View göster
     * @param {string} viewId - View ID
     * @param {boolean} ilkBaslatma - İlk başlatma mı (input temizleme yapılmasın)
     */
    function viewGoster(viewId, ilkBaslatma = false) {
        console.log(`🔄 [App] View değiştiriliyor: ${viewId} (ilk başlatma: ${ilkBaslatma})`);
        
        // Yetki kontrolü
        const kullanici = Auth.aktifKullanici();
        if (!kullanici) {
            console.warn('⚠️ [App] Kullanıcı bulunamadı, login overlay gösteriliyor');
            loginOverlayGoster();
            return;
        }

        const rol = kullanici.rol;
        // Uluslararası RBAC normlarına göre view yetkileri
        const yetkiler = {
            'Yönetici': ['dashboard', 'sporcu-kayit', 'sporcu-listesi', 'aidat', 'yoklama', 'giderler', 'antrenorler', 'raporlar', 'ayarlar', 'kullanici-yonetimi'],
            'Antrenör': ['sporcu-listesi', 'yoklama'], // Dashboard YOK - Finansal bilgiler içeriyor
            'Muhasebe': ['dashboard', 'aidat', 'giderler', 'raporlar'] // Finansal işlemler için dashboard gerekli
        };

        const izinliViewlar = yetkiler[rol] || [];
        if (!izinliViewlar.includes(viewId)) {
            console.warn(`⚠️ [App] Yetki yok! Rol: ${rol}, İstenen view: ${viewId}`);
            Helpers.toast('Bu sayfaya erişim yetkiniz yok!', 'error');
            // Rol bazlı varsayılan view'a yönlendir
            if (rol === 'Antrenör') {
                viewId = 'sporcu-listesi'; // Antrenör için varsayılan
            } else if (rol === 'Muhasebe') {
                viewId = 'dashboard'; // Muhasebe için varsayılan
            } else {
                viewId = 'dashboard'; // Yönetici için varsayılan
            }
            console.log(`✅ [App] Varsayılan view'a yönlendiriliyor: ${viewId}`);
        } else {
            console.log(`✅ [App] Yetki kontrolü başarılı, view gösteriliyor: ${viewId}`);
        }

        if (!ilkBaslatma) {
            try {
                // Tüm arama kutularını ve form input'larını temizle (sadece panel değiştiğinde)
                aramaKutulariniTemizle();
                formInputlariniTemizle();
            } catch (e) {
                console.warn('Input temizleme hatası:', e);
            }
        }
        
        // Aktif nav butonunu güncelle
        Helpers.$$('#mainNav button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.target === viewId);
        });

        // Aktif view'u güncelle
        Helpers.$$('.view').forEach(view => {
            const isActive = view.id === viewId;
            view.classList.toggle('active', isActive);
            // Display özelliğini de ayarla
            if (isActive) {
                view.style.display = 'block';
            } else {
                view.style.display = 'none';
            }
        });

        // Nav indicator'ı güncelle
        navIndicatorGuncelle(viewId);

        state.aktifView = viewId;
        
        // Aktif view'u localStorage'a kaydet (sayfa yenilendiğinde aynı yerde kalsın)
        localStorage.setItem('soybis_aktifView', viewId);

        // Dashboard'dan çıkıldığında chart'ları temizle (bellek sızıntısı önleme)
        if (viewId !== 'dashboard' && window.Dashboard && typeof Dashboard.tumChartlariTemizle === 'function') {
            Dashboard.tumChartlariTemizle();
        }

        // Panel değiştiğinde modül formlarını ve filtrelerini sıfırla
        if (!ilkBaslatma) {
            try {
                // Sporcu modülü form temizleme
                if (window.Sporcu && typeof Sporcu.formuTemizle === 'function') {
                    Sporcu.formuTemizle();
                }

                // Aidat modülü filtre sıfırlama
                if (window.Aidat && typeof Aidat.filtreSifirla === 'function') {
                Aidat.filtreSifirla();
                }

                // Yoklama modülü filtre sıfırlama
                if (window.Yoklama && typeof Yoklama.filtreSifirla === 'function') {
                    Yoklama.filtreSifirla();
                }

                // Gider modülü form/filtre temizleme (varsa)
                if (window.Gider && typeof Gider.formuTemizle === 'function') {
                    Gider.formuTemizle();
                }

                // Antrenör modülü form temizleme (varsa)
                if (window.Antrenor && typeof Antrenor.formuTemizle === 'function') {
                    Antrenor.formuTemizle();
                }

                // Kullanıcı yönetimi modülü form temizleme (varsa)
                if (window.KullaniciYonetimi && typeof KullaniciYonetimi.formuTemizle === 'function') {
                    KullaniciYonetimi.formuTemizle();
                }
            } catch (e) {
                console.warn('Modül form/filtre temizleme hatası:', e);
            }
        }

        // View'a özgü güncellemeler
        viewGuncellemeleri(viewId);
        
        console.log(`✅ [App] View başarıyla gösterildi: ${viewId}`);
    }

    /**
     * Nav indicator pozisyonunu güncelle
     * @param {string} viewId - View ID
     */
    function navIndicatorGuncelle(viewId) {
        const indicator = Helpers.$('#navIndicator');
        const activeBtn = Helpers.$(`#mainNav button[data-target="${viewId}"]`);
        
        if (indicator && activeBtn) {
            const nav = Helpers.$('#mainNav');
            if (!nav) return;
            
            const navRect = nav.getBoundingClientRect();
            const btnRect = activeBtn.getBoundingClientRect();
            
            // Butonun nav içindeki pozisyonunu hesapla
            const topOffset = btnRect.top - navRect.top;
            
            indicator.style.top = topOffset + 'px';
            indicator.style.height = btnRect.height + 'px';
        }
    }

    /**
     * View'a özgü güncellemeler
     * @param {string} viewId - View ID
     */
    function viewGuncellemeleri(viewId) {
        console.log(`🔄 [App] View güncellemeleri yapılıyor: ${viewId}`);
        
        try {
            switch (viewId) {
                case 'dashboard':
                    console.log('📊 [App] Dashboard güncellemeleri yapılıyor...');
                    if (window.Dashboard) {
                        // Chart'lar yoksa yeniden oluştur
                        if (typeof Dashboard.grafikleriOlustur === 'function') {
                            console.log('✅ [App] Dashboard grafikleri oluşturuluyor...');
                            Dashboard.grafikleriOlustur();
                        }
                        if (typeof Dashboard.guncelle === 'function') {
                            console.log('✅ [App] Dashboard güncelleniyor...');
                            Dashboard.guncelle();
                        }
                    } else {
                        console.warn('⚠️ [App] Dashboard modülü bulunamadı');
                    }
                    break;
                case 'sporcu-kayit':
                    console.log('📝 [App] Sporcu kayıt formu güncellemeleri yapılıyor...');
                    // Sporcu kayıt formu gösterildiğinde form eventlerini yeniden bağla
                    if (window.Sporcu && typeof Sporcu.formEventleriniYenidenBagla === 'function') {
                        console.log('✅ [App] Sporcu form eventleri yeniden bağlanıyor...');
                        // Kısa bir gecikme ile form'un DOM'da olmasını garanti et
                        setTimeout(() => {
                            Sporcu.formEventleriniYenidenBagla();
                            // Debug: Buton durumunu kontrol et
                            if (typeof Sporcu.butonDurumunuKontrolEt === 'function') {
                                Sporcu.butonDurumunuKontrolEt();
                            }
                            console.log('✅ [App] Sporcu form eventleri bağlandı');
                        }, 100);
                    } else {
                        console.warn('⚠️ [App] Sporcu modülü veya formEventleriniYenidenBagla fonksiyonu bulunamadı');
                    }
                    break;
                case 'sporcu-listesi':
                    console.log('👥 [App] Sporcu listesi güncelleniyor...');
                    console.log('🔍 [App] window.Sporcu kontrolü:', !!window.Sporcu);
                    
                    if (window.Sporcu) {
                        console.log('🔍 [App] Sporcu.listeyiGuncelle tipi:', typeof Sporcu.listeyiGuncelle);
                        if (typeof Sporcu.listeyiGuncelle === 'function') {
                            console.log('✅ [App] Sporcu.listeyiGuncelle() çağrılıyor...');
                        Sporcu.listeyiGuncelle();
                            console.log('✅ [App] Sporcu.listeyiGuncelle() çağrısı tamamlandı');
                        } else {
                            console.warn('⚠️ [App] Sporcu.listeyiGuncelle fonksiyon değil!');
                        }
                    } else {
                        console.warn('⚠️ [App] window.Sporcu bulunamadı!');
                    }
                    break;
                case 'aidat':
                    console.log('💳 [App] Aidat view güncellemeleri yapılıyor...');
                    // Aidat view'ına geçildiğinde modülü başlat
                    // ÖNEMLİ: init içinde filtreSifirla zaten çağrılıyor, bu yüzden burada çağırmaya gerek yok
                    if (window.Aidat) {
                        if (typeof Aidat.init === 'function') {
                            console.log('✅ [App] Aidat modülü yeniden başlatılıyor...');
                            Aidat.init();
                            console.log('✅ [App] Aidat modülü başlatıldı');
                        } else {
                            console.warn('⚠️ [App] Aidat.init fonksiyonu bulunamadı!');
                        }
                    } else {
                        console.warn('⚠️ [App] window.Aidat bulunamadı!');
                    }
                    break;
                case 'yoklama':
                    console.log('📋 [App] Yoklama listesi güncelleniyor...');
                    console.log('🔍 [App] window.Yoklama kontrolü:', !!window.Yoklama);
                    
                    if (window.Yoklama) {
                        console.log('🔍 [App] Yoklama.listeyiGuncelle tipi:', typeof Yoklama.listeyiGuncelle);
                        if (typeof Yoklama.listeyiGuncelle === 'function') {
                            console.log('✅ [App] Yoklama.listeyiGuncelle() çağrılıyor...');
                        Yoklama.listeyiGuncelle();
                            console.log('✅ [App] Yoklama.listeyiGuncelle() çağrısı tamamlandı');
                        } else {
                            console.warn('⚠️ [App] Yoklama.listeyiGuncelle fonksiyon değil!');
                        }
                    } else {
                        console.warn('⚠️ [App] window.Yoklama bulunamadı!');
                    }
                    break;
                case 'giderler':
                    console.log('💰 [App] Gider view güncellemeleri yapılıyor...');
                    // Gider view'ına geçildiğinde modülü başlat - DOM hazır olması için kısa gecikme
                    setTimeout(() => {
                        if (window.Gider) {
                            if (typeof Gider.init === 'function') {
                                console.log('✅ [App] Gider modülü yeniden başlatılıyor...');
                                Gider.init();
                                console.log('✅ [App] Gider modülü başlatıldı');
                            } else {
                                console.warn('⚠️ [App] Gider.init fonksiyonu bulunamadı!');
                            }
                        } else {
                            console.warn('⚠️ [App] window.Gider bulunamadı!');
                        }
                    }, 100);
                    break;
                case 'raporlar':
                    console.log('📄 [App] Raporlar view güncellemeleri yapılıyor...');
                    // Raporlar view'ına geçildiğinde modülü başlat (init içinde guncelle() çağrılıyor) - DOM hazır olması için kısa gecikme
                    setTimeout(() => {
                        if (window.Rapor) {
                            if (typeof Rapor.init === 'function') {
                                console.log('✅ [App] Rapor modülü yeniden başlatılıyor...');
                                Rapor.init();
                                console.log('✅ [App] Rapor modülü başlatıldı');
                            } else {
                                console.warn('⚠️ [App] Rapor.init fonksiyonu bulunamadı!');
                            }
                        } else {
                            console.warn('⚠️ [App] window.Rapor bulunamadı!');
                        }
                    }, 100);
                    break;
                case 'ayarlar':
                    console.log('⚙️ [App] Ayarlar güncelleniyor...');
                    // Ayarlar view'ında tüm ayarları güncelle
                    ayarlariGuncelle();
                    // Toplu zam butonunu ekle/kontrol et
                    if (window.Ayarlar && typeof Ayarlar.topluZamButonuOlustur === 'function') {
                        setTimeout(() => {
                            console.log('🔄 [App] Toplu zam butonu kontrol ediliyor...');
                            Ayarlar.topluZamButonuOlustur();
                        }, 300);
                        setTimeout(() => {
                            // İkinci deneme
                            if (!Helpers.$('#topluZamBtn')) {
                                console.log('🔄 [App] Toplu zam butonu hala yok, tekrar deneniyor...');
                                Ayarlar.topluZamButonuOlustur();
                            }
                        }, 1000);
                    }
                    console.log('✅ [App] Ayarlar güncellendi');
                    break;
                case 'kullanici-yonetimi':
                    console.log('👤 [App] Kullanıcı yönetimi view güncellemeleri yapılıyor...');
                    // Kullanıcı yönetimi view'ına geçildiğinde modülü başlat - DOM hazır olması için kısa gecikme
                    setTimeout(() => {
                        if (window.KullaniciYonetimi) {
                            if (typeof KullaniciYonetimi.init === 'function') {
                                console.log('✅ [App] Kullanıcı Yönetimi modülü yeniden başlatılıyor...');
                                KullaniciYonetimi.init();
                                console.log('✅ [App] Kullanıcı Yönetimi modülü başlatıldı');
                            } else {
                                console.warn('⚠️ [App] KullaniciYonetimi.init fonksiyonu bulunamadı!');
                            }
                            // Panel göster (liste güncellemesi için)
                            if (typeof KullaniciYonetimi.paneliGoster === 'function') {
                                console.log('✅ [App] Kullanıcı yönetimi paneli gösteriliyor...');
                                KullaniciYonetimi.paneliGoster();
                            } else if (typeof KullaniciYonetimi.kullaniciListesiniGuncelle === 'function') {
                                console.log('✅ [App] Kullanıcı listesi güncelleniyor...');
                                KullaniciYonetimi.kullaniciListesiniGuncelle();
                            }
                        } else {
                            console.warn('⚠️ [App] KullaniciYonetimi modülü bulunamadı!');
                        }
                    }, 100);
                    break;
                case 'antrenorler':
                    console.log('👔 [App] Antrenör view güncellemeleri yapılıyor...');
                    // Antrenör view'ına geçildiğinde modülü başlat - DOM hazır olması için kısa gecikme
                    setTimeout(() => {
                        if (window.Antrenor) {
                            if (typeof Antrenor.init === 'function') {
                                console.log('✅ [App] Antrenör modülü yeniden başlatılıyor...');
                                Antrenor.init();
                                console.log('✅ [App] Antrenör modülü başlatıldı');
                            } else {
                                console.warn('⚠️ [App] Antrenor.init fonksiyonu bulunamadı!');
                            }
                        } else {
                            console.warn('⚠️ [App] window.Antrenor bulunamadı!');
                        }
                    }, 100);
                    break;
            }
        } catch (e) {
            console.error('❌ [App] View güncelleme hatası:', e);
        }
        
        console.log(`✅ [App] View güncellemeleri tamamlandı: ${viewId}`);
    }

    /**
     * Tüm arama kutularını temizle
     */
    function aramaKutulariniTemizle() {
        // Sporcu listesi arama kutusu
        const searchBox = Helpers.$('#searchBox');
        if (searchBox) {
            searchBox.value = '';
        }

        // Aidat arama kutusu
        const aidatArama = Helpers.$('#aidatArama');
        if (aidatArama) {
            aidatArama.value = '';
        }
        
        // Diğer arama kutuları (varsa)
        document.querySelectorAll('.search-box, input[type="search"], input[placeholder*="ara" i]').forEach(input => {
            if (input.id !== 'searchBox' && input.id !== 'aidatArama') {
                input.value = '';
            }
        });
    }
    
    /**
     * Tüm form input'larını temizle (validation class'ları dahil)
     */
    function formInputlariniTemizle() {
        try {
            // Önce tüm form'ları reset et
            const forms = document.querySelectorAll('form');
            forms.forEach(form => {
                try {
                    // Arama formları hariç (arama kutuları genelde form içinde değil)
                    const isSearchForm = form.classList.contains('search-form') || 
                                        form.id === 'searchForm' ||
                                        form.querySelector('input[type="search"]');
                    
                    if (!isSearchForm) {
                        form.reset();
                    }
                } catch (e) {
                    console.warn('Form reset hatası:', e);
                }
            });

            // Tüm input, select, textarea elementlerini bul
            const inputs = document.querySelectorAll('input, select, textarea');
            if (!inputs || inputs.length === 0) return;
            
            inputs.forEach(input => {
                try {
                    // Sadece form içindeki input'ları temizle (arama kutuları hariç)
                    const isSearchBox = input.classList.contains('search-box') || 
                                       input.id === 'searchBox' || 
                                       input.id === 'aidatArama' ||
                                       input.type === 'search';
                    
                    if (!isSearchBox && input.id) {
                        // Validation class'larını kaldır
                        input.classList.remove('validated-success', 'error');
                        
                        // Error text'leri temizle
                        const errorEl = document.getElementById(input.id + 'Error');
                        if (errorEl) {
                            errorEl.textContent = '';
                        }
                    }
                } catch (e) {
                    // Tek bir input'ta hata olsa bile devam et
                    console.warn('Input temizleme hatası (tek eleman):', e);
                }
            });
        } catch (e) {
            // Genel hata durumunda sessizce devam et
            console.warn('Form input temizleme hatası:', e);
        }
    }

    /**
     * Modülleri başlat
     */
    function modulleriBaslat() {
        console.log('📦 [App] Modüller başlatılıyor...');
        
        // Dashboard
        try {
            if (window.Dashboard && typeof Dashboard.init === 'function') {
                console.log('🔄 [App] Dashboard modülü başlatılıyor...');
                Dashboard.init();
            } else {
                console.warn('⚠️ [App] Dashboard modülü bulunamadı veya init fonksiyonu yok');
            }
        } catch (e) {
            console.error('❌ [App] Dashboard init hatası:', e);
        }
        
        // Sporcu
        try {
            if (window.Sporcu && typeof Sporcu.init === 'function') {
                console.log('🔄 [App] Sporcu modülü başlatılıyor...');
                Sporcu.init();
            } else {
                console.warn('⚠️ [App] Sporcu modülü bulunamadı veya init fonksiyonu yok');
            }
        } catch (e) {
            console.error('❌ [App] Sporcu init hatası:', e);
        }
        
        // Aidat
        try {
            if (window.Aidat && typeof Aidat.init === 'function') {
                console.log('🔄 [App] Aidat modülü başlatılıyor...');
                Aidat.init();
            } else {
                console.warn('⚠️ [App] Aidat modülü bulunamadı veya init fonksiyonu yok');
            }
        } catch (e) {
            console.error('❌ [App] Aidat init hatası:', e);
        }
        
        // Yoklama
        try {
            if (window.Yoklama && typeof Yoklama.init === 'function') {
                console.log('🔄 [App] Yoklama modülü başlatılıyor...');
                Yoklama.init();
            } else {
                console.warn('⚠️ [App] Yoklama modülü bulunamadı veya init fonksiyonu yok');
            }
        } catch (e) {
            console.error('❌ [App] Yoklama init hatası:', e);
        }
        
        // Gider
        try {
            if (window.Gider && typeof Gider.init === 'function') {
                console.log('🔄 [App] Gider modülü başlatılıyor...');
                Gider.init();
            } else {
                console.warn('⚠️ [App] Gider modülü bulunamadı veya init fonksiyonu yok');
            }
        } catch (e) {
            console.error('❌ [App] Gider init hatası:', e);
        }
        
        // Antrenör
        try {
            if (window.Antrenor && typeof Antrenor.init === 'function') {
                console.log('🔄 [App] Antrenör modülü başlatılıyor...');
                Antrenor.init();
            } else {
                console.warn('⚠️ [App] Antrenör modülü bulunamadı veya init fonksiyonu yok');
            }
        } catch (e) {
            console.error('❌ [App] Antrenör init hatası:', e);
        }
        
        // Rapor
        try {
            if (window.Rapor && typeof Rapor.init === 'function') {
                console.log('🔄 [App] Rapor modülü başlatılıyor...');
                Rapor.init();
            } else {
                console.warn('⚠️ [App] Rapor modülü bulunamadı veya init fonksiyonu yok');
            }
        } catch (e) {
            console.error('❌ [App] Rapor init hatası:', e);
        }
        
        // Notification (Hatırlatma)
        try {
            if (window.Notification && typeof Notification.init === 'function') {
                console.log('🔄 [App] Notification modülü başlatılıyor...');
                Notification.init();
            } else {
                console.warn('⚠️ [App] Notification modülü bulunamadı veya init fonksiyonu yok');
            }
        } catch (e) {
            console.error('❌ [App] Notification init hatası:', e);
        }

        // Ayarlar
        try {
            if (window.Ayarlar && typeof Ayarlar.init === 'function') {
                console.log('🔄 [App] Ayarlar modülü başlatılıyor...');
                Ayarlar.init();
            } else {
                console.warn('⚠️ [App] Ayarlar modülü bulunamadı veya init fonksiyonu yok');
            }
        } catch (e) {
            console.error('❌ [App] Ayarlar init hatası:', e);
        }

        // Kullanıcı Yönetimi
        try {
            if (window.KullaniciYonetimi && typeof KullaniciYonetimi.init === 'function') {
                console.log('🔄 [App] Kullanıcı Yönetimi modülü başlatılıyor...');
                KullaniciYonetimi.init();
            } else {
                console.warn('⚠️ [App] Kullanıcı Yönetimi modülü bulunamadı veya init fonksiyonu yok');
            }
        } catch (e) {
            console.error('❌ [App] Kullanıcı Yönetimi init hatası:', e);
        }
        
        console.log('✅ [App] Tüm modüller başlatıldı');
    }

    /**
     * Keyboard shortcuts
     */
    function klavyeKisayollari() {
        document.addEventListener('keydown', function(e) {
            // Modal açıksa sadece ESC çalışsın
            const activeModal = document.querySelector('.modal.active');
            if (activeModal) {
                if (e.key === 'Escape') {
                    const closeBtn = activeModal.querySelector('.modal-close');
                    if (closeBtn) closeBtn.click();
                }
                return;
            }

            // Input/textarea içindeyse sadece Ctrl+S çalışsın
            const isInput = e.target.tagName === 'INPUT' || 
                           e.target.tagName === 'TEXTAREA' || 
                           e.target.tagName === 'SELECT' ||
                           e.target.isContentEditable;
            
            // Ctrl+S: Form kaydet (eğer form varsa)
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                const activeForm = document.querySelector('form:not([style*="display: none"])');
                if (activeForm) {
                    const submitBtn = activeForm.querySelector('button[type="submit"]');
                    if (submitBtn && !submitBtn.disabled) {
                        submitBtn.click();
                        Helpers.toast('Form kaydediliyor...', 'info');
                    }
                }
                return;
            }

            // Input içindeyken diğer kısayollar çalışmasın
            if (isInput) return;

            // Sayısal tuşlar: Hızlı navigasyon (1-9)
            if (e.key >= '1' && e.key <= '9' && !e.ctrlKey && !e.altKey) {
                const navButtons = Helpers.$$('#mainNav button');
                const index = parseInt(e.key) - 1;
                if (navButtons[index]) {
                    navButtons[index].click();
                }
            }

            // G: Dashboard'a git
            if (e.key === 'g' || e.key === 'G') {
                if (!e.ctrlKey && !e.altKey) {
                    viewGoster('dashboard');
                }
            }

            // Ctrl+K veya /: Arama kutusuna odaklan
            if ((e.ctrlKey && e.key === 'k') || e.key === '/') {
                e.preventDefault();
                const searchBox = document.querySelector('.search-box, #searchBox, #aidatArama');
                if (searchBox) {
                    searchBox.focus();
                    searchBox.select();
                }
            }
        });
    }

    /**
     * Ayarlar eventlerini bağla
     */
    function ayarlarEventleri() {
        // Toplu zam butonunu ayarlar sayfasına ekle (view değiştiğinde)
        if (window.Ayarlar && typeof Ayarlar.topluZamButonuOlustur === 'function') {
            // Ayarlar sayfasına geçildiğinde butonu kontrol et
            // NOT: viewGoster zaten App nesnesinin bir metodu, burada override ediyoruz
            const originalViewGoster = App.viewGoster;
            App.viewGoster = function(viewName, skipNavUpdate) {
                const result = originalViewGoster.apply(this, arguments);
                if (viewName === 'ayarlar') {
                    console.log('🔄 [App] Ayarlar sayfasına geçildi, toplu zam butonu kontrol ediliyor...');
                    setTimeout(() => {
                        Ayarlar.topluZamButonuOlustur();
                    }, 200);
                    setTimeout(() => {
                        // İkinci deneme - buton hala yoksa
                        if (!Helpers.$('#topluZamBtn')) {
                            console.log('🔄 [App] Buton hala yok, tekrar deneniyor...');
                            Ayarlar.topluZamButonuOlustur();
                        }
                    }, 1000);
                }
                return result;
            };
            console.log('✅ [App] App.viewGoster override edildi - toplu zam butonu için');
        } else {
            console.warn('⚠️ [App] Ayarlar.topluZamButonuOlustur bulunamadı!');
        }
        
        // Yedekle butonu
        const yedekleBtn = Helpers.$('#yedekleBtn');
        if (yedekleBtn) {
            yedekleBtn.addEventListener('click', function() {
                Storage.yedekIndir();
            });
        }

        // Geri yükle butonu
        const geriYukleBtn = Helpers.$('#geriYukleBtn');
        const yedekDosya = Helpers.$('#yedekDosya');
        
        if (geriYukleBtn && yedekDosya) {
            geriYukleBtn.addEventListener('click', function() {
                yedekDosya.click();
            });

            yedekDosya.addEventListener('change', async function(e) {
                const file = e.target.files[0];
                if (!file) return;

                try {
                    const yedek = await Storage.dosyadanYukle(file);
                    
                    if (Helpers.onay('Mevcut veriler yedekteki verilerle değiştirilecek. Devam etmek istiyor musunuz?')) {
                        if (Storage.yedekYukle(yedek)) {
                            location.reload();
                        }
                    }
                } catch (error) {
                    Helpers.toast(error.message, 'error');
                }

                // Input'u sıfırla
                this.value = '';
            });
        }

        // Sistemi sıfırla butonu
        const sifirlaBtn = Helpers.$('#sistemiSifirlaBtn');
        if (sifirlaBtn) {
            sifirlaBtn.addEventListener('click', function() {
                if (!Helpers.onay('⚠️ DİKKAT!\n\nTüm veriler kalıcı olarak silinecek. Bu işlem geri alınamaz!\n\nDevam etmek istiyor musunuz?')) {
                    return;
                }

                const kullaniciAdi = Helpers.girdi('Kullanıcı adınızı girin:');
                if (kullaniciAdi === null) return;

                const sifre = Helpers.girdi('Şifrenizi girin:');
                if (sifre === null) return;

                // Async şifre doğrulama
                Storage.sistemSifirla(kullaniciAdi, sifre).then(basarili => {
                    if (basarili) {
                        setTimeout(() => location.reload(), 1000);
                    }
                });
            });
        }

        // Çıkış butonu
        const logoutBtn = Helpers.$('#logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', function() {
                if (Helpers.onay('Çıkış yapmak istediğinize emin misiniz?')) {
                    Auth.cikisYap();
                }
            });
        }

        // Tema değiştirme butonu
        temaYonetimiBaslat();
    }

    /**
     * Tema yönetimini başlat
     */
    function temaYonetimiBaslat() {
        // Tema değiştirme butonunu oluştur veya bul
        let temaBtn = Helpers.$('#themeToggleBtn');
        
        if (!temaBtn) {
            // Buton yoksa oluştur
            temaBtn = document.createElement('button');
            temaBtn.id = 'themeToggleBtn';
            temaBtn.className = 'theme-toggle-btn';
            temaBtn.setAttribute('aria-label', 'Tema değiştir');
            temaBtn.innerHTML = '<i class="fa-solid fa-moon"></i>';
            
            // Header'daki meta bölümüne ekle (kullanıcı bilgisinden önce)
            const meta = Helpers.$('.meta');
            if (meta) {
                // Tema butonu zaten varsa ekleme
                if (!meta.querySelector('#themeToggleBtn')) {
                    meta.insertBefore(temaBtn, meta.firstChild);
                }
            } else {
                // Meta yoksa header'a ekle
                const header = Helpers.$('.app-header');
                if (header) {
                    const metaDiv = document.createElement('div');
                    metaDiv.className = 'meta';
                    metaDiv.appendChild(temaBtn);
                    header.appendChild(metaDiv);
                }
            }
        }
        
        // Event listener ekle
        if (temaBtn && !temaBtn.hasAttribute('data-theme-listener')) {
            temaBtn.setAttribute('data-theme-listener', 'true');
            temaBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                temaDegistir();
            });
        }
    }

    /**
     * Tema değiştir (Dark <-> Light)
     */
    function temaDegistir() {
        const body = document.body;
        const isLightMode = body.classList.contains('light-mode');
        const temaBtn = Helpers.$('#themeToggleBtn');
        
        if (isLightMode) {
            // Light Mode'dan Dark Mode'a geç
            body.classList.remove('light-mode');
            localStorage.setItem('soybis_theme', 'dark');
            if (temaBtn) {
                temaBtn.innerHTML = '<i class="fa-solid fa-moon"></i>';
            }
        } else {
            // Dark Mode'dan Light Mode'a geç
            body.classList.add('light-mode');
            localStorage.setItem('soybis_theme', 'light');
            if (temaBtn) {
                temaBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
            }
        }
        
        // Smooth transition için
        body.style.transition = 'background-color 0.3s ease, color 0.3s ease';
    }

    /**
     * Tema tercihini uygula (sayfa yüklendiğinde)
     */
    function temaTercihiniUygula() {
        const savedTheme = localStorage.getItem('soybis_theme');
        const body = document.body;
        const temaBtn = Helpers.$('#themeToggleBtn');
        
        if (savedTheme === 'light') {
            body.classList.add('light-mode');
            if (temaBtn) {
                temaBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
            }
        } else {
            // Varsayılan: Dark Mode
            body.classList.remove('light-mode');
            if (temaBtn) {
                temaBtn.innerHTML = '<i class="fa-solid fa-moon"></i>';
            }
        }
    }

    /**
     * Login overlay'i göster
     */
    function loginOverlayGoster() {
        const overlay = Helpers.$('#loginOverlay');
        if (overlay) {
            overlay.classList.remove('hidden');
            overlay.style.display = 'flex'; // CSS'deki display: flex'i aktif et
        }
        // App container'ı gizle
        const appContainer = Helpers.$('.app-container');
        if (appContainer) {
            appContainer.style.display = 'none';
        }
        // Splash screen'i gizle
        const splash = Helpers.$('#splashScreen');
        if (splash) {
            splash.style.display = 'none';
            splash.classList.add('hidden');
        }
    }

    /**
     * Login overlay'i gizle
     */
    function loginOverlayGizle() {
        const overlay = Helpers.$('#loginOverlay');
        if (overlay) {
            overlay.classList.add('hidden');
        }
        // App container'ı göster
        const appContainer = Helpers.$('.app-container');
        if (appContainer) {
            appContainer.style.display = 'flex';
        }
    }

    /**
     * Login form eventlerini bağla
     */
    function loginEventleri() {
        console.log('🔐 [App] Login eventleri bağlanıyor...');
        const loginForm = Helpers.$('#loginForm');
        if (!loginForm) {
            console.warn('⚠️ [App] Login form bulunamadı');
            return;
        }

        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            console.log('🔄 [App] Login form submit edildi');

            const kullaniciAdi = Helpers.$('#loginKullaniciAdi')?.value.trim();
            const sifre = Helpers.$('#loginSifre')?.value;

            const errorDiv = Helpers.$('#loginError');
            const errorText = Helpers.$('#loginErrorText');

            // Hata mesajını gizle
            if (errorDiv) errorDiv.style.display = 'none';

            if (!kullaniciAdi || !sifre) {
                console.warn('⚠️ [App] Login: Kullanıcı adı veya şifre boş');
                if (errorDiv && errorText) {
                    errorText.textContent = 'Lütfen kullanıcı adı ve şifre girin!';
                    errorDiv.style.display = 'flex';
                }
                return;
            }

            // Giriş yap
            console.log(`🔄 [App] Giriş yapılıyor... Kullanıcı: ${kullaniciAdi}`);
            const kullanici = await Auth.girisYap(kullaniciAdi, sifre);

            if (!kullanici) {
                console.warn('⚠️ [App] Giriş başarısız: Kullanıcı adı veya şifre hatalı');
                if (errorDiv && errorText) {
                    errorText.textContent = 'Kullanıcı adı veya şifre hatalı!';
                    errorDiv.style.display = 'flex';
                }
                // Şifre alanını temizle
                const sifreInput = Helpers.$('#loginSifre');
                if (sifreInput) sifreInput.value = '';
                return;
            }
            
            console.log(`✅ [App] Giriş başarılı! Kullanıcı: ${kullanici.adSoyad || kullanici.kullaniciAdi}, Rol: ${kullanici.rol}`);

            // Başarılı giriş - Önce splash screen'i göster
            loginOverlayGizle();
            splashScreenGoster();
            
            // App container'ı gizle (splash screen gösterilirken)
            const appContainer = Helpers.$('.app-container');
            if (appContainer) {
                appContainer.style.display = 'none';
            }
            
            kullaniciBilgileriniGoster();
            rolBazliMenuGizle();
            
            // Uygulamayı başlat
            try {
                // Eski verileri migrate et
                if (window.Storage && typeof Storage.veriMigration === 'function') {
                    Storage.veriMigration();
                }

                // Tarihi güncelle
                tarihiGuncelle();

                // Navigasyon eventlerini bağla
                navigasyonEventleri();

                // Modülleri başlat
                modulleriBaslat();

                // Ayarlar eventlerini bağla
                ayarlarEventleri();

                // Tema yönetimini başlat
                temaYonetimiBaslat();
                temaTercihiniUygula();

                // Keyboard shortcuts'ları bağla
                klavyeKisayollari();

                // Hamburger menü eventlerini bağla (Mobil)
                hamburgerMenuEventleri();

                // Rol bazlı varsayılan view'a yönlendir
                const kullaniciRolu = kullanici.rol;
                let varsayilanView = 'dashboard';
                if (kullaniciRolu === 'Antrenör') {
                    varsayilanView = 'sporcu-listesi';
                } else if (kullaniciRolu === 'Muhasebe') {
                    varsayilanView = 'dashboard';
                } else {
                    varsayilanView = 'dashboard';
                }
                
                viewGoster(varsayilanView, true);

                // Nav indicator pozisyonunu ayarla
                setTimeout(() => {
                    navIndicatorGuncelle(varsayilanView);
                }, 100);

                state.yuklendi = true;
                
                // Splash screen'i kapat ve app container'ı göster
                splashScreenKapat();
                setTimeout(() => {
                    const appContainer = Helpers.$('.app-container');
                    if (appContainer) {
                        appContainer.style.display = 'flex';
                        
                        // App container görünür olduktan sonra sidebar yönetimini başlat
                        // DOM hazır olduğundan emin olmak için biraz bekle
                        setTimeout(() => {
                            // Masaüstü sidebar yönetimi (varsayılan açık + tercih kaydı)
                            if (window.innerWidth >= 769) {
                                try {
                                    masaustuSidebarYonetimi();
                                } catch (e) {
                                    console.warn('Masaüstü sidebar yönetimi hatası:', e);
                                }
                            }
                        }, 100);
                    }
                }, 1800); // Splash screen animasyonu bitene kadar bekle

            } catch (error) {
                console.error('Uygulama başlatma hatası:', error);
                Helpers.toast('Uygulama başlatılırken hata oluştu!', 'error');
                // Hata durumunda da app container'ı göster
                const appContainer = Helpers.$('.app-container');
                if (appContainer) {
                    appContainer.style.display = 'flex';
                }
                splashScreenKapat();
            }
        });
    }

    /**
     * Kullanıcı bilgilerini header'da göster
     */
    function kullaniciBilgileriniGoster() {
        const kullanici = Auth.aktifKullanici();
        if (!kullanici) return;

        const userNameEl = Helpers.$('#userName');
        const userRoleBadgeEl = Helpers.$('#userRoleBadge');
        const headerUserEl = Helpers.$('#headerUser');
        const logoutBtn = Helpers.$('#logoutBtn');

        if (userNameEl) {
            userNameEl.textContent = kullanici.adSoyad || kullanici.kullaniciAdi || 'Sistem Yöneticisi';
        }

        if (userRoleBadgeEl) {
            userRoleBadgeEl.textContent = kullanici.rol || 'Yönetici';
        }

        if (headerUserEl) {
            headerUserEl.style.display = 'flex';
        }

        if (logoutBtn) {
            logoutBtn.style.display = 'flex';
        }
    }

    /**
     * Rol bazlı menü gizleme
     */
    function rolBazliMenuGizle() {
        const kullanici = Auth.aktifKullanici();
        if (!kullanici) return;

        const rol = kullanici.rol;
        const navButtons = Helpers.$$('#mainNav button[data-rol]');

        navButtons.forEach(btn => {
            const izinVerilenRoller = btn.getAttribute('data-rol');
            
            if (izinVerilenRoller === 'all') {
                // Tüm roller erişebilir
                btn.style.display = '';
            } else {
                // Belirli roller erişebilir
                const roller = izinVerilenRoller.split(',').map(r => r.trim());
                if (roller.includes(rol)) {
                    btn.style.display = '';
                } else {
                    btn.style.display = 'none';
                }
            }
        });

        // View'lara erişimi kontrol et
        viewYetkiKontrol();
    }

    /**
     * View erişim yetkisi kontrolü
     */
    function viewYetkiKontrol() {
        const kullanici = Auth.aktifKullanici();
        if (!kullanici) return;

        const rol = kullanici.rol;

        // Uluslararası RBAC normlarına göre view yetkileri
        const yetkiler = {
            'Yönetici': ['dashboard', 'sporcu-kayit', 'sporcu-listesi', 'aidat', 'yoklama', 'giderler', 'antrenorler', 'raporlar', 'ayarlar'],
            'Antrenör': ['sporcu-listesi', 'yoklama'], // Dashboard YOK - Finansal bilgiler içeriyor
            'Muhasebe': ['dashboard', 'aidat', 'giderler', 'raporlar'] // Finansal işlemler için dashboard gerekli
        };

        const izinliViewlar = yetkiler[rol] || [];

        // Tüm view'ları kontrol et
        const views = Helpers.$$('.view');
        views.forEach(view => {
            const viewId = view.id;
            if (!izinliViewlar.includes(viewId)) {
                // Erişim yok, view'ı gizle
                view.style.display = 'none';
            }
        });
    }

    /**
     * Ayarları güncelle
     */
    function ayarlariGuncelle() {
        const istatistikler = Storage.istatistikler();

        const sporcuEl = Helpers.$('#istatSporcu');
        const odemeEl = Helpers.$('#istatOdeme');
        const yoklamaEl = Helpers.$('#istatYoklama');
        const giderEl = Helpers.$('#istatGider');
        const depolamaEl = Helpers.$('#istatDepolama');

        if (sporcuEl) sporcuEl.textContent = istatistikler.sporcuSayisi;
        if (odemeEl) odemeEl.textContent = istatistikler.odemeSayisi;
        if (yoklamaEl) yoklamaEl.textContent = istatistikler.yoklamaSayisi;
        if (giderEl) giderEl.textContent = istatistikler.giderSayisi;
        if (depolamaEl) depolamaEl.textContent = istatistikler.depolamaKB + ' KB';
        
        // Hatırlatma ayarlarını göster
        hatirlatmaAyarlariGoster();
    }
    
    /**
     * Hatırlatma ayarlarını göster - Profesyonel Panel
     */
    function hatirlatmaAyarlariGoster() {
        const container = Helpers.$('#notificationSettings');
        if (!container) {
            console.warn('Hatırlatma ayarları container bulunamadı');
            return;
        }
        
        if (!window.Notification) {
            container.innerHTML = '<div class="empty-state"><i class="fa-solid fa-exclamation-triangle"></i><p>Bildirim modülü yüklenemedi</p></div>';
            return;
        }
        
        // Güncel ayarları al (her seferinde fresh data)
        let ayarlar;
        try {
            ayarlar = Notification.ayarlariGetir();
        } catch (error) {
            console.error('Ayarlar alınamadı:', error);
            container.innerHTML = '<div class="empty-state"><i class="fa-solid fa-exclamation-triangle"></i><p>Ayarlar yüklenemedi</p></div>';
            return;
        }
        
        if (!ayarlar) {
            container.innerHTML = '<div class="empty-state"><i class="fa-solid fa-exclamation-triangle"></i><p>Ayarlar bulunamadı</p></div>';
            return;
        }
        
        container.innerHTML = `
            <!-- Ana Toggle - Kompakt -->
            <div class="notification-compact-toggle">
                <div class="notification-compact-toggle-content">
                    <span class="notification-compact-label">Hatırlatma Sistemi</span>
                    <span class="notification-compact-desc">Otomatik hatırlatmaları aktifleştir</span>
                </div>
                <label class="toggle-switch">
                    <input type="checkbox" id="notificationEnabled" ${ayarlar.enabled ? 'checked' : ''} 
                           onchange="if(window.Notification) Notification.ayarlariGuncelle({enabled: this.checked});">
                    <span class="toggle-slider"></span>
                </label>
            </div>
            
            <!-- Bildirim Yöntemleri -->
            <div class="notification-compact-section">
                <h5 class="notification-compact-section-title">
                    <i class="fa-solid fa-paper-plane"></i>
                    Bildirim Kanalları
                </h5>
                <div class="notification-methods-grid-compact">
                    <div class="notification-method-compact ${ayarlar.methods.sms ? 'active' : ''}">
                        <div class="notification-method-icon-compact sms">
                            <i class="fa-solid fa-sms"></i>
                        </div>
                        <span class="notification-method-name-compact">SMS</span>
                        <label class="toggle-switch-small">
                            <input type="checkbox" ${ayarlar.methods.sms ? 'checked' : ''} 
                                   onchange="if(window.Notification) Notification.ayarlariGuncelle({methods: {sms: this.checked}});">
                            <span class="toggle-slider-small"></span>
                        </label>
                    </div>
                    
                    <div class="notification-method-compact ${ayarlar.methods.email ? 'active' : ''}">
                        <div class="notification-method-icon-compact email">
                            <i class="fa-solid fa-envelope"></i>
                        </div>
                        <span class="notification-method-name-compact">E-posta</span>
                        <label class="toggle-switch-small">
                            <input type="checkbox" ${ayarlar.methods.email ? 'checked' : ''} 
                                   onchange="if(window.Notification) Notification.ayarlariGuncelle({methods: {email: this.checked}});">
                            <span class="toggle-slider-small"></span>
                        </label>
                    </div>
                    
                    <div class="notification-method-compact ${ayarlar.methods.whatsapp ? 'active' : ''}">
                        <div class="notification-method-icon-compact whatsapp">
                            <i class="fa-brands fa-whatsapp"></i>
                        </div>
                        <span class="notification-method-name-compact">WhatsApp</span>
                        <label class="toggle-switch-small">
                            <input type="checkbox" ${ayarlar.methods.whatsapp ? 'checked' : ''} 
                                   onchange="if(window.Notification) Notification.ayarlariGuncelle({methods: {whatsapp: this.checked}});">
                            <span class="toggle-slider-small"></span>
                        </label>
                    </div>
                    
                    <div class="notification-method-compact ${ayarlar.methods.inApp ? 'active' : ''}">
                        <div class="notification-method-icon-compact inapp">
                            <i class="fa-solid fa-bell"></i>
                        </div>
                        <span class="notification-method-name-compact">Uygulama İçi</span>
                        <label class="toggle-switch-small">
                            <input type="checkbox" ${ayarlar.methods.inApp ? 'checked' : ''} 
                                   onchange="if(window.Notification) Notification.ayarlariGuncelle({methods: {inApp: this.checked}});">
                            <span class="toggle-slider-small"></span>
                        </label>
                    </div>
                </div>
            </div>
            
            <!-- Zamanlama Ayarları - Kompakt -->
            <div class="notification-compact-section">
                <h5 class="notification-compact-section-title">
                    <i class="fa-solid fa-clock"></i>
                    Zamanlama
                </h5>
                <div class="notification-timing-grid-compact">
                    <div class="notification-timing-compact">
                        <div class="notification-timing-icon-compact">
                            <i class="fa-solid fa-calendar-minus"></i>
                        </div>
                        <div class="notification-timing-content-compact">
                            <label class="notification-timing-label-compact">Önceden Hatırlat</label>
                            <div class="notification-timing-input-compact">
                                <input type="number" id="notifDaysBefore" min="0" max="30" value="${ayarlar.timing.daysBefore}" 
                                       class="notification-number-input-compact"
                                       onchange="if(window.Notification) Notification.ayarlariGuncelle({timing: {daysBefore: parseInt(this.value) || 0}});">
                                <span class="notification-timing-unit-compact">gün</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="notification-timing-compact">
                        <div class="notification-timing-icon-compact today">
                            <i class="fa-solid fa-calendar-day"></i>
                        </div>
                        <div class="notification-timing-content-compact">
                            <label class="notification-timing-label-compact">Ödeme Günü</label>
                            <label class="toggle-switch-small">
                                <input type="checkbox" id="notifOnDueDate" ${ayarlar.timing.onDueDate ? 'checked' : ''}
                                       onchange="if(window.Notification) Notification.ayarlariGuncelle({timing: {onDueDate: this.checked}});">
                                <span class="toggle-slider-small"></span>
                            </label>
                        </div>
                    </div>
                    
                    <div class="notification-timing-compact">
                        <div class="notification-timing-icon-compact warning">
                            <i class="fa-solid fa-calendar-xmark"></i>
                        </div>
                        <div class="notification-timing-content-compact">
                            <label class="notification-timing-label-compact">Gecikme Hatırlatması</label>
                            <div class="notification-timing-input-compact">
                                <input type="number" id="notifDaysAfter" min="0" max="30" value="${ayarlar.timing.daysAfter}" 
                                       class="notification-number-input-compact"
                                       onchange="if(window.Notification) Notification.ayarlariGuncelle({timing: {daysAfter: parseInt(this.value) || 0}});">
                                <span class="notification-timing-unit-compact">gün</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Toast mesajı göster (ayar değişikliği sonrası)
        try {
            if (window.Helpers && typeof Helpers.toast === 'function') {
                // Sessizce güncelle, toast gösterme (kullanıcı zaten değişikliği görüyor)
            }
        } catch (e) {
            // Toast gösterilemezse sessizce devam et
        }
    }

    /**
     * Tüm modülleri güncelle
     */
    function tumunuGuncelle() {
        if (window.Dashboard) Dashboard.guncelle();
        if (window.Sporcu) Sporcu.listeyiGuncelle();
        if (window.Aidat) Aidat.listeyiGuncelle();
        if (window.Yoklama) Yoklama.listeyiGuncelle();
        if (window.Gider) Gider.listeyiGuncelle();
        if (window.Rapor) Rapor.guncelle();
    }

    /**
     * Aktif view'u getir
     * @returns {string} Aktif view ID
     */
    function aktifViewGetir() {
        return state.aktifView;
    }

    /**
     * Uygulama yüklendi mi?
     * @returns {boolean}
     */
    function yuklendiMi() {
        return state.yuklendi;
    }

    /**
     * Mobil menü kontrolü - sadece mobilde çalışmalı
     */
    function isMobile() {
        return window.innerWidth < 769;
    }
    
    /**
     * Hamburger menü eventlerini bağla (Mobile)
     */
    function hamburgerMenuEventleri() {
        const hamburgerBtn = Helpers.$('#hamburgerBtn');
        const sidebar = Helpers.$('#sidebar');
        const overlay = Helpers.$('#mobileMenuOverlay');
        const closeBtn = Helpers.$('#sidebarCloseBtn');
        
        if (!hamburgerBtn || !sidebar || !overlay) return;
        
        // Hamburger butonuna tıklama
        if (hamburgerBtn) {
            hamburgerBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                // Sadece mobilde çalış
                if (isMobile()) {
                    toggleMobileMenu();
                }
            });
        }
        
        // Close butonuna tıklama
        if (closeBtn) {
            closeBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                // Sadece mobilde çalış
                if (isMobile()) {
                    closeMobileMenu();
                }
            });
        }
        
        // Overlay'e tıklayınca menüyü kapat
        if (overlay) {
            overlay.addEventListener('click', function() {
                // Sadece mobilde çalış
                if (isMobile()) {
                    closeMobileMenu();
                }
            });
        }
        
        // ESC tuşu ile menüyü kapat (sadece mobilde)
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && isMobile() && sidebar.classList.contains('open')) {
                closeMobileMenu();
            }
        });
        
        // Nav butonlarına tıklandığında menüyü kapat (SADECE MOBİLDE)
        const navButtons = Helpers.$$('#mainNav button');
        navButtons.forEach(btn => {
            btn.addEventListener('click', function() {
                // Sadece mobilde menüyü kapat, masaüstünde sidebar açık kalmalı
                if (isMobile()) {
                    closeMobileMenu();
                }
            });
        });
        
        // Swipe gesture (sol kenardan sağa çekince aç) - sadece mobilde
        let touchStartX = 0;
        let touchEndX = 0;
        
        document.addEventListener('touchstart', function(e) {
            if (!isMobile()) return;
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });
        
        document.addEventListener('touchend', function(e) {
            if (!isMobile()) return;
            touchEndX = e.changedTouches[0].screenX;
            handleSwipeGesture();
        }, { passive: true });
        
        function handleSwipeGesture() {
            if (!isMobile()) return;
            
            const swipeThreshold = 80;
            const swipeDistance = touchEndX - touchStartX;
            
            // Sol kenardan sağa swipe (menü kapalıyken)
            if (touchStartX < 30 && swipeDistance > swipeThreshold && !sidebar.classList.contains('open')) {
                openMobileMenu();
            }
            
            // Sağdan sola swipe (menü açıkken)
            if (swipeDistance < -swipeThreshold && sidebar.classList.contains('open')) {
                closeMobileMenu();
            }
        }
    }
    
    /**
     * Mobil menüyü aç/kapat
     */
    function toggleMobileMenu() {
        // Sadece mobilde çalış
        if (!isMobile()) return;
        
        const hamburgerBtn = Helpers.$('#hamburgerBtn');
        const sidebar = Helpers.$('#sidebar');
        const overlay = Helpers.$('#mobileMenuOverlay');
        
        if (!hamburgerBtn || !sidebar || !overlay) return;
        
        const isOpen = sidebar.classList.contains('open');
        
        if (isOpen) {
            closeMobileMenu();
        } else {
            openMobileMenu();
        }
    }
    
    /**
     * Mobil menüyü aç
     */
    function openMobileMenu() {
        // Sadece mobilde çalış
        if (!isMobile()) return;
        
        const fabBtn = Helpers.$('#hamburgerBtn');
        const sidebar = Helpers.$('#sidebar');
        const overlay = Helpers.$('#mobileMenuOverlay');
        
        if (!fabBtn || !sidebar || !overlay) return;
        
        // Masaüstü class'larını temizle (çakışmayı önle)
        sidebar.classList.remove('sidebar-closed');
        
        fabBtn.classList.add('active');
        fabBtn.setAttribute('aria-expanded', 'true');
        sidebar.classList.add('open');
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden'; // Arka plan scroll'unu engelle
    }
    
    /**
     * Mobil menüyü kapat
     */
    function closeMobileMenu() {
        // Sadece mobilde çalış
        if (!isMobile()) return;
        
        const fabBtn = Helpers.$('#hamburgerBtn');
        const sidebar = Helpers.$('#sidebar');
        const overlay = Helpers.$('#mobileMenuOverlay');
        
        if (!fabBtn || !sidebar || !overlay) return;
        
        fabBtn.classList.remove('active');
        fabBtn.setAttribute('aria-expanded', 'false');
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
        document.body.style.overflow = ''; // Scroll'u geri aç
    }
    
    /**
     * Masaüstü Sidebar Yönetimi
     * - Varsayılan açık
     * - Hamburger ile kapatılabilir
     * - Tercih localStorage'da saklanır
     */
    function masaustuSidebarYonetimi() {
        const sidebar = Helpers.$('#sidebar');
        
        if (!sidebar) {
            // Sidebar bulunamazsa kısa bir süre sonra tekrar dene (DOM henüz hazır olmayabilir)
            setTimeout(() => {
                masaustuSidebarYonetimi();
            }, 200);
            return;
        }
        
        const desktopSidebarToggle = Helpers.$('#desktopSidebarToggle'); // Sidebar içindeki buton
        const desktopMenuToggle = Helpers.$('#desktopMenuToggle'); // Floating buton
        
        // localStorage'dan tercih oku
        const sidebarPref = localStorage.getItem('sidebarOpen');
        const shouldBeOpen = sidebarPref === null ? true : sidebarPref === 'true'; // Varsayılan: açık
        
        // Tercihi uygula
        if (shouldBeOpen) {
            sidebar.classList.remove('sidebar-closed');
        } else {
            sidebar.classList.add('sidebar-closed');
        }
        
        // Event listener'ları sadece bir kez bağla (çift bağlantı önleme)
        // Sidebar içindeki toggle butonu (açıkken görünür)
        if (desktopSidebarToggle && !desktopSidebarToggle.hasAttribute('data-sidebar-listener')) {
            desktopSidebarToggle.setAttribute('data-sidebar-listener', 'true');
            desktopSidebarToggle.addEventListener('click', function(e) {
                e.stopPropagation();
                toggleDesktopSidebar();
            });
        }
        
        // Floating toggle butonu (kapalıyken görünür)
        if (desktopMenuToggle && !desktopMenuToggle.hasAttribute('data-menu-listener')) {
            desktopMenuToggle.setAttribute('data-menu-listener', 'true');
            desktopMenuToggle.addEventListener('click', function(e) {
                e.stopPropagation();
                toggleDesktopSidebar();
            });
        }
        
        // Pencere boyutu değiştiğinde kontrol et (masaüstü/mobil geçişi)
        let resizeTimer;
        window.addEventListener('resize', function() {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function() {
                if (window.innerWidth >= 769) {
                    // Masaüstüne geçiş - mobil menüyü kapat ve tercihi uygula
                    const fabBtn = Helpers.$('#hamburgerBtn');
                    const overlay = Helpers.$('#mobileMenuOverlay');
                    
                    // Mobil menü state'ini temizle
                    if (fabBtn) {
                        fabBtn.classList.remove('active');
                        fabBtn.setAttribute('aria-expanded', 'false');
                    }
                    if (overlay) {
                        overlay.classList.remove('active');
                    }
                    sidebar.classList.remove('open');
                    document.body.style.overflow = '';
                    
                    // Masaüstü tercihini uygula
                    const pref = localStorage.getItem('sidebarOpen');
                    const open = pref === null ? true : pref === 'true';
                    if (open) {
                        sidebar.classList.remove('sidebar-closed');
                    } else {
                        sidebar.classList.add('sidebar-closed');
                    }
                } else {
                    // Mobil'e geçiş - masaüstü state'ini temizle ve mobil menüyü kapat
                    sidebar.classList.remove('sidebar-closed');
                    closeMobileMenu(); // Mobil menüyü de kapat
                }
            }, 100);
        });
    }
    
    /**
     * Masaüstü sidebar'ı aç/kapat
     */
    function toggleDesktopSidebar() {
        const sidebar = Helpers.$('#sidebar');
        if (!sidebar) return;
        
        const isClosed = sidebar.classList.contains('sidebar-closed');
        
        if (isClosed) {
            // Aç
            sidebar.classList.remove('sidebar-closed');
            localStorage.setItem('sidebarOpen', 'true');
        } else {
            // Kapat
            sidebar.classList.add('sidebar-closed');
            localStorage.setItem('sidebarOpen', 'false');
        }
    }

    // Public API
    return {
        init,
        viewGoster,
        tumunuGuncelle,
        aktifViewGetir,
        yuklendiMi,
        hatirlatmaAyarlariGoster,
        rolBazliMenuGizle,
        kullaniciBilgileriniGoster,
        toggleMobileMenu,
        openMobileMenu,
        closeMobileMenu,
        toggleDesktopSidebar,
        masaustuSidebarYonetimi,
        isMobile
    };
})();

// Logo yükleme hatalarını kontrol et ve düzelt
function logolariKontrolEt() {
    try {
        const logolar = document.querySelectorAll('img[src*="logo"]');
        if (!logolar || logolar.length === 0) return;
        
        logolar.forEach(img => {
            if (!img) return;
            
            img.addEventListener('error', function() {
                try {
                    // Logo yüklenemezse gizle ve stil düzenle
                    if (this) {
                        this.style.display = 'none';
                        // Yanındaki başlık için margin düzenle
                        const nextSibling = this.nextElementSibling;
                        if (nextSibling && nextSibling.tagName === 'H1') {
                            nextSibling.style.marginTop = '0';
                        }
                    }
                } catch (e) {
                    console.warn('Logo error handler hatası:', e);
                }
            });
            
            // Logo yüklendiğinde kontrol et
            img.addEventListener('load', function() {
                try {
                    if (this) {
                        this.style.display = '';
                    }
                } catch (e) {
                    console.warn('Logo load handler hatası:', e);
                }
            });
        });
    } catch (e) {
        console.warn('Logo kontrol hatası:', e);
    }
}

// DOM yüklendiğinde uygulamayı başlat
document.addEventListener('DOMContentLoaded', function() {
    logolariKontrolEt();
    App.init();
});

// Global erişim
window.App = App;

// Sayfa kapanmadan önce uyarı (opsiyonel)
// window.addEventListener('beforeunload', function(e) {
//     if (App.yuklendiMi()) {
//         e.preventDefault();
//         e.returnValue = '';
//     }
// });



