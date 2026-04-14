<?php
// Bu dosyayı kopyalayın: cp config.example.php config.php
// Ardından cPanel MySQL bilgilerinizi girin. config.php Git'e eklenmez.

declare(strict_types=1);

return [
  'db' => [
    'host' => 'localhost',
    'name' => 'your_database_name',
    'user' => 'your_database_user',
    'pass' => 'your_database_password',
    'charset' => 'utf8mb4',
  ],
  'session' => [
    'name' => 'soybis_session',
    'secure' => false,
    'httponly' => true,
    'samesite' => 'Lax',
  ],
  'default_admin' => [
    'kullaniciAdi' => 'admin',
    'sifreHash' => '',
    'adSoyad' => 'Sistem Yöneticisi',
    'email' => '',
    'rol' => 'Yönetici',
    'aktif' => 1,
    'sifreDuzMetin' => '1234',
  ],
];
