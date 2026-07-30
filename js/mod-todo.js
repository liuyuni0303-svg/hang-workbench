/* ===== 待办清单栏目：新建/编辑/删除/完成 + 提醒推送 + 家庭公共 + 归档 ===== */
const ModTodo = (() => {
  const { $, $$, esc, toast, openModal, confirmModal, todayStr } = UI;

  const notifSupported = ('Notification' in window);
  let V = null;
  const state = { mode: 'mine' }; // 'mine' | 'public'

  /* ---------- 时间工具 ---------- */
  function parseLocalDT(s) {
    const m = s && s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  }
  const pad = n => String(n).padStart(2, '0');
  function fmtRemind(s) {
    const d = parseLocalDT(s); if (!d) return '';
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const that = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diff = Math.round((that - today) / 86400000);
    const hm = pad(d.getHours()) + ':' + pad(d.getMinutes());
    if (diff === 0) return '今天 ' + hm;
    if (diff === 1) return '明天 ' + hm;
    if (diff === -1) return '昨天 ' + hm;
    return (d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + hm;
  }
  function isOverdue(p) {
    if (p.done || !p.remindAt) return false;
    const d = parseLocalDT(p.remindAt);
    return d && d.getTime() <= Date.now();
  }

  /* ---------- 数据筛选（兼容家庭多成员） ---------- */
  const allTodos = () => Store.list('todo', { all: true });
  function visible(records) {
    const active = Store.activeMember();
    return records.filter(r => {
      const p = r.payload;
      const isPublic = p.scope === 'public';
      if (state.mode === 'public') return isPublic;            // 家庭公共视图
      return !isPublic && (p.member || Store.DEFAULT_MEMBER_ID) === active; // 我的待办
    });
  }

  /* ---------- 渲染 ---------- */
  function render(view) {
    V = view;
    const vis = visible(allTodos());
    const active = vis.filter(r => !r.payload.done);
    const done = vis.filter(r => r.payload.done);

    // 排序：逾期置顶 → 提醒时间升序 → 创建时间降序
    active.sort((a, b) => {
      const oa = isOverdue(a.payload) ? 0 : 1, ob = isOverdue(b.payload) ? 0 : 1;
      if (oa !== ob) return oa - ob;
      const ra = a.payload.remindAt ? parseLocalDT(a.payload.remindAt).getTime() : Infinity;
      const rb = b.payload.remindAt ? parseLocalDT(b.payload.remindAt).getTime() : Infinity;
      if (ra !== rb) return ra - rb;
      return (b.payload.createdAt || '').localeCompare(a.payload.createdAt || '');
    });

    const overdue = active.filter(r => isOverdue(r.payload)).length;
    const perm = notifSupported ? Notification.permission : 'unsupported';
    const showPermBtn = notifSupported && perm === 'default';

    view.innerHTML = `
      <div class="card" style="padding:14px 16px">
        <div class="row" style="justify-content:space-between;align-items:center;margin-bottom:12px;gap:10px">
          <div class="todo-tabs">
            <button data-mode="mine" class="${state.mode === 'mine' ? 'on' : ''}">🙂 我的待办</button>
            <button data-mode="public" class="${state.mode === 'public' ? 'on' : ''}">👨‍👩‍👧 家庭公共</button>
          </div>
          ${showPermBtn ? `<button class="btn small ghost" id="permBtn">🔔 开启提醒</button>` : ''}
        </div>
        <div class="stat-row" style="margin-bottom:0">
          <div class="stat"><div class="v">${active.length}</div><div class="k">待办</div></div>
          <div class="stat"><div class="v" style="color:var(--green)">${done.length}</div><div class="k">已完成</div></div>
          <div class="stat"><div class="v" style="color:${overdue ? 'var(--red)' : 'var(--brand)'}">${overdue}</div><div class="k">已逾期</div></div>
        </div>
        ${perm === 'denied' ? `<p class="muted" style="margin-top:10px">⚠️ 系统通知已被浏览器拦截，提醒将以应用内红点 / 弹窗提示；如需系统推送，请在浏览器站点设置中允许通知。</p>` : ''}
        ${!notifSupported ? `<p class="muted" style="margin-top:10px">ℹ️ 当前浏览器不支持系统通知（如 iOS Safari），提醒将以应用内红点 / 弹窗提示；电脑端或安卓安装后可收到系统推送。</p>` : ''}
      </div>

      <div class="card-title" style="margin:16px 0 10px">📋 ${state.mode === 'public' ? '家庭公共待办' : '我的待办'}（${active.length}）</div>
      ${active.length
        ? `<div class="todo-list">${active.map(todoHTML).join('')}</div>`
        : `<div class="empty"><div class="big">${state.mode === 'public' ? '👨‍👩‍👧' : '✅'}</div>${state.mode === 'public' ? '还没有家庭公共待办，点右下角 + 添加' : '太棒了，当前没有待办！点右下角 + 新增一条'}</div>`}

      <div class="card-title" style="margin:18px 0 10px">🗂️ 已完成（按日期归档 · ${done.length}）</div>
      ${UI.renderArchive(done, doneHTML, { emptyIcon: '🎉', emptyText: '还没有已完成的待办' })}

      <button class="fab" id="addBtn">＋</button>`;

    UI.bindArchiveToggle(view);
    $$('[data-mode]', view).forEach(b => b.onclick = () => { state.mode = b.dataset.mode; render(view); });
    if (showPermBtn) $('#permBtn', view).onclick = requestPerm;
    $('#addBtn', view).onclick = () => openForm();
    $$('[data-toggle]', view).forEach(b => b.onclick = () => toggleDone(b.dataset.toggle));
    $$('[data-edit]', view).forEach(b => b.onclick = () => openForm(b.dataset.edit));
    $$('[data-del]', view).forEach(b => b.onclick = () =>
      confirmModal('删除这条待办？', () => { Store.remove(b.dataset.del); toast('已删除'); }));
    $$('[data-undone]', view).forEach(b => b.onclick = () => toggleDone(b.dataset.undone));
    $$('[data-ddel]', view).forEach(b => b.onclick = () =>
      confirmModal('删除这条已完成记录？', () => { Store.remove(b.dataset.ddel); toast('已删除'); }));
  }

  function todoHTML(r) {
    const p = r.payload;
    const overdue = isOverdue(p);
    const creator = p.scope === 'public' ? Store.getMember(p.member) : null;
    return `<div class="todo-item ${overdue ? 'overdue' : ''}">
      <button class="todo-check" data-toggle="${r.id}" title="标记完成"></button>
      <div class="todo-main">
        <div class="todo-title">${esc(p.title || '未命名待办')}
          ${p.scope === 'public' ? '<span class="tag accent">家庭</span>' : ''}
        </div>
        <div class="todo-meta">
          ${p.remindAt ? `<span class="reminder-badge ${overdue ? 'over' : ''}">⏰ ${fmtRemind(p.remindAt)}</span>` : ''}
          ${creator ? `<span class="tag">${creator.emoji || '🙂'} ${esc(creator.name)} 添加</span>` : ''}
          ${p.note ? `<span class="todo-note">${esc(p.note)}</span>` : ''}
        </div>
      </div>
      <div class="rec-ops">
        <button data-edit="${r.id}" title="编辑">✏️</button>
        <button data-del="${r.id}" title="删除">🗑️</button>
      </div>
    </div>`;
  }

  function doneHTML(r) {
    const p = r.payload;
    const creator = p.scope === 'public' ? Store.getMember(p.member) : null;
    return `<div class="todo-item done">
      <button class="todo-check done" data-undone="${r.id}" title="取消完成"></button>
      <div class="todo-main">
        <div class="todo-title done">${esc(p.title || '未命名待办')}
          ${p.scope === 'public' ? '<span class="tag accent">家庭</span>' : ''}
        </div>
        <div class="todo-meta">
          ${creator ? `<span class="tag">${creator.emoji || '🙂'} ${esc(creator.name)} 添加</span>` : ''}
          ${p.note ? `<span class="todo-note">${esc(p.note)}</span>` : ''}
          ${p.remindAt ? `<span class="reminder-badge">⏰ ${fmtRemind(p.remindAt)}</span>` : ''}
        </div>
      </div>
      <div class="rec-ops">
        <button data-ddel="${r.id}" title="删除">🗑️</button>
      </div>
    </div>`;
  }

  function toggleDone(id) {
    const r = Store.get(id); if (!r) return;
    const p = r.payload;
    if (p.done) {
      const createdDate = (p.createdAt || '').slice(0, 10) || todayStr();
      Store.update(id, { done: false, doneAt: null, date: createdDate, notified: null });
      toast('已恢复为待办');
    } else {
      const now = new Date().toISOString();
      Store.update(id, { done: true, doneAt: now, date: now.slice(0, 10), notified: null });
      toast('已完成 ✓');
    }
  }

  /* ---------- 表单（新建 / 编辑） ---------- */
  function openForm(editId) {
    const rec = editId ? Store.get(editId) : null;
    const p = rec ? rec.payload : {};
    const isPublic = p.scope === 'public';
    let scopeSel = isPublic ? 'public' : 'private';
    const members = Store.members();
    const ownerId = (p.member && !isPublic) ? p.member : Store.activeMember();
    const titleVal = p.title || '';
    const noteVal = p.note || '';
    const remindVal = p.remindAt || '';

    const memberOptions = members.map(m =>
      `<option value="${m.id}" ${m.id === ownerId ? 'selected' : ''}>${m.emoji || '🙂'} ${esc(m.name)}</option>`).join('');

    openModal(editId ? '编辑待办' : '新建待办', `
      <div class="field"><label>标题 *</label><input id="fTitle" placeholder="例如：缴水电费、买菜、给妈妈打电话" value="${esc(titleVal)}" maxlength="120"></div>
      <div class="field"><label>备注（可选）</label><textarea id="fNote" placeholder="补充说明，如地点、注意事项">${esc(noteVal)}</textarea></div>
      <div class="field"><label>归属</label>
        <div class="todo-tabs" style="margin-bottom:8px">
          <button type="button" id="sPriv" class="${scopeSel === 'private' ? 'on' : ''}">🙂 指定成员</button>
          <button type="button" id="sPub" class="${scopeSel === 'public' ? 'on' : ''}">👨‍👩‍👧 家庭公共事项</button>
        </div>
        <select id="fOwner" ${scopeSel === 'public' ? 'disabled style="opacity:.5"' : ''}>${memberOptions}</select>
        <p class="muted" style="margin-top:6px" id="scopeHint">${scopeSel === 'public' ? '家庭公共待办：所有成员都可见、可勾选完成。' : '指定给某位家庭成员；切换成员后仅在该成员「我的待办」中显示。'}</p>
      </div>
      <div class="field"><label>提醒时间（可选）</label>
        <div class="row">
          <input type="datetime-local" id="fRemind" value="${esc(remindVal)}" style="flex:1">
          ${remindVal ? `<button type="button" class="btn small ghost" id="fClearRem" style="flex:none">清除</button>` : ''}
        </div>
        <p class="muted" style="margin-top:6px">到时间后，若已授权将弹出系统通知；未授权则以应用内红点 / 弹窗提醒。电脑端、安卓安装后支持系统推送。</p>
      </div>
      <div class="modal-foot">
        <button class="btn ghost" id="fDone">完成</button>
        <button class="btn" id="fSave">${editId ? '保存修改' : '保存'}</button>
      </div>`, {
      onOpen(mask, close) {
        const sPriv = mask.querySelector('#sPriv'), sPub = mask.querySelector('#sPub');
        const owner = mask.querySelector('#fOwner'), hint = mask.querySelector('#scopeHint');
        const paint = () => {
          sPriv.className = scopeSel === 'private' ? 'on' : '';
          sPub.className = scopeSel === 'public' ? 'on' : '';
          owner.disabled = scopeSel === 'public';
          owner.style.opacity = scopeSel === 'public' ? '.5' : '1';
          hint.textContent = scopeSel === 'public'
            ? '家庭公共待办：所有成员都可见、可勾选完成。'
            : '指定给某位家庭成员；切换成员后仅在该成员「我的待办」中显示。';
        };
        sPriv.onclick = () => { scopeSel = 'private'; paint(); };
        sPub.onclick = () => { scopeSel = 'public'; paint(); };
        const clr = mask.querySelector('#fClearRem');
        if (clr) clr.onclick = () => { mask.querySelector('#fRemind').value = ''; };

        const save = () => {
          const title = mask.querySelector('#fTitle').value.trim();
          if (!title) { toast('请输入待办标题'); return; }
          const remind = mask.querySelector('#fRemind').value;
          const payload = {
            title,
            note: mask.querySelector('#fNote').value.trim(),
            scope: scopeSel,
            remindAt: remind || null,
            notified: remind ? null : (p.notified || null)
          };
          if (scopeSel === 'public') {
            payload.member = Store.activeMember();  // 创建者
          } else {
            payload.member = mask.querySelector('#fOwner').value;  // 归属成员
          }
          if (editId) {
            Store.update(editId, payload);
            if (remind) maybeRequestPerm();
            toast('已保存'); close();
          } else {
            payload.createdAt = new Date().toISOString();
            payload.date = payload.createdAt.slice(0, 10);
            payload.done = false; payload.doneAt = null;
            Store.add('todo', payload);
            if (remind) maybeRequestPerm();
            toast('已添加 ✓'); close();
          }
        };
        mask.querySelector('#fDone').onclick = close;
        mask.querySelector('#fSave').onclick = save;
      }
    });
  }

  /* ---------- 提醒：系统通知 + 应用内兜底 ---------- */
  function fireNotification(r) {
    const p = r.payload;
    const title = '⏰ 待办提醒：' + (p.title || '待办事项');
    const body = p.note ? p.note : (p.scope === 'public' ? '家庭公共事项' : '个人待办');
    try {
      if (Notification.permission === 'granted') {
        new Notification(title, { body, tag: r.id, icon: './icons/icon-192.png' });
      } else {
        UI.toast('🔔 ' + title + (body ? '：' + body : ''));
      }
    } catch (e) {
      UI.toast('🔔 ' + title);
    }
    Store.update(r.id, { notified: new Date().toISOString() }); // 标记已提醒，避免重复
  }

  function checkDue() {
    if (!notifSupported) return;
    const now = Date.now();
    const active = Store.activeMember();
    allTodos().forEach(r => {
      const p = r.payload;
      if (p.done || !p.remindAt || p.notified) return;
      const isPublic = p.scope === 'public';
      if (!isPublic && (p.member || Store.DEFAULT_MEMBER_ID) !== active) return; // 仅本人私有 + 公共
      const d = parseLocalDT(p.remindAt);
      if (d && d.getTime() <= now) fireNotification(r);
    });
  }

  function maybeRequestPerm() {
    if (!notifSupported) return;
    if (Notification.permission === 'default') Notification.requestPermission().catch(() => {});
  }
  function requestPerm() {
    if (!notifSupported) { toast('当前浏览器不支持系统通知'); return; }
    Notification.requestPermission().then(() => {
      if (V) render(V);
      toast(Notification.permission === 'granted' ? '✅ 已开启系统提醒' : '提醒权限未授予，将以应用内提示');
    }).catch(() => {});
  }

  function start() {
    if (!notifSupported) return;
    checkDue();
    setInterval(checkDue, 20000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) checkDue(); });
    window.addEventListener('focus', checkDue);
  }

  start(); // 应用启动即开始监听到期提醒
  return { render };
})();
