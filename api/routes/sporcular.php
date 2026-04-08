<?php
declare(strict_types=1);

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth.php';
require_once __DIR__ . '/../rbac.php';

function sporcular_get_all(): void {
  soybis_session_start();
  require_login();

  $pdo = db();
  $stmt = $pdo->query("SELECT id, data FROM sporcular");
  $rows = $stmt->fetchAll();
  $result = [];
  foreach ($rows as $r) {
    $data = json_decode((string)$r['data'], true);
    if (!is_array($data)) $data = [];
    $colId = (int)$r['id'];
    $jsonId = isset($data['id']) ? (int)$data['id'] : 0;
    // JSON’daki id öncelikli: PK kolonu INT iken taşma (2147483647) olmuş eski satırlarda doğru id JSON’da kalır.
    $data['id'] = $jsonId > 0 ? $jsonId : $colId;
    $result[] = $data;
  }
  respondJson($result);
}

function sporcular_upsert(): void {
  soybis_session_start();
  require_login();

  $pdo = db();
  $body = getJsonBody();
  // body doğrudan sporcu objesi de olabilir
  $sporcu = is_array($body) && array_key_exists('sporcu', $body) ? ($body['sporcu'] ?? []) : $body;
  $id = (int)($sporcu['id'] ?? 0);

  // Storage v3 ID üretiyor; paylaşımda ID yoksa yeni üretmek yerine hata veriyoruz.
  if ($id <= 0) {
    respondJson(['error' => 'Sporcu id gerekli'], 400);
  }

  $data = $sporcu;
  $data['id'] = $id;

  $stmt = $pdo->prepare(
    "REPLACE INTO sporcular (id, data) VALUES (:id, :data)"
  );
  $stmt->execute([
    ':id' => $id,
    ':data' => json_encode($data, JSON_UNESCAPED_UNICODE),
  ]);

  respondJson($data);
}

/**
 * Eski istemciler için DELETE hâlâ çağrılabilir: kayıt silinmez;
 * sporcu "Ayrıldı" yapılır, aidat / yoklama dokunulmaz.
 * İsteğe bağlı JSON: { "kaynak": "kendi" | "yonetici" }
 */
function sporcular_delete(int $id): void {
  soybis_session_start();
  require_login();

  $body = getJsonBody();
  $kaynak = 'yonetici';
  if (isset($body['kaynak']) && ($body['kaynak'] === 'kendi' || $body['kaynak'] === 'yonetici')) {
    $kaynak = (string)$body['kaynak'];
  }

  $pdo = db();
  $stmt = $pdo->prepare("SELECT id, data FROM sporcular WHERE id = :id");
  $stmt->execute([':id' => $id]);
  $row = $stmt->fetch();
  if (!$row) {
    respondJson(['ok' => true]);
    return;
  }

  $data = json_decode((string)$row['data'], true);
  if (!is_array($data)) {
    $data = [];
  }
  $data['id'] = $id;
  $data['durum'] = 'Ayrıldı';
  $data['silinmeBilgisi'] = [
    'tarih' => gmdate('c'),
    'kaynak' => $kaynak,
  ];

  $stmtUp = $pdo->prepare("REPLACE INTO sporcular (id, data) VALUES (:id, :data)");
  $stmtUp->execute([
    ':id' => $id,
    ':data' => json_encode($data, JSON_UNESCAPED_UNICODE),
  ]);

  respondJson(['ok' => true]);
}

?>
