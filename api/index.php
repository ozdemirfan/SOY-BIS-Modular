<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/rbac.php';
require_once __DIR__ . '/routes/sporcular.php';
require_once __DIR__ . '/routes/aidatlar.php';
require_once __DIR__ . '/routes/yoklama.php';
require_once __DIR__ . '/routes/giderler.php';
require_once __DIR__ . '/routes/antrenorler.php';
require_once __DIR__ . '/routes/kullanicilar.php';
require_once __DIR__ . '/routes/ayarlar.php';
require_once __DIR__ . '/routes/baslangic_bakiyesi.php';
require_once __DIR__ . '/routes/backup.php';
require_once __DIR__ . '/routes/system.php';

// Basit CORS (cookie'li istekler için).
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '') {
  header('Access-Control-Allow-Origin: ' . $origin);
  header('Access-Control-Allow-Credentials: true');
}
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Methods: GET,POST,DELETE,OPTIONS');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
  http_response_code(204);
  exit;
}

$path = readPath(); // /api sonrası
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// Sağlık/handshake
if ($path === '' && $method === 'GET') {
  respondJson(['ok' => true, 'service' => 'soybis-api', 'version' => '0.1']);
}

// Auth routes
if ($path === 'auth/login' && $method === 'POST') {
  api_auth_login();
}
if ($path === 'auth/logout' && $method === 'POST') {
  api_auth_logout();
}
if ($path === 'auth/me' && $method === 'GET') {
  api_auth_me();
}
if ($path === 'system/init' && $method === 'POST') {
  api_system_init();
}

// CRUD routes
$parts = array_values(array_filter(explode('/', $path), fn($p) => $p !== ''));
$resource = $parts[0] ?? '';
$second = $parts[1] ?? null;
$id = null;
if ($second !== null && is_numeric($second)) {
  $id = (int)$second;
}

// Sporcular
if ($resource === 'sporcular') {
  if ($method === 'GET' && count($parts) === 1) return sporcular_get_all();
  if ($method === 'POST' && count($parts) === 1) return sporcular_upsert();
  if ($method === 'DELETE' && $id !== null && count($parts) === 2) return sporcular_delete($id);
}

// Aidatlar
if ($resource === 'aidatlar') {
  if ($method === 'GET' && count($parts) === 1) return aidatlar_get_all();
  if ($method === 'POST' && count($parts) === 1) return aidatlar_upsert();
  if ($method === 'DELETE' && $id !== null && count($parts) === 2) return aidatlar_delete($id);
}

// Yoklama
if ($resource === 'yoklamalar') {
  if ($method === 'GET' && count($parts) === 1) return yoklama_get_all();
}

if ($resource === 'yoklama') {
  // Batch: /api/yoklama/batch
  if ($method === 'POST' && count($parts) === 2 && $second === 'batch') return yoklama_batch();

  // Get one: /api/yoklama?tarih=YYYY-MM-DD&grup=U12
  if ($method === 'GET' && count($parts) === 1) {
    $tarih = (string)($_GET['tarih'] ?? '');
    $grup = (string)($_GET['grup'] ?? '');
    if ($tarih === '' || $grup === '') {
      respondJson(['error' => 'tarih ve grup gerekli'], 400);
    }
    return yoklama_get_one($tarih, $grup);
  }

  // Update single: /api/yoklama  (body: {tarih,grup,sporcuId,durum,eskiDurum?})
  if ($method === 'POST' && count($parts) === 1) return yoklama_upsert_single();
}

// Giderler
if ($resource === 'giderler') {
  if ($method === 'GET' && count($parts) === 1) return giderler_get_all();
  if ($method === 'POST' && count($parts) === 1) return giderler_upsert();
  if ($method === 'DELETE' && $id !== null && count($parts) === 2) return giderler_delete($id);
}

// Antrenorler
if ($resource === 'antrenorler') {
  if ($method === 'GET' && count($parts) === 1) return antrenorler_get_all();
  if ($method === 'POST' && count($parts) === 1) return antrenorler_upsert();
  if ($method === 'DELETE' && $id !== null && count($parts) === 2) return antrenorler_delete($id);
}

// Kullanici
if ($resource === 'kullanicilar') {
  if ($method === 'GET' && count($parts) === 1) return kullanicilar_get_all();
  if ($method === 'POST' && count($parts) === 1) return kullanicilar_upsert();
  if ($method === 'DELETE' && $id !== null && count($parts) === 2) return kullanicilar_delete($id);
}

// Ayarlar
if ($resource === 'ayarlar') {
  if ($method === 'GET' && count($parts) === 1) return ayarlar_get();
  if ($method === 'POST' && count($parts) === 1) return ayarlar_update();
}

// Baslangic bakiyesi
if ($resource === 'baslangic_bakiyesi') {
  if ($method === 'GET' && count($parts) === 1) return baslangic_bakiyesi_get();
  if ($method === 'POST' && count($parts) === 1) return baslangic_bakiyesi_update();
}

// Backup
if ($resource === 'backup') {
  if ($method === 'GET' && count($parts) === 1) return backup_get();
  if ($method === 'POST' && count($parts) === 2 && $second === 'restore') return backup_restore();
}

// System reset
if ($resource === 'system' && $method === 'POST' && count($parts) === 2 && $second === 'reset') {
  return system_reset();
}

respondJson(['error' => 'Not Found'], 404);

?>

