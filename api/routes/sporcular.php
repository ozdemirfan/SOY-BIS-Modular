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
    $data['id'] = (int)$r['id'];
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

function sporcular_delete(int $id): void {
  soybis_session_start();
  require_login();

  $pdo = db();
  $pdo->beginTransaction();
  try {
    $stmt = $pdo->prepare("DELETE FROM sporcular WHERE id = :id");
    $stmt->execute([':id' => $id]);

    // Aidatlar tablosundan ilgili sporcuya ait kayıtları sil.
    $stmt2 = $pdo->prepare("DELETE FROM aidatlar WHERE sporcuId = :id");
    $stmt2->execute([':id' => $id]);

    // Yoklamalar JSON içinden sporcu referansını kaldır.
    $stmt3 = $pdo->query("SELECT tarih, grup, data FROM yoklamalar");
    $rows = $stmt3->fetchAll();

    foreach ($rows as $r) {
      $data = json_decode((string)$r['data'], true);
      if (!is_array($data)) continue;

      if (!isset($data['sporcular']) || !is_array($data['sporcular'])) continue;

      $data['sporcular'] = array_values(array_filter(
        $data['sporcular'],
        fn($p) => isset($p['id']) && (int)$p['id'] !== $id
      ));

      $tarih = (string)$r['tarih'];
      $grup = (string)$r['grup'];

      if (count($data['sporcular']) === 0) {
        $stmtDel = $pdo->prepare("DELETE FROM yoklamalar WHERE tarih = :t AND grup = :g");
        $stmtDel->execute([':t' => $tarih, ':g' => $grup]);
      } else {
        $stmtUp = $pdo->prepare("REPLACE INTO yoklamalar (tarih, grup, data) VALUES (:t, :g, :data)");
        $stmtUp->execute([
          ':t' => $tarih,
          ':g' => $grup,
          ':data' => json_encode($data, JSON_UNESCAPED_UNICODE),
        ]);
      }
    }

    $pdo->commit();
  } catch (Throwable $e) {
    $pdo->rollBack();
    respondJson(['error' => 'delete failed', 'detail' => $e->getMessage()], 500);
  }
  respondJson(['ok' => true]);
}

?>

