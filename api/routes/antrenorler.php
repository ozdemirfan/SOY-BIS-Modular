<?php
declare(strict_types=1);

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth.php';
require_once __DIR__ . '/../rbac.php';

function antrenorler_get_all(): void {
  soybis_session_start();
  require_login();

  $pdo = db();
  $stmt = $pdo->query("SELECT id, data FROM antrenorler");
  $rows = $stmt->fetchAll();
  $result = [];
  foreach ($rows as $r) {
    $data = json_decode((string)$r['data'], true);
    if (!is_array($data)) $data = [];
    $colId = (int)$r['id'];
    $jsonId = isset($data['id']) ? (int)$data['id'] : 0;
    $data['id'] = $jsonId > 0 ? $jsonId : $colId;
    $result[] = $data;
  }
  respondJson($result);
}

function antrenorler_upsert(): void {
  soybis_session_start();
  require_login();

  $pdo = db();
  $body = getJsonBody();
  $antrenor = is_array($body) && array_key_exists('antrenor', $body) ? ($body['antrenor'] ?? []) : $body;
  $id = (int)($antrenor['id'] ?? 0);
  if ($id <= 0) respondJson(['error' => 'Antrenor id gerekli'], 400);

  $data = $antrenor;
  $data['id'] = $id;

  $stmt = $pdo->prepare("REPLACE INTO antrenorler (id, data) VALUES (:id, :data)");
  $stmt->execute([
    ':id' => $id,
    ':data' => json_encode($data, JSON_UNESCAPED_UNICODE),
  ]);

  respondJson($data);
}

function antrenorler_delete(int $id): void {
  soybis_session_start();
  require_login();

  $pdo = db();
  $stmt = $pdo->prepare("DELETE FROM antrenorler WHERE id = :id");
  $stmt->execute([':id' => $id]);
  respondJson(['ok' => true]);
}

?>

