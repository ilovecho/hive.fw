/**
 * @file hive_service_base.js (hardened)
 * @brief 공통 AJAX / DOM / 유틸 함수 모음
 * @author AnHive
 * @date   2025-12-10
 *
 * 개선 포인트
 * - fetch 기반 POST() 래퍼 (JSON 파싱/에러 처리 일원화)
 * - CSRF 토큰 자동 첨부(메타 태그 or 쿠키에서 읽기)
 * - 공통 오류 처리/로그 출력
 * - XSS 완화를 위한 텍스트 출력 유틸 추가
 * - 전역 네임스페이스 Anhive 제공 + 기존 global POST() 유지
 */
(function (window, document) {
    'use strict';

    // ------------------------------------
    // 유틸 네임스페이스
    // ------------------------------------
    const Anhive = {};

    // ===== 1. 공통 유틸 함수들 =====

    /**
     * 단순 타입 체크
     */
    Anhive.isObject = function (val) {
        return val !== null && typeof val === 'object' && !Array.isArray(val);
    };

    /**
     * 쿠키 값 읽기
     * @param {string} name
     * @returns {string|null}
     */
    Anhive.getCookie = function (name) {
        const m = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([$?*|{}\]\\^])/g, '\\$1') + '=([^;]*)'));
        return m ? decodeURIComponent(m[1]) : null;
    };

    // 메모리에 보관하는 CSRF 토큰 (get_csrf 로 받아 setCsrfToken 으로 저장)
    let _csrfToken = '';

    /** CSRF 토큰을 메모리에 저장 (페이지 로드시 get_csrf 응답을 넣어둠) */
    Anhive.setCsrfToken = function (token) {
        if (typeof token === 'string' && token.length > 0) _csrfToken = token;
    };

    /**
     * CSRF 토큰 추출
     * - 우선순위: 메모리 토큰 → <meta name="csrf-token"> → 쿠키
     */
    Anhive.getCsrfToken = function () {
        if (_csrfToken) return _csrfToken;

        const meta = document.querySelector('meta[name="csrf-token"]');
        if (meta && meta.content) return meta.content;

        return Anhive.getCookie('XSRF-TOKEN') ||
               Anhive.getCookie('csrftoken') ||
               Anhive.getCookie('CSRF-TOKEN');
    };

    /**
     * HTML 이스케이프 (XSS 완화용)
     * @param {string} str
     * @returns {string}
     */
    Anhive.escapeHTML = function (str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    };

    /**
     * 안전하게 텍스트를 엘리먼트에 넣기
     * @param {Element} el
     * @param {string} text
     */
    Anhive.setTextSafe = function (el, text) {
        if (!el) return;
        el.textContent = text == null ? '' : String(text);
    };

    /**
     * parent 아래에서 selector로 자식 찾기
     * 기존 _getChild 대체용 (호환)
     * @param {Element|Document} parent
     * @param {string} selector
     * @returns {Element|null}
     */
    Anhive.getChild = function (parent, selector) {
        if (!parent) return null;
        return parent.querySelector(selector);
    };

    // ===== 2. AJAX 래퍼 (POST) =====

    /**
     * 안전한 POST 요청
     *
     * 사용 예:
     *   var fd = new FormData();
     *   fd.append('func','get_expcases');
     *   POST('w01-s00.php', fd, function(resp){ ... });
     *
     * @param {string} url
     * @param {FormData|Object|null} data
     * @param {Function} onSuccess  resp(JSON 파싱 결과) => void
     * @param {Function} onError    err(Error or string) => void
     */
    function POST(url, data, onSuccess, onError) {
        // 콜백 기본값 처리
        if (typeof onSuccess !== 'function') {
            onSuccess = function () {};
        }
        if (typeof onError !== 'function') {
            onError = function (err) {
                console.error('[Anhive.POST] Error:'+err);
                alert('서버 통신 중 오류가 발생했습니다.\n잠시 후 다시 시도해주세요.');
            };
        }

        // data가 단순 Object라면 FormData로 변환
        let body;
        if (data instanceof FormData) {
            body = data;
        } else if (Anhive.isObject(data)) {
            body = new FormData();
            Object.keys(data).forEach(function (k) {
                if (data[k] !== undefined && data[k] !== null) {
                    body.append(k, data[k]);
                }
            });
        } else if (data == null) {
            body = new FormData();
        } else {
            // 기타 타입은 그대로 전달하지 않고 에러 처리
            return onError(new Error('POST data 타입이 FormData 또는 Object가 아닙니다.'));
        }

        // CSRF 토큰이 있으면 헤더에 추가
        const headers = new Headers();
        headers.append('X-Requested-With', 'XMLHttpRequest');
        const csrf = Anhive.getCsrfToken();
        if (csrf) {
            headers.append('X-CSRF-TOKEN', csrf);
        }

        // fetch 옵션
        const options = {
            method: 'POST',
            headers: headers,
            body: body,
            credentials: 'same-origin', // 세션 쿠키 포함
        };

        fetch(url, options)
            .then(function (response) {
                // 401: 미로그인/세션만료 → 로그인 페이지로 이동
                if (response.status === 401) {
                    var here = encodeURIComponent(location.pathname.replace(/.*\//, '') + location.search);
                    location.href = 'w00_login.html?next=' + here;
                    throw new Error('Unauthorized');
                }
                // HTTP 레벨 에러 (404, 500 등)
                if (!response.ok) {
                    const err = new Error('HTTP Error ' + response.status);
                    err.status = response.status;
                    throw err;
                }
                // JSON 응답 시도
                return response
                    .text()
                    .then(function (text) {
                        if (!text) return {};
                        try {
                            return JSON.parse(text);
                        } catch (e) {
                            console.warn('[Anhive.POST] JSON 파싱 실패, 원문 반환', e);
                            // 서버가 JSON 포맷이 아닌 경우를 대비해 원문도 같이 넘김
                            return { raw: text };
                        }
                    });
            })
            .then(function (json) {
                // 서버 통일 포맷: { status: 'success'|'error', data: ... }
                if (json && typeof json.status !== 'undefined') {
                    if (json.status === 'success') {
                        onSuccess(json);
                    } else {
                        const errMsg = json.data || '서버에서 오류를 반환했습니다.';
                        console.error('[Anhive.POST] 서버 오류:', errMsg);
                        onError(new Error(errMsg));
                    }
                } else {
                    // status 필드가 없으면, 그대로 넘김 (기존 코드 호환)
                    onSuccess(json);
                }
            })
            .catch(function (err) {
                if (err && err.message === 'Unauthorized') return;  // 이미 로그인 페이지로 이동 중
                onError(err);
            });
    }

    /**
     * 페이지 초기화: 서버에서 CSRF 토큰을 받아 메모리에 저장한 뒤 callback 실행.
     * - 미로그인(401)이면 POST 내부에서 로그인 페이지로 이동.
     * - 모든 보호 페이지는 onload 시 initPage(준비완료_콜백) 를 호출할 것.
     *
     * 사용: initPage(function(){ load_list(); });
     */
    function initPage(callback, apiUrl) {
        var fd = new FormData();
        fd.append('func', 'get_csrf');
        POST(apiUrl || 's00_s2service.php', fd, function (resp) {
            if (resp && resp.data && resp.data.csrf) Anhive.setCsrfToken(resp.data.csrf);
            if (typeof callback === 'function') callback();
        }, function () {
            // get_csrf 실패(미로그인 제외)는 토큰 없이도 화면은 띄움
            if (typeof callback === 'function') callback();
        });
    }
    Anhive.initPage = initPage;

    // ===== 3. 공개 API 바인딩 =====

    // 네임스페이스에 할당
    Anhive.POST = POST;

    // 기존 코드 호환을 위해 전역으로도 노출
    window.Anhive = window.Anhive || {};
    Object.assign(window.Anhive, Anhive);

    // 기존 코드: POST('url', data, cb) 그대로 작동하도록
    if (!window.POST) {
        window.POST = POST;
    }
    if (!window.initPage) {
        window.initPage = initPage;
    }

    // _getChild 이름을 사용하는 기존 코드 호환용
    if (!window._getChild) {
        window._getChild = Anhive.getChild;
    }

})(window, document);
