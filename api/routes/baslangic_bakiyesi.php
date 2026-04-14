<?php
declare(strict_types=1);

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth.php';
require_once __DIR__ . '/../rbac.php';

function baslangic_bakiyesi_get(): void {
  soybis_session_start();
  require_login();
  $pdo = db();

  $stmt = $pdo->query("SELECT nakit, banka, tarih FROM baslangic_bakiyesi WHERE id = 1 LIMIT 1");
  $row = $stmt->fetch();
  if (!$row) {
    respondJson(['nakit' => 0, 'banka' => 0, 'tarih' => date('Y-m-d')]);
  }
  respondJson([
    'nakit' => (float)$row['nakit'],
    'banka' => (float)$row['banka'],
    'tarih' => (string)$row['tarih'],
  ]);
}

function baslangic_bakiyesi_update(): void {
  soybis_session_start();
  require_login();

  $body = getJsonBody();
  $bakiyeler = is_array($body) && array_key_exists('bakiyeler', $body) ? ($body['bakiyeler'] ?? []) : $body;
  if (!is_array($bakiyeler)) {
    respondJson(['error' => 'bakiyeler object required'], 400);
  }

  $nakit = (string)($bakiyeler['nakit'] ?? '0');
  $banka = (string)($bakiyeler['banka'] ?? '0');
  $tarih = (string)($bakiyeler['tarih'] ?? date('Y-m-d'));

  $pdo = db();
  $stmt = $pdo->prepare("UPDATE baslangic_bakiyesi SET nakit = :n, banka = :b, tarih = :t WHERE id = 1");
  $stmt->execute([
    ':n' => $nakit,
    ':b' => $banka,
    ':t' => $tarih,
  ]);

  respondJson(['ok' => true]);
}

?>

