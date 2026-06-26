/**
 * @file   hive_table_lite.js
 * @brief  동적 테이블 컴포넌트 (v2.1)
 * @author AnHive Co., Ltd.  anhive@gmail.com
 * @date   2017~2025
 *
 * ■ v2.1 신규 기능
 *   [CODE 동적 목록]  codes 에 함수를 지정하면 행 데이터 기반으로
 *                     setRow() 시점에 <option> 목록을 동적 재구성
 *
 *     codes: function(rowData) {
 *         return [
 *             { v:'null',    l:'공개' },
 *             { v:'user',    l:'user' },
 *             { v:'admin',   l:'admin' },
 *         ];
 *     }
 *
 *   [CODE 정적 목록]  기존 방식 그대로 사용 가능
 *     codes: [{v:'값', l:'레이블'}, ...]
 *     codes: ['값1', '값2', ...]
 *
 * ■ v2.0 기능 (유지)
 *   [TAB]   Tab/Shift+Tab → 편집 셀 이동,  Enter → 아래 행 이동
 *   [CHECK] type:'check' → 체크박스,  직렬화: '1'/'0'
 *
 * ■ 보안 유지 항목
 *   H-04: innerHTML 할당 금지 → textContent / .value 사용
 *
 * ■ 컬럼 옵션
 *   {
 *     title   : '헤더 텍스트',
 *     id      : 'db_컬럼명',
 *     type    : 'text' | 'code' | 'check' | 'control'
 *     role    : 'info' | 'edit' | 'pass' | 'button' | 'onoff'
 *     visible : true | false
 *     codes   : [{v,l},...] | ['값',...] | function(rowData){return [{v,l},...]}
 *     onclick : 'fn(this);'                    role:'button' 전용
 *     buttons : [{value,onclick}]              type:'control' 전용
 *   }
 *
 * ─────────────────────────────────────────────────────────────────
 * ■ 사용 예 (동적 codes)
 * ─────────────────────────────────────────────────────────────────
 *
 *  var table_option = {
 *      table : { width:'100%' },
 *      column: [
 *          { title:'서비스', id:'func',    type:'text', visible:true, role:'info' },
 *          { title:'역할',   id:'role',    type:'code', visible:true, role:'edit',
 *              codes: function(rowData) {
 *                  var base = [
 *                      { v:'null',    l:'공개 (null)' },
 *                      { v:'user',    l:'user'        },
 *                      { v:'manager', l:'manager'     },
 *                      { v:'admin',   l:'admin'       },
 *                  ];
 *                  // rowData 에 따라 선택지를 제한하거나 추가할 수 있음
 *                  // 예: 시스템 내부 func 는 null 옵션 제거
 *                  if (rowData.func === 'login') {
 *                      return base.filter(function(c){ return c.v === 'null'; });
 *                  }
 *                  return base;
 *              }
 *          },
 *          { title:'관리', id:'', type:'control', visible:true, role:'onoff',
 *              buttons:[{ value:'저장', onclick:'save_row(this);' }]
 *          },
 *      ]
 *  };
 *
 *  var myTable = new TableLite('tbl_wrap', table_option);
 *  myTable.showData(serverRows);   // setRow() 내부에서 codes 함수 자동 실행
 */

'use strict';

class TableLite {

    /* ================================================================
     * constructor
     * ================================================================ */
    constructor(id, option) {
        this._option = option;
        this._id     = id;

        this.table = document.createElement('table');
        this.table.style.width = option['table']['width'];

        // 헤더 행
        var trh = document.createElement('tr');
        option['column'].forEach(column => {
            var th = document.createElement('th');
            th.textContent = column.title;          // H-04
            th.classList.add('keycolume');
            if (column.visible === false) th.classList.add('col_hide');
            trh.append(th);
        });

        // 샘플 행 (hidden, appendRow 복사 원본)
        var trd = document.createElement('tr');
        trd.dataset.form  = 'sample';
        trd.style.display = 'none';
        option['column'].forEach(column => {
            trd.append(this._makeCell(column));
        });

        this.table.append(trh);
        this.table.append(trd);
        document.getElementById(id).append(this.table);

        // [TAB] 키보드 네비게이션 등록
        this._bindTabNavigation();
    }

    /* ================================================================
     * _normCodes : codes 정규화
     *   문자열 배열  → [{v, l}] 배열
     *   함수        → 그대로 보관 (setRow 시점에 호출)
     *   {v,l} 배열  → 그대로
     * ================================================================ */
    _normCodes(codes) {
        if (typeof codes === 'function') return codes;   // 동적 함수 그대로
        return (codes || []).map(function(c) {
            return (typeof c === 'string') ? {v:c, l:c} : c;
        });
    }

    /* ================================================================
     * _buildOptions : <select> 에 <option> 목록 재구성
     *   codes  : 정규화된 [{v,l}] 배열  (함수 아닌 것)
     *   curVal : 현재 선택값 (재구성 후 복원)
     * ================================================================ */
    _buildOptions(sel, codes, curVal) {
        // 기존 option 제거
        while (sel.firstChild) sel.removeChild(sel.firstChild);
        codes.forEach(function(code) {
            var opt = document.createElement('option');
            opt.value       = code.v;
            opt.textContent = code.l;               // H-04
            sel.append(opt);
        });
        if (curVal !== undefined) sel.value = String(curVal);
    }

    /* ================================================================
     * _makeCell : 셀(td) 하나 생성
     *   code 타입: codes 가 함수이면 샘플 행엔 빈 select 만 생성
     *              실제 option 은 setRow() 에서 채움
     * ================================================================ */
    _makeCell(column) {
        var td = document.createElement('td');
        td.dataset.id   = column['id']   || '';
        td.dataset.type = column['type'] || 'text';

        if (column.visible === false) td.classList.add('col_hide');

        switch (column.type) {

            // ── [CODE] 드롭다운 ─────────────────────────────────────
            case 'code': {
                var normCodes = this._normCodes(column.codes);

                var sel = document.createElement('select');
                sel.classList.add('cell-select');
                sel.dataset.id   = column['id'] || '';
                sel.style.width  = '100%';
                sel.style.border = 'none';
                sel.style.background = 'transparent';
                sel.style.font   = 'inherit';
                sel.style.padding = '4px 2px';
                if (column.role !== 'edit') {
                    sel.disabled     = true;
                    sel.style.cursor = 'default';
                }

                // 정적 codes → 샘플 행에 미리 option 생성
                // 동적 함수  → 샘플 행에 placeholder option 만 추가
                if (typeof normCodes === 'function') {
                    // placeholder: setRow 시 교체됨
                    var ph = document.createElement('option');
                    ph.value       = '';
                    ph.textContent = '';
                    sel.append(ph);
                    // 함수 참조를 dataset 에 저장할 수 없으므로 _option 에서 찾음
                    sel.dataset.dynamic = 'true';
                } else {
                    this._buildOptions(sel, normCodes, undefined);
                }

                td.classList.add('data-code');
                if (column.role === 'edit') td.classList.add('enablewrite');
                td.style.padding = '0';
                td.append(sel);
                break;
            }

            // ── [CHECK] 체크박스 ────────────────────────────────────
            case 'check': {
                var chk = document.createElement('input');
                chk.type = 'checkbox';
                chk.classList.add('cell-check');
                chk.dataset.id   = column['id'] || '';
                chk.style.width  = '16px';
                chk.style.height = '16px';
                chk.style.cursor = 'pointer';
                chk.style.margin = '0';
                if (column.role === 'info') {
                    chk.disabled     = true;
                    chk.style.cursor = 'default';
                }
                td.classList.add('data-check');
                td.style.textAlign = 'center';
                td.append(chk);
                break;
            }

            // ── control (버튼 그룹) ─────────────────────────────────
            case 'control': {
                var span = document.createElement('span');
                span.setAttribute('name', 'manage_button');
                span.style.display = 'none';
                (column.buttons || []).forEach(function(btn) {
                    var inp = document.createElement('input');
                    inp.type  = 'button';
                    inp.value = btn.value;
                    inp.setAttribute('onclick', btn.onclick);
                    //inp.style.margin = '0 2px';
                    span.append(inp);
                });
                td.append(span);
                break;
            }

            // ── text 기본값 ─────────────────────────────────────────
            default: {
                td.classList.add('data-text');
                if (column.role === 'edit') {
                    td.classList.add('enablewrite');
                    td.contentEditable = 'true';
                }
                if (column.role === 'pass') {
                    td.classList.add('enablewrite');
                    td.classList.add('hidetext');
                    td.contentEditable = 'true';
                }
                if (column.role === 'button') {
                    td.classList.add('cell_button');
                    td.setAttribute('onclick', column.onclick);
                }
                break;
            }
        }
        return td;
    }

    /* ================================================================
     * _bindTabNavigation
     * ================================================================ */
    _bindTabNavigation() {
        this.table.addEventListener('keydown', (e) => {
            if (e.key !== 'Tab' && e.key !== 'Enter') return;

            var target  = e.target;
            var focusTd = null;

            if (target.tagName === 'TD' && target.isContentEditable) {
                focusTd = target;
            } else if (target.tagName === 'SELECT' || target.tagName === 'INPUT') {
                var el = target;
                while (el && el.tagName !== 'TD') el = el.parentNode;
                focusTd = el;
            }
            if (!focusTd) return;

            var tr = focusTd;
            while (tr && tr.tagName !== 'TR') tr = tr.parentNode;
            if (!tr || tr.dataset.form !== 'cloned') return;

            e.preventDefault();

            if (e.key === 'Enter') {
                var colIdx = Array.from(tr.cells).indexOf(focusTd);
                var below  = this._getNextRowCell(tr, colIdx);
                if (below) { this._focusCell(below); return; }
            }

            var editables = this._getRowEditables(tr);
            var idx = editables.indexOf(focusTd);
            if (idx === -1) return;

            var next = (!e.shiftKey)
                ? editables[(idx + 1) % editables.length]
                : editables[(idx - 1 + editables.length) % editables.length];

            this._focusCell(next);
        });
    }

    _getRowEditables(tr) {
        var cells = [];
        Array.from(tr.cells).forEach(function(td) {
            if (this._isFocusable(td)) cells.push(td);
        }, this);
        return cells;
    }

    _isFocusable(td) {
        if (td.classList.contains('col_hide')) return false;
        var type = td.dataset.type;
        if (type === 'code') {
            var sel = td.querySelector('select');
            return sel && !sel.disabled;
        }
        if (type === 'check') {
            var chk = td.querySelector('input[type="checkbox"]');
            return chk && !chk.disabled;
        }
        return td.isContentEditable === true;
    }

    _getNextRowCell(tr, colIdx) {
        var allRows = Array.from(this.table.querySelectorAll('tr[data-form="cloned"]'));
        var ri = allRows.indexOf(tr);
        if (ri === -1 || ri >= allRows.length - 1) return null;
        var next = allRows[ri + 1].cells[colIdx];
        return (next && this._isFocusable(next)) ? next : null;
    }

    _focusCell(td) {
        if (!td) return;
        var sel = td.querySelector('select');
        var chk = td.querySelector('input[type="checkbox"]');
        if (sel) {
            sel.focus();
        } else if (chk) {
            chk.focus();
        } else if (td.isContentEditable) {
            td.focus();
            try {
                var range = document.createRange();
                var sel2  = window.getSelection();
                range.selectNodeContents(td);
                range.collapse(false);
                sel2.removeAllRanges();
                sel2.addRange(range);
            } catch (ex) {}
        }
    }

    /* ================================================================
     * appendRow : 샘플 행 복사 → 테이블 끝에 추가
     * ================================================================ */
    appendRow() {
        var a  = this.table.querySelector('[data-form="sample"]');
        var cl = a.cloneNode(true);
        cl.style.display = '';
        cl.setAttribute('data-form', 'cloned');
        this.table.appendChild(cl);
        return cl;
    }

    /* ================================================================
     * setRow : 복사된 행 DOM 에 데이터 바인딩
     *
     *   [v2.1 추가] code 셀의 codes 가 함수인 경우:
     *     1) rowData 를 인자로 함수 호출 → [{v,l}] 배열 획득
     *     2) <select> 의 <option> 목록을 재구성
     *     3) 현재 값(data[key])으로 선택 복원
     * ================================================================ */
    setRow(cl, data) {
        var self = this;

        // text
        var tds = cl.getElementsByClassName('data-text');
        for (var i = 0; i < tds.length; i++) {
            var key = tds[i].getAttribute('data-id');
            tds[i].textContent = (data[key] !== undefined) ? data[key] : '';   // H-04
        }

        // code — 동적/정적 모두 처리
        var cdTds = cl.getElementsByClassName('data-code');
        for (var i = 0; i < cdTds.length; i++) {
            var key = cdTds[i].getAttribute('data-id');
            var sel = cdTds[i].querySelector('select');
            if (!sel) continue;

            // 이 셀에 해당하는 컬럼 옵션 찾기
            var colDef = null;
            self._option['column'].forEach(function(c) {
                if (c.id === key && c.type === 'code') colDef = c;
            });

            if (colDef && typeof colDef.codes === 'function') {
                // ── 동적 codes: 함수 호출 → option 재구성 ────────
                var dynCodes = colDef.codes(data);
                dynCodes = (dynCodes || []).map(function(c) {
                    return (typeof c === 'string') ? {v:c, l:c} : c;
                });
                self._buildOptions(sel, dynCodes, data[key]);
            } else {
                // ── 정적 codes: value 만 설정 ─────────────────────
                if (data[key] !== undefined) sel.value = String(data[key]);
            }
        }

        // check
        var ckTds = cl.getElementsByClassName('data-check');
        for (var i = 0; i < ckTds.length; i++) {
            var key = ckTds[i].getAttribute('data-id');
            var raw = data[key];
            var chk = ckTds[i].querySelector('input[type="checkbox"]');
            if (chk) chk.checked = (raw === '1' || raw === 1 || raw === true || raw === 'true');
        }
    }

    /* ================================================================
     * showData : rows 배열 → 테이블 전체 렌더
     * ================================================================ */
    showData(rows) {
        for (var i = 0; i < rows.length; i++) {
            var cl = this.appendRow();
            this.setRow(cl, rows[i]);
        }
    }

    /* ================================================================
     * clear : cloned 행 전부 제거
     * ================================================================ */
    clear() {
        var trs;
        while ((trs = this.table.querySelector('[data-form="cloned"]'))) {
            trs.parentNode.removeChild(trs);
        }
    }

    /* ================================================================
     * getCellData : 키에 해당하는 셀 값 반환
     * ================================================================ */
    getCellData(key, obj, intag) {
        while (obj.nodeName !== intag.toUpperCase()) obj = obj.parentNode;
        return this._readCell(obj, key);
    }

    _readCell(tr, key) {
        var tds = tr.getElementsByClassName('data-text');
        for (var i = 0; i < tds.length; i++) {
            if (tds[i].getAttribute('data-id') === key)
                return tds[i].textContent;
        }
        var cdTds = tr.getElementsByClassName('data-code');
        for (var i = 0; i < cdTds.length; i++) {
            if (cdTds[i].getAttribute('data-id') === key) {
                var sel = cdTds[i].querySelector('select');
                return sel ? sel.value : '';
            }
        }
        var ckTds = tr.getElementsByClassName('data-check');
        for (var i = 0; i < ckTds.length; i++) {
            if (ckTds[i].getAttribute('data-id') === key) {
                var chk = ckTds[i].querySelector('input[type="checkbox"]');
                return chk ? (chk.checked ? '1' : '0') : '0';
            }
        }
        return '';
    }

    /* ================================================================
     * toJson : 전체 cloned 행 → JSON 문자열
     * ================================================================ */
    toJson() {
        var rows = [];
        var trs  = this.table.getElementsByTagName('tr');
        for (var ti = 0; ti < trs.length; ti++) {
            if (trs[ti].getAttribute('data-form') !== 'cloned') continue;
            rows.push(this._rowToObject(trs[ti]));
        }
        return JSON.stringify(rows);
    }

    /* ================================================================
     * rowToJson : 단일 행 → JSON 문자열
     * ================================================================ */
    rowToJson(objInRow) {
        while (objInRow.nodeName !== 'TR') objInRow = objInRow.parentNode;
        return JSON.stringify([this._rowToObject(objInRow)]);
    }

    _rowToObject(tr) {
        var data = {};
        var tds = tr.getElementsByClassName('data-text');
        for (var i = 0; i < tds.length; i++) {
            var k = tds[i].getAttribute('data-id');
            if (k) data[k] = tds[i].textContent;
        }
        var cdTds = tr.getElementsByClassName('data-code');
        for (var i = 0; i < cdTds.length; i++) {
            var k   = cdTds[i].getAttribute('data-id');
            var sel = cdTds[i].querySelector('select');
            if (k) data[k] = sel ? sel.value : '';
        }
        var ckTds = tr.getElementsByClassName('data-check');
        for (var i = 0; i < ckTds.length; i++) {
            var k   = ckTds[i].getAttribute('data-id');
            var chk = ckTds[i].querySelector('input[type="checkbox"]');
            if (k) data[k] = chk ? (chk.checked ? '1' : '0') : '0';
        }
        return data;
    }

    /* ================================================================
     * showControls : 버튼 그룹 표시/숨김
     * ================================================================ */
    showControls(visible) {
        var displaySet = visible ? '' : 'none';
        var objs = this.table.querySelectorAll('[name="manage_button"]');
        for (var i = 0; i < objs.length; i++) {
            objs[i].style.display = displaySet;
        }
    }
}
