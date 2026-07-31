/* ===== 减肥栏目：日历视图记录 + 体重/身体全维度 + 趋势折线图 ===== */
const ModWeight = (() => {
  const { $, $$, esc, toast, openModal, confirmModal, todayStr, fmtDate } = UI;

  const METRICS = [
    { key: 'weight', name: '体重',   unit: 'kg', color: '#2b6e5f' },
    { key: 'chest',  name: '胸围',   unit: 'cm', color: '#c9762c' },
    { key: 'belly',  name: '肚围',   unit: 'cm', color: '#7d5ba6' },
    { key: 'waist',  name: '腰围',   unit: 'cm', color: '#2980b9' },
    { key: 'thigh',  name: '大腿围', unit: 'cm', color: '#c0392b' },
    { key: 'calf',   name: '小腿围', unit: 'cm', color: '#16a085' },
    { key: 'arm',    name: '手臂围', unit: 'cm', color: '#8e6e2f' }
  ];

  let curYM = todayStr().slice(0, 7);   // 日历当前月
  let curMetric = 'weight';
  let curRange = 7; // 7 | 30 | 'custom'
  let customFrom = '', customTo = '';

  /* 日期 -> 当天记录列表（新的在前） */
  function recsByDate() {
    const map = {};
    Store.list('weight').forEach(r => {
      const d = r.payload.date;
      (map[d] = map[d] || []).push(r);
    });
    Object.values(map).forEach(list => list.sort((a, b) => b.updated_at.localeCompare(a.updated_at)));
    return map;
  }

  function chartData() {
    const recs = Store.list('weight').filter(r => r.payload[curMetric] != null && r.payload[curMetric] !== '');
    const byDate = {};
    recs.forEach(r => {
      const d = r.payload.date;
      if (!byDate[d] || r.updated_at > byDate[d].updated_at) byDate[d] = r;
    });
    let dates = Object.keys(byDate).sort();
    const today = todayStr();
    if (curRange === 'custom' && customFrom && customTo) {
      dates = dates.filter(d => d >= customFrom && d <= customTo);
    } else if (curRange !== 'custom') {
      const from = new Date(Date.now() - (curRange - 1) * 86400000);
      const fromStr = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}-${String(from.getDate()).padStart(2, '0')}`;
      dates = dates.filter(d => d >= fromStr && d <= today);
    }
    return dates.map(d => ({ date: d, value: parseFloat(byDate[d].payload[curMetric]) }));
  }

  function shiftMonth(ym, delta) {
    const [y, m] = ym.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  function render(view) {
    const map = recsByDate();
    const recs = Store.list('weight');
    const today = todayStr();
    const [y, m] = curYM.split('-').map(Number);
    const monthDays = Object.keys(map).filter(d => d.startsWith(curYM)).length;

    const mtr = METRICS.find(x => x.key === curMetric);
    const data = chartData();
    const diff = data.length >= 2 ? (data[data.length - 1].value - data[0].value) : null;

    // 最新体重（全部记录中最近一天的）
    const latestW = recs.find(r => r.payload.weight);

    // 日历格
    const first = new Date(y, m - 1, 1);
    const daysInMonth = new Date(y, m, 0).getDate();
    const startW = first.getDay();
    let cells = '';
    for (let i = 0; i < startW; i++) cells += `<div class="cal-day dim"></div>`;
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${curYM}-${String(d).padStart(2, '0')}`;
      const dayRecs = map[ds];
      const w = dayRecs ? (dayRecs.find(r => r.payload.weight) || {}).payload : null;
      const cls = ['cal-day', dayRecs ? 'has-rec' : '', ds === today ? 'today' : '', ds > today ? 'future' : ''].join(' ');
      cells += `<div class="${cls}" data-day="${ds}">
        <span>${d}</span>${w && w.weight ? `<span class="val">${esc(w.weight)}</span>` : ''}
        <span class="mk"></span>
      </div>`;
    }

    const latestEmpty = !latestW;
    const diffEmpty = diff == null;
    const rate = daysInMonth ? Math.round(monthDays / daysInMonth * 100) : 0;

    view.innerHTML = `
      <div class="w-board">
        <div class="w-row2">
          <div class="kpi ${latestEmpty ? 'empty' : ''}">
            <div class="cap"><span>最新体重</span><span class="ic">⚖️</span></div>
            ${latestW
              ? `<div class="big">${esc(latestW.payload.weight)}<span class="u">kg</span></div>
                 <div class="sub">${fmtDate(latestW.payload.date)} 已打卡</div>`
              : `<div class="ebox"><div class="eic">⚖️</div><div><div class="et">尚未记录体重</div><div class="es">点击右下角 ＋ 记录今天</div></div></div>`}
          </div>
          <div class="kpi ${diffEmpty ? 'empty' : ''}">
            <div class="cap"><span>${mtr.name}区间变化</span><span class="ic">📉</span></div>
            ${diffEmpty
              ? `<div class="ebox"><div class="eic">＋</div><div><div class="et">暂无对比数据</div><div class="es">多记录几天，自动计算区间变化</div></div></div>`
              : `<div class="big" style="color:${diff <= 0 ? 'var(--green)' : 'var(--red)'}">${(diff > 0 ? '+' : '') + diff.toFixed(1)}<span class="u">${mtr.unit}</span></div>
                 <div class="sub">较${curRange === 'custom' ? '所选区间' : curRange + '天前'}</div>`}
          </div>
        </div>
        <div class="kpi full">
          <div style="min-width:0">
            <div class="cap"><span>本月记录天数</span></div>
            <div class="big">${monthDays}<span class="u">/ ${daysInMonth} 天</span></div>
            <div class="sub ${monthDays > 0 ? 'good' : ''}">${monthDays > 0 ? '达标率 ' + rate + '% · 继续加油' : '本月还没开始打卡'}</div>
          </div>
          <div class="ring" style="--p:${rate}%"><i>${rate}%</i></div>
        </div>
      </div>

      <div class="card">
        <div class="cal-head">
          <button class="icon-btn" id="prevM">‹</button>
          <div class="cal-title">${y}年${m}月</div>
          <div class="row" style="gap:4px">
            <button class="today-btn" id="jumpToday">回今天</button>
            <button class="icon-btn" id="nextM">›</button>
          </div>
        </div>
        <div class="cal-grid">
          ${['日', '一', '二', '三', '四', '五', '六'].map(w => `<div class="cal-week">${w}</div>`).join('')}
          ${cells}
        </div>
        <div class="muted" style="margin-top:10px">🟢 圆点为当天有体态记录（格内数字为体重kg）；点击日期录入 / 查看当天数据</div>
      </div>

      <div class="card">
        <div class="card-title">📈 变化趋势</div>
        <div class="chart-tabs" id="metricTabs">
          ${METRICS.map(x => `<button data-m="${x.key}" class="${x.key === curMetric ? 'on' : ''}">${x.name}</button>`).join('')}
        </div>
        <div class="chart-tabs" id="rangeTabs">
          <button data-r="7" class="${curRange === 7 ? 'on' : ''}">近7天</button>
          <button data-r="30" class="${curRange === 30 ? 'on' : ''}">近30天</button>
          <button data-r="custom" class="${curRange === 'custom' ? 'on' : ''}">自定义</button>
        </div>
        ${curRange === 'custom' ? `
        <div class="row" style="margin-bottom:10px">
          <input type="date" id="cFrom" value="${customFrom}">
          <span class="muted">至</span>
          <input type="date" id="cTo" value="${customTo}">
        </div>` : ''}
        <div id="chartBox">${Charts.line(data, { unit: mtr.unit, color: mtr.color })}</div>
      </div>
      <button class="fab" id="addBtn" title="记录今天">＋</button>`;

    $('#prevM', view).onclick = () => { curYM = shiftMonth(curYM, -1); render(view); };
    $('#nextM', view).onclick = () => { curYM = shiftMonth(curYM, 1); render(view); };
    $('#jumpToday', view).onclick = () => { curYM = todayStr().slice(0, 7); render(view); };
    $$('[data-day]', view).forEach(c => {
      if (!c.dataset.day) return;
      c.onclick = () => dayClick(c.dataset.day);
    });
    $('#addBtn', view).onclick = () => dayClick(today);
    $$('#metricTabs button', view).forEach(b => b.onclick = () => { curMetric = b.dataset.m; render(view); });
    $$('#rangeTabs button', view).forEach(b => b.onclick = () => { curRange = b.dataset.r === 'custom' ? 'custom' : +b.dataset.r; render(view); });
    if (curRange === 'custom') {
      $('#cFrom', view).onchange = e => { customFrom = e.target.value; render(view); };
      $('#cTo', view).onchange = e => { customTo = e.target.value; render(view); };
    }
  }

  /* 点击日期：无记录 → 直接新增；有记录 → 当日明细（可再新增/编辑/删除） */
  function dayClick(ds) {
    const dayRecs = recsByDate()[ds];
    if (!dayRecs || !dayRecs.length) { openForm(null, ds); return; }
    openDayDetail(ds);
  }

  function openDayDetail(ds) {
    const dayRecs = recsByDate()[ds] || [];
    const modal = openModal(fmtDate(ds) + ' · 体态记录', `
      <div id="dayList">
        ${dayRecs.map(recHTML).join('') || '<div class="empty">当天暂无记录</div>'}
      </div>
      <div class="modal-foot">
        <button class="btn block" id="dayAdd">＋ 新增当天记录</button>
      </div>`, {
      onOpen(mask, close) {
        mask.querySelector('#dayAdd').onclick = () => { close(); openForm(null, ds); };
        mask.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => { close(); openForm(b.dataset.edit, ds); });
        mask.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
          close();
          confirmModal('删除这条体态记录？删除后不可恢复。', () => {
            Store.remove(b.dataset.del); toast('已删除');
          });
        });
      }
    });
    return modal;
  }

  function recHTML(r) {
    const p = r.payload;
    const dims = METRICS.slice(1).filter(x => p[x.key]).map(x => `${x.name} ${p[x.key]}cm`).join(' · ');
    return `<div class="rec">
      <div class="rec-main">
        <div class="rec-title">${p.weight ? `体重 ${esc(p.weight)} kg` : '维度记录'}</div>
        ${dims ? `<div class="rec-sub">${esc(dims)}</div>` : ''}
      </div>
      <div class="rec-ops">
        <button data-edit="${r.id}" title="编辑">✏️</button>
        <button data-del="${r.id}" title="删除">🗑️</button>
      </div>
    </div>`;
  }

  function openForm(id, presetDate) {
    const rec = id ? Store.get(id) : null;
    const p = rec ? rec.payload : {};
    openModal(id ? '编辑体态记录' : '新增体态记录', `
      <div class="field"><label>日期</label><input type="date" id="fDate" value="${p.date || presetDate || todayStr()}"></div>
      <div class="field"><label>体重（kg）</label><input type="number" step="0.1" inputmode="decimal" id="fWeight" placeholder="如 55.6" value="${p.weight || ''}"></div>
      <div class="grid3">
        ${METRICS.slice(1).map(x => `
          <div class="field"><label>${x.name}（cm）</label>
          <input type="number" step="0.1" inputmode="decimal" id="f_${x.key}" value="${p[x.key] || ''}"></div>`).join('')}
      </div>
      <div class="modal-foot"><button class="btn block" id="fSave">保存</button></div>`, {
      onOpen(mask, close) {
        mask.querySelector('#fSave').onclick = () => {
          const payload = { date: mask.querySelector('#fDate').value || todayStr(), weight: mask.querySelector('#fWeight').value.trim() };
          METRICS.slice(1).forEach(x => payload[x.key] = mask.querySelector('#f_' + x.key).value.trim());
          if (!payload.weight && !METRICS.slice(1).some(x => payload[x.key])) { toast('请至少填写一项数据'); return; }
          if (id) Store.update(id, payload); else Store.add('weight', payload);
          toast('已保存 ✓'); close();
        };
      }
    });
  }

  return { render };
})();
