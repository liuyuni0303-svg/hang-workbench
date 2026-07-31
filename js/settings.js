/* ===== 设置页：云同步配置 + Supabase 注册引导 + 安装教程 ===== */
const SettingsPage = (() => {
  const { $, $$, esc, toast, openModal } = UI;

  const SQL = `create table if not exists records (
  id text primary key,
  user_key text not null,
  module text not null,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);
create index if not exists idx_records_sync
  on records (user_key, updated_at);
alter table records enable row level security;
drop policy if exists "personal_full_access" on records;
create policy "personal_full_access" on records
  for all using (true) with check (true);`;

  function copy(text, msg) {
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject())
      .then(() => toast(msg || '已复制'))
      .catch(() => {
        const ta = document.createElement('textarea');
        ta.value = text; document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); ta.remove(); toast(msg || '已复制');
      });
  }

  function render(view) {
    const s = Store.getSettings();
    const st = Store.getSyncState();

    view.innerHTML = `
      <div class="card">
        <div class="card-title">☁️ 云端同步状态</div>
        <div class="row" style="margin-bottom:10px">
          <span class="sync-badge ${st.state === 'ok' ? 'sync-ok' : st.state === 'err' ? 'sync-err' : st.state === 'busy' ? 'sync-busy' : 'sync-local'}" style="font-size:14px">
            <span class="dot"></span><span>${esc(st.msg)}</span>
          </span>
          ${st.pending ? `<span class="tag accent">${st.pending} 条待上传</span>` : ''}
        </div>
        <p class="muted" style="margin-bottom:12px">
          🟢 绿色 = 在线 · 已同步&nbsp;&nbsp;🔴 红色 = 离线或同步失败&nbsp;&nbsp;⚪ 灰色 = 离线本地模式（未配置云端）<br>
          未配置云端时，所有数据仍会<b>实时保存在本设备</b>，不会丢失；断网照常使用，联网后自动上传同步。
        </p>
        <div class="field"><label>Supabase 项目 URL</label>
          <input id="sUrl" placeholder="https://xxxx.supabase.co" value="${esc(s.supabaseUrl || '')}"></div>
        <div class="field"><label>Supabase anon key（公开密钥）</label>
          <input id="sKey" placeholder="eyJhbGciOi..." value="${esc(s.supabaseKey || '')}"></div>
        <div class="field"><label>同步码（多设备填相同的码即可互通数据）</label>
          <div class="row">
            <input id="sSyncKey" value="${esc(s.syncKey || '')}">
            <button class="btn small ghost" id="copySyncKey" style="flex:none">复制</button>
          </div>
        </div>
        <div class="row">
          <button class="btn" id="saveSync">保存并测试连接</button>
          <button class="btn ghost" id="syncNow2">立即同步</button>
        </div>
      </div>

      <div class="card">
        <div class="card-title">🚀 首次使用：3 步开通云端同步（免费）</div>
        <div class="steps">
          <div class="step"><div class="step-body">
            打开 <b>supabase.com</b> ，用邮箱或 GitHub 注册，创建一个新项目（New Project），区域随意，数据库密码自己设一个记住。
          </div></div>
          <div class="step"><div class="step-body">
            项目建好后，进入左侧 <b>SQL Editor</b>，粘贴下面的建表脚本并点 Run：
            <pre class="sqlbox">${esc(SQL)}</pre>
            <button class="btn small ghost" id="copySql">📋 复制建表 SQL</button>
          </div></div>
          <div class="step"><div class="step-body">
            进入 <b>Project Settings → API</b>（或 Data API），复制 <b>Project URL</b> 和 <b>anon public key</b>，填到上方两个输入框，点「保存并测试连接」即可。<br>
            之后在手机上也安装本应用，填<b>相同的 URL、Key 和同步码</b>，两台设备数据就会自动互通。
          </div></div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">📲 安装到桌面 / 主屏幕</div>
        <div class="steps">
          <div class="step"><div class="step-body"><b>电脑（Chrome/Edge）：</b>地址栏右侧点「安装」图标（⊕ 或屏幕小图标）→ 安装，之后从桌面/开始菜单以独立窗口打开，不再经过浏览器。</div></div>
          <div class="step"><div class="step-body"><b>安卓手机：</b>浏览器菜单 → 「添加到主屏幕」/「安装应用」。</div></div>
          <div class="step"><div class="step-body"><b>iPhone（Safari）：</b>分享按钮 → 「添加到主屏幕」，主屏幕会出现「杭」字图标。</div></div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">🛠️ 数据工具</div>
        <div class="row" style="flex-wrap:wrap;gap:8px">
          <button class="btn small ghost" id="exportBtn">📤 导出全部数据(JSON)</button>
          <button class="btn small ghost" id="importBtn">📥 导入数据</button>
          <button class="btn small ghost" id="repushBtn">☁️ 全量重传到云端</button>
        </div>
        <input type="file" id="importFile" accept=".json" style="display:none">
        <p class="muted" style="margin-top:8px">导出文件可作为额外备份；「全量重传」用于换了新的 Supabase 项目后把本地历史全部补传上去。</p>
      </div>`;

    $('#copySql', view).onclick = () => copy(SQL, '建表 SQL 已复制，去 Supabase SQL Editor 粘贴运行');
    $('#copySyncKey', view).onclick = () => copy($('#sSyncKey', view).value, '同步码已复制');

    $('#saveSync', view).onclick = async () => {
      const url = $('#sUrl', view).value.trim();
      const key = $('#sKey', view).value.trim();
      const syncKey = $('#sSyncKey', view).value.trim() || s.syncKey;
      Store.saveSettings({ supabaseUrl: url, supabaseKey: key, syncKey });
      if (!url || !key) { toast('已保存（未配置云端，继续本地模式）'); render(view); return; }
      toast('正在测试连接…');
      const t = await Store.testConnection(url, key);
      if (t.ok) {
        toast('✅ 连接成功，开始同步');
        Store.markAllDirty();          // 首次接入：本地全部历史补传
        Store.resetPullCursor();
        await Store.syncNow(true);
      } else {
        toast('❌ ' + t.reason);
      }
      render(view);
    };

    $('#syncNow2', view).onclick = async () => {
      const r = await Store.syncNow(true);
      toast(r.ok ? '✅ 同步完成' : '同步未完成：' + (r.reason === 'unconfigured' ? '尚未配置云端' : r.reason === 'offline' ? '当前离线' : r.reason));
      render(view);
    };

    $('#exportBtn', view).onclick = () => {
      const data = {
        exportedAt: new Date().toISOString(),
        settings: { modules: Store.getSettings().modules, sportTypes: Store.getSettings().sportTypes },
        records: JSON.parse(localStorage.getItem('hang.records') || '{}')
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'hang-backup-' + UI.todayStr() + '.json';
      a.click();
      toast('已导出备份文件');
    };

    $('#importBtn', view).onclick = () => $('#importFile', view).click();
    $('#importFile', view).onchange = e => {
      const f = e.target.files[0]; if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          const recs = data.records || {};
          const cur = JSON.parse(localStorage.getItem('hang.records') || '{}');
          let n = 0;
          Object.values(recs).forEach(r => {
            if (!cur[r.id] || r.updated_at > cur[r.id].updated_at) { cur[r.id] = r; n++; }
          });
          localStorage.setItem('hang.records', JSON.stringify(cur));
          Store.markAllDirty();
          toast(`导入完成，合并 ${n} 条记录，即将刷新`);
          setTimeout(() => location.reload(), 900);
        } catch (err) { toast('导入失败：文件格式不正确'); }
      };
      reader.readAsText(f);
    };

    $('#repushBtn', view).onclick = async () => {
      Store.markAllDirty();
      const r = await Store.syncNow(true);
      toast(r.ok ? '✅ 全量重传完成' : '重传失败，请检查云端配置');
      render(view);
    };
  }

  return { render };
})();
