/* ===== 烘焙栏目：食谱库 + 实操计时器（启动/暂停/重置/结束） ===== */
const ModBaking = (() => {
  const { $, $$, esc, toast, openModal, confirmModal, todayStr, fmtDate, bindArchiveToggle } = UI;

  /* ---- 全局计时器（切换页面不中断） ---- */
  const Timer = {
    running: false, remain: 0, total: 0, label: '', tick: null, done: false,
    start(seconds, label) {
      this.stop(false);
      this.total = this.remain = seconds; this.label = label; this.done = false;
      this.resume();
    },
    resume() {
      if (this.tick || this.remain <= 0) return;
      this.running = true;
      this.tick = setInterval(() => {
        this.remain--;
        if (this.remain <= 0) { this.remain = 0; this.finish(); }
        renderTimerBox();
      }, 1000);
      renderTimerBox();
    },
    pause() { clearInterval(this.tick); this.tick = null; this.running = false; renderTimerBox(); },
    reset() { this.pause(); this.remain = this.total; this.done = false; renderTimerBox(); },
    stop(rerender = true) { this.pause(); this.remain = 0; this.total = 0; this.label = ''; this.done = false; if (rerender) renderTimerBox(); },
    finish() {
      this.pause(); this.done = true;
      beep();
      toast('⏰ 「' + this.label + '」计时结束！');
      if (Notification && Notification.permission === 'granted') {
        try { new Notification('杭 · 计时结束', { body: this.label + ' 时间到啦' }); } catch (e) {}
      }
    }
  };

  function beep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      let t = ctx.currentTime;
      for (let i = 0; i < 3; i++) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.frequency.value = 880; g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        o.start(t); o.stop(t + 0.4); t += 0.5;
      }
    } catch (e) {}
  }

  const fmtSec = s => `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s % 3600 / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  let currentView = null;

  function renderTimerBox() {
    if (!currentView || !document.body.contains(currentView)) return;
    const box = $('#timerBox', currentView);
    if (!box) return;
    if (Timer.total <= 0) { box.innerHTML = ''; return; }
    box.innerHTML = `
      <div class="timer-box">
        <div class="timer-name">⏱ ${esc(Timer.label)}</div>
        <div class="timer-time ${Timer.done ? 'timer-done' : ''}">${Timer.done ? '完成 ✓' : fmtSec(Timer.remain)}</div>
        <div class="timer-btns">
          ${Timer.done ? '' : Timer.running
            ? `<button data-t="pause">⏸ 暂停</button>`
            : `<button data-t="resume">▶ 继续</button>`}
          <button data-t="reset">↻ 重置</button>
          <button data-t="stop">■ 结束</button>
        </div>
      </div>`;
    $$('[data-t]', box).forEach(b => b.onclick = () => Timer[b.dataset.t]());
  }

  function render(view) {
    currentView = view;
    const recs = Store.list('baking');
    const favs = recs.filter(r => r.payload.favorite);
    const others = recs.filter(r => !r.payload.favorite);

    view.innerHTML = `
      <div id="timerBox"></div>
      ${favs.length ? `<div class="card-title" style="margin:4px 0 10px">⭐ 收藏食谱</div>${favs.map(cardHTML).join('')}` : ''}
      <div class="card-title" style="margin:14px 0 10px">📖 全部食谱（按创建日期归档）</div>
      ${others.length || favs.length ? groupByDate(others) : `<div class="empty"><div class="big">🍞</div>还没有食谱，点右下角 + 新建你的第一份烘焙食谱</div>`}
      <button class="fab" id="addBtn">＋</button>`;

    renderTimerBox();
    bindArchiveToggle(view);
    $('#addBtn', view).onclick = () => openForm();
    bindCardOps(view);
  }

  function groupByDate(recs) {
    if (!recs.length) return '';
    const groups = {};
    recs.forEach(r => { const k = r.payload.date || r.updated_at.slice(0, 10); (groups[k] = groups[k] || []).push(r); });
    const keys = Object.keys(groups).sort().reverse();
    return keys.map((k, i) => `
      <div class="archive-group ${i === 0 ? 'open' : ''}">
        <div class="archive-head"><span class="arrow">▶</span><span>${fmtDate(k)}</span><span class="count">${groups[k].length} 份</span></div>
        <div class="archive-body">${groups[k].map(cardHTML).join('')}</div>
      </div>`).join('');
  }

  function cardHTML(r) {
    const p = r.payload;
    return `<div class="card" style="margin:10px 0">
      <div class="row" style="align-items:flex-start">
        <div style="flex:1;min-width:0">
          <div class="rec-title" style="font-size:15px">${p.favorite ? '⭐ ' : ''}${esc(p.name)}</div>
          <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">
            ${p.temp ? `<span class="tag accent">🌡 ${esc(p.temp)}</span>` : ''}
            ${p.duration ? `<span class="tag brand">⏱ ${esc(p.duration)} 分钟</span>` : ''}
          </div>
        </div>
        <div class="rec-ops">
          <button data-fav="${r.id}" title="收藏">${p.favorite ? '💛' : '🤍'}</button>
          <button data-edit="${r.id}" title="编辑">✏️</button>
          <button data-del="${r.id}" title="删除">🗑️</button>
        </div>
      </div>
      <details style="margin-top:8px">
        <summary style="cursor:pointer;font-size:13px;color:var(--brand);font-weight:600">查看食材与步骤</summary>
        <div style="margin-top:8px">
          <div class="muted" style="font-weight:700;margin-bottom:3px">食材用量</div>
          <div style="font-size:13.5px;white-space:pre-wrap;color:var(--ink-2)">${esc(p.ingredients || '—')}</div>
          <div class="muted" style="font-weight:700;margin:10px 0 3px">制作步骤</div>
          <div style="font-size:13.5px;white-space:pre-wrap;color:var(--ink-2)">${esc(p.steps || '—')}</div>
        </div>
      </details>
      ${p.duration ? `<button class="btn small" style="margin-top:10px" data-timer="${r.id}">▶ 启动 ${esc(p.duration)} 分钟计时</button>` : ''}
      <button class="btn small ghost" style="margin-top:10px;margin-left:6px" data-timerx="${r.id}">⏱ 自定义计时</button>
    </div>`;
  }

  function bindCardOps(view) {
    $$('[data-fav]', view).forEach(b => b.onclick = () => {
      const r = Store.get(b.dataset.fav);
      Store.update(r.id, { favorite: !r.payload.favorite });
    });
    $$('[data-edit]', view).forEach(b => b.onclick = () => openForm(b.dataset.edit));
    $$('[data-del]', view).forEach(b => b.onclick = () =>
      confirmModal('删除这份食谱？删除后不可恢复。', () => { Store.remove(b.dataset.del); toast('已删除'); }));
    $$('[data-timer]', view).forEach(b => b.onclick = () => {
      const r = Store.get(b.dataset.timer);
      askNotify();
      Timer.start(Math.round(parseFloat(r.payload.duration) * 60), r.payload.name);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      $('.view').scrollTo({ top: 0, behavior: 'smooth' });
    });
    $$('[data-timerx]', view).forEach(b => b.onclick = () => {
      const r = Store.get(b.dataset.timerx);
      openModal('自定义计时 · ' + r.payload.name, `
        <div class="grid2">
          <div class="field"><label>分钟</label><input type="number" id="tMin" inputmode="numeric" value="10"></div>
          <div class="field"><label>秒</label><input type="number" id="tSec" inputmode="numeric" value="0"></div>
        </div>
        <div class="modal-foot"><button class="btn block" id="tGo">▶ 开始计时</button></div>`, {
        onOpen(mask, close) {
          mask.querySelector('#tGo').onclick = () => {
            const s = (+mask.querySelector('#tMin').value || 0) * 60 + (+mask.querySelector('#tSec').value || 0);
            if (s <= 0) { toast('请输入有效时长'); return; }
            askNotify();
            Timer.start(s, r.payload.name);
            close();
            $('.view').scrollTo({ top: 0, behavior: 'smooth' });
          };
        }
      });
    });
  }

  function askNotify() {
    if (window.Notification && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }

  function openForm(id) {
    const rec = id ? Store.get(id) : null;
    const p = rec ? rec.payload : {};
    openModal(id ? '编辑食谱' : '新建烘焙食谱', `
      <div class="field"><label>食谱名称 *</label><input id="fName" placeholder="如：戚风蛋糕 6寸" value="${esc(p.name || '')}"></div>
      <div class="field"><label>食材详细用量 *</label><textarea id="fIng" placeholder="低筋面粉 85g&#10;鸡蛋 5个&#10;细砂糖 60g&#10;牛奶 55g&#10;玉米油 45g">${esc(p.ingredients || '')}</textarea></div>
      <div class="field"><label>完整制作步骤 *</label><textarea id="fSteps" placeholder="1. 蛋黄蛋白分离…&#10;2. 蛋黄糊：牛奶+油乳化…&#10;3. …">${esc(p.steps || '')}</textarea></div>
      <div class="grid2">
        <div class="field"><label>烘烤/蒸煮温度</label><input id="fTemp" placeholder="如 上下火150°C" value="${esc(p.temp || '')}"></div>
        <div class="field"><label>制作时长（分钟）</label><input type="number" inputmode="decimal" id="fDur" placeholder="如 55" value="${esc(p.duration || '')}"></div>
      </div>
      <div class="modal-foot"><button class="btn block" id="fSave">保存食谱</button></div>`, {
      onOpen(mask, close) {
        mask.querySelector('#fSave').onclick = () => {
          const payload = {
            name: mask.querySelector('#fName').value.trim(),
            ingredients: mask.querySelector('#fIng').value.trim(),
            steps: mask.querySelector('#fSteps').value.trim(),
            temp: mask.querySelector('#fTemp').value.trim(),
            duration: mask.querySelector('#fDur').value.trim(),
            date: p.date || todayStr(),
            favorite: !!p.favorite
          };
          if (!payload.name) { toast('请填写食谱名称'); return; }
          if (id) Store.update(id, payload); else Store.add('baking', payload);
          toast('食谱已保存 ✓'); close();
        };
      }
    });
  }

  return { render };
})();
