<?php
declare(strict_types=1);

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../auth.php';
require_once __DIR__ . '/../rbac.php';

function yoklama_get_all(): void {
  soybis_session_start();
  require_login();

  $pdo = db();
  $stmt = $pdo->query("SELECT tarih, grup, data FROM yoklamalar");
  $rows = $stmt->fetchAll();

  $result = [];
  foreach ($rows as $r) {
    $data = json_decode((string)$r['data'], true);
    if (!is_array($data)) $data = [];
    // Tarih/grup JSON içinde olsa bile normalize edelim
    $data['tarih'] = (string)$r['tarih'];
    $data['grup'] = (string)$r['grup'];
    $result[] = $data;
  }
  respondJson($result);
}

function yoklama_get_one(string $tarih, string $grup): void {
  soybis_session_start();
  require_login();

  $pdo = db();
  $stmt = $pdo->prepare("SELECT data FROM yoklamalar WHERE tarih = :t AND grup = :g LIMIT 1");
  $stmt->execute([':t' => $tarih, ':g' => $grup]);
  $row = $stmt->fetch();
  if (!$row) {
    respondJson(null, 200);
  }

  $data = json_decode((string)$row['data'], true);
  if (!is_array($data)) $data = [];
  $data['tarih'] = $tarih;
  $data['grup'] = $grup;
  respondJson($data);
}

function yoklama_apply_change(array $change, bool $withAudit): array {
  $tarih = (string)($change['tarih'] ?? '');
  $grup = (string)($change['grup'] ?? '');
  $sporcuId = (int)($change['sporcuId'] ?? 0);
  $yeniDurum = (string)($change['yeniDurum'] ?? $change['durum'] ?? 'yok');
  $eskiDurum = (string)($change['eskiDurum'] ?? '');

  if ($tarih === '' || $grup === '' || $sporcuId <= 0) {
    return ['error' => 'invalid_change'];
  }

  $pdo = db();

  $stmt = $pdo->prepare("SELECT data FROM yoklamalar WHERE tarih = :t AND grup = :g LIMIT 1");
  $stmt->execute([':t' => $tarih, ':g' => $grup]);
  $row = $stmt->fetch();

  $yoklama = $row ? json_decode((string)$row['data'], true) : null;
  if (!is_array($yoklama)) {
    $yoklama = [
      'id' => time(),
      'tarih' => $tarih,
      'grup' => $grup,
      'sporcular' => [],
    ];
  }

  if (!isset($yoklama['sporcular']) || !is_array($yoklama['sporcular'])) {
    $yoklama['sporcular'] = [];
  }

  $found = false;
  for ($i = 0; $i < count($yoklama['sporcular']); $i++) {
    $p = $yoklama['sporcular'][$i];
    $pid = isset($p['id']) ? (int)$p['id'] : 0;
    if ($pid === $sporcuId) {
      $eski = isset($p['durum']) ? (string)$p['durum'] : '';
      // Eğer eskiDurum gelmediyse, yoklama'dan çıkar
      if ($eskiDurum === '') $eskiDurum = $eski;
      $yoklama['sporcular'][$i]['durum'] = $yeniDurum;
      $found = true;
      break;
    }
  }
  if (!$found) {
    $yoklama['sporcular'][] = ['id' => $sporcuId, 'durum' => $yeniDurum];
    // Yeni kayıt ise eskiDurum'u tahmin etmeye çalış
    if ($eskiDurum === '') $eskiDurum = 'yok';
  }

  // Persist
  $stmt2 = $pdo->prepare("REPLACE INTO yoklamalar (tarih, grup, data) VALUES (:t, :g, :data)");
  $stmt2->execute([
    ':t' => $tarih,
    ':g' => $grup,
    ':data' => json_encode($yoklama, JSON_UNESCAPED_UNICODE),
  ]);

  // Audit
  if ($withAudit) {
    $user = $_SESSION['soybis_user'] ?? null;
    if ($user) {
      $ua = $_SERVER['HTTP_USER_AGENT'] ?? null;
      $stmtA = $pdo->prepare(
        "INSERT INTO yoklama_audit
          (yoklamaTarih, yoklamaGrup, sporcuId, eskiDurum, yeniDurum, kullaniciId, kullaniciAdi, kullaniciRol, timestamp, cihaz, userAgent)
         VALUES
          (:yt, :yg, :sid, :eski, :yeni, :uid, :uadi, :uro, NOW(), :cihaz, :ua)"
      );
      $stmtA->execute([
        ':yt' => $tarih,
        ':yg' => $grup,
        ':sid' => $sporcuId,
        ':eski' => $eskiDurum,
        ':yeni' => $yeniDurum,
        ':uid' => (int)$user['id'],
        ':uadi' => (string)$user['kullaniciAdi'],
        ':uro' => (string)$user['rol'],
        ':cihaz' => 'web',
        ':ua' => $ua,
      ]);
    }
  }

  return ['ok' => true, 'yoklama' => $yoklama];
}

function yoklama_upsert_single(): void {
  soybis_session_start();
  require_login();

  $body = getJsonBody();
  $change = is_array($body) && array_key_exists('change', $body) ? ($body['change'] ?? []) : $body;

  $withAudit = array_key_exists('eskiDurum', $change) || array_key_exists('yeniDurum', $change);
  $res = yoklama_apply_change($change, $withAudit);
  if (isset($res['error'])) {
    respondJson(['error' => 'invalid payload'], 400);
  }
  respondJson(['ok' => true]);
}

function yoklama_batch(): void {
  soybis_session_start();
  require_login();

  $body = getJsonBody();
  $changes = $body['changes'] ?? [];
  if (!is_array($changes)) {
    respondJson(['error' => 'changes array required'], 400);
  }

  $pdo = db();
  $pdo->beginTransaction();
  try {
    $applied = 0;
    foreach ($changes as $c) {
      $withAudit = array_key_exists('eskiDurum', $c) || array_key_exists('yeniDurum', $c);
      $res = yoklama_apply_change($c, $withAudit);
      if (!isset($res['error'])) {
        $applied++;
      }
    }
    $pdo->commit();
    respondJson(['ok' => true, 'applied' => $applied]);
  } catch (Throwable $e) {
    $pdo->rollBack();
    respondJson(['error' => 'batch failed', 'detail' => $e->getMessage()], 500);
  }
}

?>

