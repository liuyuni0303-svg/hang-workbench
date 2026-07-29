/* ===== 头疼频率栏目：日历标记 + 备注 + 月度统计 ===== */
const ModHeadache = (() => {
  const { $, $$, esc, toast, openModal, confirmModal, todayStr } = UI;

  let curYM = todayStr().slice(0, 7); // 'YYYY-MM'

  function recsByDate() {
    const map = {};
    Store.list('headache').forEach(r => { map[r.payload.date] = r; });
    return map;
  }

  function render(view) {
    const [y, m] = curYM.split('-').map(Number);
    const map = recsByDate();
    const today = todayStr();
    const monthRecs = Object.keys(map).filter(d => d.startsWith(curYM));
    const yearRecs = Object.keys(map).filter(d => d.startsWith(String(y)));

    // 日历格
    const first = new Date(y, m - 1, 1);
    const daysInMonth = new Date(y, m, 0).getDate();
    const startW = first.getDay();
    let cells = '';
    for (let i = 0; i < startW; i++) cells += `<div class="cal-day dim"></div>`;
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${curYM}-${String(d).padStart(2, '0')}`;
      const hit = map[ds];
      const cls = ['cal-day', hit ? 'hit' : '', ds === today ? 'today' : '', ds > today ? 'future' : ''].join(' ');
      cells += `<div class="${cls}" data-day="${ds}" title="${hit && hit.payload.note ? esc(hit.payload.note) : ''}">${d}</div>`;
    }

    view.innerHTML = `
      <div class="stat-row">
        <div class="stat"><div class="v" style="color:${monthRecs.length ? 'var(--red)' : 'var(--brand)'}">${monthRecs.length}</div><div class="k">本月发作次数</div></div>
        <div class="stat"><div class="v">${yearRecs.length}</div><div class="k">${y}年累计次数</div></div>
        <div class="stat"><div class="v">${lastGap(map, today)}</div><div class="k">距上次发作(天)</div></div>
      </div>

      <div class="card">
        <div class="cal-head">
          <button class="icon-btn" id="prevM">‹</button>
          <div class="cal-title">${y}年${m}月</div>
          <div class="row" style="gap:4px">
            <button class="btn small ghost" id="jumpToday">回今天</button>
            <button class="icon-btn" id="nextM">›</button>
          </div>
        </div>
        <div class="cal-grid">
          ${['日', '一', '二', '三', '四', '五', '六'].map(w => `<div class="cal-week">${w}</div>`).join('')}
          ${cells}
        </div>
        <div class="muted" style="margin-top:10px">点击日期标记/取消头疼；🔴 红色 = 当日有头疼记录</div>
      </div>

      <div class="card-title" style="margin:16px 0 10px">📝 本月头疼明细</div>
      ${monthRecs.length ? monthRecs.sort().reverse().map(d => detailHTML(map[d])).join('')
        : `<div class="empty"><div class="big">🎉</div>本月暂无头疼记录，继续保持！</div>`}`;

    $('#prevM', view).onclick = () => { curYM = shiftMonth(curYM, -1); render(view); };
    $('#nextM', view).onclick = () => { curYM = shiftMonth(curYM, 1); render(view); };
    $('#jumpToday', view).onclick = () => { curYM = todayStr().slice(0, 7); render(view); };
    $$('[data-day]', view).forEach(c => c.onclick = () => dayClick(c.dataset.day, map));
    $$('[data-hedit]', view).forEach(b => b.onclick = () => openNote(b.dataset.hedit));
    $$('[data-hdel]', view).forEach(b => b.onclick = () =>
      confirmModal('取消这天的头疼标记？', () => { Store.remove(b.dataset.hdel); toast('已取消标记'); }));
  }

  function lastGap(map, today) {
    const dates = Object.keys(map).filter(d => d <= today).sort();
    if (!dates.length) return '--';
    const last = new Date(dates[dates.length - 1] + 'T00:00:00');
    return Math.floor((new Date(today + 'T00:00:00') - last) / 86400000);
  }

  function shiftMonth(ym, delta) {
    const [y, m] = ym.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  function detailHTML(r) {
    const p = r.payload;
    return `<div class="card" style="margin-bottom:8px;padding:12px 14px">
      <div class="row">
        <div style="flex:1">
          <b style="font-size:14px">🔴 ${UI.fmtDate(p.date)}</b>
          ${p.severity ? `<span class="tag red" style="margin-left:8px">${esc(p.severity)}</span>` : ''}
          ${p.duration ? `<span class="tag" style="margin-left:4px">持续 ${esc(p.duration)}</span>` : ''}
          ${p.note ? `<div class="rec-sub" style="margin-top:4px">${esc(p.note)}</div>` : ''}
        </div>
        <div class="rec-ops">
          <button data-hedit="${r.id}" title="编辑备注">✏️</button>
          <button data-hdel="${r.id}" title="取消标记">🗑️</button>
        </div>
      </div>
    </div>`;
  }

  function dayClick(ds, map) {
    const existing = map[ds];
    if (existing) {
      openNote(existing.id);
    } else {
      const id = Store.add('headache', { date: ds, severity: '', duration: '', note: '' });
      toast('已标记 ' + UI.fmtDate(ds) + ' 头疼');
      openNote(id);
    }
  }

  function openNote(id) {
    const r = Store.get(id);
    if (!r) return;
    const p = r.payload;
    openModal('头疼记录 · ' + UI.fmtDate(p.date), `
      <div class="field"><label>严重程度</label>
        <select id="hSev">
          <option value="">未填写</option>
          ${['轻微', '中等', '严重', '剧烈'].map(s => `<option ${p.severity === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </div>
      <div class="field"><label>持续时长</label><input id="hDur" placeholder="如 2小时 / 半天" value="${esc(p.duration || '')}"></div>
      <div class="field"><label>诱因 / 备注</label><textarea id="hNote" placeholder="熬夜？没喝咖啡？天气变化？经期？">${esc(p.note || '')}</textarea></div>
      <div class="modal-foot">
        <button class="btn warn" id="hDel">取消标记</button>
        <button class="btn" id="hSave">保存</button>
      </div>`, {
      onOpen(mask, close) {
        mask.querySelector('#hSave').onclick = () => {
          Store.update(id, {
            severity: mask.querySelector('#hSev').value,
            duration: mask.querySelector('#hDur').value.trim(),
            note: mask.querySelector('#hNote').value.trim()
          });
          toast('已保存 ✓'); close();
        };
        mask.querySelector('#hDel').onclick = () => { Store.remove(id); toast('已取消标记'); close(); };
      }
    });
  }

  return { render };
})();
