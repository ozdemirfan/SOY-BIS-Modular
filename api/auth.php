<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';

function soybis_session_start(): void {
  $cfg = soybis_config();
  $sess = $cfg['session'];

  if (session_status() !== PHP_SESSION_ACTIVE) {
    session_name($sess['name']);
    session_set_cookie_params([
      'httponly' => $sess['httponly'],
      'secure' => (bool)$sess['secure'],
      'samesite' => $sess['samesite'],
      // 'path' => '/',
    ]);
    session_start();
  }
}

function bootstrap_default_admin(PDO $pdo): void {
  $cfg = soybis_config();
  $adminCfg = $cfg['default_admin'];

  // Table yoksa doğal olarak hata verecek; schema kurulmadan endpoint çağrılmasın.
  $countStmt = $pdo->query("SELECT COUNT(*) AS c FROM users");
  $count = (int)($countStmt->fetch()['c'] ?? 0);
  if ($count > 0) return;

  $sifreHash = $adminCfg['sifreHash'];
  if (empty($sifreHash)) {
    $sifreHash = hash('sha256', (string)$adminCfg['sifreDuzMetin']);
  }

  $stmt = $pdo->prepare(
    "INSERT INTO users (kullaniciAdi, adSoyad, email, rol, aktif, sifreHash, olusturmaTarihi)
     VALUES (:kullaniciAdi, :adSoyad, :email, :rol, :aktif, :sifreHash, :olusturmaTarihi)"
  );

  $stmt->execute([
    ':kullaniciAdi' => (string)$adminCfg['kullaniciAdi'],
    ':adSoyad' => (string)$adminCfg['adSoyad'],
    ':email' => (string)$adminCfg['email'],
    ':rol' => (string)$adminCfg['rol'],
    ':aktif' => (int)$adminCfg['aktif'],
    ':sifreHash' => (string)$sifreHash,
    ':olusturmaTarihi' => date('Y-m-d H:i:s'),
  ]);
}

function api_auth_login(): void {
  soybis_session_start();

  $pdo = db();
  bootstrap_default_admin($pdo);

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
    respondJson(['error' => 'Kullanıcı adı veya şifre hatalı'], 401);
  }
  if ((int)$user['aktif'] !== 1) {
    respondJson(['error' => 'Kullanıcı pasif'], 403);
  }

  // DB'de SHA2() ile eklenmiş büyük harfli hex ile JS/PHP hash('sha256') küçük harf uyumu
  $dbHash = strtolower(trim((string)$user['sifreHash']));
  $gelenHash = strtolower(trim($sifreHash));
  if (strlen($dbHash) !== strlen($gelenHash) || !hash_equals($dbHash, $gelenHash)) {
    respondJson(['error' => 'Kullanıcı adı veya şifre hatalı'], 401);
  }

  $_SESSION['soybis_user'] = [
    'id' => (int)$user['id'],
    'kullaniciAdi' => (string)$user['kullaniciAdi'],
    'rol' => (string)$user['rol'],
    'adSoyad' => (string)($user['adSoyad'] ?? $user['kullaniciAdi']),
    'email' => (string)($user['email'] ?? ''),
    'girisTarihi' => date('c'),
  ];

  respondJson(['ok' => true, 'user' => $_SESSION['soybis_user']]);
}

function api_auth_logout(): void {
  soybis_session_start();
  $_SESSION = [];
  if (ini_get("session.use_cookies")) {
    $params = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000,
      $params['path'], $params['domain'],
      (bool)($params['secure'] ?? false), (bool)($params['httponly'] ?? true)
    );
  }
  session_destroy();
  respondJson(['ok' => true]);
}

function api_auth_me(): void {
  soybis_session_start();
  if (!isset($_SESSION['soybis_user'])) {
    respondJson(['error' => 'Unauthorized'], 401);
  }
  respondJson($_SESSION['soybis_user']);
}

function api_system_init(): void {
  soybis_session_start();
  $pdo = db();
  bootstrap_default_admin($pdo);
  respondJson(['ok' => true]);
}

?>

