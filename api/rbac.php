<?php
declare(strict_types=1);

function user_role(): ?string {
  return $_SESSION['soybis_user']['rol'] ?? null;
}

function require_login(): void {
  if (!isset($_SESSION['soybis_user'])) {
    respondJson(['error' => 'Unauthorized'], 401);
  }
}

function require_roles(array $roles): void {
  $role = user_role();
  if ($role === null || !in_array($role, $roles, true)) {
    respondJson(['error' => 'Forbidden'], 403);
  }
}

?>

