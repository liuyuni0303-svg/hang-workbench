/* ===== 自定义栏目：通用日记式记录（标题+内容+日期，按日期归档） ===== */
const ModCustom = (() => {
  const { $, $$, esc, toast, openModal, confirmModal, todayStr, renderArchive, bindArchiveToggle } = UI;

  function render(view, modKey, modName) {
    const storeKey = 'custom:' + modKey;
    const recs = Store.list(storeKey);

    view.innerHTML = `
      <div class="card-title" style="margin:4px 0 10px">🗂️ ${esc(modName)}记录（按日期归档）</div>
      ${renderArchive(recs, recHTML, { emptyIcon: '📒', emptyText: '还没有记录，点右下角 + 新增' })}
      <button class="fab" id="addBtn">＋</button>`;

    bindArchiveToggle(view);
    $('#addBtn', view).onclick = () => openForm(storeKey);
    $$('[data-edit]', view).forEach(b => b.onclick = () => openForm(storeKey, b.dataset.edit));
    $$('[data-del]', view).forEach(b => b.onclick = () =>
      confirmModal('删除这条记录？', () => { Store.remove(b.dataset.del); toast('已删除'); }));
  }

  function recHTML(r) {
    const p = r.payload;
    return `<div class="rec">
      <div class="rec-main">
        <div class="rec-title">${esc(p.title || '记录')}</div>
        ${p.content ? `<div class="rec-sub" style="white-space:pre-wrap">${esc(p.content)}</div>` : ''}
      </div>
      <div class="rec-ops">
        <button data-edit="${r.id}" title="编辑">✏️</button>
        <button data-del="${r.id}" title="删除">🗑️</button>
      </div>
    </div>`;
  }

  function openForm(storeKey, id) {
    const rec = id ? Store.get(id) : null;
    const p = rec ? rec.payload : {};
    openModal(id ? '编辑记录' : '新增记录', `
      <div class="field"><label>日期</label><input type="date" id="fDate" value="${p.date || todayStr()}"></div>
      <div class="field"><label>标题 *</label><input id="fTitle" value="${esc(p.title || '')}" placeholder="记录点什么"></div>
      <div class="field"><label>内容</label><textarea id="fContent" placeholder="详细内容…">${esc(p.content || '')}</textarea></div>
      <div class="modal-foot"><button class="btn block" id="fSave">保存</button></div>`, {
      onOpen(mask, close) {
        mask.querySelector('#fSave').onclick = () => {
          const payload = {
            date: mask.querySelector('#fDate').value || todayStr(),
            title: mask.querySelector('#fTitle').value.trim(),
            content: mask.querySelector('#fContent').value.trim()
          };
          if (!payload.title) { toast('请填写标题'); return; }
          if (id) Store.update(id, payload); else Store.add(storeKey, payload);
          toast('已保存 ✓'); close();
        };
      }
    });
  }

  return { render };
})();
