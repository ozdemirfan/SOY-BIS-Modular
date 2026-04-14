<?php
declare(strict_types=1);

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth.php';
require_once __DIR__ . '/../rbac.php';

function system_reset(): void {
  // Bu endpoint oturum bazlı değil, verdiğiniz admin şifresine göre çalışır.
  $pdo = db();
  $body = getJsonBody();

  $kullaniciAdi = trim((string)($body['kullaniciAdi'] ?? ''));
  $sifreHash = (string)($body['sifreHash'] ?? '');
  $sifreDuzMetin = (string)($body['sifre'] ?? '');

  if ($kullaniciAdi === '') {
    respondJson(['error' => 'kullaniciAdi gerekli'], 400);
  }

  if ($sifreHash === '') {
    if ($sifreDuzMetin === '') {
      respondJson(['error' => 'sifreHash veya sifre gerekli'], 400);
    }
    $sifreHash = hash('sha256', $sifreDuzMetin);
  }

  $stmt = $pdo->prepare("SELECT * FROM users WHERE kullaniciAdi = :k LIMIT 1");
  $stmt->execute([':k' => $kullaniciAdi]);
  $user = $stmt->fetch();

  if (!$user) {
    respondJson(['ok' => false, 'error' => 'kullanici bulunamadi'], 400);
  }
  if ((int)$user['aktif'] !== 1) {
    respondJson(['ok' => false, 'error' => 'kullanici pasif'], 400);
  }
  if ((string)$user['rol'] !== 'Yönetici') {
    respondJson(['ok' => false, 'error' => 'Yönetici gerekli'], 403);
  }
  if (!hash_equals((string)$user['sifreHash'], $sifreHash)) {
    respondJson(['ok' => false, 'error' => 'şifre hatalı'], 400);
  }

  $pdo->beginTransaction();
  try {
    $pdo->exec("DELETE FROM sporcular");
    $pdo->exec("DELETE FROM aidatlar");
    $pdo->exec("DELETE FROM yoklamalar");
    $pdo->exec("DELETE FROM giderler");
    $pdo->exec("DELETE FROM antrenorler");
    $pdo->exec("DELETE FROM yoklama_audit");

    $pdo->exec("UPDATE ayarlar SET data = '{}' WHERE id = 1");
    $pdo->exec("UPDATE baslangic_bakiyesi SET nakit = 0, banka = 0, tarih = CURDATE() WHERE id = 1");

    $pdo->commit();
    respondJson(['ok' => true]);
  } catch (Throwable $e) {
    $pdo->rollBack();
    respondJson(['ok' => false, 'error' => 'reset failed', 'detail' => $e->getMessage()], 500);
  }
}

?>

