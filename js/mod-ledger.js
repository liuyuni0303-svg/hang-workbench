/* ===== 记账栏目：日常收支台账（轻量化快速记账） ===== */
const ModLedger = (() => {
  const { $, $$, esc, toast, openModal, confirmModal, todayStr, renderArchive, bindArchiveToggle } = UI;
  const num = v => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
  const fmtMoney = v => {
    const n = Math.round(num(v) * 100) / 100;
    return (n < 0 ? '-' : '') + '¥' + Math.abs(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  const allCats = () => (Store.getSettings().ledgerCats || []).slice();
  const catOptions = sel => {
    const list = allCats();
    if (sel && !list.includes(sel)) list.push(sel);
    return list.map(c => `<option ${c === sel ? 'selected' : ''}>${esc(c)}</option>`).join('');
  };
  const fmtMonth = m => { const [y, mo] = m.split('-'); return `${y}年${+mo}月`; };

  let V = null;
  const state = { month: '', year: '', range: 'month', kind: 'all', cat: 'all' };

  function render(view) {
    V = view;
    if (!state.month) state.month = todayStr().slice(0, 7);
    if (!state.year) state.year = todayStr().slice(0, 4);
    const recs = Store.list('ledger');
    const byMonth = state.range === 'month';
    const prefix = byMonth ? state.month : state.year;
    const rangeRecs = recs.filter(r => (r.payload.date || '').startsWith(prefix));
    const income = rangeRecs.filter(r => r.payload.kind === 'income').reduce((s, r) => s + num(r.payload.amount), 0);
    const expense = rangeRecs.filter(r => r.payload.kind === 'expense').reduce((s, r) => s + num(r.payload.amount), 0);
    const balance = income - expense;

    let shown = rangeRecs;
    if (state.kind !== 'all') shown = shown.filter(r => r.payload.kind === state.kind);
    if (state.cat !== 'all') shown = shown.filter(r => r.payload.category === state.cat);

    view.innerHTML = `
      <div class="card" style="padding:15px 16px">
        <div class="row" style="justify-content:space-between;margin-bottom:12px">
          <div class="cal-title">${byMonth ? fmtMonth(state.month) : state.year + ' 年合计'}</div>
          <div class="row" style="gap:6px">
            ${byMonth
              ? `<button class="icon-btn" id="mPrev" title="上一月">‹</button><button class="btn small ghost" id="mToday">本月</button><button class="icon-btn" id="mNext" title="下一月">›</button>`
              : `<button class="icon-btn" id="yPrev" title="上一年">‹</button><button class="btn small ghost" id="yToday">本年</button><button class="icon-btn" id="yNext" title="下一年">›</button>`}
          </div>
        </div>
        <div class="chart-tabs" style="margin-bottom:14px">
          <button data-r="month" class="${state.range === 'month' ? 'on' : ''}">按月</button>
          <button data-r="year" class="${state.range === 'year' ? 'on' : ''}">本年合计</button>
        </div>
        <div class="stat-row" style="margin-bottom:0">
          <div class="stat"><div class="v" style="color:var(--green)">${fmtMoney(income)}</div><div class="k">收入</div></div>
          <div class="stat"><div class="v" style="color:var(--red)">${fmtMoney(expense)}</div><div class="k">支出</div></div>
          <div class="stat"><div class="v" style="color:${balance < 0 ? 'var(--red)' : 'var(--brand)'}">${fmtMoney(balance)}</div><div class="k">结余</div></div>
        </div>
      </div>

      <div class="card">
        <button class="btn block" id="quickAdd" style="width:100%;padding:13px;font-size:15px">＋ 记一笔</button>
        <div class="chart-tabs" style="margin:14px 0 10px">
          <button data-k="all" class="${state.kind === 'all' ? 'on' : ''}">全部</button>
          <button data-k="income" class="${state.kind === 'income' ? 'on' : ''}">收入</button>
          <button data-k="expense" class="${state.kind === 'expense' ? 'on' : ''}">支出</button>
        </div>
        <div class="field" style="margin:0">
          <label style="font-size:12.5px;color:var(--ink-2);font-weight:700;margin-bottom:6px;display:block">按分类筛选</label>
          <select id="fCatFilter">
            <option value="all">全部分类</option>
            ${allCats().map(c => `<option value="${esc(c)}" ${state.cat === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="card-title" style="margin:4px 0 10px">📒 收支流水（按日期归档）</div>
      ${renderArchive(shown, recHTML, { emptyIcon: '💰', emptyText: (byMonth ? '本月' : state.year + ' 年') + '还没有记账，点上方「记一笔」开始记录' })}
      <button class="fab" id="addBtn">＋</button>`;

    bindArchiveToggle(view);
    $$('[data-r]', view).forEach(b => b.onclick = () => { state.range = b.dataset.r; render(view); });
    if (byMonth) {
      $('#mPrev', view).onclick = () => shiftMonth(-1);
      $('#mNext', view).onclick = () => shiftMonth(1);
      $('#mToday', view).onclick = () => { state.month = todayStr().slice(0, 7); render(view); };
    } else {
      $('#yPrev', view).onclick = () => shiftYear(-1);
      $('#yNext', view).onclick = () => shiftYear(1);
      $('#yToday', view).onclick = () => { state.year = todayStr().slice(0, 4); render(view); };
    }
    $('#quickAdd', view).onclick = () => openForm();
    $('#addBtn', view).onclick = () => openForm();
    $$('[data-k]', view).forEach(b => b.onclick = () => { state.kind = b.dataset.k; render(view); });
    $('#fCatFilter', view).onchange = e => { state.cat = e.target.value; render(view); };
    $$('[data-edit]', view).forEach(b => b.onclick = () => openForm(b.dataset.edit));
    $$('[data-copy]', view).forEach(b => b.onclick = () => openForm(null, b.dataset.copy));
    $$('[data-del]', view).forEach(b => b.onclick = () =>
      confirmModal('删除这条记账记录？', () => { Store.remove(b.dataset.del); toast('已删除'); }));
  }

  function shiftMonth(delta) {
    let [y, m] = state.month.split('-').map(Number);
    m += delta;
    if (m < 1) { m = 12; y--; } else if (m > 12) { m = 1; y++; }
    state.month = `${y}-${String(m).padStart(2, '0')}`;
    render(V);
  }

  function shiftYear(delta) {
    state.year = String(+state.year + delta);
    render(V);
  }

  function recHTML(r) {
    const p = r.payload, isInc = p.kind === 'income';
    const sub = [p.pay ? esc(p.pay) : '', p.note ? '💬 ' + esc(p.note) : ''].filter(Boolean).join(' · ');
    return `<div class="rec">
      <div class="rec-main">
        <div class="rec-title" style="display:flex;align-items:center;gap:6px">
          <span class="tag ${isInc ? 'brand' : 'red'}">${isInc ? '收入' : '支出'}</span>
          <span>${esc(p.category || '其他')}</span>
          <span style="margin-left:auto;font-weight:800;color:${isInc ? 'var(--green)' : 'var(--red)'}">${isInc ? '+' : '-'}${fmtMoney(num(p.amount))}</span>
        </div>
        ${sub ? `<div class="rec-sub">${sub}</div>` : ''}
      </div>
      <div class="rec-ops">
        <button data-copy="${r.id}" title="复制复用">⧉</button>
        <button data-edit="${r.id}" title="编辑">✏️</button>
        <button data-del="${r.id}" title="删除">🗑️</button>
      </div>
    </div>`;
  }

  function openForm(editId, copyId) {
    const rec = editId ? Store.get(editId) : (copyId ? Store.get(copyId) : null);
    const p = rec ? rec.payload : {};
    let kindVal = p.kind || 'expense';
    const dateVal = p.date || todayStr();
    const catVal = p.category || allCats()[0] || '其他';

    openModal(editId ? '编辑记账' : '记一笔', `
      <div class="field"><label>日期</label><input type="date" id="fDate" value="${dateVal}"></div>
      <div class="field"><label>收支类型</label>
        <div class="row" style="gap:8px">
          <button type="button" class="btn small ${kindVal === 'expense' ? '' : 'ghost'}" id="kExp" style="flex:1">－ 支出</button>
          <button type="button" class="btn small ${kindVal === 'income' ? '' : 'ghost'}" id="kInc" style="flex:1">＋ 收入</button>
        </div>
      </div>
      <div class="field"><label>分类</label>
        <div class="row">
          <select id="fCat" style="flex:1">${catOptions(catVal)}</select>
          <button type="button" class="btn small ghost" id="fCatMgr" style="flex:none">⚙ 管理</button>
        </div>
      </div>
      <div class="field"><label>金额（元）*</label><input type="number" inputmode="decimal" step="0.01" id="fAmt" placeholder="0.00" value="${esc(p.amount || '')}"></div>
      <div class="field"><label>支付方式（可选）</label>
        <select id="fPay">
          <option value="">不填</option>
          ${['微信', '支付宝', '现金', '银行卡'].map(x => `<option ${p.pay === x ? 'selected' : ''}>${x}</option>`).join('')}
        </select>
      </div>
      <div class="field"><label>备注（可选）</label><input id="fNote" placeholder="消费说明，如：午餐麦当劳" value="${esc(p.note || '')}"></div>
      <div class="modal-foot">
        <button class="btn ghost" id="fDone">完成</button>
        <button class="btn" id="fSave">${editId ? '保存修改' : '保存并继续'}</button>
      </div>`, {
      onOpen(mask, close) {
        const kExp = mask.querySelector('#kExp'), kInc = mask.querySelector('#kInc');
        const paint = () => {
          kExp.className = 'btn small ' + (kindVal === 'expense' ? '' : 'ghost');
          kInc.className = 'btn small ' + (kindVal === 'income' ? '' : 'ghost');
        };
        kExp.onclick = () => { kindVal = 'expense'; paint(); };
        kInc.onclick = () => { kindVal = 'income'; paint(); };
        mask.querySelector('#fCatMgr').onclick = () => openCatManager();

        const save = (keep) => {
          const payload = {
            date: mask.querySelector('#fDate').value || todayStr(),
            kind: kindVal,
            category: mask.querySelector('#fCat').value,
            amount: mask.querySelector('#fAmt').value.trim(),
            pay: mask.querySelector('#fPay').value,
            note: mask.querySelector('#fNote').value.trim()
          };
          if (!payload.amount || isNaN(num(payload.amount)) || num(payload.amount) <= 0) { toast('请输入有效金额'); return; }
          if (editId) Store.update(editId, payload); else Store.add('ledger', payload);
          if (V) render(V);
          if (keep) {
            mask.querySelector('#fAmt').value = '';
            mask.querySelector('#fNote').value = '';
            mask.querySelector('#fAmt').focus();
            toast('已记录 ✓ 继续录入');
          } else close();
        };
        mask.querySelector('#fDone').onclick = () => close();
        mask.querySelector('#fSave').onclick = () => save(!editId);
      }
    });
  }

  function openCatManager() {
    const cats = (Store.getSettings().ledgerCats || []).slice();
    const rowHTML = (c, i) => `<div class="mod-row">
      <input class="cat-name" data-i="${i}" value="${esc(c)}" style="flex:1;width:auto">
      <button class="btn small ghost" data-delcat="${i}">删除</button>
    </div>`;
    const m = openModal('分类管理', `
      <div id="catList">${cats.map((c, i) => rowHTML(c, i)).join('')}</div>
      <div class="row" style="margin-top:12px">
        <input id="newCat" placeholder="新增分类名称">
        <button class="btn small" id="addCat" style="flex:none">＋</button>
      </div>
      <p class="muted" style="margin-top:8px">修改名称后，历史该分类的记账会自动同步更新；分类可自由新增与删除。</p>`, {
      onClose() {
        if (V) render(V);
        const sel = document.querySelector('#fCat');
        if (sel) sel.innerHTML = catOptions(sel.value);
      }
    });
    const box = m.el.querySelector('#catList');
    function rebind() {
      box.innerHTML = cats.map((c, i) => rowHTML(c, i)).join('');
      m.el.querySelectorAll('[data-delcat]').forEach(b => b.onclick = () => {
        const i = +b.dataset.delcat, name = cats[i];
        confirmModal('删除分类「' + name + '」？已有该分类的记账记录会保留，仅分类从列表移除。', () => {
          cats.splice(i, 1);
          Store.saveSettings({ ledgerCats: cats });
          rebind();
        });
      });
      m.el.querySelectorAll('.cat-name').forEach(inp => inp.onchange = () => {
        const i = +inp.dataset.i, nv = inp.value.trim();
        if (!nv || nv === cats[i]) return;
        const ov = cats[i]; cats[i] = nv;
        Store.list('ledger').forEach(r => { if (r.payload.category === ov) Store.update(r.id, { category: nv }); });
        Store.saveSettings({ ledgerCats: cats });
        toast('分类已更新');
      });
    }
    rebind();
    m.el.querySelector('#addCat').onclick = () => {
      const v = m.el.querySelector('#newCat').value.trim(); if (!v) return;
      if (cats.includes(v)) { toast('分类已存在'); return; }
      cats.push(v); Store.saveSettings({ ledgerCats: cats });
      m.el.querySelector('#newCat').value = '';
      rebind(); toast('分类已添加');
    };
  }

  return { render };
})();
