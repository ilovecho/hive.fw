<?php
/**
 * inc_util_service.php  —  서비스 공통 유틸리티
 *
 * - 입력:  get_POST(), get_GET(), get_POSTMATCH()
 * - 출력:  outputJSON(), outputS02()
 * - 로깅:  trace_log()
 * - 기타:  make_uuid_v4(), make_random_string(), get_client_ip()
 */

// 운영 기본값은 false. 개발 시 상위에서 define('HIVE_DEBUG', true) 로 활성화.
if (!defined('HIVE_DEBUG')) define('HIVE_DEBUG', false);

/* ============================================================
 *  로깅
 * ============================================================ */
function trace_log(string $msg): void
{
    if (HIVE_DEBUG) error_log('[HIVE] ' . $msg);
}

/* ============================================================
 *  입력 헬퍼
 * ============================================================ */
function get_POST(string $key, $default = null)
{
    if (!isset($_POST[$key])) return $default;
    $v = $_POST[$key];
    return is_array($v) ? $v : trim($v);
}

function get_GET(string $key, $default = null)
{
    if (!isset($_GET[$key])) return $default;
    $v = $_GET[$key];
    return is_array($v) ? $v : trim($v);
}

/**
 * LIKE 검색 패턴 생성.
 * 값이 없으면 '' 반환 → <c: /> 조건 자동 제거됨.
 *
 * 예) get_POSTMATCH('keyword', '%@S%')
 *     POST['keyword'] = 'abc'  →  "%abc%"
 *     POST['keyword'] = ''     →  ""
 */
function get_POSTMATCH(string $key, string $pattern): string
{
    $v = get_POST($key, '');
    if ($v === '' || $v === null) return '';
    return str_replace('@S', $v, $pattern);
}

/* ============================================================
 *  출력 헬퍼
 * ============================================================ */

/** JSON 즉시 출력 후 종료 */
function outputJSON($data, string $status = 'success'): void
{
    if (!headers_sent()) header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['status' => $status, 'data' => $data], JSON_UNESCAPED_UNICODE);
    exit;
}

/** 라우터에서 포장하는 배열 반환 (outputJSON 대신 return 방식) */
function outputS02($data, string $status = 'success'): array
{
    return ['status' => $status, 'data' => $data];
}

/* ============================================================
 *  ID / 토큰 유틸
 * ============================================================ */
function make_uuid_v4(): string
{
    $d = random_bytes(16);
    $d[6] = chr((ord($d[6]) & 0x0f) | 0x40);
    $d[8] = chr((ord($d[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($d), 4));
}

function make_random_string(int $length = 32, string $chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'): string
{
    $result = '';
    $max = strlen($chars) - 1;
    for ($i = 0; $i < $length; $i++) $result .= $chars[random_int(0, $max)];
    return $result;
}

function get_client_ip(): string
{
    foreach (['HTTP_CLIENT_IP', 'HTTP_X_FORWARDED_FOR', 'REMOTE_ADDR'] as $key) {
        if (!empty($_SERVER[$key])) return trim(explode(',', $_SERVER[$key])[0]);
    }
    return '0.0.0.0';
}

function get_md5digest(string $userid, string $password): string
{
    return md5($userid . ':Hive Service Area:' . $password);
}

/* ============================================================
 *  비밀번호 해싱 (P3/H4)
 * ============================================================ */

/** 평문 → 안전한 해시 (bcrypt/argon2, PHP 기본 알고리즘) */
function hash_password(string $plain): string
{
    return password_hash($plain, PASSWORD_DEFAULT);
}

/**
 * 비밀번호 검증.
 *  - 최신 해시($2y$/$argon...)는 password_verify
 *  - 레거시 SHA-256(64-hex)은 임시 호환 → 성공 시 재해시 필요 표시
 *
 * @param bool $needsRehash 검증 성공 후 password_hash 로 갱신 필요 여부
 */
function verify_password(string $plain, string $stored, bool &$needsRehash = false): bool
{
    $needsRehash = false;
    if ($stored === '') return false;

    // 최신 해시 형식
    if ($stored[0] === '$') {
        if (password_verify($plain, $stored)) {
            $needsRehash = password_needs_rehash($stored, PASSWORD_DEFAULT);
            return true;
        }
        return false;
    }

    // 레거시 SHA-256(64-hex) 호환 — 성공 시 최신 해시로 마이그레이션 권장
    if (preg_match('/^[0-9a-f]{64}$/i', $stored)
        && hash_equals(strtolower($stored), hash('sha256', $plain))) {
        $needsRehash = true;
        return true;
    }

    return false;
}
