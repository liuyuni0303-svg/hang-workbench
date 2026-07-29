/* ===== 轻量 SVG 折线图（零依赖，离线可用） ===== */
const Charts = (() => {
  /* data: [{date:'2026-07-28', value: 55.2}, ...] 按日期升序
     opts: {unit, color, height} */
  function line(data, opts = {}) {
    const H = opts.height || 220, W = Math.max(320, data.length * 46);
    const padL = 42, padR = 16, padT = 18, padB = 34;
    const color = opts.color || '#2b6e5f';

    if (!data.length) {
      return `<div class="empty" style="padding:24px 0"><div class="big">📈</div>该时间段暂无数据</div>`;
    }
    const vals = data.map(d => d.value);
    let min = Math.min(...vals), max = Math.max(...vals);
    if (min === max) { min -= 1; max += 1; }
    const span = max - min;
    min -= span * 0.12; max += span * 0.12;

    const iw = W - padL - padR, ih = H - padT - padB;
    const x = i => padL + (data.length === 1 ? iw / 2 : i * iw / (data.length - 1));
    const y = v => padT + ih - (v - min) / (max - min) * ih;

    // Y 轴刻度（4 档）
    let grid = '', labels = '';
    for (let g = 0; g <= 3; g++) {
      const v = min + (max - min) * g / 3;
      const gy = y(v);
      grid += `<line x1="${padL}" y1="${gy}" x2="${W - padR}" y2="${gy}" stroke="#e6e4dc" stroke-dasharray="3 3"/>`;
      labels += `<text x="${padL - 6}" y="${gy + 4}" text-anchor="end" font-size="10" fill="#98a49e">${v.toFixed(1)}</text>`;
    }
    // X 轴标签（稀疏采样，避免拥挤）
    const step = Math.ceil(data.length / 8);
    data.forEach((d, i) => {
      if (i % step === 0 || i === data.length - 1) {
        labels += `<text x="${x(i)}" y="${H - 12}" text-anchor="middle" font-size="10" fill="#98a49e">${d.date.slice(5).replace('-', '/')}</text>`;
      }
    });

    const pts = data.map((d, i) => `${x(i)},${y(d.value)}`).join(' ');
    const areaPts = `${padL},${padT + ih} ${pts} ${x(data.length - 1)},${padT + ih}`;
    const dots = data.map((d, i) => `
      <circle cx="${x(i)}" cy="${y(d.value)}" r="3.5" fill="#fff" stroke="${color}" stroke-width="2">
        <title>${d.date}：${d.value}${opts.unit || ''}</title>
      </circle>
      <text x="${x(i)}" y="${y(d.value) - 9}" text-anchor="middle" font-size="9.5" fill="#5c6a64">${d.value}</text>`).join('');

    return `<div class="chart-wrap"><svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="min-width:100%">
      ${grid}${labels}
      <polygon points="${areaPts}" fill="${color}" opacity="0.08"/>
      <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
      ${dots}
    </svg></div>`;
  }
  return { line };
})();
