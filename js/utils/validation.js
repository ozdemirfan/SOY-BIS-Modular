/**
 * SOY-BIS - Doğrulama Fonksiyonları (validation.js)
 * Form ve veri doğrulama işlemleri
 */

const Validation = (function() {
    'use strict';

    /**
     * TC Kimlik No doğrulama (Algoritma kontrolü)
     * @param {string} tc - TC Kimlik No
     * @returns {Object} {valid: boolean, message: string}
     */
    function tcKimlikDogrula(tc) {
        // Temel kontroller
        if (!tc) {
            return { valid: true, message: '' }; // Opsiyonel: boşsa geç
        }

        tc = tc.toString().trim();

        if (tc.length !== 11) {
            return { valid: false, message: 'TC Kimlik No 11 haneli olmalıdır.' };
        }

        if (!/^\d{11}$/.test(tc)) {
            return { valid: false, message: 'TC Kimlik No sadece rakamlardan oluşmalıdır.' };
        }

        if (tc[0] === '0') {
            return { valid: false, message: 'TC Kimlik No 0 ile başlayamaz.' };
        }

        // TC Kimlik algoritma kontrolü
        const digits = tc.split('').map(Number);
        
        // 1, 3, 5, 7, 9. hanelerin toplamının 7 katından
        // 2, 4, 6, 8. hanelerin toplamı çıkarılır
        // Sonuç 10'a bölümünden kalan 10. haneyi verir
        const tekler = digits[0] + digits[2] + digits[4] + digits[6] + digits[8];
        const ciftler = digits[1] + digits[3] + digits[5] + digits[7];
        const onuncuHane = ((tekler * 7) - ciftler) % 10;
        
        if (onuncuHane < 0) {
            const pozitifOnuncu = (onuncuHane + 10) % 10;
            if (pozitifOnuncu !== digits[9]) {
                return { valid: false, message: 'Geçersiz TC Kimlik No.' };
            }
        } else if (onuncuHane !== digits[9]) {
            return { valid: false, message: 'Geçersiz TC Kimlik No.' };
        }

        // İlk 10 hanenin toplamının 10'a bölümünden kalan 11. haneyi verir
        const ilkOnToplam = digits.slice(0, 10).reduce((a, b) => a + b, 0);
        if (ilkOnToplam % 10 !== digits[10]) {
            return { valid: false, message: 'Geçersiz TC Kimlik No.' };
        }

        return { valid: true, message: '' };
    }

    /**
     * E-posta doğrulama
     * @param {string} email - E-posta adresi
     * @returns {Object} {valid: boolean, message: string}
     */
    function emailDogrula(email) {
        console.log('📧 [Validation] Email doğrulama:', email);
        
        if (!email) {
            console.log('✅ [Validation] Email boş, opsiyonel - geçerli');
            return { valid: true, message: '' }; // Opsiyonel alan
        }

        email = email.trim().toLowerCase();
        console.log('🔍 [Validation] Temizlenmiş email:', email);

        // Temel regex kontrolü
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        
        if (!emailRegex.test(email)) {
            console.log('❌ [Validation] Regex testi başarısız');
            return { valid: false, message: 'Geçerli bir e-posta adresi giriniz.' };
        }

        // Daha detaylı kontroller
        const parts = email.split('@');
        if (parts[0].length < 1 || parts[1].length < 3) {
            console.log('❌ [Validation] Parts uzunluk kontrolü başarısız');
            return { valid: false, message: 'Geçerli bir e-posta adresi giriniz.' };
        }

        // Domain kontrolü
        const domain = parts[1];
        console.log('🌐 [Validation] Domain kontrol:', domain);
        
        if (!domain.includes('.') || domain.startsWith('.') || domain.endsWith('.')) {
            console.log('❌ [Validation] Domain format kontrolü başarısız');
            return { valid: false, message: 'Geçerli bir e-posta adresi giriniz.' };
        }

        // Özel domain kontrolleri (hotmail, gmail, vs.)
        const commonDomains = ['hotmail.com', 'hotmail.co.uk', 'outlook.com', 'gmail.com', 'yahoo.com', 'yandex.com'];
        const isCommonDomain = commonDomains.includes(domain);
        
        console.log('✅ [Validation] Email geçerli:', { 
            email: email, 
            domain: domain, 
            isCommonDomain: isCommonDomain 
        });

        return { valid: true, message: '' };
    }
    
    /**
     * Email validation test fonksiyonu
     * @param {string} testEmail - Test edilecek email
     */
    function testEmailValidation(testEmail) {
        console.log('🧪 [Validation Test] Email test başlatılıyor:', testEmail);
        const result = emailDogrula(testEmail);
        console.log('🧪 [Validation Test] Sonuç:', result);
        return result;
    }

    /**
     * Telefon numarası doğrulama (Türkiye formatı)
     * @param {string} telefon - Telefon numarası
     * @returns {Object} {valid: boolean, message: string, formatted: string}
     */
    function telefonDogrula(telefon) {
        if (!telefon) {
            return { valid: false, message: 'Telefon numarası boş olamaz.', formatted: '' };
        }

        // Sadece rakamları al
        let temiz = telefon.replace(/\D/g, '');

        // Başında 0 varsa kaldır
        if (temiz.startsWith('0')) {
            temiz = temiz.substring(1);
        }

        // +90 veya 90 ile başlıyorsa kaldır
        if (temiz.startsWith('90') && temiz.length > 10) {
            temiz = temiz.substring(2);
        }

        // 10 hane olmalı
        if (temiz.length !== 10) {
            return { 
                valid: false, 
                message: 'Telefon numarası 10 haneli olmalıdır (5XX XXX XX XX).', 
                formatted: temiz 
            };
        }

        // 5 ile başlamalı (cep telefonu)
        if (!temiz.startsWith('5')) {
            return { 
                valid: false, 
                message: 'Geçerli bir cep telefonu numarası giriniz (5XX ile başlamalı).', 
                formatted: temiz 
            };
        }

        // Formatlanmış hali
        const formatted = temiz.replace(/(\d{3})(\d{3})(\d{2})(\d{2})/, '$1 $2 $3 $4');

        return { valid: true, message: '', formatted: temiz };
    }

    /**
     * Ad Soyad doğrulama
     * @param {string} adSoyad - Ad Soyad
     * @returns {Object} {valid: boolean, message: string}
     */
    function adSoyadDogrula(adSoyad) {
        if (!adSoyad) {
            return { valid: false, message: 'Ad Soyad boş olamaz.' };
        }

        adSoyad = adSoyad.trim();

        if (adSoyad.length < 3) {
            return { valid: false, message: 'Ad Soyad en az 3 karakter olmalıdır.' };
        }

        if (adSoyad.length > 100) {
            return { valid: false, message: 'Ad Soyad en fazla 100 karakter olabilir.' };
        }

        // Sadece harf ve boşluk içermeli
        const adRegex = /^[a-zA-ZçÇğĞıİöÖşŞüÜ\s]+$/;
        if (!adRegex.test(adSoyad)) {
            return { valid: false, message: 'Ad Soyad sadece harf ve boşluk içermelidir.' };
        }

        // En az iki kelime olmalı
        const kelimeler = adSoyad.split(/\s+/).filter(k => k.length > 0);
        if (kelimeler.length < 2) {
            return { valid: false, message: 'Lütfen ad ve soyad giriniz.' };
        }

        return { valid: true, message: '' };
    }

    /**
     * Tarih doğrulama
     * @param {string} tarih - Tarih (YYYY-MM-DD)
     * @param {Object} options - Seçenekler
     * @returns {Object} {valid: boolean, message: string}
     */
    function tarihDogrula(tarih, options = {}) {
        const { 
            required = false, 
            minYas = null, 
            maxYas = null,
            minTarih = null,
            maxTarih = null
        } = options;

        if (!tarih) {
            if (required) {
                return { valid: false, message: 'Tarih boş olamaz.' };
            }
            return { valid: true, message: '' };
        }

        const date = new Date(tarih);
        if (isNaN(date.getTime())) {
            return { valid: false, message: 'Geçerli bir tarih giriniz.' };
        }

        const bugun = new Date();
        bugun.setHours(0, 0, 0, 0);

        // Yaş kontrolü
        if (minYas !== null || maxYas !== null) {
            const yas = Helpers.yasHesapla(tarih);
            
            if (minYas !== null && yas < minYas) {
                return { valid: false, message: `Yaş en az ${minYas} olmalıdır.` };
            }
            
            if (maxYas !== null && yas > maxYas) {
                return { valid: false, message: `Yaş en fazla ${maxYas} olmalıdır.` };
            }
        }

        // Min tarih kontrolü
        if (minTarih !== null) {
            const min = new Date(minTarih);
            if (date < min) {
                return { valid: false, message: `Tarih ${Helpers.tarihFormat(minTarih)} tarihinden sonra olmalıdır.` };
            }
        }

        // Max tarih kontrolü
        if (maxTarih !== null) {
            const max = new Date(maxTarih);
            if (date > max) {
                return { valid: false, message: `Tarih ${Helpers.tarihFormat(maxTarih)} tarihinden önce olmalıdır.` };
            }
        }

        return { valid: true, message: '' };
    }

    /**
     * Sayı doğrulama
     * @param {string|number} deger - Değer
     * @param {Object} options - Seçenekler
     * @returns {Object} {valid: boolean, message: string, value: number}
     */
    function sayiDogrula(deger, options = {}) {
        const {
            required = false,
            min = null,
            max = null,
            integer = false,
            fieldName = 'Değer'
        } = options;

        if (deger === null || deger === undefined || deger === '') {
            if (required) {
                return { valid: false, message: `${fieldName} boş olamaz.`, value: 0 };
            }
            return { valid: true, message: '', value: 0 };
        }

        // String ise temizle ve sayıya çevir
        let num = typeof deger === 'string' 
            ? parseFloat(deger.replace(/\./g, '').replace(',', '.'))
            : deger;

        if (isNaN(num)) {
            return { valid: false, message: `${fieldName} geçerli bir sayı olmalıdır.`, value: 0 };
        }

        if (integer && !Number.isInteger(num)) {
            return { valid: false, message: `${fieldName} tam sayı olmalıdır.`, value: num };
        }

        if (min !== null && num < min) {
            return { valid: false, message: `${fieldName} en az ${min} olmalıdır.`, value: num };
        }

        if (max !== null && num > max) {
            return { valid: false, message: `${fieldName} en fazla ${max} olmalıdır.`, value: num };
        }

        return { valid: true, message: '', value: num };
    }

    /**
     * Gerekli alan kontrolü
     * @param {*} deger - Değer
     * @param {string} fieldName - Alan adı
     * @returns {Object} {valid: boolean, message: string}
     */
    function gerekliAlan(deger, fieldName = 'Bu alan') {
        if (deger === null || deger === undefined || deger === '' || 
            (typeof deger === 'string' && deger.trim() === '')) {
            return { valid: false, message: `${fieldName} boş olamaz.` };
        }
        return { valid: true, message: '' };
    }

    /**
     * Sporcu form doğrulama
     * @param {Object} formData - Form verileri
     * @returns {Object} {valid: boolean, errors: Object}
     */
    function sporcuFormDogrula(formData) {
        const errors = {};
        let valid = true;

        // Ad Soyad
        const adSoyadResult = adSoyadDogrula(formData.adSoyad);
        if (!adSoyadResult.valid) {
            errors.adSoyad = adSoyadResult.message;
            valid = false;
        }

        // TC Kimlik (opsiyonel)
        if (formData.tcKimlik) {
        const tcResult = tcKimlikDogrula(formData.tcKimlik);
        if (!tcResult.valid) {
            errors.tcKimlik = tcResult.message;
            valid = false;
            }
        }

        // Doğum Tarihi
        const tarihResult = tarihDogrula(formData.dogumTarihi, { 
            required: true, 
            minYas: 3, 
            maxYas: 100 
        });
        if (!tarihResult.valid) {
            errors.dogumTarihi = tarihResult.message;
            valid = false;
        }

        // Cinsiyet
        const cinsiyetResult = gerekliAlan(formData.cinsiyet, 'Cinsiyet');
        if (!cinsiyetResult.valid) {
            errors.cinsiyet = cinsiyetResult.message;
            valid = false;
        }

        // Branş
        const bransResult = gerekliAlan(formData.brans, 'Branş');
        if (!bransResult.valid) {
            errors.brans = bransResult.message;
            valid = false;
        }

        // Telefon
        const telefonResult = telefonDogrula(formData.telefon);
        if (!telefonResult.valid) {
            errors.telefon = telefonResult.message;
            valid = false;
        }

        // E-posta (opsiyonel)
        if (formData.email) {
            const emailResult = emailDogrula(formData.email);
            if (!emailResult.valid) {
                errors.email = emailResult.message;
                valid = false;
            }
        }

        // Veli 1 Ad
        const veli1AdResult = gerekliAlan(formData.veli1Ad, 'Veli Ad Soyad');
        if (!veli1AdResult.valid) {
            errors.veli1Ad = veli1AdResult.message;
            valid = false;
        }

        // Veli 1 Telefon
        const veli1TelResult = telefonDogrula(formData.veli1Tel);
        if (!veli1TelResult.valid) {
            errors.veli1Tel = veli1TelResult.message;
            valid = false;
        }

        // Veli 1 Yakınlık
        const veli1YakinlikResult = gerekliAlan(formData.veli1Yakinlik, 'Veli Yakınlık');
        if (!veli1YakinlikResult.valid) {
            errors.veli1Yakinlik = veli1YakinlikResult.message;
            valid = false;
        }

        // Aylık Ücret (burslu değilse)
        if (formData.bursDurumu !== 'burslu') {
            const ucretResult = sayiDogrula(formData.aylikUcret, {
                required: true,
                min: 0,
                fieldName: 'Aylık Ücret'
            });
            if (!ucretResult.valid) {
                errors.aylikUcret = ucretResult.message;
                valid = false;
            }
        }

        return { valid, errors };
    }

    /**
     * Form hatalarını göster
     * @param {Object} errors - Hata objesi
     */
    function hatalariGoster(errors) {
        // Önceki hataları temizle
        document.querySelectorAll('.error-text').forEach(el => el.textContent = '');
        document.querySelectorAll('input.error, select.error, textarea.error').forEach(el => {
            el.classList.remove('error');
        });

        // Yeni hataları göster
        for (const [field, message] of Object.entries(errors)) {
            const errorEl = document.getElementById(`${field}Error`);
            const inputEl = document.getElementById(field);
            
            if (errorEl) {
                errorEl.textContent = message;
            }
            
            if (inputEl) {
                inputEl.classList.add('error');
            }
        }
    }

    /**
     * Hataları temizle
     */
    function hatalariTemizle() {
        document.querySelectorAll('.error-text').forEach(el => el.textContent = '');
        document.querySelectorAll('input.error, select.error, textarea.error').forEach(el => {
            el.classList.remove('error');
        });
    }

    // Public API
    return {
        tcKimlikDogrula,
        emailDogrula,
        telefonDogrula,
        adSoyadDogrula,
        tarihDogrula,
        sayiDogrula,
        gerekliAlan,
        sporcuFormDogrula,
        hatalariGoster,
        hatalariTemizle,
        testEmailValidation
    };
})();

// Global erişim
window.Validation = Validation;
