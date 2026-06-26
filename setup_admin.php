<?php
/**
 * setup_admin.php  —  관리자 비밀번호 설정 (CLI 전용)
 *
 * 기존 비밀번호 평문을 모를 때, 또는 초기 계정을 만들 때 사용.
 * password_hash 로 안전하게 저장한다.
 *
 * 사용법 (서버 셸에서):
 *   php setup_admin.php <userid> <password> [name]
 *
 * 예:
 *   php setup_admin.php system_admin 'NewP@ss123'
 *
 * - 해당 userid 가 있으면 비밀번호 갱신(+state='1' 활성화)
 * - 없으면 최소 필드로 새로 생성
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('This script can only be run from the command line.');
}

require_once __DIR__ . '/inc/inc_db_system.php';
require_once __DIR__ . '/inc/inc_util_service.php';

$userid = $argv[1] ?? '';
$plain  = $argv[2] ?? '';
$name   = $argv[3] ?? $userid;

if ($userid === '' || $plain === '') {
    fwrite(STDERR, "Usage: php setup_admin.php <userid> <password> [name]\n");
    exit(1);
}

$hash = hash_password($plain);
$pdo  = DB::getConnection();

$exists = get_link("SELECT COUNT(*) FROM users WHERE userid = :userid", [':userid' => $userid]);

if ((int)$exists > 0) {
    set_sql(
        "UPDATE users SET password = :pw, state = '1' WHERE userid = :userid",
        [':pw' => $hash, ':userid' => $userid]
    );
    echo "[OK] '{$userid}' 비밀번호를 갱신하고 활성화했습니다.\n";
} else {
    // 최소 필드로 신규 생성 (NOT NULL 컬럼 채움)
    set_sql(
        "INSERT INTO users (userid, name, md5id, password, md5digest, provider, rolecode, masterkey, state, enrolled)
         VALUES (:userid, :name, :md5id, :pw, :digest, 'id', 'A', 0, '1', datetime('now','localtime'))",
        [
            ':userid' => $userid,
            ':name'   => $name,
            ':md5id'  => md5($userid . microtime(true)),
            ':pw'     => $hash,
            ':digest' => get_md5digest($userid, $plain),
        ]
    );
    echo "[OK] 관리자 '{$userid}' 계정을 생성했습니다.\n";
}
