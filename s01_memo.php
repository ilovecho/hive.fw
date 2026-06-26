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

/**
 * oid 입력을 양의 정수로 정규화. 유효하지 않으면 0 반환.
 */
function _memo_oid($raw): int
{
    if ($raw === '' || $raw === null) return 0;
    if (!ctype_digit((string)$raw)) return 0;   // 숫자만 허용
    return (int)$raw;
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

    $keyword  = get_POSTMATCH('keyword',  '%@S%');
    $category = get_POST('category', '');

    $sql = <<<SQL
SELECT oid, category, title, content, done, created
FROM   memo
WHERE  1=1
<c: AND category = :category />
<c: AND (title LIKE :keyword OR content LIKE :keyword) />
ORDER  BY oid DESC
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
    $category = get_POST('category', '일반');
    $done     = get_POST('done', '0');

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

    set_sql("DELETE FROM memo WHERE oid=:oid", [':oid' => $oid]);
    outputJSON('삭제되었습니다.');
}
