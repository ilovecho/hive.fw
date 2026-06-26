<?php
/**
 * download.php  —  첨부파일 다운로드 (GET, 로그인 필요)
 *
 *   download.php?att=<memo_attach.oid>
 *
 * - 세션 로그인 검사 (라우터와 동일 정책)
 * - att_id 로 원본 파일명 + 저장 파일을 찾아 attachment 로 전송
 * - 항상 application/octet-stream + Content-Disposition: attachment
 *   (인라인 실행/스크립트 렌더 방지)
 */

if (!session_id()) {
    $secure = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
    session_set_cookie_params([
        'lifetime' => 0, 'path' => '/', 'secure' => $secure,
        'httponly' => true, 'samesite' => 'Strict',
    ]);
    session_start();
}

require_once __DIR__ . '/inc/inc_db_system.php';
require_once __DIR__ . '/inc/inc_util_service.php';

// 로그인 필요
if (empty($_SESSION['userid'])) {
    http_response_code(401);
    header('Content-Type: text/plain; charset=utf-8');
    exit('로그인이 필요합니다.');
}

$attId = (string)($_GET['att'] ?? '');
if (!ctype_digit($attId) || (int)$attId <= 0) {
    http_response_code(400);
    exit('잘못된 요청입니다.');
}
$attId = (int)$attId;

try {
    $rows = get_sql(
        "SELECT a.filename, d.storage, d.sizeof
         FROM memo_attach a JOIN document d ON d.oid = a.doc_id
         WHERE a.oid = :a",
        [':a' => $attId]
    );
} catch (Throwable $e) {
    http_response_code(500);
    exit('서버 오류');
}

if (!$rows) {
    http_response_code(404);
    exit('파일을 찾을 수 없습니다.');
}

$filename = (string)$rows[0]['filename'];
$storage  = basename((string)$rows[0]['storage']);   // 경로 이탈 방지
$path     = __DIR__ . '/document/' . $storage;

if ($storage === '' || !is_file($path)) {
    http_response_code(404);
    exit('파일이 존재하지 않습니다.');
}

// 헤더 인젝션 방지용 정리
$asciiName = preg_replace('/[^\x20-\x7E]/', '_', $filename);
$asciiName = str_replace(['"', '\\'], '_', $asciiName);

while (ob_get_level() > 0) ob_end_clean();

header('Content-Type: application/octet-stream');
header('Content-Disposition: attachment; filename="' . $asciiName . '"; '
     . "filename*=UTF-8''" . rawurlencode($filename));
header('Content-Length: ' . filesize($path));
header('X-Content-Type-Options: nosniff');
header('Cache-Control: private, no-store');

readfile($path);
exit;
