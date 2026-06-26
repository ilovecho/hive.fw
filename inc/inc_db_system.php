<?php
/**
 * inc_db_system.php  —  PDO 기반 DB 공통 모듈
 *
 * 설정 (상위에서 define 하지 않으면 기본값 사용):
 *   define('DB_DSN',  'sqlite:/path/to/hive.db');
 *   define('DB_USER', '');
 *   define('DB_PASS', '');
 */

if (!defined('DB_DSN'))  define('DB_DSN',  'sqlite:' . dirname(__DIR__) . '/db/hive.db');
if (!defined('DB_USER')) define('DB_USER', '');
if (!defined('DB_PASS')) define('DB_PASS', '');

/* ============================================================
 *  DB 싱글톤
 * ============================================================ */
class DB
{
    private static $pdo = null;

    public static function getConnection(): PDO
    {
        if (self::$pdo instanceof PDO) return self::$pdo;

        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ];

        try {
            $dsn = DB_DSN;
            if (strpos($dsn, 'sqlite:') === 0) {
                self::_ensureSqliteDir($dsn);
                self::$pdo = new PDO($dsn, null, null, $options);
                self::$pdo->exec('PRAGMA foreign_keys = ON');
            } else {
                self::$pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
            }
        } catch (PDOException $e) {
            error_log('[DB] Connection failed: ' . $e->getMessage());
            throw new RuntimeException('Database connection failed', 0, $e);
        }

        return self::$pdo;
    }

    private static function _ensureSqliteDir(string $dsn): void
    {
        $path = substr($dsn, strlen('sqlite:'));
        if ($path === '' || $path === ':memory:') return;
        $dir = dirname($path);
        if (!is_dir($dir) && !mkdir($dir, 0770, true) && !is_dir($dir)) {
            throw new RuntimeException("SQLite 디렉터리 생성 실패: $dir");
        }
    }
}

/* ============================================================
 *  <c: AND col = :param /> 조건부 SQL 템플릿
 *
 *  :param 값이 null 이거나 빈 문자열이면 해당 줄 전체를 제거.
 *  값이 있으면 <c: ... /> 태그만 벗겨서 SQL에 포함.
 * ============================================================ */
function compile_sql_template(string $sql, array &$params): string
{
    $out = '';
    foreach (explode(PHP_EOL, $sql) as $line) {
        if (preg_match('/<[Cc]:(?<cond>.*)\/>/U', $line, $m)) {
            // 조건절에 등장하는 모든 :param 수집
            preg_match_all('/(?<key>:\w+)/', $m['cond'], $km);
            $keys = array_unique($km['key']);

            // 값이 있는 파라미터가 하나라도 있으면 조건 포함, 아니면 제거
            $hasValue = false;
            foreach ($keys as $key) {
                if (isset($params[$key]) && $params[$key] !== null && $params[$key] !== '') {
                    $hasValue = true;
                    break;
                }
            }

            if (!$hasValue) {
                foreach ($keys as $key) unset($params[$key]);   // 미사용 파라미터 제거
                continue;                                       // 조건절 제거
            }
            $out .= $m['cond'] . PHP_EOL;   // 태그 제거 후 조건만 포함
        } else {
            $out .= $line . PHP_EOL;
        }
    }
    return $out;
}

/* ============================================================
 *  공개 API
 * ============================================================ */

/** SELECT → 행 배열 */
function get_sql(string $sql, array $param = []): array
{
    $compiled = compile_sql_template($sql, $param);
    try {
        $stmt = DB::getConnection()->prepare($compiled);
        $stmt->execute($param);
        return $stmt->fetchAll();
    } catch (PDOException $e) {
        error_log('[DB][SELECT] ' . $e->getMessage() . "\nSQL: " . $compiled);
        throw $e;
    }
}

/** INSERT / UPDATE / DELETE → 영향 행 수 */
function set_sql(string $sql, array $param = []): int
{
    $compiled = compile_sql_template($sql, $param);
    try {
        $stmt = DB::getConnection()->prepare($compiled);
        $stmt->execute($param);
        return $stmt->rowCount();
    } catch (PDOException $e) {
        error_log('[DB][SET] ' . $e->getMessage() . "\nSQL: " . $compiled);
        throw $e;
    }
}

/** 전체 페이지 수 반환 (페이징용) */
function get_count(string $sql, array $param, int $lines): int
{
    $wrapped = "SELECT COUNT(*) AS cnt FROM ($sql) t";
    $compiled = compile_sql_template($wrapped, $param);
    try {
        $stmt = DB::getConnection()->prepare($compiled);
        $stmt->execute($param);
        $row   = $stmt->fetch(PDO::FETCH_ASSOC);
        $total = isset($row['cnt']) ? (int)$row['cnt'] : 0;
        return ($lines > 0) ? (int)ceil($total / $lines) : 0;
    } catch (PDOException $e) {
        error_log('[DB][COUNT] ' . $e->getMessage());
        throw $e;
    }
}

/** 첫 행 첫 열 단일 값 반환 */
function get_link(string $sql, array $param = [])
{
    $rows = get_sql($sql, $param);
    if (empty($rows)) return null;
    $first = reset($rows);
    return is_array($first) ? reset($first) : $first;
}

/** SELECT 결과를 CSV 문자열로 반환 */
function csv_sql(string $sql, array $param = [], string $delim = ','): string
{
    $rows = get_sql($sql, $param);
    if (empty($rows)) return '';
    $fp = fopen('php://temp', 'r+');
    fputcsv($fp, array_keys($rows[0]), $delim);
    foreach ($rows as $row) fputcsv($fp, $row, $delim);
    rewind($fp);
    $csv = stream_get_contents($fp);
    fclose($fp);
    return $csv;
}
