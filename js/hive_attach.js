/**
 * hive_attach.js  —  메모 첨부파일 UI 컴포넌트
 *
 * 사용:
 *   HiveAttach.mount(memoId, containerEl);   // 컨테이너에 첨부 UI 구성 + 목록 로드
 *
 * 의존: anhive.base.js 의 POST() (CSRF 토큰 자동 전송)
 *       서버: list_attach / upload_attach / delete_attach, download.php
 *
 * 보안: 파일명 등은 textContent 로만 출력 (XSS 방지)
 */
'use strict';

var HiveAttach = (function () {
    var API = 's00_s2service.php';

    function fmtSize(n) {
        n = parseInt(n, 10) || 0;
        if (n < 1024) return n + ' B';
        if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
        return (n / 1048576).toFixed(1) + ' MB';
    }

    function render(memoId, listEl, items) {
        while (listEl.firstChild) listEl.removeChild(listEl.firstChild);

        if (!items || !items.length) {
            var empty = document.createElement('div');
            empty.className = 'attach-empty';
            empty.textContent = '첨부파일 없음';
            listEl.appendChild(empty);
            return;
        }

        items.forEach(function (it) {
            var row = document.createElement('div');
            row.className = 'attach-item';

            var link = document.createElement('a');
            link.className = 'attach-name';
            link.href = 'download.php?att=' + encodeURIComponent(it.att_id);
            link.textContent = it.filename;          // XSS 안전
            link.setAttribute('download', '');

            var size = document.createElement('span');
            size.className = 'attach-size';
            size.textContent = fmtSize(it.sizeof);

            var del = document.createElement('button');
            del.type = 'button';
            del.className = 'attach-del';
            del.textContent = '삭제';
            del.addEventListener('click', function () { remove(memoId, it.att_id, listEl); });

            row.appendChild(link);
            row.appendChild(size);
            row.appendChild(del);
            listEl.appendChild(row);
        });
    }

    function reload(memoId, listEl) {
        var fd = new FormData();
        fd.append('func', 'list_attach');
        fd.append('memo_id', memoId);
        POST(API, fd, function (r) { render(memoId, listEl, r.data || []); });
    }

    function upload(memoId, fileInput, listEl) {
        if (!fileInput.files || !fileInput.files.length) { alert('파일을 선택하세요.'); return; }
        var fd = new FormData();
        fd.append('func', 'upload_attach');
        fd.append('memo_id', memoId);
        fd.append('file', fileInput.files[0]);
        POST(API, fd, function (r) {
            fileInput.value = '';
            render(memoId, listEl, r.data || []);
        });
    }

    function remove(memoId, attId, listEl) {
        if (!confirm('첨부파일을 삭제할까요?')) return;
        var fd = new FormData();
        fd.append('func', 'delete_attach');
        fd.append('att_id', attId);
        POST(API, fd, function (r) { render(memoId, listEl, r.data || []); });
    }

    /** 컨테이너에 첨부 UI 구성 (파일 선택 + 첨부 버튼 + 목록) */
    function mount(memoId, container) {
        while (container.firstChild) container.removeChild(container.firstChild);

        var bar = document.createElement('div');
        bar.className = 'attach-bar';

        var input = document.createElement('input');
        input.type = 'file';
        input.className = 'attach-file';

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'attach-up';
        btn.textContent = '＋ 첨부';
        btn.addEventListener('click', function () { upload(memoId, input, listEl); });

        bar.appendChild(input);
        bar.appendChild(btn);

        var listEl = document.createElement('div');
        listEl.className = 'attach-list';

        container.appendChild(bar);
        container.appendChild(listEl);

        reload(memoId, listEl);
    }

    return { mount: mount };
})();
