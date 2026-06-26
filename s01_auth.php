<?php
/**
 * s01_auth.php  —  인증/세션 서비스 (P1/P2/P3)
 *
 * func        설명                         공개여부
 * ---------   --------------------------   --------
 * login       로그인 (CSRF 토큰 발급)       공개
 * logout      로그아웃                      보호
 * get_csrf    CSRF 토큰 재발급              보호
 * whoami      현재 세션 사용자 정보          보호
 *
 * 비밀번호: password_hash/verify (레거시 SHA-256 자동 마이그레이션)
 * CSRF    : 세션 저장 + XSRF-TOKEN 쿠키(이중 제출). 라우터가 검증.
 */

$services['login']    = '_auth_login';
$services['logout']   = '_auth_logout';
$services['get_csrf'] = '_auth_get_csrf';
$services['whoami']   = '_auth_whoami';

/**
 * CSRF 토큰 발급: 세션에 저장하고 JS가 읽을 수 있는 쿠키로도 내려준다.
 * (anhive.base.js 가 XSRF-TOKEN 쿠키를 읽어 X-CSRF-TOKEN 헤더로 전송)
 */
function auth_issue_csrf(): string
{
    $token = bin2hex(random_bytes(32));
    $_SESSION['csrf'] = $token;

    $secure = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
    setcookie('XSRF-TOKEN', $token, [
        'expires'  => 0,
        'path'     => '/',
        'secure'   => $secure,
        'httponly' => false,        // JS가 읽어 헤더로 보내야 하므로 false
        'samesite' => 'Strict',
    ]);
    return $token;
}

/* ── login ─────────────────────────────────────────── */
function _auth_login(): void
{
    $userid   = get_POST('userid', '');
    $password = get_POST('password', '');

    if ($userid === '' || $password === '') {
        outputJSON('아이디와 비밀번호를 입력하세요.', 'error');
    }

    // 탈퇴(state=9) 제외하고 조회
    $rows = get_sql(
        "SELECT userid, name, password, rolecode, state FROM users WHERE userid = :userid AND state < '9'",
        [':userid' => $userid]
    );
    if (!$rows) {
        // 사용자 존재 여부를 구분 노출하지 않음
        outputJSON('아이디 또는 비밀번호가 올바르지 않습니다.', 'error');
    }
    $u = $rows[0];

    $needsRehash = false;
    if (!verify_password($password, (string)$u['password'], $needsRehash)) {
        outputJSON('아이디 또는 비밀번호가 올바르지 않습니다.', 'error');
    }

    // 레거시/구식 해시면 최신 해시로 마이그레이션
    if ($needsRehash) {
        set_sql(
            "UPDATE users SET password = :pw WHERE userid = :userid",
            [':pw' => hash_password($password), ':userid' => $userid]
        );
    }

    // 세션 고정 공격 방지
    session_regenerate_id(true);
    $_SESSION['userid']   = $u['userid'];
    $_SESSION['name']     = $u['name'];
    $_SESSION['rolecode'] = $u['rolecode'];

    $csrf = auth_issue_csrf();

    outputJSON([
        'userid'   => $u['userid'],
        'name'     => $u['name'],
        'rolecode' => $u['rolecode'],
        'csrf'     => $csrf,
    ]);
}

/* ── logout ────────────────────────────────────────── */
function _auth_logout(): void
{
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
    }
    setcookie('XSRF-TOKEN', '', time() - 42000, '/');
    session_destroy();
    outputJSON('로그아웃되었습니다.');
}

/* ── get_csrf ──────────────────────────────────────── */
function _auth_get_csrf(): void
{
    // 세션에 토큰이 있으면 재사용, 없으면 새로 발급
    $token = $_SESSION['csrf'] ?? '';
    if ($token === '') $token = auth_issue_csrf();
    outputJSON(['csrf' => $token]);
}

/* ── whoami ────────────────────────────────────────── */
function _auth_whoami(): void
{
    outputJSON([
        'userid'   => $_SESSION['userid']   ?? null,
        'name'     => $_SESSION['name']     ?? null,
        'rolecode' => $_SESSION['rolecode'] ?? null,
    ]);
}
