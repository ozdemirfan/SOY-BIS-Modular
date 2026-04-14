<?php
declare(strict_types=1);

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth.php';
require_once __DIR__ . '/../rbac.php';

function backup_get(): void {
  soybis_session_start();
  require_login();
  require_roles(['Yönetici']);

  $pdo = db();

  $sporcular = [];
  $stmt = $pdo->query("SELECT id, data FROM sporcular");
  foreach ($stmt->fetchAll() as $r) {
    $data = json_decode((string)$r['data'], true);
    if (!is_array($data)) $data = [];
    $data['id'] = (int)$r['id'];
    $sporcular[] = $data;
  }

  $aidatlar = [];
  $stmt = $pdo->query("SELECT id, data FROM aidatlar");
  foreach ($stmt->fetchAll() as $r) {
    $data = json_decode((string)$r['data'], true);
    if (!is_array($data)) $data = [];
    $data['id'] = (int)$r['id'];
    $aidatlar[] = $data;
  }

  $yoklamalar = [];
  $stmt = $pdo->query("SELECT tarih, grup, data FROM yoklamalar");
  foreach ($stmt->fetchAll() as $r) {
    $data = json_decode((string)$r['data'], true);
    if (!is_array($data)) $data = [];
    $data['tarih'] = (string)$r['tarih'];
    $data['grup'] = (string)$r['grup'];
    $yoklamalar[] = $data;
  }

  $giderler = [];
  $stmt = $pdo->query("SELECT id, data FROM giderler");
  foreach ($stmt->fetchAll() as $r) {
    $data = json_decode((string)$r['data'], true);
    if (!is_array($data)) $data = [];
    $data['id'] = (int)$r['id'];
    $giderler[] = $data;
  }

  $antrenorler = [];
  $stmt = $pdo->query("SELECT id, data FROM antrenorler");
  foreach ($stmt->fetchAll() as $r) {
    $data = json_decode((string)$r['data'], true);
    if (!is_array($data)) $data = [];
    $data['id'] = (int)$r['id'];
    $antrenorler[] = $data;
  }

  $payload = [
    'versiyon' => '3.0.0',
    'tarih' => date('c'),
    'veriler' => [
      'sporcular' => $sporcular,
      'aidatlar' => $aidatlar,
      'yoklamalar' => $yoklamalar,
      'giderler' => $giderler,
      'antrenorler' => $antrenorler,
    ],
  ];

  respondJson($payload);
}

function backup_restore(): void {
  soybis_session_start();
  require_login();
  require_roles(['Yönetici']);

  $body = getJsonBody();
  $veriler = $body['veriler'] ?? null;
  if (!is_array($veriler)) {
    respondJson(['error' => 'veriler gerekli'], 400);
  }

  $sporcular = $veriler['sporcular'] ?? [];
  $aidatlar = $veriler['aidatlar'] ?? [];
  $yoklamalar = $veriler['yoklamalar'] ?? [];
  $giderler = $veriler['giderler'] ?? [];
  $antrenorler = $veriler['antrenorler'] ?? [];

  $pdo = db();
  $pdo->beginTransaction();
  try {
    $pdo->exec("DELETE FROM sporcular");
    $pdo->exec("DELETE FROM aidatlar");
    $pdo->exec("DELETE FROM yoklamalar");
    $pdo->exec("DELETE FROM giderler");
    $pdo->exec("DELETE FROM antrenorler");
    $pdo->exec("DELETE FROM yoklama_audit");

    foreach ((array)$sporcular as $s) {
      $id = (int)($s['id'] ?? 0);
      if ($id <= 0) continue;
      $stmt = $pdo->prepare("REPLACE INTO sporcular (id, data) VALUES (:id, :data)");
      $stmt->execute([
        ':id' => $id,
        ':data' => json_encode($s, JSON_UNESCAPED_UNICODE),
      ]);
    }

    foreach ((array)$aidatlar as $a) {
      $id = (int)($a['id'] ?? 0);
      if ($id <= 0) continue;
      $sporcuId = (int)($a['sporcuId'] ?? 0);
      $donemAy = (int)($a['donemAy'] ?? 1);
      $donemYil = (int)($a['donemYil'] ?? (int)date('Y'));
      $stmt = $pdo->prepare(
        "REPLACE INTO aidatlar (id, sporcuId, donemAy, donemYil, data)
         VALUES (:id, :sporcuId, :donemAy, :donemYil, :data)"
      );
      $stmt->execute([
        ':id' => $id,
        ':sporcuId' => $sporcuId,
        ':donemAy' => $donemAy,
        ':donemYil' => $donemYil,
        ':data' => json_encode($a, JSON_UNESCAPED_UNICODE),
      ]);
    }

    foreach ((array)$yoklamalar as $y) {
      $tarih = (string)($y['tarih'] ?? '');
      $grup = (string)($y['grup'] ?? '');
      if ($tarih === '' || $grup === '') continue;
      $stmt = $pdo->prepare("REPLACE INTO yoklamalar (tarih, grup, data) VALUES (:t, :g, :data)");
      $stmt->execute([
        ':t' => $tarih,
        ':g' => $grup,
        ':data' => json_encode($y, JSON_UNESCAPED_UNICODE),
      ]);
    }

    foreach ((array)$giderler as $g) {
      $id = (int)($g['id'] ?? 0);
      if ($id <= 0) continue;
      $stmt = $pdo->prepare("REPLACE INTO giderler (id, data) VALUES (:id, :data)");
      $stmt->execute([
        ':id' => $id,
        ':data' => json_encode($g, JSON_UNESCAPED_UNICODE),
      ]);
    }

    foreach ((array)$antrenorler as $an) {
      $id = (int)($an['id'] ?? 0);
      if ($id <= 0) continue;
      $stmt = $pdo->prepare("REPLACE INTO antrenorler (id, data) VALUES (:id, :data)");
      $stmt->execute([
        ':id' => $id,
        ':data' => json_encode($an, JSON_UNESCAPED_UNICODE),
      ]);
    }

    $pdo->commit();
    respondJson(['ok' => true]);
  } catch (Throwable $e) {
    $pdo->rollBack();
    respondJson(['error' => 'restore failed', 'detail' => $e->getMessage()], 500);
  }
}

?>

