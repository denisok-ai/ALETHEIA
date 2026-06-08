<?php
/**
 * Одноразовый CLI для Mailcow: заполнить _sogo_static_view через штатную PHP-функцию.
 * Запускать ВНУТРИ контейнера php-fpm-mailcow:
 *   php /path/to/this/file.php
 *
 * Не вызывает init_db_schema() (в отличие от полного init_db.inc.php).
 */
// Mailcow ожидает инклюды относительно /web
$_SERVER['SERVER_NAME'] = 'localhost';
$_SERVER['HTTP_HOST'] = 'localhost';

require_once '/web/inc/vars.inc.php';
require_once '/web/inc/functions.inc.php';
require_once '/web/inc/functions.docker.inc.php';

$dsn = $database_type . ':unix_socket=' . $database_sock . ';dbname=' . $database_name;
$opt = [
  PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
  PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
  PDO::ATTR_EMULATE_PREPARES => false,
];

$pdo = new PDO($dsn, $database_user, $database_pass, $opt);
$GLOBALS['pdo'] = $pdo;

if (getenv('SKIP_SOGO') === 'y') {
  fwrite(STDERR, "SKIP_SOGO=y — выход.\n");
  exit(1);
}

update_sogo_static_view(null);
echo "update_sogo_static_view OK\n";

try {
  $m = new Memcached();
  $m->addServer('memcached', 11211);
  $m->flush();
  echo "memcached flush OK\n";
} catch (Throwable $e) {
  fwrite(STDERR, 'memcached: ' . $e->getMessage() . "\n");
}
