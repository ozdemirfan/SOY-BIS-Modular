/**
 * SOY-BIS - Doğrulama Fonksiyonları (validation.ts)
 * Form ve veri doğrulama işlemleri - TypeScript Version
 */

import { yasHesapla, tarihFormat } from './helpers';

// Validation result interfaces
interface ValidationResult {
  valid: boolean;
  message: string;
}

interface TelefonValidationResult extends ValidationResult {
  formatted: string;
}

interface SayiValidationResult extends ValidationResult {
  value: number;
}

interface TarihValidationOptions {
  required?: boolean;
  minYas?: number | null;
  maxYas?: number | null;
  minTarih?: string | null;
  maxTarih?: string | null;
}

interface SayiValidationOptions {
  required?: boolean;
  min?: number | null;
  max?: number | null;
  integer?: boolean;
  fieldName?: string;
}

interface SporcuFormData {
  adSoyad?: string;
  tcKimlik?: string;
  dogumTarihi?: string;
  cinsiyet?: string;
  brans?: string;
  telefon?: string;
  email?: string;
  veli1Ad?: string;
  veli1Tel?: string;
  veli1Yakinlik?: string;
  bursDurumu?: string;
  aylikUcret?: string | number;
}

interface ValidationErrors {
  [key: string]: string;
}

interface FormValidationResult {
  valid: boolean;
  errors: ValidationErrors;
}

/**
 * TC Kimlik No doğrulama (Algoritma kontrolü)
 */
export function tcKimlikDogrula(tc: string | null | undefined): ValidationResult {
  // Temel kontroller
  if (!tc) {
    return { valid: false, message: 'TC Kimlik No boş olamaz.' };
  }

  const tcStr = tc.toString().trim();

  if (tcStr.length !== 11) {
    return { valid: false, message: 'TC Kimlik No 11 haneli olmalıdır.' };
  }

  if (!/^\d{11}$/.test(tcStr)) {
    return { valid: false, message: 'TC Kimlik No sadece rakamlardan oluşmalıdır.' };
  }

  if (tcStr[0] === '0') {
    return { valid: false, message: 'TC Kimlik No 0 ile başlayamaz.' };
  }

  // TC Kimlik algoritma kontrolü
  const digits = tcStr.split('').map(Number);

  // 1, 3, 5, 7, 9. hanelerin toplamının 7 katından
  // 2, 4, 6, 8. hanelerin toplamı çıkarılır
  // Sonuç 10'a bölümünden kalan 10. haneyi verir
  const tekler =
    (digits[0] || 0) + (digits[2] || 0) + (digits[4] || 0) + (digits[6] || 0) + (digits[8] || 0);
  const ciftler = (digits[1] || 0) + (digits[3] || 0) + (digits[5] || 0) + (digits[7] || 0);
  const onuncuHane = (tekler * 7 - ciftler) % 10;

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
 */
export function emailDogrula(email: string | null | undefined): ValidationResult {
  if (!email) {
    return { valid: true, message: '' }; // Opsiyonel alan
  }

  // XSS/Script kontrolü - zararlı içerik engelleme
  const scriptPattern =
    /<\s*script|<\s*\/\s*script|javascript:|on\w+\s*=|<\s*iframe|<\s*object|<\s*embed/i;
  if (scriptPattern.test(email)) {
    return { valid: false, message: 'Geçersiz karakterler içeriyor!' };
  }

  // HTML tag kontrolü
  const htmlTagPattern = /<[^>]*>/;
  if (htmlTagPattern.test(email)) {
    return { valid: false, message: 'Geçersiz karakterler içeriyor!' };
  }

  const emailStr = email.trim().toLowerCase();

  // Temel regex kontrolü
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(emailStr)) {
    return { valid: false, message: 'Geçerli bir e-posta adresi giriniz.' };
  }

  // Daha detaylı kontroller
  const parts = emailStr.split('@');
  if (!parts[0] || parts[0].length < 1 || !parts[1] || parts[1].length < 3) {
    return { valid: false, message: 'Geçerli bir e-posta adresi giriniz.' };
  }

  // Domain kontrolü
  const domain = parts[1];
  if (!domain || !domain.includes('.') || domain.startsWith('.') || domain.endsWith('.')) {
    return { valid: false, message: 'Geçerli bir e-posta adresi giriniz.' };
  }

  return { valid: true, message: '' };
}

/**
 * Telefon numarası doğrulama (Türkiye formatı)
 */
export function telefonDogrula(telefon: string | null | undefined): TelefonValidationResult {
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
      formatted: temiz,
    };
  }

  // 5 ile başlamalı (cep telefonu)
  if (!temiz.startsWith('5')) {
    return {
      valid: false,
      message: 'Geçerli bir cep telefonu numarası giriniz (5XX ile başlamalı).',
      formatted: temiz,
    };
  }

  return { valid: true, message: '', formatted: temiz };
}

/**
 * Ad Soyad doğrulama
 */
export function adSoyadDogrula(adSoyad: string | null | undefined): ValidationResult {
  if (!adSoyad) {
    return { valid: false, message: 'Ad Soyad boş olamaz.' };
  }

  const adStr = adSoyad.trim();

  if (adStr.length < 3) {
    return { valid: false, message: 'Ad Soyad en az 3 karakter olmalıdır.' };
  }

  if (adStr.length > 100) {
    return { valid: false, message: 'Ad Soyad en fazla 100 karakter olabilir.' };
  }

  // Sadece harf ve boşluk içermeli
  const adRegex = /^[a-zA-ZçÇğĞıİöÖşŞüÜ\s]+$/;
  if (!adRegex.test(adStr)) {
    return { valid: false, message: 'Ad Soyad sadece harf ve boşluk içermelidir.' };
  }

  // En az iki kelime olmalı
  const kelimeler = adStr.split(/\s+/).filter(k => k.length > 0);
  if (kelimeler.length < 2) {
    return { valid: false, message: 'Lütfen ad ve soyad giriniz.' };
  }

  return { valid: true, message: '' };
}

/**
 * Tarih doğrulama
 */
export function tarihDogrula(
  tarih: string | null | undefined,
  options: TarihValidationOptions = {}
): ValidationResult {
  const {
    required = false,
    minYas = null,
    maxYas = null,
    minTarih = null,
    maxTarih = null,
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
    const yas = yasHesapla(tarih);

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
      return {
        valid: false,
        message: `Tarih ${tarihFormat(minTarih)} tarihinden sonra olmalıdır.`,
      };
    }
  }

  // Max tarih kontrolü
  if (maxTarih !== null) {
    const max = new Date(maxTarih);
    if (date > max) {
      return {
        valid: false,
        message: `Tarih ${tarihFormat(maxTarih)} tarihinden önce olmalıdır.`,
      };
    }
  }

  return { valid: true, message: '' };
}

/**
 * Sayı doğrulama
 */
export function sayiDogrula(
  deger: string | number | null | undefined,
  options: SayiValidationOptions = {}
): SayiValidationResult {
  const {
    required = false,
    min = null,
    max = null,
    integer = false,
    fieldName = 'Değer',
  } = options;

  if (deger === null || deger === undefined || deger === '') {
    if (required) {
      return { valid: false, message: `${fieldName} boş olamaz.`, value: 0 };
    }
    return { valid: true, message: '', value: 0 };
  }

  // String ise temizle ve sayıya çevir
  let num =
    typeof deger === 'string' ? parseFloat(deger.replace(/\./g, '').replace(',', '.')) : deger;

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
 */
export function gerekliAlan(deger: unknown, fieldName = 'Bu alan'): ValidationResult {
  if (
    deger === null ||
    deger === undefined ||
    deger === '' ||
    (typeof deger === 'string' && deger.trim() === '')
  ) {
    return { valid: false, message: `${fieldName} boş olamaz.` };
  }
  return { valid: true, message: '' };
}

/**
 * Sporcu form doğrulama
 * @param formData - Form verileri
 * @param excludeId - TC kontrolünde hariç tutulacak ID (güncelleme için)
 */
export function sporcuFormDogrula(
  formData: SporcuFormData,
  excludeId: number | null = null
): FormValidationResult {
  const errors: ValidationErrors = {};
  let valid = true;

  // Ad Soyad
  const adSoyadResult = adSoyadDogrula(formData.adSoyad);
  if (!adSoyadResult.valid) {
    errors.adSoyad = adSoyadResult.message;
    valid = false;
  }

  // TC Kimlik (opsiyonel - sadece girilmişse doğrula)
  if (formData.tcKimlik && formData.tcKimlik.trim()) {
    const tcResult = tcKimlikDogrula(formData.tcKimlik);
    if (!tcResult.valid) {
      errors.tcKimlik = tcResult.message;
      valid = false;
    } else {
      // TC Kimlik uniqueness kontrolü (Storage modülünden)
      if (typeof window !== 'undefined' && (window as any).Storage) {
        const Storage = (window as any).Storage;
        if (Storage.tcKontrol && Storage.tcKontrol(formData.tcKimlik, excludeId)) {
          errors.tcKimlik = 'Bu TC Kimlik No zaten kayıtlı!';
          valid = false;
        }
      }
    }
  }

  // Doğum Tarihi
  const tarihResult = tarihDogrula(formData.dogumTarihi, {
    required: true,
    minYas: 3,
    maxYas: 100,
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
      fieldName: 'Aylık Ücret',
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
 */
export function hatalariGoster(errors: ValidationErrors): void {
  console.log('🔴 [Validation] Hataları göster:', errors);
  // Önceki hataları temizle
  document.querySelectorAll('.error-text').forEach(el => {
    el.textContent = '';
  });
  document.querySelectorAll('input.error, select.error, textarea.error').forEach(el => {
    el.classList.remove('error');
  });

  // Yeni hataları göster
  for (const [field, message] of Object.entries(errors)) {
    const errorEl = document.getElementById(`${field}Error`);
    const inputEl = document.getElementById(field);

    console.log(
      `🔍 [Validation] Field: ${field}, ErrorEl:`,
      errorEl,
      'InputEl:',
      inputEl,
      'Message:',
      message
    );

    if (errorEl) {
      // Sadece hata mesajı varsa göster
      errorEl.textContent = message || '';
      console.log(`✅ [Validation] Error text set edildi: ${field}Error = "${message}"`);
    } else {
      console.warn(`⚠️ [Validation] Error element bulunamadı: ${field}Error`);
    }

    if (inputEl) {
      inputEl.classList.add('error');
      inputEl.classList.remove('validated-success');
      console.log(`✅ [Validation] Input error class eklendi: ${field}`);
    } else {
      console.warn(`⚠️ [Validation] Input element bulunamadı: ${field}`);
    }
  }
}

/**
 * Hataları temizle
 */
export function hatalariTemizle(): void {
  document.querySelectorAll('.error-text').forEach(el => {
    el.textContent = '';
  });
  document.querySelectorAll('input.error, select.error, textarea.error').forEach(el => {
    el.classList.remove('error');
  });
  // Validated-success class'ını da temizle
  document
    .querySelectorAll(
      'input.validated-success, select.validated-success, textarea.validated-success'
    )
    .forEach(el => {
      el.classList.remove('validated-success');
    });
}

// Global erişim için (backward compatibility)
if (typeof window !== 'undefined') {
  (window as unknown as { Validation: Record<string, unknown> }).Validation = {
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
  };
}
