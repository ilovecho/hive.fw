/**
 * @file   hive_profile_lite.js
 * @brief  단건 레코드 프로필 컴포넌트 (v2.2)
 * @author AnHive Co., Ltd.  anhive@gmail.com
 * @date   2017~2026
 *
 * ■ v2.2 신규 기능
 *   [DATE] type:'date' → <input type="date"> 브라우저 기본 달력 선택기
 *   [TIME] type:'time' → <input type="time">
 *   [DATETIME] type:'datetime-local' → <input type="datetime-local">
 *   [PICKER] date/time/datetime-local 클릭 시 showPicker() 보강
 *   [TEXTAREA] type:'textarea' → 복수 라인 입력
 *
 * ■ v2.1 기능
 *   [CODE] type:'code' → 드롭다운(select)
 *   [CHECK] type:'check' → 체크박스
 *
 * ■ 보안 유지 항목
 *   H-04: innerHTML 할당 금지 → textContent / .value 사용
 *
 * ■ 컬럼 옵션
 *   {
 *     title   : '제목',
 *     id      : 'db_컬럼명',
 *     type    : 'text' | 'date' | 'time' | 'datetime-local' | 'textarea' | 'code' | 'check' | 'control',
 *     role    : 'info' | 'edit' | 'pass' | 'button',
 *     visible : true | false,
 *     rows    : 3,                    // textarea 전용
 *     codes   : [{v,l},...] | ['값1'] | function(data){return [{v,l},...]},
 *     onclick : 'fn(this);',
 *     buttons : [{value, onclick}, …]
 *   }
 */

'use strict';

class ProfileLite {

    constructor(id, option) {
        this._option = option;

        this.table = document.createElement('table');
        this.table.style.width           = option.table.width || '100%';
        this.table.style.backgroundColor = '#B6B6B6';

        option.column.forEach(col => {
            var tr = document.createElement('tr');

            var th = document.createElement('td');
            th.textContent = col.title;
            th.classList.add('keycolume');
            if (option.table.title_width) th.style.width = option.table.title_width;
            if (col.visible === false)    th.classList.add('col_hide');
            tr.append(th);

            tr.append(this._makeCell(col, option.table.data_width));
            this.table.append(tr);
        });

        document.getElementById(id).append(this.table);
    }

    _normCodes(codes) {
        if (typeof codes === 'function') return codes;
        return (codes || []).map(function(c) {
            return (typeof c === 'string') ? {v: c, l: c} : c;
        });
    }

    _buildOptions(sel, codes, curVal) {
        while (sel.firstChild) sel.removeChild(sel.firstChild);
        codes.forEach(function(code) {
            var opt = document.createElement('option');
            opt.value       = code.v;
            opt.textContent = code.l;
            sel.append(opt);
        });
        if (curVal !== undefined) sel.value = String(curVal);
    }

    _normalizeInputValue(inputType, value) {
        if (value === undefined || value === null) return '';
        var s = String(value).trim();
        if (s === '') return '';

        if (inputType === 'date') {
            // SQLite CURRENT_TIMESTAMP 또는 'YYYY-MM-DD HH:MM:SS' 값이 들어와도 날짜 부분만 사용
            return s.replace('T', ' ').substring(0, 10);
        }
        if (inputType === 'datetime-local') {
            // datetime-local은 'YYYY-MM-DDTHH:MM' 형식 필요
            return s.replace(' ', 'T').substring(0, 16);
        }
        if (inputType === 'time') {
            // 'HH:MM' 또는 'HH:MM:SS' 모두 허용하되 input에는 HH:MM 기준
            return s.substring(0, 5);
        }
        return s;
    }

    _openNativePicker(input) {
        if (!input || input.disabled || input.readOnly) return;
        try {
            input.focus();
            // Chrome/Edge 계열: 셀 영역이나 달력 버튼을 눌렀을 때 강제로 native picker 표시
            if (typeof input.showPicker === 'function') {
                input.showPicker();
            }
        } catch (ex) {
            // 일부 브라우저는 사용자 제스처가 아니거나 showPicker 미지원일 수 있음.
            // 이 경우 focus만 적용하고 브라우저 기본 동작에 맡긴다.
        }
    }

    _applyInputStyle(input, col) {
        input.dataset.id       = col.id || '';
        input.style.width      = '100%';
        input.style.border     = 'none';
        input.style.background = 'transparent';
        input.style.font       = 'inherit';
        input.style.padding    = '4px 2px';
        input.style.boxSizing  = 'border-box';
        input.style.minHeight  = '28px';

        if (col.role !== 'edit') {
            input.disabled = true;
            input.style.cursor = 'default';
        } else {
            input.style.cursor = 'pointer';
        }
    }

    _makeCell(col, dataWidth) {
        var td = document.createElement('td');
        td.dataset.id   = col.id   || '';
        td.dataset.type = col.type || 'text';

        if (col.visible === false) td.classList.add('col_hide');
        if (dataWidth) td.style.minWidth = dataWidth;

        switch (col.type) {

            case 'code': {
                var normCodes = this._normCodes(col.codes);
                var sel = document.createElement('select');
                this._applyInputStyle(sel, col);

                if (typeof normCodes === 'function') {
                    var ph = document.createElement('option');
                    ph.value = '';
                    ph.textContent = '';
                    sel.append(ph);
                    sel.dataset.dynamic = 'true';
                } else {
                    this._buildOptions(sel, normCodes, undefined);
                }

                td.classList.add('data-code');
                if (col.role === 'edit') td.classList.add('enablewrite');
                td.style.padding = '0';
                td.append(sel);
                break;
            }

            case 'check': {
                var chk = document.createElement('input');
                chk.type         = 'checkbox';
                chk.dataset.id   = col.id || '';
                chk.style.width  = '16px';
                chk.style.height = '16px';
                chk.style.margin = '2px 0';

                if (col.role === 'info') {
                    chk.disabled     = true;
                    chk.style.cursor = 'default';
                } else {
                    chk.style.cursor = 'pointer';
                }

                td.classList.add('data-check');
                td.append(chk);
                break;
            }

            case 'date':
            case 'time':
            case 'datetime-local': {
                var inp = document.createElement('input');
                inp.type = col.type;
                this._applyInputStyle(inp, col);
                inp.classList.add('cell-native-picker');

                // 일부 환경에서는 input 오른쪽의 기본 아이콘을 정확히 눌러야 picker가 열리므로
                // 셀 전체 클릭과 별도 버튼 클릭 모두 native picker를 호출하도록 보강한다.
                var wrap = document.createElement('div');
                wrap.className = 'profile-input-wrap';
                wrap.style.display = 'flex';
                wrap.style.alignItems = 'center';
                wrap.style.gap = '4px';
                wrap.style.width = '100%';

                inp.style.flex = '1 1 auto';
                inp.style.minWidth = '0';
                inp.style.background = '#fff';
                inp.style.border = '1px solid #cbd5e1';
                inp.style.borderRadius = '4px';
                inp.style.padding = '5px 6px';

                var pickerBtn = document.createElement('button');
                pickerBtn.type = 'button';
                pickerBtn.textContent = (col.type === 'time') ? '⏱' : '📅';
                pickerBtn.title = '선택';
                pickerBtn.className = 'profile-picker-button';
                pickerBtn.style.flex = '0 0 auto';
                pickerBtn.style.border = '1px solid #cbd5e1';
                pickerBtn.style.background = '#f8fafc';
                pickerBtn.style.borderRadius = '4px';
                pickerBtn.style.cursor = (col.role === 'edit') ? 'pointer' : 'default';
                pickerBtn.style.minHeight = '28px';
                pickerBtn.style.padding = '2px 7px';
                pickerBtn.disabled = (col.role !== 'edit');

                var selfForPicker = this;
                inp.addEventListener('click', function(e) {
                    if (col.role === 'edit') selfForPicker._openNativePicker(inp);
                });
                pickerBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (col.role === 'edit') selfForPicker._openNativePicker(inp);
                });
                td.addEventListener('click', function(e) {
                    if (e.target === inp || e.target === pickerBtn) return;
                    if (col.role === 'edit') selfForPicker._openNativePicker(inp);
                });

                wrap.append(inp);
                //wrap.append(pickerBtn);

                td.classList.add('data-input');
                if (col.role === 'edit') td.classList.add('enablewrite');
                td.style.padding = '2px';
                td.append(wrap);
                break;
            }

            case 'textarea': {
                var ta = document.createElement('textarea');
                this._applyInputStyle(ta, col);
                ta.rows = col.rows || 3;
                ta.style.resize = 'vertical';
                ta.style.lineHeight = '1.45';
                if (col.role === 'edit') ta.style.cursor = 'text';
                td.classList.add('data-input');
                if (col.role === 'edit') td.classList.add('enablewrite');
                td.style.padding = '0';
                td.append(ta);
                break;
            }

            case 'control': {
                var span = document.createElement('span');
                span.setAttribute('name', 'manage_button');
                (col.buttons || []).forEach(function(btn) {
                    var inp = document.createElement('input');
                    inp.type  = 'button';
                    inp.value = btn.value;
                    inp.setAttribute('onclick', btn.onclick);
                    inp.style.margin = '0 2px 0 0';
                    span.append(inp);
                });
                td.append(span);
                break;
            }

            default: {
                td.classList.add('data-text');
                if (col.role === 'edit') {
                    td.classList.add('enablewrite');
                    td.contentEditable = 'true';
                } else if (col.role === 'pass') {
                    td.classList.add('enablewrite');
                    td.classList.add('hidetext');
                    td.contentEditable = 'true';
                } else if (col.role === 'button') {
                    td.classList.add('cell_button');
                    td.setAttribute('onclick', col.onclick);
                }
                break;
            }
        }

        return td;
    }

    showData(obj) {
        var data = Array.isArray(obj) ? (obj[0] || {}) : (obj || {});
        var self = this;

        var textTds = this.table.getElementsByClassName('data-text');
        for (var i = 0; i < textTds.length; i++) {
            var textKey = textTds[i].dataset.id;
            if (!textKey) continue;
            textTds[i].textContent = (data[textKey] !== undefined) ? String(data[textKey]) : '';
        }

        var inputTds = this.table.getElementsByClassName('data-input');
        for (var ii = 0; ii < inputTds.length; ii++) {
            var inputKey = inputTds[ii].dataset.id;
            var inputEl = inputTds[ii].querySelector('input, textarea');
            if (!inputEl || !inputKey) continue;
            inputEl.value = self._normalizeInputValue(inputEl.type || inputTds[ii].dataset.type, data[inputKey]);
        }

        var codeTds = this.table.getElementsByClassName('data-code');
        for (var ci = 0; ci < codeTds.length; ci++) {
            var codeKey = codeTds[ci].dataset.id;
            var sel = codeTds[ci].querySelector('select');
            if (!sel || !codeKey) continue;

            var colDef = null;
            self._option.column.forEach(function(c) {
                if (c.id === codeKey && c.type === 'code') colDef = c;
            });

            if (colDef && typeof colDef.codes === 'function') {
                var dynCodes = colDef.codes(data);
                dynCodes = (dynCodes || []).map(function(c) {
                    return (typeof c === 'string') ? {v: c, l: c} : c;
                });
                self._buildOptions(sel, dynCodes, data[codeKey]);
            } else {
                if (data[codeKey] !== undefined) sel.value = String(data[codeKey]);
            }
        }

        var checkTds = this.table.getElementsByClassName('data-check');
        for (var ki = 0; ki < checkTds.length; ki++) {
            var checkKey = checkTds[ki].dataset.id;
            var chk = checkTds[ki].querySelector('input[type="checkbox"]');
            if (!chk || !checkKey) continue;
            var raw = data[checkKey];
            chk.checked = (raw === '1' || raw === 1 || raw === true || raw === 'true' || raw === 'Y' || raw === 'y');
        }
    }

    clear() {
        var textTds = this.table.getElementsByClassName('data-text');
        for (var i = 0; i < textTds.length; i++) {
            if (!textTds[i].dataset.id) continue;
            textTds[i].textContent = '';
        }

        var inputTds = this.table.getElementsByClassName('data-input');
        for (var ii = 0; ii < inputTds.length; ii++) {
            var inputEl = inputTds[ii].querySelector('input, textarea');
            if (inputEl) inputEl.value = '';
        }

        var codeTds = this.table.getElementsByClassName('data-code');
        for (var ci = 0; ci < codeTds.length; ci++) {
            var sel = codeTds[ci].querySelector('select');
            if (sel && sel.options.length > 0) sel.selectedIndex = 0;
        }

        var checkTds = this.table.getElementsByClassName('data-check');
        for (var ki = 0; ki < checkTds.length; ki++) {
            var chk = checkTds[ki].querySelector('input[type="checkbox"]');
            if (chk) chk.checked = false;
        }
    }

    toJson() {
        var result = {};

        var textTds = this.table.getElementsByClassName('data-text');
        for (var i = 0; i < textTds.length; i++) {
            var textKey = textTds[i].dataset.id;
            if (textKey) result[textKey] = textTds[i].textContent;
        }

        var inputTds = this.table.getElementsByClassName('data-input');
        for (var ii = 0; ii < inputTds.length; ii++) {
            var inputKey = inputTds[ii].dataset.id;
            var inputEl = inputTds[ii].querySelector('input, textarea');
            if (inputKey) result[inputKey] = inputEl ? inputEl.value : '';
        }

        var codeTds = this.table.getElementsByClassName('data-code');
        for (var ci = 0; ci < codeTds.length; ci++) {
            var codeKey = codeTds[ci].dataset.id;
            var sel = codeTds[ci].querySelector('select');
            if (codeKey) result[codeKey] = sel ? sel.value : '';
        }

        var checkTds = this.table.getElementsByClassName('data-check');
        for (var ki = 0; ki < checkTds.length; ki++) {
            var checkKey = checkTds[ki].dataset.id;
            var chk = checkTds[ki].querySelector('input[type="checkbox"]');
            if (checkKey) result[checkKey] = chk ? (chk.checked ? '1' : '0') : '0';
        }

        return JSON.stringify([result]);
    }

    getData(id, fallback) {
        var textTds = this.table.getElementsByClassName('data-text');
        for (var i = 0; i < textTds.length; i++) {
            if (textTds[i].dataset.id === id) return textTds[i].textContent;
        }

        var inputTds = this.table.getElementsByClassName('data-input');
        for (var ii = 0; ii < inputTds.length; ii++) {
            if (inputTds[ii].dataset.id === id) {
                var inputEl = inputTds[ii].querySelector('input, textarea');
                return inputEl ? inputEl.value : '';
            }
        }

        var codeTds = this.table.getElementsByClassName('data-code');
        for (var ci = 0; ci < codeTds.length; ci++) {
            if (codeTds[ci].dataset.id === id) {
                var sel = codeTds[ci].querySelector('select');
                return sel ? sel.value : '';
            }
        }

        var checkTds = this.table.getElementsByClassName('data-check');
        for (var ki = 0; ki < checkTds.length; ki++) {
            if (checkTds[ki].dataset.id === id) {
                var chk = checkTds[ki].querySelector('input[type="checkbox"]');
                return chk ? (chk.checked ? '1' : '0') : '0';
            }
        }
        return fallback;
    }
}
