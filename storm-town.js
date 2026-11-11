// Hero: a tiny Stormmorph town. The tornado cruises the roads on its own; move the pointer over it to steer.
// It eats props to grow, and hydrants / fuel cans / power boxes morph it (waterspout, fire, lightning) like the game.

const SKINS = {
  classic: { name: 'TORNADO', a: '#c8f1ff', b: '#3fa9f5', rim: '#1f6fb0', debris: ['#ffffff', '#7fd0ff'] },
  water: { name: 'WATERSPOUT!', a: '#9fe3ff', b: '#1f8fff', rim: '#0b5fb8', debris: ['#5cc8ff', '#ffffff'] },
  fire: { name: 'FIRE TORNADO!', a: '#ffd23f', b: '#ff5a1f', rim: '#b8320b', debris: ['#ffb000', '#ff6a00'] },
  bolt: { name: 'LIGHTNING STORM!', a: '#c7a6ff', b: '#6d3cf0', rim: '#3d1a99', debris: ['#ffe14d', '#b06bff'] },
};
const MORPH_OF = { hydrant: 'water', fuel: 'fire', power: 'bolt' };
const MORPH_SECONDS = 7;
const PALETTE = {
  grass: '#79d64f', grass2: '#6cc944', walk: '#efe3cc', road: '#3d3f47', dash: '#f5f5f0', water: '#3fb4f0', foam: '#bfe9ff', sand: '#f3dca0',
  houses: [['#4fc3a1', '#2f8f74'], ['#6fd3f0', '#3a9cc0'], ['#f0c75e', '#c4972f'], ['#ef8a5b', '#c25a2f'], ['#c9ced8', '#8d94a3'], ['#7ad06b', '#4c9a3f']],
};

export default function stormTown(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const stage = canvas.parentElement;
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W = 0, H = 0, cell = 120, road = 26, cols = 0, rows = 0, top = 0, k = 1;
  let props = [], flying = [], debris = [], popups = [];
  let totalPoints = 0, eatenPoints = 0;
  const storm = { x: 0, y: 0, vx: 0, vy: 0, level: 1, points: 0, skin: 'classic', morphUntil: 0, node: null, prevNode: null, target: null };
  let steering = false, lastSteer = -10, pointer = { x: 0, y: 0 }, visible = true, resetAt = 0, fade = 0;

  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[Math.random() * arr.length | 0];
  const now = () => performance.now() / 1000;

  // ---------- town ----------
  function layout() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect();
    W = r.width; H = r.height;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    top = Math.round(H * 0.14);					// sea and beach along the top, like the island town
    cell = Math.max(96, Math.min(150, W / 3.4));
    road = Math.round(cell * 0.2);
    k = cell / 85;							// prop and tornado scale
    cols = Math.ceil(W / cell) + 1;
    rows = Math.ceil((H - top) / cell) + 1;
    buildTown();
  }
  const nodeX = c => c * cell + cell * 0.35;
  const nodeY = r => top + r * cell + cell * 0.35;

  function buildTown() {
    props = []; flying = []; totalPoints = 0; eatenPoints = 0;
    for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
      const x0 = nodeX(c) + road / 2 + 6, y0 = nodeY(r) + road / 2 + 6;
      const bw = cell - road - 12;
      if (x0 > W || y0 > H) continue;
      const kind = Math.random();
      if (kind < 0.6) {						// a house or two
        const n = bw > 100 ? 2 : 1;
        for (let i = 0; i < n; i++) {
          const w = bw / n - 10, d = bw * 0.42;
          addProp('house', x0 + 4 + i * (bw / n), y0 + bw * 0.12, { w, d, h: rand(14, 30), col: pick(PALETTE.houses) });
        }
        for (let i = 0; i < 2; i++) addProp('tree', x0 + rand(8, bw - 8), y0 + bw * rand(0.68, 0.9));
      } else if (kind < 0.85) {					// park
        for (let i = 0; i < 5; i++) addProp('tree', x0 + rand(8, bw - 8), y0 + rand(8, bw - 8));
        addProp('bench', x0 + bw * 0.5, y0 + bw * 0.5);
      } else {							// parking lot
        for (let i = 0; i < 3; i++) addProp('car', x0 + 14 + i * (bw / 3), y0 + bw * 0.45, { col: pick(['#ffcc33', '#ff5a5a', '#5aa9ff', '#ffffff']) });
      }
      // sidewalk bits along the road edge
      addProp(pick(['cone', 'bin', 'cone']), x0 - 2, y0 + rand(4, bw));
      addProp(pick(['hydrant', 'fuel', 'power', 'bin']), x0 + rand(4, bw), y0 - 2);
    }
    // a few cars parked along roads
    for (let i = 0; i < cols + rows; i++) {
      const c = Math.random() * cols | 0, r = Math.random() * rows | 0;
      addProp('car', nodeX(c) + rand(-4, 4), nodeY(r) + rand(cell * 0.3, cell * 0.7), { col: pick(['#ffcc33', '#ff5a5a', '#5aa9ff', '#ffffff']), vertical: true });
    }
    props.sort((a, b) => a.y - b.y);
    storm.level = 1; storm.points = 0; storm.skin = 'classic'; storm.morphUntil = 0;
    storm.node = { c: 1, r: 1 }; storm.prevNode = null;
    storm.x = nodeX(1); storm.y = nodeY(1); storm.target = { x: storm.x, y: storm.y };
  }

  const TIER = { cone: 1, bin: 1, hydrant: 1, fuel: 1, power: 1, bench: 2, tree: 2, car: 3, house: 4 };
  const POINTS = [0, 1, 3, 10, 35];
  function addProp(type, x, y, extra = {}) {
    const tier = TIER[type];
    props.push({ type, x, y, tier, wobble: 0, ...extra });
    totalPoints += POINTS[tier];
  }

  // ---------- movement ----------
  function nextNode() {
    const { c, r } = storm.node;
    const options = [{ c: c + 1, r }, { c: c - 1, r }, { c, r: r + 1 }, { c, r: r - 1 }]
      .filter(n => n.c >= 0 && n.r >= 0 && nodeX(n.c) < W - 10 && nodeY(n.r) < H - 10)
      .filter(n => !storm.prevNode || n.c !== storm.prevNode.c || n.r !== storm.prevNode.r);
    storm.prevNode = storm.node;
    storm.node = pick(options.length ? options : [storm.prevNode]);
    storm.target = { x: nodeX(storm.node.c), y: nodeY(storm.node.r) };
  }
  function nearestNode() {
    const c = Math.max(0, Math.round((storm.x - cell * 0.35) / cell)), r = Math.max(0, Math.round((storm.y - top - cell * 0.35) / cell));
    storm.node = { c: Math.min(c, cols - 1), r: Math.min(r, rows - 1) }; storm.prevNode = null;
    storm.target = { x: nodeX(storm.node.c), y: nodeY(storm.node.r) };
  }

  function step(dt, t) {
    if (steering && t - lastSteer > 2.5) { steering = false; nearestNode(); }
    const goal = steering ? pointer : storm.target;
    const dx = goal.x - storm.x, dy = goal.y - storm.y, dist = Math.hypot(dx, dy);
    const speed = (steering ? 150 : 95) * k * (1 - Math.min(0.35, storm.level * 0.03));
    if (!steering && dist < 4) nextNode();
    const want = dist > 2 ? Math.min(speed, dist * 3) : 0;
    const tvx = dist > 0 ? dx / dist * want : 0, tvy = dist > 0 ? dy / dist * want : 0;
    storm.vx += (tvx - storm.vx) * Math.min(1, dt * 4);
    storm.vy += (tvy - storm.vy) * Math.min(1, dt * 4);
    storm.x = Math.max(10, Math.min(W - 10, storm.x + storm.vx * dt));
    storm.y = Math.max(top, Math.min(H - 6, storm.y + storm.vy * dt));

    if (storm.morphUntil && t > storm.morphUntil) { storm.skin = 'classic'; storm.morphUntil = 0; }

    // Pull: edible props fly into the funnel, too-big ones wobble ("come back bigger").
    const reach = pullRadius();
    const canEat = Math.floor(storm.level) + (storm.skin === 'fire' ? 1 : 0);
    for (let i = props.length - 1; i >= 0; i--) {
      const p = props[i];
      const px = p.type === 'house' ? p.x + p.w / 2 : p.x, py = p.type === 'house' ? p.y + p.d / 2 : p.y;
      const d = Math.hypot(px - storm.x, py - storm.y);
      if (d > reach * (storm.skin === 'water' ? 1.5 : 1) && !(storm.skin === 'bolt' && d < reach * 1.7 && p.tier <= canEat)) { p.wobble *= 0.9; continue; }
      if (p.tier <= canEat) {
        props.splice(i, 1);
        flying.push({ p, a: Math.atan2(py - storm.y, px - storm.x), r: d, h: 0, t: 0, x: px, y: py });
        if (storm.skin === 'bolt') zap(px, py);
      } else p.wobble = Math.min(1, p.wobble + dt * 3);
    }
    for (let i = flying.length - 1; i >= 0; i--) {
      const f = flying[i];
      f.t += dt; f.a += dt * (5 + f.t * 6); f.r *= Math.pow(0.12, dt); f.h += dt * (40 + storm.level * 12);
      if (f.t > 0.9) { flying.splice(i, 1); eat(f.p, t); }
    }
    for (let i = debris.length - 1; i >= 0; i--) { const d = debris[i]; d.a += dt * d.s; d.h += dt * 14; if (d.h > d.max) { d.h = 0; } }
    for (let i = popups.length - 1; i >= 0; i--) { popups[i].t += dt; if (popups[i].t > 1.6) popups.splice(i, 1); }

    if (!resetAt && eatenPoints / totalPoints > 0.6) resetAt = t + 1.5;
    if (resetAt && t > resetAt) { fade = 1; resetAt = 0; buildTown(); popup('NEW TOWN!', '#ffffff'); }
    fade = Math.max(0, fade - dt * 1.5);
  }

  function pullRadius() { return (18 + Math.min(storm.level, 5) * 7) * k; }
  function eat(p, t) {
    const pts = POINTS[p.tier];
    eatenPoints += pts; storm.points += pts;
    const before = Math.floor(storm.level);
    storm.level = 1 + Math.log2(1 + storm.points / 10) * 0.75;
    if (Math.floor(storm.level) > before) popup('SIZE ' + Math.floor(storm.level) + '!', '#ffe14d');
    const morph = MORPH_OF[p.type];
    if (morph) { storm.skin = morph; storm.morphUntil = t + MORPH_SECONDS; popup(SKINS[morph].name, SKINS[morph].a); }
  }
  function popup(text, color) { popups.push({ text, color, t: 0 }); }
  let zaps = [];
  function zap(x, y) { zaps.push({ x, y, t: 0 }); }

  // ---------- drawing ----------
  function drawGround() {
    ctx.fillStyle = PALETTE.grass; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = PALETTE.water; ctx.fillRect(0, 0, W, top * 0.62);
    ctx.fillStyle = PALETTE.foam; for (let x = 0; x < W; x += 26) ctx.fillRect(x + (performance.now() / 120 % 26), top * 0.6 - 3, 12, 3);
    ctx.fillStyle = PALETTE.sand; ctx.fillRect(0, top * 0.62, W, top * 0.38);
    // sidewalks then roads
    for (const pass of ['walk', 'road']) {
      ctx.fillStyle = PALETTE[pass];
      const w = pass === 'walk' ? road + 10 : road;
      for (let c = 0; c < cols; c++) ctx.fillRect(nodeX(c) - w / 2, top, w, H - top);
      for (let r = 0; r < rows; r++) ctx.fillRect(0, nodeY(r) - w / 2, W, w);
    }
    ctx.fillStyle = PALETTE.dash;
    for (let c = 0; c < cols; c++) for (let y = top; y < H; y += 22) ctx.fillRect(nodeX(c) - 1, y, 2, 10);
    for (let r = 0; r < rows; r++) for (let x = 0; x < W; x += 22) ctx.fillRect(x, nodeY(r) - 1, 10, 2);
  }

  function drawProp(p) {
    const wob = p.wobble ? Math.sin(performance.now() / 40) * p.wobble * 2 : 0;
    ctx.save(); ctx.translate(p.x + wob, p.y);
    if (p.type !== 'house') ctx.scale(k, k);
    switch (p.type) {
      case 'house': {
        ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.fillRect(3, 3, p.w, p.d);
        ctx.fillStyle = p.col[1]; ctx.fillRect(0, p.d - p.h * 0.35, p.w, p.h * 0.35);	// front wall
        ctx.fillStyle = p.col[0]; ctx.fillRect(0, -p.h * 0.6, p.w, p.d + p.h * 0.25);		// roof
        ctx.fillStyle = 'rgba(255,255,255,.8)';
        for (let i = 0; i < Math.max(1, p.w / 18 | 0); i++) ctx.fillRect(5 + i * 16, p.d - p.h * 0.28, 7, 6);
        break;
      }
      case 'tree': ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.beginPath(); ctx.ellipse(2, 3, 7, 4, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#8b5a2b'; ctx.fillRect(-1.5, -4, 3, 6); ctx.fillStyle = '#2f9e44'; ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(7, -2); ctx.lineTo(-7, -2); ctx.fill(); break;
      case 'car': ctx.fillStyle = 'rgba(0,0,0,.18)'; if (p.vertical) ctx.fillRect(-5, -8, 12, 18); else ctx.fillRect(-8, -4, 18, 11);
        ctx.fillStyle = p.col; if (p.vertical) ctx.fillRect(-6, -10, 12, 18); else ctx.fillRect(-10, -6, 18, 11);
        ctx.fillStyle = 'rgba(30,40,60,.7)'; if (p.vertical) ctx.fillRect(-4, -6, 8, 6); else ctx.fillRect(-4, -4, 6, 7); break;
      case 'bench': ctx.fillStyle = '#8b5a2b'; ctx.fillRect(-8, -3, 16, 5); break;
      case 'cone': ctx.fillStyle = '#ff7a00'; ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(4, 2); ctx.lineTo(-4, 2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(-2.5, -3, 5, 1.5); break;
      case 'bin': ctx.fillStyle = '#2c6e49'; ctx.fillRect(-3.5, -7, 7, 9); break;
      case 'hydrant': ctx.fillStyle = '#e63946'; ctx.fillRect(-3, -8, 6, 10); ctx.fillStyle = '#5cc8ff'; ctx.beginPath(); ctx.arc(0, -12, 2.5, 0, 7); ctx.fill(); break;
      case 'fuel': ctx.fillStyle = '#ffb000'; ctx.fillRect(-4, -9, 8, 11); ctx.fillStyle = '#b8320b'; ctx.fillRect(-1, -12, 2, 3); break;
      case 'power': ctx.fillStyle = '#5b5f6a'; ctx.fillRect(-4, -10, 8, 12); ctx.fillStyle = '#ffe14d'; ctx.beginPath(); ctx.moveTo(1, -9); ctx.lineTo(-2, -4); ctx.lineTo(1, -4); ctx.lineTo(-1, 0); ctx.lineTo(3, -5); ctx.lineTo(0, -5); ctx.fill(); break;
    }
    ctx.restore();
  }

  // Stormmorph's look: a stack of flared, spiky discs that widen upward, spinning, with low-poly shards around it.
  function drawStorm(t) {
    const skin = SKINS[storm.skin];
    const L = Math.min(storm.level, 5), height = (46 + L * 13) * k, rBottom = (5 + L * 1.2) * k, rTop = (16 + L * 5.5) * k, rings = 12;
    const x = storm.x, y = storm.y;
    ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(x, y + 2, rTop * 0.9, rTop * 0.32, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(0,229,255,.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y, pullRadius(), pullRadius() * 0.55, 0, 0, 7); ctx.stroke();
    // dust cloud at the base
    for (let i = 0; i < 8; i++) {
      const a = t * 2.5 + i * 0.8, rr = rBottom * (1.4 + (i % 3) * 0.35);
      ctx.fillStyle = i % 2 ? 'rgba(176,152,118,.7)' : 'rgba(140,118,90,.6)';
      ctx.beginPath(); ctx.arc(x + Math.cos(a) * rr, y - 1 + Math.sin(a) * rr * 0.3, (3 + L * 0.5) * k * 0.8, 0, 7); ctx.fill();
    }
    // shards behind the funnel first, the rest after it
    drawShards(skin, x, y, height, rBottom, rTop, false);
    for (let i = 0; i < rings; i++) {
      const f = i / (rings - 1);
      const r = rBottom + (rTop - rBottom) * Math.pow(f, 1.3);
      const ry = Math.max(2.2, r * 0.3);
      const cx = x + Math.sin(t * 2.2 + f * 3) * (4 + L) * k * f;
      const cy = y - f * height;
      const thick = (2.5 + r * 0.12);
      const light = i % 2 ? skin.a : skin.b, dark = shade(i % 2 ? skin.a : skin.b, -0.28);
      // underside band (the disc's thickness)
      ctx.fillStyle = dark;
      ctx.beginPath(); ctx.ellipse(cx, cy + thick, r * 0.98, ry, 0, 0, Math.PI); ctx.lineTo(cx - r, cy); ctx.ellipse(cx, cy, r, ry, 0, Math.PI, 0, true); ctx.closePath(); ctx.fill();
      // spiky top face, spinning
      const spikes = 12 + Math.round(r / 8), spin = t * (5.5 - f * 2) + i * 0.7;
      const g = ctx.createRadialGradient(cx - r * 0.2, cy - ry * 0.3, r * 0.1, cx, cy, r * 1.1);
      g.addColorStop(0, shade(light, 0.35)); g.addColorStop(0.65, light); g.addColorStop(1, shade(light, -0.12));
      ctx.fillStyle = g; ctx.strokeStyle = skin.rim; ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let s = 0; s <= spikes * 2; s++) {
        const a = spin + s / (spikes * 2) * Math.PI * 2, rr = s % 2 ? r * 1.09 : r * 0.95;
        const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr * (ry / r);
        s ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      // swirl lines on the top face
      ctx.strokeStyle = shade(light, -0.25); ctx.lineWidth = Math.max(1, r * 0.05);
      for (let s = 0; s < 3; s++) {
        const a0 = spin * 1.3 + s * 2.1;
        ctx.beginPath(); ctx.ellipse(cx, cy, r * 0.62, ry * 0.62, 0, a0, a0 + 1.1); ctx.stroke();
      }
      // the funnel's dark eye on the top disc
      if (i === rings - 1) { ctx.fillStyle = shade(skin.b, -0.45); ctx.beginPath(); ctx.ellipse(cx, cy, r * 0.28, ry * 0.28, 0, 0, 7); ctx.fill(); }
    }
    drawShards(skin, x, y, height, rBottom, rTop, true);
    return { height, rTop };
  }

  function drawShards(skin, x, y, height, rBottom, rTop, front) {
    for (const d of debris) {
      if ((Math.sin(d.a) > 0) !== front) continue;
      const f = d.h / d.max, r = (rBottom + (rTop - rBottom) * f) * 1.3;
      const dx = x + Math.cos(d.a) * r, dy = y - f * height + Math.sin(d.a) * r * 0.3;
      const z = d.z * k * 0.9;
      ctx.save(); ctx.translate(dx, dy); ctx.rotate(d.a * 2);
      ctx.fillStyle = skin.debris[d.c];
      ctx.beginPath(); ctx.moveTo(-z, -z * 0.6); ctx.lineTo(z, -z * 0.2); ctx.lineTo(z * 0.2, z); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16), ch = [n >> 16, n >> 8 & 255, n & 255];
    return '#' + ch.map(c => Math.round(amt >= 0 ? c + (255 - c) * amt : c * (1 + amt)).toString(16).padStart(2, '0')).join('');
  }

  function drawFlying(f, height) {
    const k = Math.min(1, f.t / 0.9);
    const x = storm.x + Math.cos(f.a) * f.r, y = storm.y + Math.sin(f.a) * f.r * 0.5 - k * height * 0.8;
    ctx.save(); ctx.translate(x - f.p.x, y - f.p.y);
    const s = 1 - k * 0.8;
    ctx.translate(f.p.x, f.p.y); ctx.rotate(f.t * 6); ctx.scale(s, s); ctx.translate(-f.p.x, -f.p.y);
    drawProp({ ...f.p, wobble: 0 });
    ctx.restore();
  }

  function drawHud(t) {
    ctx.font = '800 14px "Bricolage Grotesque", "Arial Black", sans-serif';
    const pct = Math.round(eatenPoints / Math.max(1, totalPoints) * 100);
    const label = `Town eaten ${pct}%   Â·   Size ${Math.floor(storm.level)}`;
    const w = ctx.measureText(label).width + 22;
    ctx.fillStyle = 'rgba(14,32,54,.78)'; roundRect(12, H - 40, w, 28, 8); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText(label, 23, H - 21);
    if (storm.morphUntil) {
      const left = Math.max(0, storm.morphUntil - t), bw = 120;
      ctx.fillStyle = 'rgba(14,32,54,.78)'; roundRect(W - bw - 12, H - 40, bw, 28, 8); ctx.fill();
      ctx.fillStyle = SKINS[storm.skin].b; roundRect(W - bw - 8, H - 18, (bw - 8) * left / MORPH_SECONDS, 3, 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = '800 11px "Bricolage Grotesque", sans-serif'; ctx.fillText(SKINS[storm.skin].name.replace('!', '') + ' ' + Math.ceil(left) + 's', W - bw - 2, H - 23);
    }
    for (const p of popups) {
      const a = 1 - Math.max(0, p.t - 1.1) / 0.5;
      ctx.globalAlpha = Math.max(0, a); ctx.font = `800 ${26 + Math.min(1, p.t * 6) * 6}px "Bricolage Grotesque", "Arial Black", sans-serif`;
      ctx.textAlign = 'center'; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(10,20,40,.85)';
      ctx.strokeText(p.text, W / 2, H * 0.42 - p.t * 18); ctx.fillStyle = p.color; ctx.fillText(p.text, W / 2, H * 0.42 - p.t * 18);
      ctx.textAlign = 'left'; ctx.globalAlpha = 1;
    }
  }
  function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  function draw(t) {
    drawGround();
    // props behind the storm, the storm, then props in front of it (simple depth by y)
    let i = 0;
    for (; i < props.length && props[i].y <= storm.y; i++) drawProp(props[i]);
    const { height } = drawStorm(t);
    for (; i < props.length; i++) drawProp(props[i]);
    for (const f of flying) drawFlying(f, height);
    for (let z = zaps.length - 1; z >= 0; z--) {
      const s = zaps[z]; s.t += 1 / 60; if (s.t > 0.25) { zaps.splice(z, 1); continue; }
      ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(storm.x, storm.y - 30);
      for (let k = 1; k <= 4; k++) ctx.lineTo(storm.x + (s.x - storm.x) * k / 4 + rand(-6, 6), storm.y - 30 + (s.y - storm.y + 30) * k / 4 + rand(-6, 6));
      ctx.stroke();
    }
    drawHud(t);
    if (fade > 0) { ctx.fillStyle = `rgba(255,255,255,${fade})`; ctx.fillRect(0, 0, W, H); }
  }

  // ---------- loop ----------
  for (let i = 0; i < 26; i++) debris.push({ a: rand(0, 7), h: rand(0, 60), max: 60, s: rand(3, 6), z: rand(2, 4.5), c: i % 2 });
  let last = now();
  function frame() {
    const t = now(), dt = Math.min(0.05, t - last); last = t;
    for (const d of debris) d.max = (46 + Math.min(storm.level, 5) * 13) * k;
    if (!still) step(dt, t);
    draw(t);
    if (!still && visible) requestAnimationFrame(frame);
  }
  stage.addEventListener('pointermove', e => {
    const r = canvas.getBoundingClientRect();
    pointer = { x: e.clientX - r.left, y: e.clientY - r.top };
    steering = true; lastSteer = now();
  });
  stage.addEventListener('pointerleave', () => { lastSteer = now() - 2; });
  layout();
  new ResizeObserver(() => { layout(); if (still) draw(now()); }).observe(canvas);
  new IntersectionObserver(([e]) => { const was = visible; visible = e.isIntersecting; if (visible && !was && !still) { last = now(); requestAnimationFrame(frame); } }).observe(canvas);
  requestAnimationFrame(frame);
}
