<?php
declare(strict_types=1);

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth.php';
require_once __DIR__ . '/../rbac.php';

function kullanicilar_get_all(): void {
  soybis_session_start();
  require_login();
  require_roles(['Yönetici']);

  $pdo = db();
  $stmt = $pdo->query("SELECT id, kullaniciAdi, adSoyad, email, rol, aktif, sifreHash, olusturmaTarihi FROM users");
  $rows = $stmt->fetchAll();

  // Frontend tarafında şifre doğrulaması için sifreHash gerekiyorsa döndürürüz.
  // (Bizde Authentication API üzerinden yapıldığı için UI'de hassas gösterilmeyecek.)
  respondJson($rows);
}

function kullanicilar_upsert(): void {
  soybis_session_start();
  require_login();
  require_roles(['Yönetici']);

  $pdo = db();
  $body = getJsonBody();
  $user = is_array($body) && array_key_exists('kullanici', $body) ? ($body['kullanici'] ?? []) : $body;

  $id = isset($user['id']) ? (int)$user['id'] : 0;
  $kullaniciAdi = trim((string)($user['kullaniciAdi'] ?? ''));
  $adSoyad = trim((string)($user['adSoyad'] ?? ''));
  $email = (string)($user['email'] ?? '');
  $rol = (string)($user['rol'] ?? 'Antrenör');
  $aktif = isset($user['aktif']) ? (int)$user['aktif'] : 1;

  if ($kullaniciAdi === '') respondJson(['error' => 'kullaniciAdi gerekli'], 400);

  // Şifre hash'i ya da düz şifre kabul edelim
  $sifreHash = (string)($user['sifreHash'] ?? '');
  $sifreDuzMetin = (string)($user['sifre'] ?? '');
  if ($sifreHash === '' && $sifreDuzMetin !== '') {
    $sifreHash = hash('sha256', $sifreDuzMetin);
  }

  // Güncelleme sırasında şifre verilmediyse mevcut hash'i korumak için mevcut kaydı çek.
  if ($id > 0 && $sifreHash === '') {
    $stmt = $pdo->prepare("SELECT sifreHash FROM users WHERE id = :id LIMIT 1");
    $stmt->execute([':id' => $id]);
    $row = $stmt->fetch();
    if (!$row) respondJson(['error' => 'Kullanıcı bulunamadı'], 404);
    $sifreHash = (string)$row['sifreHash'];
  }

  if ($sifreHash === '') respondJson(['error' => 'sifreHash gerekli'], 400);

  if ($id > 0) {
    $stmt = $pdo->prepare(
      "UPDATE users
       SET kullaniciAdi = :k, adSoyad = :a, email = :e, rol = :r, aktif = :akt, sifreHash = :sh
       WHERE id = :id"
    );
    $stmt->execute([
      ':k' => $kullaniciAdi,
      ':a' => $adSoyad,
      ':e' => $email,
      ':r' => $rol,
      ':akt' => $aktif,
      ':sh' => $sifreHash,
      ':id' => $id,
    ]);
    $stmt2 = $pdo->prepare("SELECT id, kullaniciAdi, adSoyad, email, rol, aktif, sifreHash, olusturmaTarihi FROM users WHERE id = :id LIMIT 1");
    $stmt2->execute([':id' => $id]);
    $updated = $stmt2->fetch();
    respondJson($updated);
  }

  // Yeni kullanıcı
  $stmt = $pdo->prepare(
    "INSERT INTO users (kullaniciAdi, adSoyad, email, rol, aktif, sifreHash, olusturmaTarihi)
     VALUES (:k, :a, :e, :r, :akt, :sh, :t)"
  );
  $stmt->execute([
    ':k' => $kullaniciAdi,
    ':a' => $adSoyad !== '' ? $adSoyad : $kullaniciAdi,
    ':e' => $email,
    ':r' => $rol,
    ':akt' => $aktif,
    ':sh' => $sifreHash,
    ':t' => date('c'),
  ]);

  $newId = (int)$pdo->lastInsertId();
  $stmt2 = $pdo->prepare("SELECT id, kullaniciAdi, adSoyad, email, rol, aktif, sifreHash, olusturmaTarihi FROM users WHERE id = :id LIMIT 1");
  $stmt2->execute([':id' => $newId]);
  $created = $stmt2->fetch();
  respondJson($created);
}

function kullanicilar_delete(int $id): void {
  soybis_session_start();
  require_login();
  require_roles(['Yönetici']);

  $pdo = db();
  $stmt = $pdo->prepare("DELETE FROM users WHERE id = :id");
  $stmt->execute([':id' => $id]);
  respondJson(['ok' => true]);
}

?>

