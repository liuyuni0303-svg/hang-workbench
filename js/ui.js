/* ===== 通用 UI 工具：弹窗、toast、日期、归档折叠 ===== */
const UI = (() => {
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => [...(root || document).querySelectorAll(sel)];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._tm);
    t._tm = setTimeout(() => t.classList.remove('show'), 2200);
  }

  /* 弹窗：openModal(title, bodyHTML, {onOpen}) → 返回关闭函数 */
  function openModal(title, bodyHTML, opts = {}) {
    const root = $('#modalRoot');
    const mask = document.createElement('div');
    mask.className = 'modal-mask';
    mask.innerHTML = `
      <div class="modal">
        <div class="modal-head">
          <h3>${esc(title)}</h3>
          <button class="modal-close">✕</button>
        </div>
        <div class="modal-body">${bodyHTML}</div>
      </div>`;
    root.appendChild(mask);
    const close = () => { mask.remove(); opts.onClose && opts.onClose(); };
    mask.addEventListener('click', e => { if (e.target === mask) close(); });
    $('.modal-close', mask).addEventListener('click', close);
    opts.onOpen && opts.onOpen(mask, close);
    return { el: mask, close };
  }

  function confirmModal(msg, onYes) {
    openModal('确认操作', `
      <p style="font-size:14px;color:var(--ink-2)">${esc(msg)}</p>
      <div class="modal-foot">
        <button class="btn ghost" data-act="no">取消</button>
        <button class="btn warn" data-act="yes">确认删除</button>
      </div>`, {
      onOpen(mask, close) {
        mask.querySelector('[data-act=no]').onclick = close;
        mask.querySelector('[data-act=yes]').onclick = () => { close(); onYes(); };
      }
    });
  }

  /* 日期工具 */
  const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  function fmtDate(s) {
    if (!s) return '';
    const [y, m, d] = s.split('-');
    return `${y}年${+m}月${+d}日`;
  }
  function weekday(s) {
    return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][new Date(s + 'T00:00:00').getDay()] || '';
  }

  /* 按日期归档折叠渲染：
     items: 记录数组（payload.date 为归档键）
     renderItem(rec) → 单条 HTML
     默认展开：今天 + 最近一组 */
  function renderArchive(items, renderItem, opts = {}) {
    if (!items.length) {
      return `<div class="empty"><div class="big">${opts.emptyIcon || '🗂️'}</div>${opts.emptyText || '还没有记录，点右下角 + 新增'}</div>`;
    }
    const groups = {};
    items.forEach(r => {
      const key = (r.payload.date || r.updated_at.slice(0, 10));
      (groups[key] = groups[key] || []).push(r);
    });
    const keys = Object.keys(groups).sort().reverse();
    const today = todayStr();
    return keys.map((k, i) => {
      const open = (k === today || i === 0) && !opts.allCollapsed;
      return `
      <div class="archive-group ${open ? 'open' : ''}">
        <div class="archive-head" data-arch="${k}">
          <span class="arrow">▶</span>
          <span>${fmtDate(k)} ${weekday(k)}${k === today ? ' · 今天' : ''}</span>
          <span class="count">${groups[k].length} 条</span>
        </div>
        <div class="archive-body">${groups[k].map(renderItem).join('')}</div>
      </div>`;
    }).join('');
  }

  function bindArchiveToggle(container) {
    $$('.archive-head', container).forEach(h => {
      h.addEventListener('click', () => h.parentElement.classList.toggle('open'));
    });
  }

  return { $, $$, esc, toast, openModal, confirmModal, todayStr, fmtDate, weekday, renderArchive, bindArchiveToggle };
})();
