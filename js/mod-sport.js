/* ===== 运动栏目：每日运动记录台账 ===== */
const ModSport = (() => {
  const { $, $$, esc, toast, openModal, confirmModal, todayStr, renderArchive, bindArchiveToggle } = UI;

  const DEFAULT_TYPES = ['跑步', '快走', '瑜伽', '跳绳', '骑行', '游泳', '力量训练', '帕梅拉', '爬山'];
  const INTENSITY = ['轻松', '适中', '较累', '力竭'];

  function customTypes() { return Store.getSettings().sportTypes || []; }
  function allTypes() { return [...DEFAULT_TYPES, ...customTypes()]; }

  function render(view) {
    const recs = Store.list('sport');
    const today = todayStr();
    const month = today.slice(0, 7);
    const todayCount = recs.filter(r => r.payload.date === today).length;
    const monthCount = recs.filter(r => (r.payload.date || '').startsWith(month)).length;
    const monthMin = recs.filter(r => (r.payload.date || '').startsWith(month))
      .reduce((s, r) => s + (parseFloat(r.payload.duration) || 0), 0);

    view.innerHTML = `
      <div class="stat-row">
        <div class="stat"><div class="v">${todayCount}</div><div class="k">今日运动条数</div></div>
        <div class="stat"><div class="v">${monthCount}</div><div class="k">本月打卡次数</div></div>
        <div class="stat"><div class="v">${Math.round(monthMin)}</div><div class="k">本月总时长(分)</div></div>
      </div>
      <div class="card-title" style="margin:4px 0 10px">🗂️ 运动台账（按日期归档）</div>
      ${renderArchive(recs, recHTML, { emptyIcon: '🏃', emptyText: '今天还没有运动记录，点右下角 + 打卡' })}
      <button class="fab" id="addBtn">＋</button>`;

    bindArchiveToggle(view);
    $('#addBtn', view).onclick = () => openForm();
    $$('[data-edit]', view).forEach(b => b.onclick = () => openForm(b.dataset.edit));
    $$('[data-del]', view).forEach(b => b.onclick = () =>
      confirmModal('删除这条运动记录？', () => { Store.remove(b.dataset.del); toast('已删除'); }));
  }

  function recHTML(r) {
    const p = r.payload;
    return `<div class="rec">
      <div class="rec-main">
        <div class="rec-title">${esc(p.type || '运动')} · ${esc(p.duration || '?')} 分钟
          ${p.intensity ? `<span class="tag brand" style="margin-left:6px">${esc(p.intensity)}</span>` : ''}
          ${p.calories ? `<span class="tag accent" style="margin-left:4px">🔥 ${esc(p.calories)} kcal</span>` : ''}
        </div>
        ${p.note ? `<div class="rec-sub">💬 ${esc(p.note)}</div>` : ''}
      </div>
      <div class="rec-ops">
        <button data-edit="${r.id}" title="编辑">✏️</button>
        <button data-del="${r.id}" title="删除">🗑️</button>
      </div>
    </div>`;
  }

  function openForm(id) {
    const rec = id ? Store.get(id) : null;
    const p = rec ? rec.payload : {};
    openModal(id ? '编辑运动记录' : '新增运动打卡', `
      <div class="field"><label>运动日期</label><input type="date" id="fDate" value="${p.date || todayStr()}"></div>
      <div class="field"><label>运动类型</label>
        <div class="row">
          <select id="fType">${allTypes().map(t => `<option ${p.type === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>
          <button class="btn small ghost" id="fNewType" style="flex:none">＋自定义</button>
        </div>
      </div>
      <div class="grid2">
        <div class="field"><label>运动时长（分钟）*</label><input type="number" inputmode="decimal" id="fDur" placeholder="如 30" value="${esc(p.duration || '')}"></div>
        <div class="field"><label>消耗热量（kcal，可选）</label><input type="number" inputmode="decimal" id="fCal" value="${esc(p.calories || '')}"></div>
      </div>
      <div class="field"><label>运动强度</label>
        <select id="fInt">${INTENSITY.map(t => `<option ${p.intensity === t ? 'selected' : ''}>${t}</option>`).join('')}</select>
      </div>
      <div class="field"><label>运动心得 / 备注</label><textarea id="fNote" placeholder="今天状态如何？">${esc(p.note || '')}</textarea></div>
      <div class="modal-foot"><button class="btn block" id="fSave">保存打卡</button></div>`, {
      onOpen(mask, close) {
        mask.querySelector('#fNewType').onclick = () => {
          const name = prompt('输入新的运动类型名称：');
          if (name && name.trim()) {
            const list = customTypes();
            if (!allTypes().includes(name.trim())) {
              list.push(name.trim());
              Store.saveSettings({ sportTypes: list });
            }
            const sel = mask.querySelector('#fType');
            sel.innerHTML = allTypes().map(t => `<option ${t === name.trim() ? 'selected' : ''}>${esc(t)}</option>`).join('');
            toast('类型已添加');
          }
        };
        mask.querySelector('#fSave').onclick = () => {
          const payload = {
            date: mask.querySelector('#fDate').value || todayStr(),
            type: mask.querySelector('#fType').value,
            duration: mask.querySelector('#fDur').value.trim(),
            intensity: mask.querySelector('#fInt').value,
            calories: mask.querySelector('#fCal').value.trim(),
            note: mask.querySelector('#fNote').value.trim()
          };
          if (!payload.duration) { toast('请填写运动时长'); return; }
          if (id) Store.update(id, payload); else Store.add('sport', payload);
          toast('运动打卡成功 ✓'); close();
        };
      }
    });
  }

  return { render };
})();
