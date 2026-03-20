<?php
declare(strict_types=1);

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth.php';
require_once __DIR__ . '/../rbac.php';

function ayarlar_get(): void {
  soybis_session_start();
  require_login();
  $pdo = db();

  $stmt = $pdo->query("SELECT data FROM ayarlar WHERE id = 1 LIMIT 1");
  $row = $stmt->fetch();
  $data = $row ? json_decode((string)$row['data'], true) : [];
  if (!is_array($data)) $data = [];
  respondJson($data);
}

function ayarlar_update(): void {
  soybis_session_start();
  require_login();

  $body = getJsonBody();
  $ayarlar = is_array($body) && array_key_exists('ayarlar', $body) ? ($body['ayarlar'] ?? []) : $body;
  if (!is_array($ayarlar)) {
    respondJson(['error' => 'ayarlar object required'], 400);
  }

  $pdo = db();
  $stmt = $pdo->prepare("UPDATE ayarlar SET data = :d WHERE id = 1");
  $stmt->execute([':d' => json_encode($ayarlar, JSON_UNESCAPED_UNICODE)]);

  respondJson(['ok' => true]);
}

?>

