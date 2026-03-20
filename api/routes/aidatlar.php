<?php
declare(strict_types=1);

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth.php';
require_once __DIR__ . '/../rbac.php';

function aidatlar_get_all(): void {
  soybis_session_start();
  require_login();

  $pdo = db();
  $stmt = $pdo->query("SELECT id, data FROM aidatlar");
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

function aidatlar_upsert(): void {
  soybis_session_start();
  require_login();

  $pdo = db();
  $body = getJsonBody();
  $aidat = is_array($body) && array_key_exists('aidat', $body) ? ($body['aidat'] ?? []) : $body;
  $id = (int)($aidat['id'] ?? 0);

  if ($id <= 0) {
    respondJson(['error' => 'Aidat id gerekli'], 400);
  }

  $data = $aidat;
  $data['id'] = $id;

  $sporcuId = (int)($aidat['sporcuId'] ?? 0);
  $donemAy = (int)($aidat['donemAy'] ?? 1);
  $donemYil = (int)($aidat['donemYil'] ?? (int)date('Y'));

  $stmt = $pdo->prepare(
    "REPLACE INTO aidatlar (id, sporcuId, donemAy, donemYil, data)
     VALUES (:id, :sporcuId, :donemAy, :donemYil, :data)"
  );
  $stmt->execute([
    ':id' => $id,
    ':sporcuId' => $sporcuId,
    ':donemAy' => $donemAy,
    ':donemYil' => $donemYil,
    ':data' => json_encode($data, JSON_UNESCAPED_UNICODE),
  ]);

  respondJson($data);
}

function aidatlar_delete(int $id): void {
  soybis_session_start();
  require_login();

  $pdo = db();
  $stmt = $pdo->prepare("DELETE FROM aidatlar WHERE id = :id");
  $stmt->execute([':id' => $id]);
  respondJson(['ok' => true]);
}

?>

