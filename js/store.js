/* ===== 数据层：本地持久化(实时自动保存) + 同步队列 + Supabase 云同步 ===== */
const Store = (() => {
  const LS = {
    settings: 'hang.settings',
    records: 'hang.records',
    dirty: 'hang.dirty',
    lastPull: 'hang.lastPull'
  };

  const DEFAULT_MODULES = [
    { key: 'weight',   name: '减肥',     icon: '⚖️', type: 'weight',   core: true, hidden: false },
    { key: 'baking',   name: '烘焙',     icon: '🍞', type: 'baking',   core: true, hidden: false },
    { key: 'sport',    name: '运动',     icon: '🏃', type: 'sport',    core: true, hidden: false },
    { key: 'headache', name: '头疼频率', icon: '📅', type: 'headache', core: true, hidden: false },
    { key: 'ledger',   name: '记账',     icon: '💰', type: 'ledger',   core: true, hidden: false }
  ];
  const DEFAULT_CATS = ['餐饮','购物','交通','居家','医疗','烘焙耗材','运动装备','工资','其他收入','人情','娱乐','其他'];

  function loadJSON(k, def) {
    try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; }
    catch (e) { return def; }
  }
  function saveJSON(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { console.warn('本地保存失败', e); }
  }

  let settings = loadJSON(LS.settings, {});
  if (!Array.isArray(settings.modules) || !settings.modules.length) settings.modules = DEFAULT_MODULES.map(m => ({ ...m }));
  // 补齐核心栏目（防旧数据缺失）
  DEFAULT_MODULES.forEach(dm => {
    if (!settings.modules.find(m => m.key === dm.key)) settings.modules.push({ ...dm });
  });
  if (!Array.isArray(settings.ledgerCats)) settings.ledgerCats = DEFAULT_CATS.slice();
  if (!settings.syncKey) settings.syncKey = 'hang-' + Math.random().toString(36).slice(2, 8);
  saveJSON(LS.settings, settings);

  let records = loadJSON(LS.records, {});          // id -> record
  let dirty = new Set(loadJSON(LS.dirty, []));     // 待上传 id
  let lastPull = loadJSON(LS.lastPull, '1970-01-01T00:00:00Z');

  const listeners = {};
  function on(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); }
  function emit(ev, data) { (listeners[ev] || []).forEach(fn => { try { fn(data); } catch (e) {} }); }

  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16);
    });
  }
  const nowISO = () => new Date().toISOString();

  function persistAll() {
    saveJSON(LS.records, records);
    saveJSON(LS.dirty, [...dirty]);
  }

  /* ---------- 记录 CRUD（全部实时落盘） ---------- */
  function add(module, payload) {
    const id = uuid();
    records[id] = { id, module, payload, updated_at: nowISO(), deleted: false };
    dirty.add(id); persistAll();
    emit('change', module); scheduleSync();
    return id;
  }
  function update(id, payload) {
    const r = records[id]; if (!r) return;
    r.payload = { ...r.payload, ...payload };
    r.updated_at = nowISO();
    dirty.add(id); persistAll();
    emit('change', r.module); scheduleSync();
  }
  function remove(id) {
    const r = records[id]; if (!r) return;
    r.deleted = true; r.updated_at = nowISO();
    dirty.add(id); persistAll();
    emit('change', r.module); scheduleSync();
  }
  function get(id) { return records[id]; }
  function list(module) {
    return Object.values(records)
      .filter(r => r.module === module && !r.deleted)
      .sort((a, b) => (b.payload.date || '').localeCompare(a.payload.date || '') || b.updated_at.localeCompare(a.updated_at));
  }

  /* ---------- 设置 ---------- */
  function getSettings() { return settings; }
  function saveSettings(patch) {
    settings = { ...settings, ...patch };
    saveJSON(LS.settings, settings);
    emit('settings');
  }

  /* ---------- Supabase 同步 ---------- */
  const TABLE = 'records';
  let syncState = 'local'; // local | ok | err | busy
  let syncMsg = '本地模式';
  let syncTimer = null, autoTimer = null, syncing = false;

  function configured() { return !!(settings.supabaseUrl && settings.supabaseKey); }

  function setState(s, msg) {
    syncState = s; syncMsg = msg;
    emit('sync', { state: s, msg });
  }

  function headers() {
    return {
      'apikey': settings.supabaseKey,
      'Authorization': 'Bearer ' + settings.supabaseKey,
      'Content-Type': 'application/json'
    };
  }
  function base() { return settings.supabaseUrl.replace(/\/+$/, '') + '/rest/v1/' + TABLE; }

  async function pushDirty() {
    if (!dirty.size) return;
    const rows = [...dirty].map(id => records[id]).filter(Boolean).map(r => ({
      id: r.id, user_key: settings.syncKey, module: r.module,
      payload: r.payload, updated_at: r.updated_at, deleted: r.deleted
    }));
    if (!rows.length) { dirty.clear(); persistAll(); return; }
    const resp = await fetch(base() + '?on_conflict=id', {
      method: 'POST',
      headers: { ...headers(), 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify(rows)
    });
    if (!resp.ok) throw new Error('上传失败 HTTP ' + resp.status);
    rows.forEach(r => dirty.delete(r.id));
    persistAll();
  }

  async function pullRemote() {
    const url = base() + `?user_key=eq.${encodeURIComponent(settings.syncKey)}&updated_at=gt.${encodeURIComponent(lastPull)}&order=updated_at.asc&limit=1000`;
    const resp = await fetch(url, { headers: headers() });
    if (!resp.ok) throw new Error('拉取失败 HTTP ' + resp.status);
    const rows = await resp.json();
    let changedModules = new Set();
    rows.forEach(row => {
      const local = records[row.id];
      // last-write-wins：远端更新时间更新，或本地不存在
      if (!local || row.updated_at > local.updated_at) {
        records[row.id] = {
          id: row.id, module: row.module, payload: row.payload,
          updated_at: row.updated_at, deleted: !!row.deleted
        };
        dirty.delete(row.id);
        changedModules.add(row.module);
      }
      if (row.updated_at > lastPull) lastPull = row.updated_at;
    });
    saveJSON(LS.lastPull, lastPull);
    persistAll();
    changedModules.forEach(m => emit('change', m));
  }

  async function syncNow(manual) {
    if (!configured()) { setState('local', '本地模式'); return { ok: false, reason: 'unconfigured' }; }
    if (syncing) return { ok: false, reason: 'busy' };
    if (!navigator.onLine) { setState('err', '离线，待网络恢复'); return { ok: false, reason: 'offline' }; }
    syncing = true;
    setState('busy', '同步中…');
    try {
      await pushDirty();
      await pullRemote();
      setState('ok', '已同步 ' + new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }));
      syncing = false;
      return { ok: true };
    } catch (e) {
      console.warn('sync error', e);
      setState('err', '同步失败');
      syncing = false;
      return { ok: false, reason: String(e.message || e) };
    }
  }

  function scheduleSync() {
    if (!configured()) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => syncNow(false), 2500); // 写入后 2.5s 静默同步
  }

  async function testConnection(url, key) {
    const resp = await fetch(url.replace(/\/+$/, '') + '/rest/v1/' + TABLE + '?limit=1', {
      headers: { 'apikey': key, 'Authorization': 'Bearer ' + key }
    });
    if (resp.ok) return { ok: true };
    if (resp.status === 404) return { ok: false, reason: '连接成功但未找到 records 数据表，请先在 Supabase 执行建表 SQL' };
    if (resp.status === 401 || resp.status === 403) return { ok: false, reason: '密钥无效，请检查 anon key' };
    return { ok: false, reason: 'HTTP ' + resp.status };
  }

  function startAuto() {
    if (autoTimer) clearInterval(autoTimer);
    autoTimer = setInterval(() => { if (configured()) syncNow(false); }, 60000); // 每 60s 后台静默同步
    window.addEventListener('online', () => { setState(configured() ? 'busy' : 'local', '网络恢复'); syncNow(false); });
    window.addEventListener('offline', () => { if (configured()) setState('err', '已离线'); });
    if (configured()) syncNow(false); else setState('local', '本地模式');
  }

  function getSyncState() { return { state: syncState, msg: syncMsg, pending: dirty.size }; }
  function resetPullCursor() { lastPull = '1970-01-01T00:00:00Z'; saveJSON(LS.lastPull, lastPull); }
  function markAllDirty() { Object.keys(records).forEach(id => dirty.add(id)); persistAll(); }

  return {
    on, add, update, remove, get, list,
    getSettings, saveSettings,
    syncNow, testConnection, startAuto, getSyncState, configured,
    resetPullCursor, markAllDirty,
    DEFAULT_MODULES, uuid
  };
})();
