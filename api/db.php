<?php
declare(strict_types=1);

function soybis_config(): array {
  /** @var array $cfg */
  $cfg = require __DIR__ . '/config.php';
  return $cfg;
}

function db(): PDO {
  static $pdo = null;
  if ($pdo !== null) {
    return $pdo;
  }

  $cfg = soybis_config();
  $db = $cfg['db'];

  $dsn = sprintf('mysql:host=%s;dbname=%s;charset=%s', $db['host'], $db['name'], $db['charset']);

  $pdo = new PDO($dsn, $db['user'], $db['pass'], [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES => false,
  ]);

  return $pdo;
}

function respondJson(mixed $data, int $status = 200): void {
  http_response_code($status);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode($data, JSON_UNESCAPED_UNICODE);
  exit;
}

function getJsonBody(): array {
  $raw = file_get_contents('php://input');
  if ($raw === false || trim($raw) === '') {
    return [];
  }
  $data = json_decode($raw, true);
  return is_array($data) ? $data : [];
}

function readPath(): string {
  $uri = $_SERVER['REQUEST_URI'] ?? '';
  $base = '/api/';
  // /api -> boş endpoint
  if (rtrim($uri, '/') === '/api') return '';

  $pos = strpos($uri, $base);
  if ($pos === false) return '';

  $path = substr($uri, $pos + strlen($base));
  $path = trim($path, '/');
  return $path;
}

?>

