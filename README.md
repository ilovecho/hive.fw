# Hive.fw — 경량 PHP/JS 웹 프레임워크

Copyright ⓒ2026 AnHive Co., Ltd. All Rights Reserved.

---

## 개요

SQLite + PHP + 순수 JS로 동작하는 소형 웹 앱 프레임워크.  
Raspberry Pi 등 저사양 서버에서도 의존성 없이 실행 가능.

---

## 디렉터리 구조

```
hive.fw/
├── inc/
│   ├── inc_db_system.php       # DB 코어 (PDO 싱글톤, get_sql/set_sql/compile_sql_template)
│   └── inc_util_service.php    # 유틸 (get_POST, outputJSON, trace_log 등)
├── js/
│   ├── anhive.base.js          # 코어 JS (POST AJAX 래퍼, Anhive 네임스페이스)
│   └── hive_table_lite.js      # TableLite 컴포넌트
├── css/
│   ├── anhive.base.css         # 기본 스타일
│   ├── hive_table_lite.css     # 테이블 스타일
│   └── NanumGothic.woff        # 한글 폰트
├── db/                         # SQLite DB 파일 (자동 생성)
├── s00_s2service.php           # 서비스 라우터 (AJAX 진입점)
├── s01_memo.php                # 샘플 서비스 (메모 CRUD)
└── w01_memo.html               # 샘플 화면 (메모 관리)
```

---

## 핵심 개념

### 1. 서비스 라우터 (`s00_s2service.php`)

모든 AJAX 호출은 `s00_s2service.php` 한 곳으로 들어옴.  
`$_POST['func']` 값으로 등록된 함수를 호출.

```
POST s00_s2service.php
  func=list_memo   → _list_memo() 호출
  func=save_memo   → _save_memo() 호출
```

### 2. 서비스 파일 (`s01_xxx.php`)

```php
$services['list_memo'] = '_list_memo';

function _list_memo(): void
{
    $rows = get_sql("SELECT * FROM memo ORDER BY oid DESC");
    outputJSON(['list' => $rows]);
}
```

서비스 파일을 `s00_s2service.php`의 `$serviceFiles` 배열에 추가하면 자동 등록.

### 3. 조건부 SQL (`<c: ... />`)

`:param` 값이 비어 있으면 해당 줄 전체 제거, 값이 있으면 태그만 벗기고 포함.

```php
$sql = <<<SQL
SELECT * FROM memo WHERE 1=1
<c: AND category = :category />
<c: AND title LIKE :keyword />
ORDER BY oid DESC
SQL;

$rows = get_sql($sql, [':category' => $category, ':keyword' => $keyword]);
```

### 4. DB 함수

| 함수 | 용도 |
|------|------|
| `get_sql($sql, $param)` | SELECT → 행 배열 |
| `set_sql($sql, $param)` | INSERT/UPDATE/DELETE → 영향 행 수 |
| `get_link($sql, $param)` | 단일 값 반환 |
| `get_count($sql, $param, $lines)` | 페이징용 전체 페이지 수 |
| `csv_sql($sql, $param)` | CSV 문자열 반환 |

### 5. JS — `POST()` AJAX

```js
var fd = new FormData();
fd.append('func', 'list_memo');
fd.append('keyword', '검색어');

POST('s00_s2service.php', fd, function(resp) {
    console.log(resp.data.list);   // 성공 시 콜백
});
```

응답 포맷: `{ "status": "success", "data": { ... } }`

### 6. `TableLite` 컴포넌트

```js
var table = new TableLite('div_id', {
    table: { width: '100%' },
    column: [
        { title: '제목', id: 'title',    type: 'text', role: 'edit', visible: true },
        { title: '분류', id: 'category', type: 'code', role: 'edit', visible: true,
          codes: [{v:'일반', l:'일반'}, {v:'업무', l:'업무'}] },
        { title: '완료', id: 'done',     type: 'check', role: 'edit', visible: true },
        { title: '관리', id: '',         type: 'control', visible: true,
          buttons: [{ value: '저장', onclick: 'save_row(this);' }] },
    ]
});

table.showData(rows);     // 데이터 바인딩
table.clear();            // 전체 행 제거
table.appendRow();        // 빈 행 추가
table.rowToJson(btn);     // 행 → JSON
table.getCellData('id', btn, 'TR');  // 셀 값 읽기
```

**컬럼 type:** `text` | `code` | `check` | `control`  
**컬럼 role:** `info`(읽기전용) | `edit`(편집) | `pass`(숨김텍스트) | `button`

---

## 새 서비스 추가 방법

1. `s01_myapp.php` 작성
2. `s00_s2service.php`의 `$serviceFiles`에 경로 추가
3. HTML에서 `POST('s00_s2service.php', fd, cb)` 호출

---

## 요구사항

| 구분 | 항목 | 설치 |
|------|------|------|
| 필수 | PHP **7.3+** | `apt install php` |
| 필수 | PDO SQLite (`pdo_sqlite`) | `apt install php-sqlite3` |
| 필수 | mbstring | `apt install php-mbstring` |
| 권장 | curl (서버간 연동) | `apt install php-curl` |
| 필수 | Apache + PHP 모듈 | `apt install apache2 libapache2-mod-php` |

> mbstring 이 없으면 `str_limit()` 가 PCRE 폴백으로 동작하긴 하지만, 한글 처리 일관성을 위해 설치를 권장합니다.

**한 줄 설치(라즈베리파이/Debian):**
```bash
sudo apt update
sudo apt install -y apache2 php libapache2-mod-php php-sqlite3 php-mbstring php-curl
sudo systemctl restart apache2
```

설치 후 **점검 스크립트**로 한 번에 확인:
```bash
php check_requirements.php
```
모든 `[필수]` 항목이 `OK` 면 준비 완료입니다.

## 설치 (Raspberry Pi / Apache2)

```bash
cp -r hive.fw /var/www/html/myapp
chmod 644 /var/www/html/myapp/*.html
chmod 640 /var/www/html/myapp/*.php
chmod 640 /var/www/html/myapp/inc/*.php

# DB 쓰기 권한 (필수)
#  - SQLite 는 쓰기 시 db/ 디렉터리에 journal 파일을 만들므로
#    파일뿐 아니라 디렉터리에도 웹서버 사용자(www-data) 쓰기 권한이 필요.
#  - 권한이 없으면 조회(SELECT)는 되지만 저장/수정/삭제에서
#    "데이터베이스에 쓸 수 없습니다" 오류 발생.
sudo chown -R www-data:www-data /var/www/html/myapp/db
sudo chmod 770 /var/www/html/myapp/db
sudo chmod 660 /var/www/html/myapp/db/hive.db

sudo systemctl restart apache2
```

샘플 접속: `http://<서버IP>/myapp/w01_memoctl.html`

---

## 보안 설정 (운영 배포 시)

- **DB/내부파일 차단**: `db/`, `inc/` 에 `.htaccess`(`Require all denied`) 포함됨. `AllowOverride All` 이 켜져 있어야 적용됨. 가능하면 **DB 파일을 웹 루트 밖**으로 옮기고 `DB_DSN` 을 지정:
  ```php
  define('DB_DSN', 'sqlite:/home/pi/hive_data/hive.db');
  ```
- **디버그 로그**: `HIVE_DEBUG` 기본값은 `false`. 개발 중에만 상위에서 `define('HIVE_DEBUG', true)`.
- **에러 응답**: 예외 상세는 서버 로그(`error_log`)에만 남고, 클라이언트엔 일반 메시지만 반환됨.

### 인증 / CSRF (구현됨)

- 라우터(`s00_s2service.php`)가 `$public_funcs`(기본 `['login']`) 외 **모든 func 에 로그인 + CSRF 검증**을 강제함.
- 로그인: `s01_auth.php` 의 `login`/`logout`/`get_csrf`/`whoami`. 비밀번호는 `password_hash`/`password_verify`, 레거시 SHA-256은 로그인 성공 시 자동 재해시.
- CSRF: 로그인 시 세션 저장 + `XSRF-TOKEN` 쿠키 발급 → `anhive.base.js` 가 `X-CSRF-TOKEN` 헤더로 자동 전송 → 라우터가 `hash_equals` 로 검증.
- 세션 쿠키: `HttpOnly` + `SameSite=Strict` (+ HTTPS면 `Secure`).
- 미로그인(401) 시 클라이언트는 `w00_login.html` 로 자동 이동.

**초기 관리자 비밀번호 설정 (CLI)** — 기존 평문을 모르거나 새 계정이 필요할 때:
```bash
php setup_admin.php system_admin 'NewP@ss123'
```
샘플 로그인 화면: `http://<서버IP>/myapp/w00_login.html`
