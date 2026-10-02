/* ORBFALL – core engine: board generation, physics, rules, rendering */
(function (OF) {
  const { clamp, lerp, rand } = OF;
  const W = 540, GRAV = 1500, STEP = 1 / 240;
  const PEG_R = 10, BUMP_R = 17;
  const COLORS = { red: '#ff4d6d', gold: '#ffd23f', bomb: '#ff8a1f', bumper: '#b266ff' };
  const VALUE = { normal: 10, red: 25, gold: 20, bomb: 15, bumper: 5 };

  const glowCache = {};
  function glow(color, r) {
    const key = color + r;
    if (glowCache[key]) return glowCache[key];
    const s = Math.ceil(r * 2), c = document.createElement('canvas'); c.width = c.height = s;
    const g = c.getContext('2d'), gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, color); gr.addColorStop(0.35, color + '88'); gr.addColorStop(1, color + '00');
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
    return (glowCache[key] = c);
  }

  class Game {
    constructor(canvas) {
      this.cv = canvas; this.ctx = canvas.getContext('2d');
      this.H = 960; this.pxr = 1;
      this.state = 'idle'; this.cb = {};
      this.pegs = []; this.balls = []; this.parts = []; this.texts = []; this.rings = []; this.bolts = [];
      this.shake = 0; this.time = 0; this.timeScale = 1; this.acc = 0; this.last = 0;
      this.aimX = W / 2; this.dragging = false; this.paused = false;
      this.run = null; this.attract = false; this.autoT = 0; this.tallyDisp = 0; this.tallyPulse = 0;
      this.stageT = 0; this.flash = 0; this.slotFlash = [];
      this.stars = Array.from({ length: 70 }, () => ({ x: Math.random() * W, y: Math.random() * 1300, s: rand(0.6, 2), t: rand(0, 6), v: rand(2, 9) }));
      this.setTheme(OF.save.d.theme);
      this.geometry();
    }

    /* ---------- layout ---------- */
    layout(vw, vh) {
      const H = clamp(Math.round(W * vh / vw), 860, 1170);
      const scale = Math.min(vw / W, vh / H);
      const cssW = Math.floor(W * scale), cssH = Math.floor(H * scale);
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      this.cv.style.width = cssW + 'px'; this.cv.style.height = cssH + 'px';
      this.cv.width = Math.round(cssW * dpr); this.cv.height = Math.round(cssH * dpr);
      this.pxr = this.cv.width / W;
      const changed = H !== this.H;
      this.H = H; this.geometry(); this.bg = null;
      if (changed && this.state !== 'idle' && !this.run) this.newAttractBoard();
      return { cssW, cssH, scale };
    }
    geometry() {
      this.launchY = 190;
      this.slotTop = this.H - 150;
      this.slotBottom = this.H - 28;
      this.playTop = 262;
      this.playBottom = this.slotTop - 62;
      this.slotN = OF.CFG.slotMults.length;
      this.slotW = W / this.slotN;
    }
    setTheme(id) { this.theme = OF.THEME[id] || OF.THEME.night; this.bg = null; }

    /* ---------- run helpers ---------- */
    m(id) { return (this.run && this.run.mods[id]) || 0; }
    slotMult(i) {
      let v = OF.CFG.slotMults[i] + this.m('slot');
      if (i === 0 || i === this.slotN - 1) v += 2 * this.m('edge');
      return v;
    }
    get ballR() { return 11 + 3 * this.m('heavy'); }
    get comboK() { return 0.06 * (1 + 0.5 * this.m('combo')); }
    get pegPow() { return 1 + 0.06 * OF.save.d.meta.peg; }
    get coinMult() {
      const d = OF.save.d;
      return (1 + 0.1 * d.meta.coin + 0.25 * this.m('fortune')) * (d.adsRemoved ? 1.5 : 1);
    }
    emit(name, a, b) { if (!this.attract && this.cb[name]) this.cb[name](a, b); }

    makeRun(mode) {
      const d = OF.save.d;
      return {
        mode, stage: 0, seed: mode === 'daily' ? OF.hash('daily' + OF.todayKey()) : (Math.random() * 1e9) >>> 0,
        orbs: 0, nudges: 0, stageScore: 0, target: 0, totalScore: 0, coins: 0,
        mods: {}, rerolls: d.meta.reroll, revived: false, pegsHit: 0, goldHit: 0, bombs: 0, bigOrb: 0,
        secondUsed: 0, cleared: false, goalFired: false, maxStage: 0,
      };
    }

    /* ---------- lifecycle ---------- */
    startRun(mode) {
      this.attract = false;
      this.run = this.makeRun(mode || 'normal');
      const r = this.run;
      // meta: head start upgrades
      const n = OF.save.d.meta.start;
      if (n) {
        const rr = OF.rng(r.seed ^ 0x9e37);
        const pool = OF.UPGRADES.filter(u => u.id !== 'pouch' && u.rarity !== 'epic');
        for (let i = 0; i < n; i++) { const u = pool[Math.floor(rr() * pool.length)]; if (this.m(u.id) < u.max) r.mods[u.id] = this.m(u.id) + 1; }
      }
      OF.save.d.runs++; OF.save.write();
      this.nextStage();
    }
    nextStage() {
      const r = this.run;
      r.stage++; r.maxStage = r.stage;
      r.target = OF.targetFor(r.stage, r.mode);
      r.stageScore = 0; r.secondUsed = 0; r.goalFired = false;
      r.orbs = OF.CFG.baseOrbs + OF.save.d.meta.orbs + 1 * this.m('pouch');
      r.nudges = OF.CFG.baseNudges + OF.save.d.meta.nudge + 2 * this.m('nudge');
      this.balls = []; this.parts.length = 0; this.texts.length = 0; this.bolts.length = 0; this.rings.length = 0;
      this.genBoard(OF.rng((r.seed + r.stage * 7919) >>> 0));
      this.tallyDisp = 0; this.stageT = 0;
      this.state = 'intro'; this.aimX = W / 2;
      this.emit('stageStart', r);
      this.emit('hud');
    }
    quitRun() { this.run = null; this.startAttract(); }

    startAttract() {
      this.attract = true; this.run = this.makeRun('attract');
      this.run.stage = 1; this.run.orbs = 99; this.run.nudges = 0; this.run.target = 1e12;
      this.newAttractBoard(); this.state = 'attract'; this.autoT = 0.5;
    }
    newAttractBoard() {
      if (!this.run) this.run = this.makeRun('attract');
      this.balls = []; this.parts.length = 0; this.texts.length = 0;
      this.genBoard(OF.rng((Math.random() * 1e9) >>> 0), true);
    }

    /* ---------- board generation ---------- */
    genBoard(rng, forAttract) {
      const stage = forAttract ? 1 : this.run.stage;
      const x0 = 46, x1 = W - 46, y0 = this.playTop, y1 = this.playBottom;
      const patterns = ['hex', 'rows', 'rings', 'scatter', 'diamond', 'hex', 'scatter'];
      const pat = patterns[Math.floor(rng() * patterns.length)];
      let pts = [];
      if (pat === 'hex') {
        const dx = 66, dy = 56;
        for (let row = 0, y = y0; y <= y1; row++, y += dy)
          for (let x = x0 + (row % 2 ? dx / 2 : 0); x <= x1; x += dx) pts.push([x, y]);
      } else if (pat === 'rows') {
        const dy = 72;
        for (let row = 0, y = y0; y <= y1; row++, y += dy) {
          const n = row % 2 ? 6 : 7, gap = (x1 - x0) / (n - 1);
          for (let i = 0; i < n; i++) pts.push([x0 + i * gap, y + (i % 2 ? 14 : -14) * 0.0]);
          if (row % 2 === 0) pts.push([x0 + gap / 2, y + 36]);
        }
      } else if (pat === 'rings') {
        const cs = [[W * 0.28, y0 + (y1 - y0) * 0.22], [W * 0.72, y0 + (y1 - y0) * 0.5], [W * 0.3, y0 + (y1 - y0) * 0.82]];
        cs.forEach(([cx, cy], ci) => {
          for (const R of [38 + ci * 6, 92 + ci * 6]) {
            const n = Math.round((2 * Math.PI * R) / 58);
            for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + ci; pts.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R]); }
          }
          pts.push([cx, cy]);
        });
        for (let i = 0; i < 18; i++) pts.push([rand(x0, x1), rand(y0, y1)]);
      } else if (pat === 'diamond') {
        const cx = W / 2, cy = (y0 + y1) / 2;
        for (let k = 1; k <= 5; k++) {
          const R = k * 62;
          const n = k * 4 + 2;
          for (let i = 0; i < n; i++) {
            const t = i / n, a = t * Math.PI * 2;
            pts.push([cx + Math.cos(a) * R * 0.9, cy + Math.sin(a) * R * 1.12]);
          }
        }
      } else {
        for (let i = 0; i < 400; i++) pts.push([rand(x0, x1), rand(y0, y1)]);
      }
      // thin: min distance + bounds + random holes
      const keep = [], MIN = 54;
      OF.shuffle(pts, rng);
      const holes = 0.06 + rng() * 0.12;
      for (const [x, y] of pts) {
        if (x < x0 - 4 || x > x1 + 4 || y < y0 - 4 || y > y1 + 4) continue;
        if (pat !== 'scatter' && rng() < holes) continue;
        if (keep.every(k => (k[0] - x) ** 2 + (k[1] - y) ** 2 >= MIN * MIN)) keep.push([x, y]);
        if (keep.length >= 72) break;
      }
      // bumpers first (remove neighbours so the orb can still pass)
      const bumperN = forAttract ? 2 : (stage >= 3 ? 2 + Math.min(3, Math.floor(stage / 4)) : 0);
      const bumpers = [];
      for (let i = 0; i < bumperN && keep.length > 20; i++) {
        const k = keep.splice(Math.floor(rng() * keep.length), 1)[0];
        if (bumpers.every(b => (b[0] - k[0]) ** 2 + (b[1] - k[1]) ** 2 > 150 * 150)) {
          bumpers.push(k);
          for (let j = keep.length - 1; j >= 0; j--) if ((keep[j][0] - k[0]) ** 2 + (keep[j][1] - k[1]) ** 2 < 62 * 62) keep.splice(j, 1);
        }
      }
      const boss = !forAttract && stage % OF.CFG.bossEvery === 0;
      const goldP = 0.07 + 0.04 * this.m('gold') + (boss ? 0.05 : 0), redP = 0.11 + (boss ? 0.04 : 0), bombP = (stage >= 2 ? 0.035 : 0.01) + (boss ? 0.03 : 0);
      this.pegs = [];
      for (const [x, y] of keep) {
        const q = rng();
        let type = 'normal';
        if (q < goldP) type = 'gold'; else if (q < goldP + redP) type = 'red'; else if (q < goldP + redP + bombP) type = 'bomb';
        this.pegs.push({ x, y, r: PEG_R, type, lit: false, dying: -1, hitT: 0, value: VALUE[type] });
      }
      for (const [x, y] of bumpers) this.pegs.push({ x, y, r: BUMP_R, type: 'bumper', lit: false, dying: -1, hitT: 0, value: VALUE.bumper });
      // guarantee a few special pegs
      const normals = this.pegs.filter(p => p.type === 'normal');
      if (!this.pegs.some(p => p.type === 'gold') && normals.length) { const p = normals[0]; p.type = 'gold'; p.value = VALUE.gold; }
      this.livePegs = this.pegs.length;
    }

    /* ---------- player actions ---------- */
    canDrop() { return this.state === 'aim' && this.run && this.run.orbs > 0; }
    drop() {
      if (!this.canDrop()) return false;
      const r = this.run;
      r.orbs--;
      this.spawnBall(this.aimX, this.launchY, rand(-18, 18), 0);
      this.state = 'drop'; this.turnT = 0;
      OF.audio.drop(); OF.haptic(8);
      this.emit('hud');
      return true;
    }
    spawnBall(x, y, vx, vy, from) {
      const b = {
        x, y, vx, vy, r: this.ballR, hits: from ? from.hits : 0, tally: 0, trail: [], slowT: 0, split: from ? true : false,
        landing: -1, lt: 0, slot: 0, dead: false, born: this.time,
      };
      this.balls.push(b); return b;
    }
    nudge(tx) {
      if (this.state !== 'drop' || !this.run || this.run.nudges <= 0) return false;
      const live = this.balls.filter(b => b.landing < 0);
      if (!live.length) return false;
      this.run.nudges--;
      for (const b of live) {
        const dir = tx >= b.x ? 1 : -1;
        b.vx += dir * 330; b.vy = Math.min(b.vy, 120) - 40;
      }
      this.rings.push({ x: tx, y: live[0].y, r: 6, life: 0.35, max: 0.35, color: '#ffffff', w: 3, grow: 300 });
      OF.audio.nudge(); OF.haptic(14);
      this.emit('hud');
      return true;
    }
    pointerDown(x, y) {
      if (this.state === 'aim') { this.dragging = true; this.aimX = clamp(x, 28, W - 28); }
      else if (this.state === 'drop') this.nudge(x);
    }
    pointerMove(x) { if (this.dragging && this.state === 'aim') this.aimX = clamp(x, 28, W - 28); }
    pointerUp() { if (this.dragging) { this.dragging = false; this.drop(); } }

    addUpgrade(id) {
      const r = this.run; r.mods[id] = Math.min(OF.UP[id].max, this.m(id) + 1);
    }
    revive() {
      const r = this.run; r.revived = true; r.orbs += 2; this.state = 'aim'; this.emit('hud');
    }

    /* ---------- scoring & effects ---------- */
    burst(x, y, color, n, speed, life) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, s = rand(0.3, 1) * speed;
        this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.4, 1) * (life || 0.7), max: life || 0.7, size: rand(1.5, 4), color, g: 500 });
      }
      if (this.parts.length > 500) this.parts.splice(0, this.parts.length - 500);
    }
    floatText(x, y, text, color, size) {
      this.texts.push({ x, y, text, color, size: size || 20, life: 0.9, max: 0.9 });
      if (this.texts.length > 40) this.texts.shift();
    }
    lightPeg(b, p, depth, viaHit) {
      if (p.lit || p.dying >= 0) return;
      p.lit = true; p.hitT = 0.5;
      const r = this.run;
      let val = p.value;
      if (p.type === 'gold') { val *= (1 + this.m('gold')); }
      if (viaHit) b.hits++;
      const add = val * this.pegPow * (1 + b.hits * this.comboK);
      b.tally += add;
      this.tallyPulse = 1;
      r.pegsHit++;
      if (!this.attract) { OF.save.d.totalPegs++; this.emit('mission', 'pegs', 1); }
      this.floatText(p.x, p.y - 14, '+' + Math.round(add), p.type === 'normal' ? '#bfe3ff' : COLORS[p.type], 15 + Math.min(10, b.hits * 0.5));
      this.burst(p.x, p.y, p.type === 'normal' ? this.theme.peg : COLORS[p.type], p.type === 'normal' ? 5 : 10, 160);
      if (!this.attract) OF.audio.peg(b.hits, p.type);
      if (p.type === 'gold') {
        const c = Math.max(1, Math.round((1 + this.m('gold')) * this.coinMult));
        r.coins += c; r.goldHit++;
        this.floatText(p.x + 12, p.y - 32, '+' + c + '🪙', '#ffd23f', 15);
        if (!this.attract) { this.emit('mission', 'gold', 1); this.emit('mission', 'coins', c); OF.audio.coin(); }
      }
      if (p.type === 'bomb' && depth < 6) this.explode(b, p.x, p.y, 88, depth + 1, true);
      // chain bolts
      if (viaHit && this.m('chain') && b.hits % 4 === 0) this.zap(b, depth);
      // splitting
      const need = this.m('split') >= 2 ? 4 : 6;
      if (viaHit && this.m('split') && !b.split && b.hits >= need) {
        b.split = true; b.tally *= 0.5;
        const c = this.spawnBall(b.x, b.y, -b.vx - 60, b.vy * 0.5 - 100, b); c.tally = b.tally;
        b.vx += 60;
        this.rings.push({ x: b.x, y: b.y, r: 8, life: 0.4, max: 0.4, color: '#c084fc', w: 4, grow: 220 });
      }
    }
    explode(b, x, y, R, depth, isBomb) {
      this.rings.push({ x, y, r: 10, life: 0.5, max: 0.5, color: '#ffb340', w: 6, grow: R * 2.2 });
      this.burst(x, y, '#ffb340', 26, 340, 0.8);
      this.shake = Math.max(this.shake, 9); this.flash = 0.25;
      if (!this.attract) { OF.audio.bomb(); OF.haptic(30); }
      if (isBomb && !this.attract) this.emit('mission', 'bombs', 1);
      if (isBomb) this.run.bombs++;
      for (const q of this.pegs) {
        if (!q.lit && q.dying < 0 && q.type !== 'bumper' && (q.x - x) ** 2 + (q.y - y) ** 2 < R * R) this.lightPeg(b, q, depth, false);
      }
    }
    zap(b, depth) {
      const n = 2 * this.m('chain');
      const cand = this.pegs.filter(q => !q.lit && q.dying < 0 && q.type !== 'bumper' && (q.x - b.x) ** 2 + (q.y - b.y) ** 2 < 230 * 230)
        .sort((a, c) => ((a.x - b.x) ** 2 + (a.y - b.y) ** 2) - ((c.x - b.x) ** 2 + (c.y - b.y) ** 2)).slice(0, n);
      if (!cand.length) return;
      if (!this.attract) OF.audio.zap();
      for (const q of cand) { this.bolts.push({ x1: b.x, y1: b.y, x2: q.x, y2: q.y, life: 0.25 }); this.lightPeg(b, q, depth + 1, false); }
    }

    /* ---------- physics ---------- */
    update(dt) {
      this.time += dt;
      if (this.state === 'intro') { this.stageT += dt; if (this.stageT > 1.1) { this.state = 'aim'; } }
      if (this.state === 'attract') {
        this.autoT -= dt;
        if (this.autoT <= 0 && !this.balls.length) {
          if (this.pegs.filter(p => p.dying < 0).length < 24) this.newAttractBoard();
          this.spawnBall(rand(60, W - 60), this.launchY, rand(-20, 20), 0); this.autoT = 0.6;
        }
        if (this.balls.length < 2 && this.autoT <= 0) { this.spawnBall(rand(60, W - 60), this.launchY, rand(-20, 20), 0); this.autoT = 1.2; }
      }
      if (this.state === 'drop' || this.state === 'attract') this.physics(dt);
      if (this.state === 'drop' && !this.balls.length) this.endTurn();
      if (this.state === 'settle') { this.settleT -= dt; if (this.settleT <= 0) this.afterTurn(); }
      // peg dying
      for (let i = this.pegs.length - 1; i >= 0; i--) {
        const p = this.pegs[i];
        if (p.hitT > 0) p.hitT -= dt;
        if (p.dying >= 0) {
          p.dying -= dt;
          if (p.dying <= 0) { this.burst(p.x, p.y, p.type === 'normal' ? this.theme.peg : COLORS[p.type], 6, 140, 0.5); this.pegs.splice(i, 1); }
        }
      }
      // fx
      for (let i = this.parts.length - 1; i >= 0; i--) {
        const p = this.parts[i]; p.life -= dt;
        if (p.life <= 0) { this.parts.splice(i, 1); continue; }
        p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      }
      for (let i = this.texts.length - 1; i >= 0; i--) { const t = this.texts[i]; t.life -= dt; t.y -= 38 * dt; if (t.life <= 0) this.texts.splice(i, 1); }
      for (let i = this.rings.length - 1; i >= 0; i--) { const r = this.rings[i]; r.life -= dt; r.r += r.grow * dt; if (r.life <= 0) this.rings.splice(i, 1); }
      for (let i = this.bolts.length - 1; i >= 0; i--) { this.bolts[i].life -= dt; if (this.bolts[i].life <= 0) this.bolts.splice(i, 1); }
      this.shake *= Math.pow(0.0005, dt); if (this.shake < 0.1) this.shake = 0;
      this.flash = Math.max(0, this.flash - dt);
      this.tallyPulse = Math.max(0, this.tallyPulse - dt * 4);
      for (let i = 0; i < this.slotFlash.length; i++) if (this.slotFlash[i] > 0) this.slotFlash[i] -= dt;
      const live = this.balls.reduce((s, b) => s + b.tally, 0);
      this.tallyDisp = lerp(this.tallyDisp, live, Math.min(1, dt * 14));
      for (const s of this.stars) { s.y += s.v * dt; if (s.y > 1300) { s.y = -5; s.x = Math.random() * W; } }
    }

    physics(dt) {
      const subs = Math.max(1, Math.round(dt / STEP)), h = dt / subs;
      this.turnT = (this.turnT || 0) + dt;
      for (let s = 0; s < subs; s++) {
        for (let bi = this.balls.length - 1; bi >= 0; bi--) {
          const b = this.balls[bi];
          if (b.landing >= 0) { this.landStep(b, h, bi); continue; }
          // magnet toward red pegs
          const mg = this.m('magnet');
          if (mg) {
            let best = null, bd = 190 * 190;
            for (const p of this.pegs) if (p.type === 'red' && !p.lit && p.dying < 0) { const d = (p.x - b.x) ** 2 + (p.y - b.y) ** 2; if (d < bd) { bd = d; best = p; } }
            if (best) { const d = Math.sqrt(bd) || 1, f = 520 * mg * (1 - d / 190); b.vx += (best.x - b.x) / d * f * h; b.vy += (best.y - b.y) / d * f * h * 0.6; }
          }
          b.vy += GRAV * h;
          const sp = Math.hypot(b.vx, b.vy);
          if (sp > 1300) { b.vx *= 1300 / sp; b.vy *= 1300 / sp; }
          b.x += b.vx * h; b.y += b.vy * h;
          if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx) * 0.55; }
          else if (b.x > W - b.r) { b.x = W - b.r; b.vx = -Math.abs(b.vx) * 0.55; }
          if (b.y < 120 + b.r) { b.y = 120 + b.r; b.vy = Math.abs(b.vy) * 0.4; }
          // pegs
          for (let i = 0; i < this.pegs.length; i++) {
            const p = this.pegs[i];
            if (p.dying >= 0 && p.dying < 0.001) continue;
            const dy = b.y - p.y, rr = b.r + p.r;
            if (dy > rr || dy < -rr) continue;
            const dx = b.x - p.x, d2 = dx * dx + dy * dy;
            if (d2 >= rr * rr) continue;
            const d = Math.sqrt(d2) || 0.001, nx = dx / d, ny = dy / d;
            b.x = p.x + nx * rr; b.y = p.y + ny * rr;
            const vn = b.vx * nx + b.vy * ny;
            if (vn < 0) {
              const e = p.type === 'bumper' ? 1.2 : 0.58;
              b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny;
              b.vx += rand(-6, 6);
              if (-vn > 60) this.onHit(b, p);
            }
          }
          // slot dividers (small fixed posts)
          if (b.y > this.slotTop - 24) {
            for (let k = 1; k < this.slotN; k++) {
              const px = k * this.slotW, py = this.slotTop, rr = b.r + 6;
              const dx = b.x - px, dy = b.y - py;
              if (dx * dx + dy * dy < rr * rr) {
                const d = Math.sqrt(dx * dx + dy * dy) || 0.001, nx = dx / d, ny = dy / d;
                b.x = px + nx * rr; b.y = py + ny * rr;
                const vn = b.vx * nx + b.vy * ny;
                if (vn < 0) { b.vx -= 1.5 * vn * nx; b.vy -= 1.5 * vn * ny; }
              }
            }
          }
          // anti-stall
          if (Math.hypot(b.vx, b.vy) < 45) {
            b.slowT += h;
            if (b.slowT > 0.45) { b.vx += (Math.random() < 0.5 ? -1 : 1) * rand(50, 110); b.vy -= 30; b.slowT = 0; }
          } else b.slowT = 0;
          // capture in slot
          if (b.y > this.slotTop + 10) {
            b.landing = 0; b.slot = clamp(Math.floor(b.x / this.slotW), 0, this.slotN - 1);
            b.lx = b.x; b.ly = b.y;
          }
        }
      }
      // trail
      for (const b of this.balls) {
        b.trail.push(b.x, b.y);
        if (b.trail.length > 28) b.trail.splice(0, 2);
      }
      // hard safety: if a turn runs very long, force-land everything
      if (this.state === 'drop' && this.turnT > 40) for (const b of this.balls) if (b.landing < 0) { b.landing = 0; b.slot = clamp(Math.floor(b.x / this.slotW), 0, this.slotN - 1); b.lx = b.x; b.ly = b.y; }
    }
    onHit(b, p) {
      if (p.type === 'bumper') {
        if (p.hitT > 0) return;
        p.hitT = 0.25; b.tally += 5 * this.pegPow; this.tallyPulse = 0.6;
        this.burst(p.x, p.y, COLORS.bumper, 8, 220, 0.5);
        this.floatText(p.x, p.y - 22, '+5', COLORS.bumper, 14);
        if (!this.attract) { OF.audio.bump(); OF.haptic(10); }
        return;
      }
      if (p.lit) return;
      const first = b.hits === 0;
      this.lightPeg(b, p, 0, true);
      if (first && this.m('blast')) this.explode(b, p.x, p.y, 70 + 26 * this.m('blast'), 1, false);
      if (!this.attract) OF.haptic(5);
    }
    landStep(b, h, bi) {
      b.lt += h;
      const tx = (b.slot + 0.5) * this.slotW, ty = this.slotTop + 66, k = Math.min(1, b.lt / 0.32);
      b.x = lerp(b.lx, tx, k); b.y = lerp(b.ly, ty, k * k); b.r = Math.max(4, b.r - 18 * h);
      if (b.lt >= 0.34) { this.finishBall(b); this.balls.splice(bi, 1); }
    }
    finishBall(b) {
      const r = this.run, base = OF.CFG.slotMults[b.slot], mult = this.slotMult(b.slot);
      const score = Math.round(b.tally * mult);
      const x = (b.slot + 0.5) * this.slotW;
      this.slotFlash[b.slot] = 0.8;
      this.burst(x, this.slotTop + 50, mult >= 4 ? '#ffd23f' : '#6ee7ff', 14 + mult * 3, 260, 0.9);
      this.floatText(x, this.slotTop - 10, '+' + OF.fmt(score), '#ffffff', 24 + Math.min(14, mult * 2));
      this.floatText(x, this.slotTop + 20, '×' + mult, '#ffd23f', 18);
      if (!this.attract) { OF.audio.land(mult); OF.haptic(mult >= 4 ? 40 : 18); }
      if (mult >= 5) this.shake = Math.max(this.shake, 6);
      r.stageScore += score; r.totalScore += score;
      if (!this.attract) this.emit('mission', 'bigorb', score);
      if (score > r.bigOrb) r.bigOrb = score;
      if (base === 1 && r.secondUsed < this.m('second')) {
        r.secondUsed++; r.orbs++;
        this.floatText(x, this.slotTop - 50, 'ORB REFUND ♻️', '#7dffb0', 18);
      }
      if (!r.goalFired && r.stageScore >= r.target && !this.attract) {
        r.goalFired = true; this.flash = 0.5;
        this.floatText(W / 2, this.playTop + 20, 'GOAL REACHED!', '#7dffb0', 34);
        OF.audio.win(); OF.haptic(60);
      }
      this.emit('hud');
    }
    endTurn() {
      this.state = 'settle'; this.settleT = 0.55;
      let i = 0;
      for (const p of this.pegs) if (p.lit && p.type !== 'bumper' && p.dying < 0) { p.dying = 0.12 + i * 0.02; i++; }
    }
    afterTurn() {
      const r = this.run;
      this.tallyDisp = 0;
      if (r.stageScore >= r.target) return this.stageClear();
      if (r.orbs > 0) { this.state = 'aim'; this.emit('hud'); return; }
      this.state = 'fail'; OF.audio.lose();
      this.emit('fail', r);
    }
    stageClear() {
      const r = this.run;
      this.state = 'clear'; OF.audio.win(); OF.haptic(80);
      const leftover = r.orbs;
      const boss = r.stage % OF.CFG.bossEvery === 0;
      const bonus = Math.round((12 * r.stage + 8 * leftover) * this.coinMult * (boss ? 2 : 1));
      r.coins += bonus;
      this.emit('mission', 'coins', bonus);
      this.emit('mission', 'stage', r.stage);
      for (let i = 0; i < 4; i++) this.burst(rand(80, W - 80), rand(260, 520), ['#ffd23f', '#6ee7ff', '#ff7ad9', '#7dffb0'][i], 30, 380, 1.2);
      this.emit('clear', { stage: r.stage, bonus, leftover, boss, score: r.stageScore, target: r.target });
    }

    /* ---------- main loop ---------- */
    frame(ts) {
      const now = ts / 1000;
      let dt = this.last ? Math.min(0.05, now - this.last) : 0.016; this.last = now;
      if (!this.paused && this.state !== 'idle') {
        dt *= this.timeScale;
        this.update(dt);
      }
      this.render();
    }

    /* ---------- rendering ---------- */
    buildBg() {
      const c = document.createElement('canvas'); c.width = this.cv.width; c.height = this.cv.height;
      const g = c.getContext('2d'); g.scale(this.pxr, this.pxr);
      const gr = g.createLinearGradient(0, 0, 0, this.H); gr.addColorStop(0, this.theme.bg1); gr.addColorStop(1, this.theme.bg2);
      g.fillStyle = gr; g.fillRect(0, 0, W, this.H);
      const rg = g.createRadialGradient(W / 2, this.H * 0.45, 20, W / 2, this.H * 0.45, W * 0.9);
      rg.addColorStop(0, 'rgba(120,140,255,0.13)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = rg; g.fillRect(0, 0, W, this.H);
      this.bg = c;
    }
    render() {
      const g = this.ctx, k = this.pxr;
      if (!this.bg || this.bg.width !== this.cv.width) this.buildBg();
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.drawImage(this.bg, 0, 0);
      const sx = this.shake ? rand(-this.shake, this.shake) : 0, sy = this.shake ? rand(-this.shake, this.shake) : 0;
      g.setTransform(k, 0, 0, k, sx * k, sy * k);
      // stars
      g.fillStyle = this.theme.star;
      for (const s of this.stars) { if (s.y > this.H) continue; g.globalAlpha = 0.25 + 0.5 * Math.abs(Math.sin(this.time * 0.8 + s.t)); g.fillRect(s.x, s.y, s.s, s.s); }
      g.globalAlpha = 1;
      this.drawSlots(g);
      if (this.state === 'aim' || this.state === 'intro') this.drawAim(g);
      this.drawPegs(g);
      this.drawBolts(g);
      this.drawBalls(g);
      for (const r of this.rings) { g.globalAlpha = Math.max(0, r.life / r.max); g.strokeStyle = r.color; g.lineWidth = r.w; g.beginPath(); g.arc(r.x, r.y, r.r, 0, 7); g.stroke(); }
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'lighter';
      for (const p of this.parts) { g.globalAlpha = Math.max(0, p.life / p.max); g.fillStyle = p.color; g.beginPath(); g.arc(p.x, p.y, p.size * (0.4 + p.life / p.max * 0.6), 0, 7); g.fill(); }
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      for (const t of this.texts) {
        g.globalAlpha = Math.min(1, t.life / t.max * 1.6);
        g.font = `800 ${t.size}px system-ui, sans-serif`;
        g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,10,0.7)'; g.strokeText(t.text, t.x, t.y);
        g.fillStyle = t.color; g.fillText(t.text, t.x, t.y);
      }
      g.globalAlpha = 1;
      // live tally
      if (!this.attract && (this.state === 'drop' || this.state === 'settle') && this.tallyDisp > 0.5) {
        const sc = 1 + this.tallyPulse * 0.25;
        g.save(); g.translate(W / 2, 214); g.scale(sc, sc);
        g.font = '900 38px system-ui, sans-serif'; g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,20,0.8)';
        const txt = OF.fmt(this.tallyDisp); g.strokeText(txt, 0, 0); g.fillStyle = '#fff'; g.fillText(txt, 0, 0);
        const hits = this.balls.length ? Math.max(...this.balls.map(b => b.hits)) : 0;
        if (hits > 1) { g.font = '800 15px system-ui, sans-serif'; g.fillStyle = '#ffd23f'; g.fillText('COMBO ×' + hits, 0, 28); }
        g.restore();
      }
      if (!this.attract && this.run && this.run.stage % OF.CFG.bossEvery === 0 && this.state !== 'idle') {
        const bg = g.createRadialGradient(W / 2, this.H / 2, this.H * 0.25, W / 2, this.H / 2, this.H * 0.75);
        bg.addColorStop(0, 'rgba(255,40,80,0)'); bg.addColorStop(1, 'rgba(255,40,80,' + (0.16 + 0.06 * Math.sin(this.time * 3)) + ')');
        g.fillStyle = bg; g.fillRect(0, 0, W, this.H);
      }
      if (!OF.save.d.tutorialDone && this.state === 'drop' && this.run && this.run.nudges > 0) {
        g.font = '800 17px system-ui, sans-serif'; g.fillStyle = '#ffffff'; g.textAlign = 'center';
        g.fillText('TAP the screen to nudge the orb!', W / 2, this.playTop - 14);
      }
      if (this.flash > 0) { g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = `rgba(255,255,255,${this.flash * 0.35})`; g.fillRect(0, 0, this.cv.width, this.cv.height); }
    }
    drawSlots(g) {
      const top = this.slotTop, bot = this.slotBottom, w = this.slotW;
      for (let i = 0; i < this.slotN; i++) {
        const mult = this.slotMult(i), hot = mult >= 4;
        const fl = Math.max(0, this.slotFlash[i] || 0);
        const x = i * w;
        const gr = g.createLinearGradient(0, top, 0, bot);
        const base = hot ? '255,190,60' : mult >= 3 ? '170,110,255' : mult >= 2 ? '70,170,255' : '110,130,190';
        gr.addColorStop(0, `rgba(${base},${0.1 + fl * 0.6})`); gr.addColorStop(1, `rgba(${base},${0.32 + fl * 0.5})`);
        g.fillStyle = gr; g.fillRect(x + 2, top, w - 4, bot - top);
        g.strokeStyle = `rgba(${base},0.7)`; g.lineWidth = 2; g.strokeRect(x + 2, top, w - 4, bot - top);
        g.fillStyle = hot ? '#ffd23f' : '#ffffff'; g.font = `900 ${hot ? 26 : 22}px system-ui, sans-serif`;
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('×' + mult, x + w / 2, top + 58);
        if (i > 0) { g.fillStyle = '#9fb4ff'; g.beginPath(); g.arc(x, top, 6, 0, 7); g.fill(); }
      }
    }
    drawAim(g) {
      const x = this.aimX, y = this.launchY, r = this.ballR;
      // guide
      let hitY = this.slotTop - 20;
      for (const p of this.pegs) {
        const dx = Math.abs(p.x - x), rr = p.r + r;
        if (dx < rr && p.y > y) { const yy = p.y - Math.sqrt(rr * rr - dx * dx); if (yy < hitY) hitY = yy; }
      }
      g.setLineDash([4, 9]); g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x, y + r + 2); g.lineTo(x, hitY); g.stroke(); g.setLineDash([]);
      g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.arc(x, hitY, 4, 0, 7); g.fill();
      // launcher rail
      g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 10; g.lineCap = 'round';
      g.beginPath(); g.moveTo(30, y - 30); g.lineTo(W - 30, y - 30); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x - 3, y - 40, 6, 20);
      this.drawBall(g, x, y, r, [], 0);
      if (!OF.save.d.tutorialDone && this.state === 'aim') {
        g.font = '800 17px system-ui, sans-serif'; g.fillStyle = '#ffffff'; g.textAlign = 'center';
        g.fillText('Drag to aim · release to drop', W / 2, y + 44);
      }
    }
    drawPegs(g) {
      for (const p of this.pegs) {
        let col = p.type === 'normal' ? this.theme.peg : COLORS[p.type];
        let sc = 1;
        if (p.dying >= 0) sc = Math.max(0, p.dying / 0.2);
        const pulse = p.hitT > 0 ? 1 + p.hitT * 0.5 : 1;
        const r = p.r * sc * pulse;
        if (r <= 0.2) continue;
        const gl = glow(col, p.r * 4.4);
        g.globalAlpha = p.lit ? 0.95 : 0.55;
        g.drawImage(gl, p.x - gl.width / 2, p.y - gl.height / 2);
        g.globalAlpha = 1;
        g.fillStyle = p.lit ? '#ffffff' : col;
        g.beginPath(); g.arc(p.x, p.y, r, 0, 7); g.fill();
        if (!p.lit) {
          g.fillStyle = 'rgba(255,255,255,0.45)'; g.beginPath(); g.arc(p.x - r * 0.3, p.y - r * 0.3, r * 0.34, 0, 7); g.fill();
        }
        if (p.type === 'bomb') { g.fillStyle = p.lit ? '#ff8a1f' : '#2a1100'; g.beginPath(); g.arc(p.x, p.y, r * 0.55, 0, 7); g.fill(); g.fillStyle = '#ffd23f'; g.fillRect(p.x - 1, p.y - r - 3, 2, 4); }
        else if (p.type === 'gold') { g.fillStyle = '#b8860b'; g.font = `900 ${Math.round(r * 1.2)}px system-ui`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('$', p.x, p.y + 1); }
        else if (p.type === 'bumper') { g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.arc(p.x, p.y, r * 0.55, 0, 7); g.stroke(); }
      }
    }
    drawBolts(g) {
      for (const b of this.bolts) {
        g.globalAlpha = b.life / 0.25; g.strokeStyle = '#fff6a0'; g.lineWidth = 3;
        g.beginPath(); g.moveTo(b.x1, b.y1);
        const n = 5;
        for (let i = 1; i < n; i++) { const t = i / n; g.lineTo(lerp(b.x1, b.x2, t) + rand(-9, 9), lerp(b.y1, b.y2, t) + rand(-9, 9)); }
        g.lineTo(b.x2, b.y2); g.stroke();
      }
      g.globalAlpha = 1;
    }
    drawBalls(g) { for (const b of this.balls) this.drawBall(g, b.x, b.y, b.r, b.trail, b.hits); }
    drawBall(g, x, y, r, trail) {
      const skin = OF.SKIN[OF.save.d.skin] || OF.SKINS[0];
      const rainbow = skin.c1 === 'rainbow';
      const c1 = rainbow ? `hsl(${(this.time * 220) % 360},95%,70%)` : skin.c1, c2 = rainbow ? `hsl(${(this.time * 220 + 80) % 360},95%,50%)` : skin.c2;
      if (trail.length > 4) {
        for (let i = 2; i < trail.length; i += 2) {
          const t = i / trail.length;
          g.strokeStyle = rainbow ? `hsla(${(this.time * 220 + i * 6) % 360},95%,65%,${t * 0.5})` : c2; g.globalAlpha = rainbow ? 1 : t * 0.45;
          g.lineWidth = r * 1.6 * t; g.lineCap = 'round';
          g.beginPath(); g.moveTo(trail[i - 2], trail[i - 1]); g.lineTo(trail[i], trail[i + 1]); g.stroke();
        }
        g.globalAlpha = 1;
      }
      const col = rainbow ? '#ffffff' : c1;
      const gl = glow(col.startsWith('#') ? col : '#ffffff', r * 5);
      g.globalAlpha = 0.7; g.drawImage(gl, x - gl.width / 2, y - gl.height / 2); g.globalAlpha = 1;
      const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.35, c1); gr.addColorStop(1, c2);
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
  }
  OF.Game = Game;
})(window.OF);
