/**
 * @file   hive_grid_lite.js
 * @brief  Grid based single record profile component (v1.1)
 * @author AnHive Co., Ltd. / generated migration sample
 * @date   2026-05-14
 *
 * ■ 목적
 *   기존 hive_profile_lite.js의 1차원 제목-값 테이블 구조를 CSS Grid 구조로 전환한다.
 *   기존 showData(), clear(), toJson(), getData() 방식과 호환되도록 data-text,
 *   data-input, data-code, data-check class와 data-id 속성 체계를 유지한다.
 *
 * ■ 주요 옵션
 *   {
 *     table: {
 *       width       : '100%',
 *       columns     : 12,
 *       label_width : '96px',
 *       gap         : '1px',
 *       min_height  : '34px'
 *     },
 *     sections: [
 *       {
 *         title   : '작업지시서 기본정보',
 *         columns : 12,                 // 생략 시 table.columns 사용
 *         fields  : [
 *           { title:'작업번호', id:'work_no', type:'text', role:'edit', span:4 },
 *           { title:'기간', type:'group', span:8, items:[
 *              { title:'접수', id:'order_date', type:'date', role:'edit' },
 *              { title:'납기', id:'due_date', type:'date', role:'edit' }
 *           ]},
 *           { title:'메모', id:'memo', type:'textarea', role:'edit', rows:3, span:12 }
 *         ]
 *       }
 *     ]
 *   }
 *
 * ■ 지원 type
 *   text | date | date_ymd | datetime_ymd_hm | time | datetime-local | textarea | code | check | control | group
 *
 * ■ 보안 유지 항목
 *   innerHTML 미사용. textContent / .value 중심으로 처리한다.
 */

'use strict';

class HiveGridLite {

    constructor(id, option) {
        this._option = option || {};
        this._option.table = this._option.table || {};
        this._fields = this._flattenFields(this._option);
        this._fieldMap = this._buildFieldMap(this._fields);

        this.root = this._buildGrid(this._option);

        // 기존 ProfileLite 계열의 showData/toJson 내부 호환을 위해 table 이름도 유지한다.
        this.table = this.root;

        var mount = document.getElementById(id);
        if (!mount) throw new Error('HiveGridLite mount element not found: ' + id);
        mount.append(this.root);
    }

    _flattenFields(option) {
        var result = [];
        var sections = option.sections || null;

        // 기존 column 옵션을 그대로 넘겨도 1개 section으로 감싸서 동작하게 한다.
        if (!sections && option.column) {
            sections = [{ title: option.title || '', fields: option.column }];
        }
        if (!sections && option.fields) {
            sections = [{ title: option.title || '', fields: option.fields }];
        }

        (sections || []).forEach(function(section) {
            (section.fields || []).forEach(function(field) {
                if (field && (field.type === 'group' || Array.isArray(field.items))) {
                    (field.items || []).forEach(function(child) {
                        if (child) result.push(child);
                    });
                } else if (field) {
                    result.push(field);
                }
            });
        });
        return result;
    }

    _buildFieldMap(fields) {
        var map = {};
        (fields || []).forEach(function(field) {
            if (field && field.id) map[field.id] = field;
        });
        return map;
    }

    _normCodes(codes) {
        if (typeof codes === 'function') return codes;
        return (codes || []).map(function(c) {
            return (typeof c === 'string') ? {v: c, l: c} : c;
        });
    }

    _buildOptions(sel, codes, curVal) {
        while (sel.firstChild) sel.removeChild(sel.firstChild);
        (codes || []).forEach(function(code) {
            var opt = document.createElement('option');
            opt.value = code.v;
            opt.textContent = code.l;
            sel.append(opt);
        });
        if (curVal !== undefined && curVal !== null) sel.value = String(curVal);
    }

    _normalizeInputValue(inputType, value) {
        if (value === undefined || value === null) return '';
        var s = String(value).trim();
        if (s === '') return '';

        if (inputType === 'date') {
            return s.replace('T', ' ').substring(0, 10);
        }
        if (inputType === 'datetime-local') {
            return s.replace(' ', 'T').substring(0, 16);
        }
        if (inputType === 'time') {
            return s.substring(0, 5);
        }
        return s;
    }

    _formatDateYmdSlash(value) {
        if (value === undefined || value === null) return '';
        var s = String(value).trim();
        if (s === '') return '';

        // DB 값(YYYY-MM-DD), 기존 입력값(YYYY/MM/DD), timestamp 모두 표시용 YYYY/MM/DD로 변환
        s = s.replace('T', ' ').substring(0, 10);
        s = s.replace(/\./g, '-').replace(/\//g, '-');

        var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (!m) return String(value).trim();

        return m[1] + '/' + String(m[2]).padStart(2, '0') + '/' + String(m[3]).padStart(2, '0');
    }

    _parseDateYmdSlash(value) {
        if (value === undefined || value === null) return '';
        var s = String(value).trim();
        if (s === '') return '';

        // 화면 입력값은 YYYY/MM/DD가 원칙이지만 YYYY-MM-DD, YYYY.MM.DD도 허용
        s = s.replace(/\./g, '/').replace(/-/g, '/');
        var m = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
        if (!m) return s;

        return m[1] + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[3]).padStart(2, '0');
    }

    _isValidDateYmdSlash(value) {
        var dbValue = this._parseDateYmdSlash(value);
        var m = dbValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!m) return false;

        var y = parseInt(m[1], 10);
        var mo = parseInt(m[2], 10);
        var d = parseInt(m[3], 10);
        var dt = new Date(y, mo - 1, d);
        return dt.getFullYear() === y && (dt.getMonth() + 1) === mo && dt.getDate() === d;
    }

    _formatDateTimeYmdHmSlash(value) {
        if (value === undefined || value === null) return '';
        var s = String(value).trim();
        if (s === '') return '';

        // DB 값(YYYY-MM-DD HH:MM:SS), datetime-local 값(YYYY-MM-DDTHH:MM),
        // 화면값(YYYY/MM/DD HH:MM)을 모두 표시용 YYYY/MM/DD HH:MM으로 변환
        s = s.replace('T', ' ').replace(/\./g, '-').replace(/\//g, '-');
        var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:\s+(\d{1,2}):(\d{1,2})(?::\d{1,2})?)?$/);
        if (!m) return String(value).trim();

        var datePart = m[1] + '/' + String(m[2]).padStart(2, '0') + '/' + String(m[3]).padStart(2, '0');
        if (m[4] === undefined || m[5] === undefined) return datePart;
        return datePart + ' ' + String(m[4]).padStart(2, '0') + ':' + String(m[5]).padStart(2, '0');
    }

    _parseDateTimeYmdHmSlash(value) {
        if (value === undefined || value === null) return '';
        var s = String(value).trim();
        if (s === '') return '';

        // 화면 입력값은 YYYY/MM/DD HH:MM이 원칙이지만 YYYY-MM-DD, YYYY.MM.DD, T 구분도 허용
        s = s.replace('T', ' ').replace(/\./g, '/').replace(/-/g, '/').replace(/\s+/g, ' ');
        var m = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})(?:\s+(\d{1,2}):(\d{1,2})(?::\d{1,2})?)?$/);
        if (!m) return s;

        var datePart = m[1] + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[3]).padStart(2, '0');
        if (m[4] === undefined || m[5] === undefined) return datePart;
        return datePart + ' ' + String(m[4]).padStart(2, '0') + ':' + String(m[5]).padStart(2, '0');
    }

    _toDateTimeLocalValue(value) {
        var dbValue = this._parseDateTimeYmdHmSlash(value);
        if (dbValue === '') return '';
        var m = dbValue.match(/^(\d{4}-\d{2}-\d{2})(?:\s+(\d{2}:\d{2}))?$/);
        if (!m) return '';
        return m[1] + 'T' + (m[2] || '00:00');
    }

    _isValidDateTimeYmdHmSlash(value) {
        var dbValue = this._parseDateTimeYmdHmSlash(value);
        var m = dbValue.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2}))?$/);
        if (!m) return false;

        var y = parseInt(m[1], 10);
        var mo = parseInt(m[2], 10);
        var d = parseInt(m[3], 10);
        var hh = (m[4] === undefined) ? 0 : parseInt(m[4], 10);
        var mm = (m[5] === undefined) ? 0 : parseInt(m[5], 10);
        if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return false;
        var dt = new Date(y, mo - 1, d, hh, mm);
        return dt.getFullYear() === y && (dt.getMonth() + 1) === mo && dt.getDate() === d;
    }

    _openNativePicker(input) {
        if (!input || input.disabled || input.readOnly) return;
        try {
            input.focus();
            if (typeof input.showPicker === 'function') input.showPicker();
        } catch (ex) {
            // showPicker 미지원 브라우저는 focus만 사용한다.
        }
    }

    _applyInputStyle(input, col) {
        input.dataset.id = col.id || '';
        input.classList.add('hive-grid-input');

        if (col.role !== 'edit') {
            input.disabled = true;
            input.classList.add('is-readonly');
        } else {
            input.classList.add('is-editable');
        }
    }

    _buildGrid(option) {
        var tableOpt = option.table || {};
        var root = document.createElement('div');
        root.className = 'hive-grid-lite';
        root.style.width = tableOpt.width || '100%';
        if (tableOpt.gap) root.style.setProperty('--hive-grid-gap', tableOpt.gap);
        if (tableOpt.label_width) root.style.setProperty('--hive-label-width', tableOpt.label_width);
        if (tableOpt.min_height) root.style.setProperty('--hive-field-min-height', tableOpt.min_height);

        var sections = option.sections || null;
        if (!sections && option.column) sections = [{ title: option.title || '', fields: option.column }];
        if (!sections && option.fields) sections = [{ title: option.title || '', fields: option.fields }];
        sections = sections || [];

        var self = this;
        sections.forEach(function(section) {
            var sec = document.createElement('section');
            sec.className = 'hive-grid-section';

            if (section.title) {
                var title = document.createElement('div');
                title.className = 'hive-grid-section-title';
                title.textContent = section.title;
                sec.append(title);
            }

            var grid = document.createElement('div');
            grid.className = 'hive-grid';
            grid.style.gridTemplateColumns = 'repeat(' + (section.columns || tableOpt.columns || 12) + ', minmax(0, 1fr))';
            if (section.gap) grid.style.gap = section.gap;

            (section.fields || []).forEach(function(col) {
                grid.append(self._makeGridItem(col, tableOpt));
            });

            sec.append(grid);
            root.append(sec);
        });

        return root;
    }

    _makeGridItem(col, tableOpt) {
        var item = document.createElement('div');
        item.className = 'hive-grid-item';
        if (col.className) item.classList.add(col.className);
        if (col.visible === false) item.classList.add('col_hide');
        if (col.id) item.dataset.id = col.id;

        var span = col.span || tableOpt.default_span || 4;
        item.style.gridColumn = 'span ' + span;

        var label = document.createElement('div');
        label.className = 'hive-grid-label keycolume';
        label.textContent = col.title || '';
        if (col.label_width) label.style.width = col.label_width;

        var value;
        if (col.type === 'group' || Array.isArray(col.items)) {
            value = this._makeGroupCell(col);
        } else {
            value = this._makeCell(col);
        }
        value.classList.add('hive-grid-value');

        item.append(label);
        item.append(value);
        return item;
    }

    _makeGroupCell(groupCol) {
        var wrap = document.createElement('div');
        wrap.className = 'hive-grid-group';
        if (groupCol.group_columns) {
            wrap.style.gridTemplateColumns = 'repeat(' + groupCol.group_columns + ', minmax(0, 1fr))';
        }

        var self = this;
        (groupCol.items || []).forEach(function(child) {
            var unit = document.createElement('div');
            unit.className = 'hive-grid-group-unit';
            if (child.visible === false) unit.classList.add('col_hide');

            if (child.title) {
                var miniLabel = document.createElement('div');
                miniLabel.className = 'hive-grid-mini-label';
                miniLabel.textContent = child.title;
                unit.append(miniLabel);
            }

            var cell = self._makeCell(child);
            cell.classList.add('hive-grid-mini-value');
            unit.append(cell);
            wrap.append(unit);
        });

        return wrap;
    }

    _makeCell(col) {
        var cell = document.createElement('div');
        cell.dataset.id = col.id || '';
        cell.dataset.type = col.type || 'text';
        cell.className = 'hive-grid-cell';

        if (col.visible === false) cell.classList.add('col_hide');
        if (col.align) cell.style.textAlign = col.align;
        if (col.min_width) cell.style.minWidth = col.min_width;

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

                cell.classList.add('data-code');
                if (col.role === 'edit') cell.classList.add('enablewrite');
                cell.append(sel);
                break;
            }

            case 'check': {
                var chk = document.createElement('input');
                chk.type = 'checkbox';
                chk.dataset.id = col.id || '';
                chk.className = 'hive-grid-check';

                if (col.role === 'info') {
                    chk.disabled = true;
                    chk.classList.add('is-readonly');
                } else {
                    chk.classList.add('is-editable');
                }

                cell.classList.add('data-check');
                cell.append(chk);
                break;
            }

            case 'date_ymd': {
                var textInp = document.createElement('input');
                textInp.type = 'text';
                textInp.placeholder = col.placeholder || 'yyyy/mm/dd';
                textInp.maxLength = 10;
                textInp.inputMode = 'numeric';
                textInp.dataset.type = 'date_ymd';
                this._applyInputStyle(textInp, col);

                var nativeDate = document.createElement('input');
                nativeDate.type = 'date';
                nativeDate.tabIndex = -1;
                nativeDate.className = 'hive-date-hidden-picker';
                nativeDate.setAttribute('aria-hidden', 'true');
                nativeDate.disabled = (col.role !== 'edit');

                var wrap = document.createElement('div');
                wrap.className = 'profile-input-wrap hive-picker-wrap hive-date-ymd-wrap';

                var pickerBtn = document.createElement('button');
                pickerBtn.type = 'button';
                pickerBtn.textContent = '📅';
                pickerBtn.title = '선택';
                pickerBtn.className = 'profile-picker-button hive-picker-button';
                pickerBtn.disabled = (col.role !== 'edit');

                var selfForYmd = this;
                function normalizeTextInput() {
                    var v = textInp.value.trim();
                    if (v === '') {
                        textInp.classList.remove('hive-input-invalid');
                        return;
                    }
                    if (selfForYmd._isValidDateYmdSlash(v)) {
                        textInp.value = selfForYmd._formatDateYmdSlash(selfForYmd._parseDateYmdSlash(v));
                        textInp.classList.remove('hive-input-invalid');
                    } else {
                        textInp.classList.add('hive-input-invalid');
                    }
                }

                textInp.addEventListener('blur', normalizeTextInput);
                textInp.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter') {
                        normalizeTextInput();
                        textInp.blur();
                    }
                });
                nativeDate.addEventListener('change', function() {
                    textInp.value = selfForYmd._formatDateYmdSlash(nativeDate.value);
                    textInp.classList.remove('hive-input-invalid');
                    textInp.dispatchEvent(new Event('change', {bubbles:true}));
                });
                pickerBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (col.role !== 'edit') return;
                    nativeDate.value = selfForYmd._parseDateYmdSlash(textInp.value);
                    selfForYmd._openNativePicker(nativeDate);
                });

                wrap.append(textInp);
                wrap.append(nativeDate);
                wrap.append(pickerBtn);
                cell.classList.add('data-input');
                if (col.role === 'edit') cell.classList.add('enablewrite');
                cell.append(wrap);
                break;
            }

            case 'datetime_ymd_hm': {
                var dtTextInp = document.createElement('input');
                dtTextInp.type = 'text';
                dtTextInp.placeholder = col.placeholder || 'yyyy/mm/dd hh:mm';
                dtTextInp.maxLength = 16;
                dtTextInp.inputMode = 'numeric';
                dtTextInp.dataset.type = 'datetime_ymd_hm';
                this._applyInputStyle(dtTextInp, col);

                var nativeDateTime = document.createElement('input');
                nativeDateTime.type = 'datetime-local';
                nativeDateTime.tabIndex = -1;
                nativeDateTime.className = 'hive-date-hidden-picker';
                nativeDateTime.setAttribute('aria-hidden', 'true');
                nativeDateTime.disabled = (col.role !== 'edit');

                var dtWrap = document.createElement('div');
                dtWrap.className = 'profile-input-wrap hive-picker-wrap hive-datetime-ymd-hm-wrap';

                var dtPickerBtn = document.createElement('button');
                dtPickerBtn.type = 'button';
                dtPickerBtn.textContent = '📅';
                dtPickerBtn.title = '날짜/시간 선택';
                dtPickerBtn.className = 'profile-picker-button hive-picker-button';
                dtPickerBtn.disabled = (col.role !== 'edit');

                var selfForDt = this;
                function normalizeDateTimeInput() {
                    var v = dtTextInp.value.trim();
                    if (v === '') {
                        dtTextInp.classList.remove('hive-input-invalid');
                        return;
                    }
                    if (selfForDt._isValidDateTimeYmdHmSlash(v)) {
                        dtTextInp.value = selfForDt._formatDateTimeYmdHmSlash(selfForDt._parseDateTimeYmdHmSlash(v));
                        dtTextInp.classList.remove('hive-input-invalid');
                    } else {
                        dtTextInp.classList.add('hive-input-invalid');
                    }
                }

                dtTextInp.addEventListener('blur', normalizeDateTimeInput);
                dtTextInp.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter') {
                        normalizeDateTimeInput();
                        dtTextInp.blur();
                    }
                });
                nativeDateTime.addEventListener('change', function() {
                    dtTextInp.value = selfForDt._formatDateTimeYmdHmSlash(nativeDateTime.value);
                    dtTextInp.classList.remove('hive-input-invalid');
                    dtTextInp.dispatchEvent(new Event('change', {bubbles:true}));
                });
                dtPickerBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (col.role !== 'edit') return;
                    nativeDateTime.value = selfForDt._toDateTimeLocalValue(dtTextInp.value);
                    selfForDt._openNativePicker(nativeDateTime);
                });

                dtWrap.append(dtTextInp);
                dtWrap.append(nativeDateTime);
                dtWrap.append(dtPickerBtn);
                cell.classList.add('data-input');
                if (col.role === 'edit') cell.classList.add('enablewrite');
                cell.append(dtWrap);
                break;
            }

            case 'date':
            case 'time':
            case 'datetime-local': {
                var inp = document.createElement('input');
                inp.type = col.type;
                this._applyInputStyle(inp, col);
                inp.classList.add('cell-native-picker');

                var wrap = document.createElement('div');
                wrap.className = 'profile-input-wrap hive-picker-wrap';

                var pickerBtn = document.createElement('button');
                pickerBtn.type = 'button';
                pickerBtn.textContent = (col.type === 'time') ? '⏱' : '📅';
                pickerBtn.title = '선택';
                pickerBtn.className = 'profile-picker-button hive-picker-button';
                pickerBtn.disabled = (col.role !== 'edit');

                var selfForPicker = this;
                inp.addEventListener('click', function() {
                    if (col.role === 'edit') selfForPicker._openNativePicker(inp);
                });
                pickerBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (col.role === 'edit') selfForPicker._openNativePicker(inp);
                });
                cell.addEventListener('click', function(e) {
                    if (e.target === inp || e.target === pickerBtn) return;
                    if (col.role === 'edit') selfForPicker._openNativePicker(inp);
                });

                wrap.append(inp);
                wrap.append(pickerBtn);
                cell.classList.add('data-input');
                if (col.role === 'edit') cell.classList.add('enablewrite');
                cell.append(wrap);
                break;
            }

            case 'textarea': {
                var ta = document.createElement('textarea');
                this._applyInputStyle(ta, col);
                ta.rows = col.rows || 3;
                if (col.placeholder) ta.placeholder = col.placeholder;
                cell.classList.add('data-input');
                if (col.role === 'edit') cell.classList.add('enablewrite');
                cell.append(ta);
                break;
            }

            case 'control': {
                var span = document.createElement('span');
                span.setAttribute('name', 'manage_button');
                span.className = 'hive-control-wrap';

                (col.buttons || []).forEach(function(btn) {
                    var inpBtn = document.createElement('input');
                    inpBtn.type = 'button';
                    inpBtn.value = btn.value || '';
                    if (typeof btn.onclick === 'function') {
                        inpBtn.addEventListener('click', btn.onclick);
                    } else if (btn.onclick) {
                        inpBtn.setAttribute('onclick', btn.onclick);
                    }
                    span.append(inpBtn);
                });
                cell.classList.add('data-control');
                cell.append(span);
                break;
            }

            default: {
                cell.classList.add('data-text');
                if (col.role === 'edit') {
                    cell.classList.add('enablewrite');
                    cell.contentEditable = 'true';
                } else if (col.role === 'pass') {
                    cell.classList.add('enablewrite');
                    cell.classList.add('hidetext');
                    cell.contentEditable = 'true';
                } else if (col.role === 'button') {
                    cell.classList.add('cell_button');
                    if (typeof col.onclick === 'function') {
                        cell.addEventListener('click', col.onclick);
                    } else if (col.onclick) {
                        cell.setAttribute('onclick', col.onclick);
                    }
                }
                break;
            }
        }

        return cell;
    }

    showData(obj) {
        var data = Array.isArray(obj) ? (obj[0] || {}) : (obj || {});
        var self = this;

        var textEls = this.table.getElementsByClassName('data-text');
        for (var i = 0; i < textEls.length; i++) {
            var textKey = textEls[i].dataset.id;
            if (!textKey) continue;
            textEls[i].textContent = (data[textKey] !== undefined && data[textKey] !== null) ? String(data[textKey]) : '';
        }

        var inputEls = this.table.getElementsByClassName('data-input');
        for (var ii = 0; ii < inputEls.length; ii++) {
            var inputKey = inputEls[ii].dataset.id;
            var inputEl = inputEls[ii].querySelector('input, textarea');
            if (!inputEl || !inputKey) continue;
            var inputType = inputEls[ii].dataset.type || inputEl.dataset.type || inputEl.type;
            if (inputType === 'date_ymd') {
                inputEl.value = self._formatDateYmdSlash(data[inputKey]);
            } else if (inputType === 'datetime_ymd_hm') {
                inputEl.value = self._formatDateTimeYmdHmSlash(data[inputKey]);
            } else {
                inputEl.value = self._normalizeInputValue(inputEl.type || inputType, data[inputKey]);
            }
        }

        var codeEls = this.table.getElementsByClassName('data-code');
        for (var ci = 0; ci < codeEls.length; ci++) {
            var codeKey = codeEls[ci].dataset.id;
            var sel = codeEls[ci].querySelector('select');
            if (!sel || !codeKey) continue;

            var colDef = self._fieldMap[codeKey];
            if (colDef && typeof colDef.codes === 'function') {
                var dynCodes = colDef.codes(data);
                dynCodes = (dynCodes || []).map(function(c) {
                    return (typeof c === 'string') ? {v: c, l: c} : c;
                });
                self._buildOptions(sel, dynCodes, data[codeKey]);
            } else if (data[codeKey] !== undefined && data[codeKey] !== null) {
                sel.value = String(data[codeKey]);
            }
        }

        var checkEls = this.table.getElementsByClassName('data-check');
        for (var ki = 0; ki < checkEls.length; ki++) {
            var checkKey = checkEls[ki].dataset.id;
            var chk = checkEls[ki].querySelector('input[type="checkbox"]');
            if (!chk || !checkKey) continue;
            var raw = data[checkKey];
            chk.checked = (raw === '1' || raw === 1 || raw === true || raw === 'true' || raw === 'Y' || raw === 'y');
        }
    }

    clear() {
        var textEls = this.table.getElementsByClassName('data-text');
        for (var i = 0; i < textEls.length; i++) {
            if (!textEls[i].dataset.id) continue;
            textEls[i].textContent = '';
        }

        var inputEls = this.table.getElementsByClassName('data-input');
        for (var ii = 0; ii < inputEls.length; ii++) {
            var inputEl = inputEls[ii].querySelector('input, textarea');
            if (inputEl) inputEl.value = '';
        }

        var codeEls = this.table.getElementsByClassName('data-code');
        for (var ci = 0; ci < codeEls.length; ci++) {
            var sel = codeEls[ci].querySelector('select');
            if (sel && sel.options.length > 0) sel.selectedIndex = 0;
        }

        var checkEls = this.table.getElementsByClassName('data-check');
        for (var ki = 0; ki < checkEls.length; ki++) {
            var chk = checkEls[ki].querySelector('input[type="checkbox"]');
            if (chk) chk.checked = false;
        }
    }

    toObject() {
        var result = {};

        var textEls = this.table.getElementsByClassName('data-text');
        for (var i = 0; i < textEls.length; i++) {
            var textKey = textEls[i].dataset.id;
            if (textKey) result[textKey] = textEls[i].textContent;
        }

        var inputEls = this.table.getElementsByClassName('data-input');
        for (var ii = 0; ii < inputEls.length; ii++) {
            var inputKey = inputEls[ii].dataset.id;
            var inputEl = inputEls[ii].querySelector('input, textarea');
            if (inputKey) {
                var inputType = inputEls[ii].dataset.type || (inputEl ? inputEl.dataset.type : '') || (inputEl ? inputEl.type : '');
                if (inputType === 'date_ymd') {
                    result[inputKey] = inputEl ? this._parseDateYmdSlash(inputEl.value) : '';
                } else if (inputType === 'datetime_ymd_hm') {
                    result[inputKey] = inputEl ? this._parseDateTimeYmdHmSlash(inputEl.value) : '';
                } else {
                    result[inputKey] = inputEl ? inputEl.value : '';
                }
            }
        }

        var codeEls = this.table.getElementsByClassName('data-code');
        for (var ci = 0; ci < codeEls.length; ci++) {
            var codeKey = codeEls[ci].dataset.id;
            var sel = codeEls[ci].querySelector('select');
            if (codeKey) result[codeKey] = sel ? sel.value : '';
        }

        var checkEls = this.table.getElementsByClassName('data-check');
        for (var ki = 0; ki < checkEls.length; ki++) {
            var checkKey = checkEls[ki].dataset.id;
            var chk = checkEls[ki].querySelector('input[type="checkbox"]');
            if (checkKey) result[checkKey] = chk ? (chk.checked ? '1' : '0') : '0';
        }

        return result;
    }

    toJson() {
        return JSON.stringify([this.toObject()]);
    }

    getData(id, fallback) {
        var target = this.table.querySelector('[data-id="' + this._escapeSelector(id) + '"]');
        if (!target) return fallback;

        if (target.classList.contains('data-text')) return target.textContent;

        if (target.classList.contains('data-input')) {
            var inputEl = target.querySelector('input, textarea');
            return inputEl ? inputEl.value : '';
        }

        if (target.classList.contains('data-code')) {
            var sel = target.querySelector('select');
            return sel ? sel.value : '';
        }

        if (target.classList.contains('data-check')) {
            var chk = target.querySelector('input[type="checkbox"]');
            return chk ? (chk.checked ? '1' : '0') : '0';
        }

        // item wrapper가 먼저 잡힌 경우 내부 실제 cell을 다시 찾는다.
        var child = target.querySelector('.data-text, .data-input, .data-code, .data-check');
        if (child) {
            if (child.classList.contains('data-text')) return child.textContent;
            if (child.classList.contains('data-input')) {
                var childInput = child.querySelector('input, textarea');
                return childInput ? childInput.value : '';
            }
            if (child.classList.contains('data-code')) {
                var childSel = child.querySelector('select');
                return childSel ? childSel.value : '';
            }
            if (child.classList.contains('data-check')) {
                var childChk = child.querySelector('input[type="checkbox"]');
                return childChk ? (childChk.checked ? '1' : '0') : '0';
            }
        }

        return fallback;
    }

    _escapeSelector(value) {
        if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(value);
        return String(value).replace(/"/g, '\\"');
    }
}

// 기존 코드가 ProfileLite 이름을 기대하는 경우 선택적으로 alias로 사용할 수 있다.
// 필요하지 않으면 아래 줄을 삭제해도 된다.
window.HiveGridLite = HiveGridLite;
