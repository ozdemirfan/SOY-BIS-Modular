<?php
// DB ve uygulama ayarları
// cPanel panelinden aldığınız bilgileri buraya koyun.
// Güvenlik için bu dosyayı herkese açık hale getirmeyin.

declare(strict_types=1);

return [
  'db' => [
    'host' => 'localhost',
    'name' => 'soybis',
    'user' => 'root',
    'pass' => '',
    'charset' => 'utf8mb4',
  ],
  'session' => [
    'name' => 'soybis_session',
    // cPanel'de HTTPS varsa otomatik secure olabilir; MVP için kapalı bırakıyoruz.
    'secure' => false,
    'httponly' => true,
    'samesite' => 'Lax',
  ],
  'default_admin' => [
    'kullaniciAdi' => 'admin',
    'sifreHash' => '', // Boş bırakın: sistem başlatmada hash üretilecek.
    'adSoyad' => 'Sistem Yöneticisi',
    'email' => '',
    'rol' => 'Yönetici',
    'aktif' => 1,
    'sifreDuzMetin' => '1234', // Sadece bootstrap için.
  ],
];

