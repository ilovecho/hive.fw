<?php
/**
 * s00_s2service.php  —  Hive.fw 서비스 라우터
 *
 * 모든 AJAX 호출의 진입점.
 * $_POST['func'] 값으로 $services 배열에서 핸들러 함수를 찾아 호출.
 *
 * 서비스 추가 방법:
 *   1. s01_xxx.php 파일 작성 후 $services['func_name'] = '_fn_name'; 등록
 *   2. 아래 $serviceFiles 배열에 경로 추가
 */

// 세션 쿠키 하드닝 (HttpOnly/SameSite/Secure) — session_start 이전에 설정
if (!session_id()) {
    $secure = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'secure'   => $secure,
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    session_start();
}

if (!headers_sent()) {
    header('Content-Type: application/json; charset=UTF-8');
    // 보안 응답 헤더 (M5)
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: same-origin');
}

$rootDir = realpath(__DIR__);
require_once $rootDir . '/inc/inc_db_system.php';
require_once $rootDir . '/inc/inc_util_service.php';

/* ── 서비스 레지스트리 ─────────────────────────────── */
$services = [];

$serviceFiles = [
    __DIR__ . '/s01_auth.php',      // 인증/세션 (login/logout/get_csrf/whoami)
    __DIR__ . '/s01_memo.php',      // 샘플: 메모 CRUD
    // __DIR__ . '/s01_xxx.php',    // 추가 서비스는 여기에
];

/*
 * 비로그인 허용 함수 화이트리스트.
 * 여기에 없는 모든 func 는 로그인 + CSRF 검증을 요구한다.
 */
$public_funcs = ['login'];

foreach ($serviceFiles as $file) {
    if (file_exists($file)) require_once $file;
    else trace_log('[WARN] service not found: ' . $file);
}

/* ── 공통 응답 헬퍼 ────────────────────────────────── */
function _respond(array $payload): void
{
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function _error(string $msg, int $code = 400): void
{
    if (!headers_sent()) http_response_code($code);
    _respond(['status' => 'error', 'data' => $msg]);
}

/* ── 라우팅 ─────────────────────────────────────────── */
if (strtoupper($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') _error('POST only', 405);

$func = trim($_POST['func'] ?? '');
if ($func === '') _error('func 파라미터가 없습니다.', 400);

global $services, $public_funcs;
if (!isset($services[$func]) || !function_exists($services[$func])) {
    _error("알 수 없는 서비스: $func", 404);
}

/* ── 인증 게이트 (C1) + CSRF 검증 (H1) ──────────────── */
if (!in_array($func, $public_funcs, true)) {
    // 1) 로그인 필요
    if (empty($_SESSION['userid'])) {
        _error('로그인이 필요합니다.', 401);
    }
    // 2) CSRF 토큰 검증 (헤더 X-CSRF-TOKEN 또는 POST _csrf)
    $sent = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? ($_POST['_csrf'] ?? '');
    $sess = $_SESSION['csrf'] ?? '';
    if ($sess === '' || !is_string($sent) || !hash_equals($sess, $sent)) {
        _error('CSRF 검증에 실패했습니다. 다시 로그인해주세요.', 403);
    }
}

$user = $_SESSION['userid'] ?? 'anonymous';
trace_log("CALL func=$func user=$user ip=" . get_client_ip());

try {
    $result = call_user_func($services[$func]);
    if ($result !== null) _respond(is_array($result) ? $result : ['status' => 'success', 'data' => $result]);
} catch (Throwable $ex) {
    // 상세는 서버 로그로만, 클라이언트에는 일반 메시지 (내부정보 유출 방지)
    trace_log('[EXCEPTION] ' . $ex->getMessage() . ' @ ' . $ex->getFile() . ':' . $ex->getLine());
    _error('요청 처리 중 오류가 발생했습니다.', 500);
}
