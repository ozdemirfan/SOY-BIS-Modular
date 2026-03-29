/**
 * Aidat ödeme sonrası "fazla" hesabı: eski vs yeni mantık (borç satırı yok, aylık 2000).
 * Çalıştır: node scripts/verify-aidat-fazla-logic.mjs
 */

const toplamBorc = 0; // finansalHesapla: bu ay pozitif borç yok
const toplamTahsilat = 0;
const aylikUcret = 2000;
const burslu = false;
const tutar = 2000;

const beklenenBorcDonem = burslu ? toplamBorc : toplamBorc > 0 ? toplamBorc : aylikUcret;

const yeniTahsilat = toplamTahsilat + tutar;

const yeniFazlaEski = Math.max(0, yeniTahsilat - toplamBorc);
const yeniKalanEski = Math.max(0, toplamBorc - yeniTahsilat);

const yeniFazlaYeni = Math.max(0, yeniTahsilat - beklenenBorcDonem);
const yeniKalanYeni = Math.max(0, beklenenBorcDonem - yeniTahsilat);

const eskiFazlaCagir = yeniFazlaEski > 0 && yeniKalanEski <= 0;
const yeniFazlaCagir = yeniFazlaYeni > 0 && yeniKalanYeni <= 0 && beklenenBorcDonem > 0;

console.log({ toplamBorc, beklenenBorcDonem, yeniFazlaEski, yeniFazlaYeni, eskiFazlaCagir, yeniFazlaCagir });

let ok = true;
if (yeniFazlaEski !== 2000) {
  console.error('Beklenti: eski mantık fazla=2000 (bug)');
  ok = false;
}
if (yeniFazlaYeni !== 0) {
  console.error('Beklenti: yeni mantık fazla=0');
  ok = false;
}
if (eskiFazlaCagir !== true) {
  console.error('Eski: fazla dağıtım tetiklenmeliydi');
  ok = false;
}
if (yeniFazlaCagir !== false) {
  console.error('Yeni: fazla dağıtım tetiklenmemeli');
  ok = false;
}

// İki öğrenci: kasa = 2 * 2000 tahsilat (fazla yok)
const nakit1 = 2000;
const nakit2 = 2000;
const kasaToplam = nakit1 + nakit2;
if (kasaToplam !== 4000) {
  console.error('Kasa toplam 4000 olmalı');
  ok = false;
}

process.exit(ok ? 0 : 1);
