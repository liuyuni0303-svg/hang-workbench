/* ===== 主应用：路由 + 侧边栏 + 栏目管理 + 同步状态标识 ===== */
(() => {
  const { $, $$, esc, toast, openModal, confirmModal } = UI;
  const app = $('#app'), view = $('#view'), navList = $('#navList'), pageTitle = $('#pageTitle');

  let current = localStorage.getItem('hang.currentMod') || 'weight';

  /* ---------- 侧边栏 ---------- */
  function visibleModules() {
    return Store.getSettings().modules.filter(m => !m.hidden);
  }

  function renderNav() {
    const mods = visibleModules();
    if (current !== 'settings' && !mods.find(m => m.key === current)) current = mods.length ? mods[0].key : 'settings';
    navList.innerHTML = mods.map(m => `
      <button class="nav-item ${m.key === current ? 'active' : ''}" data-nav="${m.key}">
        <span class="nav-icon">${m.icon || '📁'}</span><span class="nav-name">${esc(m.name)}</span>
      </button>`).join('');
    $$('[data-nav]', navList).forEach(b => b.onclick = () => go(b.dataset.nav));
  }

  /* ---------- 路由 ---------- */
  function go(key) {
    current = key;
    localStorage.setItem('hang.currentMod', key);
    app.classList.remove('nav-open');
    renderNav();
    renderView();
  }

  function renderView() {
    view.scrollTop = 0;
    if (current === 'settings') { pageTitle.textContent = '设置与同步'; SettingsPage.render(view); return; }
    const mod = Store.getSettings().modules.find(m => m.key === current);
    if (!mod) { view.innerHTML = '<div class="empty">栏目不存在</div>'; return; }
    pageTitle.textContent = mod.name;
    switch (mod.type) {
      case 'weight': ModWeight.render(view); break;
      case 'baking': ModBaking.render(view); break;
      case 'sport': ModSport.render(view); break;
      case 'headache': ModHeadache.render(view); break;
      case 'ledger': ModLedger.render(view); break;
      default: ModCustom.render(view, mod.key, mod.name);
    }
  }

  /* ---------- 栏目管理（增减/隐藏/排序） ---------- */
  function openModuleManager() {
    const s = Store.getSettings();
    const html = () => s.modules.map((m, i) => `
      <div class="mod-row ${m.hidden ? 'hidden-mod' : ''}">
        <span class="nav-icon">${m.icon || '📁'}</span>
        <span class="nm">${esc(m.name)}${m.core ? ' <span class="tag" style="font-size:10px">内置</span>' : ''}</span>
        <div class="ops">
          <button data-up="${i}" title="上移" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button data-down="${i}" title="下移" ${i === s.modules.length - 1 ? 'disabled' : ''}>↓</button>
          <button data-hide="${i}" title="${m.hidden ? '显示' : '隐藏'}">${m.hidden ? '👁' : '🙈'}</button>
          ${m.core ? '' : `<button data-rm="${i}" title="删除">🗑️</button>`}
        </div>
      </div>`).join('');

    const modal = openModal('栏目管理', `
      <div id="modList">${html()}</div>
      <div class="row" style="margin-top:14px">
        <input id="newModName" placeholder="新栏目名称，如：读书、护肤">
        <button class="btn small" id="addMod" style="flex:none">＋新增栏目</button>
      </div>
      <p class="muted" style="margin-top:8px">内置四大栏目不可删除、可隐藏；自定义栏目为通用记录模板（日期+标题+内容，自动归档）。</p>`, {
      onClose() { renderNav(); renderView(); }
    });

    function bind() {
      const box = modal.el.querySelector('#modList');
      box.innerHTML = html();
      $$('[data-up]', box).forEach(b => b.onclick = () => { const i = +b.dataset.up; [s.modules[i - 1], s.modules[i]] = [s.modules[i], s.modules[i - 1]]; save(); });
      $$('[data-down]', box).forEach(b => b.onclick = () => { const i = +b.dataset.down; [s.modules[i + 1], s.modules[i]] = [s.modules[i], s.modules[i + 1]]; save(); });
      $$('[data-hide]', box).forEach(b => b.onclick = () => { const i = +b.dataset.hide; s.modules[i].hidden = !s.modules[i].hidden; save(); });
      $$('[data-rm]', box).forEach(b => b.onclick = () => {
        const i = +b.dataset.rm;
        confirmModal(`删除自定义栏目「${s.modules[i].name}」？栏目下的记录将保留在数据中但不再展示。`, () => {
          s.modules.splice(i, 1); save();
        });
      });
      function save() { Store.saveSettings({ modules: s.modules }); bind(); renderNav(); }
    }
    bind();

    modal.el.querySelector('#addMod').onclick = () => {
      const name = modal.el.querySelector('#newModName').value.trim();
      if (!name) { toast('请输入栏目名称'); return; }
      const icons = ['📒', '🌱', '📚', '🎨', '🧘', '💊', '🍵', '✈️', '🐱', '💰'];
      s.modules.push({
        key: 'c' + Date.now().toString(36),
        name, icon: icons[Math.floor(Math.random() * icons.length)],
        type: 'custom', core: false, hidden: false
      });
      Store.saveSettings({ modules: s.modules });
      modal.el.querySelector('#newModName').value = '';
      bind(); renderNav();
      toast('栏目「' + name + '」已添加');
    };
  }

  /* ---------- 同步状态标识 ---------- */
  function renderSyncBadge(info) {
    const badge = $('#syncBadge'), text = $('#syncText');
    const st = info || Store.getSyncState();
    badge.className = 'sync-badge ' + ({ ok: 'sync-ok', err: 'sync-err', busy: 'sync-busy', local: 'sync-local' }[st.state] || 'sync-local');
    text.textContent = st.msg;
    badge.title = '同步状态：' + st.msg + (st.pending ? `（${st.pending} 条待上传）` : '');
  }

  /* ---------- 家庭成员切换 ---------- */
  function renderMemberBtn() {
    const m = Store.getMember(Store.activeMember());
    if (!m) return;
    $('#memberEmoji').textContent = m.emoji || '🙂';
    $('#memberName').textContent = m.name;
    $('#memberBtn').style.borderColor = m.color || '#2b6e5f';
  }

  function openMemberSwitcher() {
    const cur = Store.activeMember();
    const rows = Store.members().map(m => `
      <div class="member-row ${m.id === cur ? 'active' : ''}" data-mid="${m.id}" style="--mc:${m.color || '#2b6e5f'}">
        <span class="member-emoji">${m.emoji || '🙂'}</span>
        <span class="member-name">${esc(m.name)}</span>
        ${m.id === cur ? '<span class="tag" style="margin-left:auto">当前</span>' : ''}
      </div>`).join('');
    const modal = openModal('切换家庭成员', `
      <div id="memberSwitchList">${rows}</div>
      <div class="row" style="margin-top:14px">
        <button class="btn ghost" id="toManage" style="flex:1">⚙️ 管理成员</button>
      </div>
      <p class="muted" style="margin-top:8px">切换后各栏目只展示该成员独立的记录、图表与历史数据，互不影响。</p>`, {
      onClose() { renderMemberBtn(); }
    });
    const box = modal.el.querySelector('#memberSwitchList');
    box.querySelectorAll('[data-mid]').forEach(el => el.onclick = () => {
      Store.setActiveMember(el.dataset.mid);
      renderView(); renderMemberBtn(); modal.close();
    });
    modal.el.querySelector('#toManage').onclick = () => { modal.close(); openMemberManager(); };
  }

  function openMemberManager() {
    const EMOJIS = ['🙂','😀','🧑','👩','👨','🧒','👧','👦','👵','👴','🐱','🐰','🌟','🍀','🍎','⚽'];
    function rowsHtml() {
      return Store.members().map(m => `
        <div class="member-row" data-mid="${m.id}" style="--mc:${m.color || '#2b6e5f'}">
          <span class="member-emoji">${m.emoji || '🙂'}</span>
          <input class="member-name-input" data-name="${m.id}" value="${esc(m.name)}" maxlength="8">
          <button class="icon-btn" data-pick="${m.id}" title="换图标">🎨</button>
          ${m.id === 'me' ? '<span class="tag" style="font-size:10px">默认</span>' : `<button class="icon-btn del" data-del="${m.id}" title="删除该成员及其全部数据">🗑️</button>`}
        </div>`).join('');
    }
    const modal = openModal('管理家庭成员', `
      <div id="memberList">${rowsHtml()}</div>
      <div class="row" style="margin-top:14px">
        <input id="newMemberName" placeholder="新成员名称，如：妈妈、宝宝">
        <button class="btn small" id="addMember" style="flex:none">＋添加成员</button>
      </div>
      <p class="muted" style="margin-top:8px">删除非默认成员会一并清除其名下所有记录（减肥/烘焙/记账/头疼/运动等），删除前会再次确认。</p>`, {
      onClose() { renderMemberBtn(); renderView(); }
    });
    const box = modal.el.querySelector('#memberList');
    function rebind() {
      box.innerHTML = rowsHtml();
      box.querySelectorAll('[data-name]').forEach(inp => inp.onchange = () => {
        const v = inp.value.trim(); if (!v) return;
        Store.updateMember(inp.dataset.name, { name: v });
      });
      box.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => {
        const cur = Store.getMember(b.dataset.pick);
        const next = EMOJIS[(EMOJIS.indexOf(cur.emoji) + 1 + EMOJIS.length) % EMOJIS.length] || '🙂';
        Store.updateMember(b.dataset.pick, { emoji: next });
        rebind();
      });
      box.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
        const id = b.dataset.del, m = Store.getMember(id);
        confirmModal(`删除成员「${m.name}」会一并清除其名下所有记录，确定吗？`, () => {
          Store.removeMember(id); rebind(); renderMemberBtn(); renderView();
          toast('已删除成员「' + m.name + '」及其数据');
        });
      });
    }
    rebind();
    modal.el.querySelector('#addMember').onclick = () => {
      const v = modal.el.querySelector('#newMemberName').value.trim();
      if (!v) { toast('请输入成员名称'); return; }
      const id = Store.addMember(v, EMOJIS[Store.members().length % EMOJIS.length]);
      Store.setActiveMember(id);
      modal.el.querySelector('#newMemberName').value = '';
      rebind(); renderMemberBtn(); renderView();
      toast('已添加成员「' + v + '」并切换过去');
    };
  }

  /* ---------- 事件绑定 ---------- */
  $('#menuBtn').onclick = () => app.classList.add('nav-open');
  $('#scrim').onclick = () => app.classList.remove('nav-open');
  $('#collapseBtn').onclick = () => {
    app.classList.toggle('mini');
    localStorage.setItem('hang.mini', app.classList.contains('mini') ? '1' : '');
  };
  if (localStorage.getItem('hang.mini') === '1' && window.innerWidth > 768) app.classList.add('mini');

  $('#settingsBtn').onclick = () => go('settings');
  $('#manageModulesBtn').onclick = () => { app.classList.remove('nav-open'); openModuleManager(); };
  $('#memberBtn').onclick = () => openMemberSwitcher();
  $('#syncNowBtn').onclick = async () => {
    if (!Store.configured()) { toast('尚未配置云端，去「设置与同步」开通'); go('settings'); return; }
    toast('正在同步…');
    const r = await Store.syncNow(true);
    toast(r.ok ? '✅ 同步完成' : '同步失败，请检查网络或配置');
  };

  Store.on('sync', renderSyncBadge);
  Store.on('member', () => { renderMemberBtn(); renderView(); });
  Store.on('change', mod => {
    // 数据变化（含云端拉取合并）时，若正在查看该模块则刷新
    const m = Store.getSettings().modules.find(x => x.key === current);
    const key = m ? (m.type === 'custom' ? 'custom:' + m.key : m.type) : current;
    if (mod === key || (m && mod === 'custom:' + m.key)) renderView();
  });

  /* ---------- 启动 ---------- */
  renderNav();
  renderView();
  renderSyncBadge();
  renderMemberBtn();
  Store.startAuto();
})();
