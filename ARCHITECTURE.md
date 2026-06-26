# Hive.fw 아키텍처 & 개발/운영 가이드

경량 PHP + SQLite + 순수 JS 웹 애플리케이션 프레임워크.
의존성 없이 Raspberry Pi 같은 저사양 서버에서도 동작하도록 설계되었으며,
메모(Memo) 관리 기능을 표준 샘플로 포함한다.

> 빠른 시작·설치는 [README.md](README.md), 본 문서는 구조·규약·운영 전반을 다룬다.

---

## 1. 설계 원칙

| 원칙 | 내용 |
|------|------|
| **단일 진입점** | 모든 AJAX는 `s00_s2service.php` 한 곳으로 들어와 `func` 값으로 분기 |
| **얇은 레이어** | 라우터 → 서비스 함수 → DB 헬퍼. 프레임워크/ORM 없이 함수 중심 |
| **규약 우선** | 서비스 등록(`$services['func']='_fn'`), 통일 응답(`{status,data}`), `<c:>` 조건 SQL |
| **무의존 클라이언트** | 빌드 도구·외부 라이브러리 없는 바닐라 JS 컴포넌트 |
| **보안 기본값** | 인증 게이트 + CSRF + 준비된 쿼리(prepared statement) + 출력 이스케이프 |

---

## 2. 디렉터리 구조

```
hive.fw/
├── s00_s2service.php        # 라우터(진입점): 세션·인증·CSRF·분기
├── s01_auth.php             # 서비스: 로그인/로그아웃/CSRF/세션
├── s01_memo.php             # 서비스: 메모 CRUD (샘플)
├── s01_attach.php           # 서비스: 첨부파일(업로드/목록/삭제 + GC)
├── download.php             # 인증 첨부 다운로드(GET)
├── setup_admin.php          # CLI: 관리자 비밀번호 설정/생성
├── check_requirements.php   # CLI: 설치 환경 점검
│
├── inc/
│   ├── inc_db_system.php    # DB 코어: PDO 싱글톤, get_sql/set_sql, <c:> 컴파일
│   ├── inc_util_service.php # 유틸: 입력/출력/로깅/해싱/문자열
│   └── .htaccess            # 내부 include 웹 접근 차단
│
├── js/
│   ├── anhive.base.js       # 코어: POST() AJAX, CSRF, initPage()
│   ├── hive_table_lite.js   # 컴포넌트: 다행 편집 테이블(TableLite)
│   ├── hive_grid_lite.js    # 컴포넌트: 단일 레코드 그리드 폼(HiveGridLite)
│   ├── hive_attach.js       # 컴포넌트: 첨부 UI(HiveAttach)
│   └── hive_profile_lite.js # (레거시) 세로형 폼 — 미사용, 호환 보관
│
├── css/                     # anhive.base / hive_table_lite / hive_grid_lite / hive_attach + 폰트
│
├── db/
│   ├── mes.sql              # 스키마 시드(참고용)
│   ├── hive.db              # SQLite 런타임 DB (gitignore, 자동 생성)
│   └── .htaccess            # DB 웹 접근 차단
│
├── document/                # 첨부 원본 저장소 (md5 파일명, gitignore)
│   └── .htaccess            # 직접 접근 차단 + PHP 실행 비활성
│
├── w00_login.html           # 로그인 화면
├── w01_memo.html            # 사용자: 메모 조회(읽기 전용)
├── w01_memoctl.html         # 관리자: 목록 + 추가/수정/삭제(팝업)
└── w01_memoset.html         # 관리자: 단일 메모 입력(그리드 폼)
```

---

## 3. 요청 처리 흐름

```
[브라우저]                         [서버: s00_s2service.php]
  화면(.html)
   └ POST(api, FormData, cb)  ──▶  1. 세션 시작(HttpOnly/SameSite)
       (anhive.base.js)            2. 보안 헤더(nosniff 등)
       X-CSRF-TOKEN 헤더           3. 서비스 파일 require (s01_*.php → $services 등록)
                                    4. func 검증 / 매핑 확인
                                    5. 인증 게이트: public 아니면 로그인 필요(401)
                                    6. CSRF 검증: csrf_exempt 아니면 토큰 대조(403)
                                    7. call_user_func($services[func])
                                         └ 서비스가 outputJSON(...) 로 즉시 응답
                                    8. 예외 → RuntimeException(안전메시지)/일반(마스킹)
   응답 {status,data}  ◀──────────  JSON
   cb(resp) 또는 401→로그인 이동
```

- **GET 다운로드**는 라우터를 거치지 않고 `download.php`가 직접 처리(세션 검사 후 파일 스트리밍).

---

## 4. 백엔드 레이어

### 4.1 라우터 (`s00_s2service.php`)
- 세션 쿠키 하드닝(`HttpOnly`, `SameSite=Strict`, HTTPS면 `Secure`)
- 서비스 파일 로딩(`$serviceFiles`) → 각 파일이 `$services` 전역에 등록
- 접근 제어 두 단계:
  - `$public_funcs`(기본 `['login']`): 로그인·CSRF 모두 면제
  - `$csrf_exempt`(`['login','get_csrf']`): 로그인은 필요, CSRF만 면제
- 예외 처리: 우리가 만든 `RuntimeException`(예: DB 쓰기권한 안내)은 메시지 노출, 그 외는 일반 메시지로 마스킹(내부정보 비노출)

### 4.2 서비스 (`s01_*.php`)
함수 등록 + 구현. 표준 패턴:
```php
$services['list_memo'] = '_list_memo';

function _list_memo(): void {
    $rows = get_sql("SELECT ... WHERE 1=1 <c: AND title LIKE :kw />", [':kw' => $kw]);
    outputJSON(['list' => $rows]);   // 즉시 JSON 응답 후 exit
}
```

### 4.3 DB 코어 (`inc/inc_db_system.php`)
| 함수 | 용도 |
|------|------|
| `DB::getConnection()` | PDO 싱글톤(SQLite 기본, DSN 변경으로 MySQL 등 가능) |
| `get_sql($sql,$p)` | SELECT → 행 배열 |
| `set_sql($sql,$p)` | INSERT/UPDATE/DELETE → 영향 행 수 |
| `get_link($sql,$p)` | 단일 값 |
| `get_count($sql,$p,$lines)` | 페이징 페이지 수 |
| `csv_sql($sql,$p)` | CSV 문자열 |

**`<c:>` 조건부 SQL** — 한 줄에 있는 `:param`이 모두 비면 그 줄을 제거하고 파라미터도 정리, 하나라도 값이 있으면 태그만 벗겨 포함:
```sql
WHERE 1=1
<c: AND category = :category />
<c: AND (title LIKE :keyword OR content LIKE :keyword) />
```
모든 값은 **준비된 쿼리로 바인딩**되어 SQL 인젝션에 안전하다(`<c:>`는 줄 포함/제외만 결정).

### 4.4 유틸 (`inc/inc_util_service.php`)
입력 `get_POST/get_GET/get_POSTMATCH`, 출력 `outputJSON`, 로깅 `trace_log`(기본 off),
해싱 `hash_password/verify_password`(bcrypt, 레거시 SHA-256 자동 마이그레이션),
문자열 `str_limit`(mbstring 없이도 동작), `make_uuid_v4` 등.

---

## 5. 인증 · CSRF · 보안 모델

| 항목 | 구현 |
|------|------|
| **인증** | 세션 기반. `login`이 `users`(state<'9') 조회 + `verify_password` → 성공 시 `session_regenerate_id` + 세션에 userid/rolecode |
| **CSRF** | 로그인/`get_csrf`가 토큰 발급(세션 저장 + `XSRF-TOKEN` 쿠키). 클라이언트는 `get_csrf`로 토큰을 받아 메모리에 두고 `X-CSRF-TOKEN` 헤더로 전송. 라우터가 `hash_equals` 검증 |
| **비밀번호** | `password_hash`(bcrypt). 레거시 SHA-256은 로그인 성공 시 재해시 |
| **전송/세션** | 쿠키 `HttpOnly`+`SameSite=Strict`(+HTTPS `Secure`), 보안 헤더 `nosniff`/`X-Frame-Options`/`Referrer-Policy` |
| **파일 보호** | `db/`,`inc/`,`document/`에 `.htaccess`(`Require all denied`). 첨부는 인증된 `download.php`로만, 항상 `attachment`(octet-stream) |
| **출력/입력** | 클라이언트는 `textContent`/`.value`로 출력(XSS 방지). 서버는 oid 정수화, 분류/완료 화이트리스트, 키워드 길이·목록 LIMIT |

> 주의: `.htaccess`는 `AllowOverride`가 켜진 Apache에서만 적용된다. 더 확실하게는 `db/`를 웹 루트 밖으로 옮기고 `DB_DSN`을 지정한다.

---

## 6. 프론트엔드

### 6.1 코어 (`anhive.base.js`)
```js
POST(url, formData, onSuccess, onError);   // CSRF 헤더 자동, 401→로그인 이동
Anhive.setCsrfToken(token);                // 메모리 토큰 저장
initPage(callback);                        // get_csrf 수신 후 callback 실행
```
모든 보호 화면은 로드 시 `initPage(준비완료_콜백)`로 토큰을 먼저 확보한다.
응답 규약: `{ "status": "success"|"error", "data": ... }`.

### 6.2 컴포넌트
| 컴포넌트 | 파일 | 용도 |
|----------|------|------|
| **TableLite** | `hive_table_lite.js` | 다행 표시/편집 테이블. `showData/clear/appendRow/getCellData/toJson`, 컬럼 `type:text|code|check|control`, `role:info|edit|pass|button` |
| **HiveGridLite** | `hive_grid_lite.js` | 단일 레코드 그리드 폼(섹션/스팬/날짜피커 등). `showData/clear/toObject/getData` |
| **HiveAttach** | `hive_attach.js` | 첨부 UI. `HiveAttach.mount(memoId, containerEl)` |

편집칸/읽기전용 시각 구분은 공통 CSS(흰 입력박스+파란 테두리 vs 평면 회색)로 처리.

---

## 7. 데이터 모델 (샘플)

```sql
memo(oid PK, category, title, content, done, created)

document(oid PK, md5key UNIQUE, storage, sizeof, mimetype, created)
memo_attach(oid PK, memo_id, doc_id, filename, created, UNIQUE(memo_id,doc_id))

users(oid PK, userid UNIQUE, name, password, rolecode, state, ...)   -- mes.sql
```
`memo`/`document`/`memo_attach`는 서비스가 `CREATE TABLE IF NOT EXISTS`로 자동 생성한다.

### 첨부 서브시스템 (콘텐츠 주소 + 참조 카운팅)
- 업로드 파일은 **내용 MD5**를 파일명으로 `document/<md5>`에 저장 → 동일 내용은 1개만 보관(`md5key` UNIQUE).
- `memo_attach`가 메모↔파일 참조를 N:N으로 연결.
- 첨부 해제/메모 삭제 시 해당 `doc_id` 참조가 **0이 되면** 물리 파일+행을 GC. 다른 메모가 참조 중이면 **보존**.
- `delete_memo` → `attach_purge_memo()` 연동.

---

## 8. 개발 가이드 — 새 기능 추가

### 8.1 새 서비스(백엔드)
1. `s01_xxx.php` 작성:
   ```php
   <?php
   $services['list_xxx'] = '_list_xxx';
   function _list_xxx(): void {
       $rows = get_sql("SELECT ... <c: AND col=:k />", [':k' => get_POST('k','')]);
       outputJSON(['list' => $rows]);
   }
   ```
2. 라우터 `s00_s2service.php`의 `$serviceFiles`에 경로 추가.
3. 공개 함수면 `$public_funcs`/`$csrf_exempt` 정책 검토(기본은 로그인+CSRF 필요).

### 8.2 새 화면(프론트)
```html
<script src="./js/anhive.base.js"></script>
<script>
function load() {
  var fd = new FormData(); fd.append('func','list_xxx'); fd.append('k', '...');
  POST('s00_s2service.php', fd, function(resp){ /* resp.data 사용, textContent 출력 */ });
}
window.addEventListener('DOMContentLoaded', function(){ initPage(load); });
</script>
```

### 8.3 규약 체크리스트
- 응답은 `outputJSON($data[, 'error'])` 또는 라우터가 배열을 포장.
- 사용자 입력은 정수화/화이트리스트/길이제한으로 정규화.
- 출력은 항상 `textContent`/`.value` (innerHTML 금지).
- 상태 변경(쓰기) func은 로그인+CSRF 게이트를 거치게 둔다.

---

## 9. 운영 가이드

### 9.1 요구사항 & 설치
```bash
sudo apt install -y apache2 php libapache2-mod-php php-sqlite3 php-mbstring php-curl
php check_requirements.php        # 필수 항목 OK 확인
```
필수: PHP 7.3+, `pdo_sqlite`, `json`, mbstring(권장).

### 9.2 배포 & 권한
```bash
# 웹 루트(또는 ~/hive.fw)에 배치 후
sudo chown -R www-data:www-data db document
sudo chmod 770 db document
sudo chmod 660 db/hive.db 2>/dev/null || true
sudo systemctl restart apache2     # 그룹/권한 변경 반영
```
- DB·document는 **웹서버 사용자(www-data) 쓰기 권한** 필수. 권한 없으면 조회는 되고 저장/업로드가 실패.
- 일관 배포(부분 배포 금지): `git fetch && git reset --hard origin/main` 후 브라우저 **Ctrl+Shift+R**.

### 9.3 초기 계정
시드 비밀번호 평문은 알 수 없으므로 CLI로 설정:
```bash
php setup_admin.php system_admin '강력한비밀번호'
```
이후 `w00_login.html`로 로그인.

### 9.4 백업
- DB: `cp db/hive.db ~/hive.db.$(date +%F).bak`
- 첨부: `document/` 디렉터리 백업(파일명이 md5라 DB와 함께 보존해야 정합).

### 9.5 트러블슈팅
| 증상 | 원인/조치 |
|------|-----------|
| 로그인 후 조회·저장 "서버 통신 중 오류" / HTTP 500 | 보통 PHP 확장 누락. `php check_requirements.php`, 특히 mbstring/pdo_sqlite. `error.log` 확인 |
| 저장만 실패(조회는 됨) | DB/document **쓰기 권한**. `chown www-data` + Apache 재시작 |
| 모든 보호요청 403 | CSRF 토큰 미전송 — 옛 파일/브라우저 캐시. 일관 배포 + 하드 리프레시 |
| user=anonymous 로 통과 | 라우터가 인증 게이트 없는 옛 버전 — 일관 배포 필요 |
| `php_flag` 관련 500 | php-fpm 환경 — `document/.htaccess`는 `IfModule`로 보호되어 있음. 커스텀 추가 시 주의 |

로그는 기본 off(`HIVE_DEBUG=false`). 디버깅 시 임시로 `define('HIVE_DEBUG', true)` 후 `tail -f /var/log/apache2/error.log`.

---

## 10. 화면 맵

| 화면 | 대상 | 기능 |
|------|------|------|
| `w00_login.html` | 전체 | 로그인 |
| `w01_memo.html` | 사용자 | 메모 **조회 전용**(상세·첨부 다운로드) |
| `w01_memoctl.html` | 관리자 | 목록 + 추가/수정/삭제(팝업) + 첨부 |
| `w01_memoset.html` | 관리자 | 단일 메모 입력(그리드 폼) + 첨부 |

---

## 11. 서비스 func 레퍼런스

| func | 파일 | 공개 | 설명 |
|------|------|------|------|
| `login` / `logout` / `get_csrf` / `whoami` | s01_auth | login만 공개 | 인증/세션/CSRF |
| `list_memo` / `get_memo` / `save_memo` / `delete_memo` | s01_memo | 보호 | 메모 CRUD |
| `list_attach` / `upload_attach` / `delete_attach` | s01_attach | 보호 | 첨부 관리 |
| (GET) `download.php?att=<id>` | download.php | 보호 | 첨부 다운로드 |

---

_Copyright ⓒ2026 AnHive Co., Ltd. — 기술 설계/운영 개념._
