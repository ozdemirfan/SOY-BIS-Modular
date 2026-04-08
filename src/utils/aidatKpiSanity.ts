/**
 * Aidat dönem KPI tutarlılığı — tek kaynaklı hesap sonrası koruma katmanı.
 *
 * Neden gerekli: Ham aidat satırlarını toplayan eski dashboard mantığı ile
 * sporcu bazlı dönem hesabı (aidatDonemTabloHesap) farklı sonuç verebiliyordu.
 * Yeni kodda KPI yalnızca aidatKpiOzetHesapla zincirinden gelmeli; burada
 * NaN/sonsuz ve bariz mantık ihlalleri yakalanır.
 */

const isDev =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.includes('dev'));

export interface AidatDonemKpi {
  beklenen: number;
  tahsilat: number;
  kalan: number;
}

/** Satırların toplamında: her satırda kalan = max(0, beklenen−tahsilat) olduğundan kalan ≤ beklenen olmalı */
export function assertAidatDonemKpiSanity(kpi: AidatDonemKpi, context: string): void {
  if (!isDev) return;

  const { beklenen, tahsilat, kalan } = kpi;
  const nums = [beklenen, tahsilat, kalan];
  for (let i = 0; i < nums.length; i++) {
    const n = nums[i];
    if (!Number.isFinite(n)) {
      console.warn(`[Aidat KPI] ${context}: geçersiz sayı (NaN/Infinity)`, kpi);
      return;
    }
    if (n < 0) {
      console.warn(`[Aidat KPI] ${context}: negatif bileşen`, kpi);
      return;
    }
  }

  const EPS = 0.02;
  if (kalan > beklenen + EPS) {
    console.warn(`[Aidat KPI] ${context}: kalan beklenenden büyük (yuvarlama dışı)`, kpi);
  }
}
