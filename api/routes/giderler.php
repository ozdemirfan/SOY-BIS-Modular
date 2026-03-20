<?php
declare(strict_types=1);

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth.php';
require_once __DIR__ . '/../rbac.php';

function giderler_get_all(): void {
  soybis_session_start();
  require_login();

  $pdo = db();
  $stmt = $pdo->query("SELECT id, data FROM giderler");
  $rows = $stmt->fetchAll();
  $result = [];
  foreach ($rows as $r) {
    $data = json_decode((string)$r['data'], true);
    if (!is_array($data)) $data = [];
    $data['id'] = (int)$r['id'];
    $result[] = $data;
  }
  respondJson($result);
}

function giderler_upsert(): void {
  soybis_session_start();
  require_login();

  $pdo = db();
  $body = getJsonBody();
  $gider = is_array($body) && array_key_exists('gider', $body) ? ($body['gider'] ?? []) : $body;
  $id = (int)($gider['id'] ?? 0);
  if ($id <= 0) {
    respondJson(['error' => 'Gider id gerekli'], 400);
  }

  $data = $gider;
  $data['id'] = $id;

  $stmt = $pdo->prepare("REPLACE INTO giderler (id, data) VALUES (:id, :data)");
  $stmt->execute([
    ':id' => $id,
    ':data' => json_encode($data, JSON_UNESCAPED_UNICODE),
  ]);

  respondJson($data);
}

function giderler_delete(int $id): void {
  soybis_session_start();
  require_login();

  $pdo = db();
  $stmt = $pdo->prepare("DELETE FROM giderler WHERE id = :id");
  $stmt->execute([':id' => $id]);
  respondJson(['ok' => true]);
}

?>

