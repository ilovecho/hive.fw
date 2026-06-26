<?php
/**
 * s01_memo.php  —  메모 CRUD 샘플 서비스
 *
 * func          설명
 * ----------    ----------------------------
 * list_memo     메모 목록 조회 (키워드 검색)
 * get_memo      단일 메모 조회 (oid)
 * save_memo     저장 (oid 없으면 INSERT, 있으면 UPDATE)
 * delete_memo   삭제
 */

$services['list_memo']   = '_list_memo';
$services['get_memo']    = '_get_memo';
$services['save_memo']   = '_save_memo';
$services['delete_memo'] = '_delete_memo';

/** 허용 분류값 (화이트리스트) */
const MEMO_CATEGORIES = ['일반', '업무', '개인'];

/** 키워드 최대 길이 (DoS 완화) */
const MEMO_KEYWORD_MAX = 100;

/** 목록 최대 반환 행 수 */
const MEMO_LIST_LIMIT = 500;

/**
 * oid 입력을 양의 정수로 정규화. 유효하지 않으면 0 반환.
 */
function _memo_oid($raw): int
{
    if ($raw === '' || $raw === null) return 0;
    if (!ctype_digit((string)$raw)) return 0;   // 숫자만 허용
    return (int)$raw;
}

/** 분류값 정규화: 허용 목록에 없으면 기본값 '일반' */
function _memo_category($raw): string
{
    $v = is_string($raw) ? trim($raw) : '';
    return in_array($v, MEMO_CATEGORIES, true) ? $v : '일반';
}

/** 완료값 정규화: '1' 또는 '0' */
function _memo_done($raw): string
{
    return ($raw === '1' || $raw === 1 || $raw === true || $raw === 'true') ? '1' : '0';
}

/* ── 테이블 자동 생성 ──────────────────────────────── */
function _memo_table(): void
{
    DB::getConnection()->exec("
        CREATE TABLE IF NOT EXISTS memo (
            oid      INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT    NOT NULL DEFAULT '일반',
            title    TEXT    NOT NULL DEFAULT '',
            content  TEXT    NOT NULL DEFAULT '',
            done     TEXT    NOT NULL DEFAULT '0',
            created  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
        )
    ");
}

/* ── list_memo ─────────────────────────────────────── */
function _list_memo(): void
{
    _memo_table();

    // 키워드 길이 제한 (과도한 LIKE 검색 방지) — mbstring 없이도 동작
    $rawKeyword = str_limit((string)get_POST('keyword', ''), MEMO_KEYWORD_MAX);
    $keyword    = ($rawKeyword === '') ? '' : '%' . $rawKeyword . '%';
    $category   = get_POST('category', '');

    $limit = MEMO_LIST_LIMIT;
    $sql = <<<SQL
SELECT oid, category, title, content, done, created
FROM   memo
WHERE  1=1
<c: AND category = :category />
<c: AND (title LIKE :keyword OR content LIKE :keyword) />
ORDER  BY oid DESC
LIMIT  {$limit}
SQL;

    $rows = get_sql($sql, [':category' => $category, ':keyword' => $keyword]);
    outputJSON(['list' => $rows, 'total' => count($rows)]);
}

/* ── get_memo ──────────────────────────────────────── */
function _get_memo(): void
{
    _memo_table();

    $oid = _memo_oid(get_POST('oid', ''));
    if ($oid <= 0) outputJSON('유효하지 않은 oid 입니다.', 'error');

    $rows = get_sql(
        "SELECT oid, category, title, content, done, created FROM memo WHERE oid = :oid",
        [':oid' => $oid]
    );
    outputJSON($rows ? $rows[0] : null);
}

/* ── save_memo ─────────────────────────────────────── */
function _save_memo(): void
{
    _memo_table();

    $oid      = _memo_oid(get_POST('oid', ''));
    $title    = get_POST('title', '');
    $content  = get_POST('content', '');
    $category = _memo_category(get_POST('category', '일반'));
    $done     = _memo_done(get_POST('done', '0'));

    if (trim($title) === '') outputJSON('제목을 입력하세요.', 'error');

    if ($oid <= 0) {
        set_sql(
            "INSERT INTO memo (category, title, content, done) VALUES (:category, :title, :content, :done)",
            [':category' => $category, ':title' => $title, ':content' => $content, ':done' => $done]
        );
        $newOid = DB::getConnection()->lastInsertId();
        outputJSON(['msg' => '저장되었습니다.', 'oid' => $newOid]);
    } else {
        set_sql(
            "UPDATE memo SET category=:category, title=:title, content=:content, done=:done WHERE oid=:oid",
            [':category' => $category, ':title' => $title, ':content' => $content, ':done' => $done, ':oid' => $oid]
        );
        outputJSON(['msg' => '수정되었습니다.', 'oid' => $oid]);
    }
}

/* ── delete_memo ───────────────────────────────────── */
function _delete_memo(): void
{
    $oid = _memo_oid(get_POST('oid', ''));
    if ($oid <= 0) outputJSON('삭제할 항목이 없습니다.', 'error');

    // 첨부 참조 정리 (마지막 참조면 실제 파일까지 삭제)
    if (function_exists('attach_purge_memo')) attach_purge_memo($oid);

    set_sql("DELETE FROM memo WHERE oid=:oid", [':oid' => $oid]);
    outputJSON('삭제되었습니다.');
}
