<?php
// DB ve uygulama ayarları
// cPanel panelinden aldığınız bilgileri buraya koyun.
// Güvenlik için bu dosyayı herkese açık hale getirmeyin.
//
// db.host: Genelde localhost; uzak MySQL (RDS, hosting "Remote MySQL") ise panelde verilen hostname.
// db.name / user / pass: cPanel → MySQL Databases ile oluşturduğunuz veritabanı ve kullanıcı.
//
// session.secure: Üretimde site HTTPS ise true yapın (çerezin yalnızca TLS ile gitmesi).
// session.samesite: Frontend farklı bir origin'den (ayrı subdomain) API'ye istek atıyorsa
//   CORS ile birlikte çoğu senaryoda 'None' + secure=true gerekir; aynı site + /api için 'Lax' yeterlidir.

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
    // cPanel'de HTTPS varsa true önerilir (secure => false yalnızca düz HTTP geliştirme içindir).
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

