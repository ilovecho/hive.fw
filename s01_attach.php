<?php
/**
 * s01_attach.php  —  메모 첨부파일 서비스 (콘텐츠 주소 + 참조 카운팅)
 *
 * func           설명
 * ------------   -------------------------------------------
 * list_attach    메모의 첨부 목록 (memo_id)
 * upload_attach  파일 업로드 (memo_id, file) — 동일 내용은 중복 저장 안 함
 * delete_attach  첨부 1건 해제 (att_id) — 마지막 참조면 실제 파일 삭제
 *
 * 저장 구조
 *   document/<md5>          : 실제 파일 1개 (내용 해시로 중복 제거)
 *   document(테이블)        : md5key(UNIQUE), storage, sizeof, mimetype
 *   memo_attach(테이블)     : memo_id ↔ doc_id 참조 + 원본 파일명
 *
 * 참조 카운팅
 *   memo_attach 에서 doc_id 참조 수가 0 이 되면 document 행 + 물리 파일 삭제.
 *   여러 메모가 같은 파일을 참조하면 모든 참조가 사라지기 전까지 보존.
 */

$services['list_attach']   = '_list_attach';
$services['upload_attach'] = '_upload_attach';
$services['delete_attach'] = '_delete_attach';

/** 업로드 최대 크기 (바이트) */
const ATTACH_MAX_BYTES = 10485760;   // 10MB

/** 첨부 저장 디렉터리 */
function _attach_dir(): string
{
    return __DIR__ . '/document';
}

/* ── 테이블/디렉터리 준비 ──────────────────────────── */
function _attach_tables(): void
{
    $pdo = DB::getConnection();
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS document (
            oid      INTEGER PRIMARY KEY AUTOINCREMENT,
            md5key   TEXT    NOT NULL UNIQUE,
            storage  TEXT    NOT NULL,
            sizeof   INTEGER NOT NULL DEFAULT 0,
            mimetype TEXT,
            created  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
        )
    ");
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS memo_attach (
            oid      INTEGER PRIMARY KEY AUTOINCREMENT,
            memo_id  INTEGER NOT NULL,
            doc_id   INTEGER NOT NULL,
            filename TEXT    NOT NULL,
            created  TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
            UNIQUE(memo_id, doc_id)
        )
    ");
}

function _attach_ensure_dir(): string
{
    $dir = _attach_dir();
    if (!is_dir($dir) && !mkdir($dir, 0770, true) && !is_dir($dir)) {
        throw new RuntimeException('첨부 저장 디렉터리를 만들 수 없습니다. document 폴더 쓰기 권한을 확인하세요.');
    }
    if (!is_writable($dir)) {
        throw new RuntimeException('첨부를 저장할 수 없습니다. document 디렉터리 쓰기 권한(웹서버 사용자)을 확인하세요.');
    }
    return $dir;
}

/** 파일명 정리 (헤더 인젝션/경로 이탈 방지) */
function _attach_safe_name($name): string
{
    $name = (string)$name;
    $name = str_replace(["\r", "\n", "\0", '"', '\\', '/'], '_', $name);
    $name = basename($name);
    $name = str_limit($name, 200);
    return $name === '' ? 'file' : $name;
}

/** 메모 존재 확인 */
function _attach_memo_exists(int $memoId): bool
{
    if ($memoId <= 0) return false;
    return (int)get_link("SELECT COUNT(*) FROM memo WHERE oid = :oid", [':oid' => $memoId]) > 0;
}

/** 첨부 목록 조회 (배열 반환) */
function _attach_rows(int $memoId): array
{
    return get_sql(
        "SELECT a.oid AS att_id, a.doc_id, a.filename, d.sizeof, d.md5key
         FROM memo_attach a JOIN document d ON d.oid = a.doc_id
         WHERE a.memo_id = :mid
         ORDER BY a.oid",
        [':mid' => $memoId]
    );
}

/**
 * 참조 카운팅 GC: doc_id 참조가 0 이면 물리 파일 + document 행 삭제.
 */
function _attach_gc(int $docId): void
{
    if ($docId <= 0) return;
    $cnt = (int)get_link("SELECT COUNT(*) FROM memo_attach WHERE doc_id = :d", [':d' => $docId]);
    if ($cnt > 0) return;   // 아직 참조하는 메모가 있으면 보존

    $storage = get_link("SELECT storage FROM document WHERE oid = :d", [':d' => $docId]);
    if (is_string($storage) && $storage !== '') {
        $path = _attach_dir() . '/' . basename($storage);
        if (is_file($path)) @unlink($path);
    }
    set_sql("DELETE FROM document WHERE oid = :d", [':d' => $docId]);
}

/**
 * 메모 삭제 시 호출: 해당 메모의 모든 첨부 참조 제거 후 GC.
 * (s01_memo.php 의 delete_memo 에서 function_exists 로 호출)
 */
function attach_purge_memo(int $memoId): void
{
    _attach_tables();
    $docIds = get_sql("SELECT DISTINCT doc_id FROM memo_attach WHERE memo_id = :m", [':m' => $memoId]);
    set_sql("DELETE FROM memo_attach WHERE memo_id = :m", [':m' => $memoId]);
    foreach ($docIds as $row) {
        _attach_gc((int)$row['doc_id']);
    }
}

/* ── list_attach ───────────────────────────────────── */
function _list_attach(): void
{
    _attach_tables();
    $memoId = _memo_oid(get_POST('memo_id', ''));
    if ($memoId <= 0) outputJSON('유효하지 않은 memo_id 입니다.', 'error');
    outputJSON(_attach_rows($memoId));
}

/* ── upload_attach ─────────────────────────────────── */
function _upload_attach(): void
{
    _attach_tables();

    $memoId = _memo_oid(get_POST('memo_id', ''));
    if (!_attach_memo_exists($memoId)) outputJSON('먼저 메모를 저장한 뒤 첨부할 수 있습니다.', 'error');

    if (!isset($_FILES['file']) || !is_array($_FILES['file'])) outputJSON('첨부할 파일이 없습니다.', 'error');
    $f = $_FILES['file'];

    if (($f['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        outputJSON('파일 업로드에 실패했습니다. (코드 ' . ($f['error'] ?? '?') . ')', 'error');
    }
    if (!is_uploaded_file($f['tmp_name'])) outputJSON('잘못된 업로드입니다.', 'error');
    if ((int)$f['size'] <= 0) outputJSON('빈 파일은 첨부할 수 없습니다.', 'error');
    if ((int)$f['size'] > ATTACH_MAX_BYTES) {
        outputJSON('파일이 너무 큽니다. 최대 ' . (ATTACH_MAX_BYTES / 1048576) . 'MB 까지 가능합니다.', 'error');
    }

    $dir  = _attach_ensure_dir();
    $md5  = md5_file($f['tmp_name']);
    if ($md5 === false) outputJSON('파일 해시 계산에 실패했습니다.', 'error');

    // 동일 내용 파일이 이미 있으면 재사용 (중복 저장 안 함)
    $docId = get_link("SELECT oid FROM document WHERE md5key = :m", [':m' => $md5]);
    if ($docId === null) {
        $storage = $md5;
        $dest    = $dir . '/' . $storage;
        if (!is_file($dest)) {
            if (!move_uploaded_file($f['tmp_name'], $dest)) {
                outputJSON('파일 저장에 실패했습니다. document 디렉터리 권한을 확인하세요.', 'error');
            }
            @chmod($dest, 0640);
        }
        set_sql(
            "INSERT INTO document (md5key, storage, sizeof, mimetype) VALUES (:m, :s, :z, :t)",
            [':m' => $md5, ':s' => $storage, ':z' => (int)$f['size'], ':t' => (string)($f['type'] ?? '')]
        );
        $docId = DB::getConnection()->lastInsertId();
    }

    // 메모-파일 연결 (이미 연결돼 있으면 무시)
    $filename = _attach_safe_name($f['name'] ?? 'file');
    set_sql(
        "INSERT OR IGNORE INTO memo_attach (memo_id, doc_id, filename) VALUES (:m, :d, :f)",
        [':m' => $memoId, ':d' => (int)$docId, ':f' => $filename]
    );

    outputJSON(_attach_rows($memoId));
}

/* ── delete_attach ─────────────────────────────────── */
function _delete_attach(): void
{
    _attach_tables();

    $attId = _memo_oid(get_POST('att_id', ''));
    if ($attId <= 0) outputJSON('유효하지 않은 att_id 입니다.', 'error');

    $row = get_sql("SELECT memo_id, doc_id FROM memo_attach WHERE oid = :a", [':a' => $attId]);
    if (!$row) outputJSON('첨부를 찾을 수 없습니다.', 'error');

    $memoId = (int)$row[0]['memo_id'];
    $docId  = (int)$row[0]['doc_id'];

    set_sql("DELETE FROM memo_attach WHERE oid = :a", [':a' => $attId]);
    _attach_gc($docId);   // 마지막 참조였으면 실제 파일 삭제

    outputJSON(_attach_rows($memoId));
}
