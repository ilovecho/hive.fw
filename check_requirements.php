<?php
/**
 * check_requirements.php  —  설치 환경 점검 (CLI 전용)
 *
 * 사용법:  php check_requirements.php
 *
 * PHP 버전, 필수/권장 확장, db 디렉터리·파일 쓰기 권한을 확인한다.
 * 모든 [필수] 항목이 OK 면 설치 준비 완료.
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('This script can only be run from the command line.');
}

$ok = true;
$line = function ($pass, $label, $note = '') use (&$ok) {
    if (!$pass) $ok = false;
    printf("  [%s] %s%s\n", $pass ? 'OK' : 'X ', $label, $note ? "  ($note)" : '');
};

echo "== Hive.fw 설치 점검 ==\n\n";

// PHP 버전 (배열형 setcookie/session 옵션은 7.3+ 필요)
echo "PHP 버전\n";
$line(version_compare(PHP_VERSION, '7.3.0', '>='), 'PHP >= 7.3', PHP_VERSION);

// 필수 확장
echo "\n필수 확장\n";
$line(extension_loaded('pdo'),        'pdo');
$line(extension_loaded('pdo_sqlite'), 'pdo_sqlite', 'apt install php-sqlite3');
$line(extension_loaded('json'),       'json');

// 권장 확장 (없어도 동작은 하지만 권장)
echo "\n권장 확장\n";
printf("  [%s] mbstring  (apt install php-mbstring)\n", extension_loaded('mbstring') ? 'OK' : '- ');
printf("  [%s] curl      (서버간 연동 wget_post 용)\n",   extension_loaded('curl')     ? 'OK' : '- ');

// DB 경로 쓰기 권한
echo "\nDB 쓰기 권한\n";
$dbDir  = __DIR__ . '/db';
$dbFile = $dbDir . '/hive.db';
$line(is_dir($dbDir) && is_writable($dbDir), 'db 디렉터리 쓰기 가능', $dbDir);
if (file_exists($dbFile)) {
    $line(is_writable($dbFile), 'hive.db 쓰기 가능', $dbFile);
} else {
    printf("  [- ] hive.db 없음 — 최초 접근 시 자동 생성 시도 (디렉터리 쓰기 권한 필요)\n");
}

echo "\n결과: " . ($ok ? "설치 준비 완료 ✅\n" : "필수 항목 누락 ❌ — 위 X 항목을 해결하세요.\n");
exit($ok ? 0 : 1);
