/* ORBFALL – screens, menus, meta-game */
(function (OF) {
  const $ = s => document.querySelector(s);
  const S = () => OF.save.d;
  const fmt = OF.fmt;
  let game;

  const UI = OF.ui = { act: {}, sheetOpen: false, resultCtx: null };

  OF.toast = function (msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 2200);
  };
  OF.confirmPurchase = function (id) {
    const p = OF.PRODUCTS.find(x => x.id === id);
    return Promise.resolve(window.confirm('TEST MODE – simulate purchase of "' + p.name + '" (' + p.price + ')?'));
  };

  /* ---------- sheet helpers ---------- */
  UI.open = function (html, opts) {
    opts = opts || {};
    $('#sheet').innerHTML = html;
    $('#sheet').scrollTop = 0;
    $('#overlay').classList.add('show');
    UI.sheetOpen = true; UI.onClose = opts.onClose || null;
  };
  UI.close = function () {
    $('#overlay').classList.remove('show'); UI.sheetOpen = false;
    const c = UI.onClose; UI.onClose = null; if (c) c();
  };
  UI.banner = function (title, sub) {
    const b = $('#banner'); b.innerHTML = title + (sub ? '<small>' + sub + '</small>' : '');
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  };

  /* ---------- wallet / badges ---------- */
  OF.onWallet = function () {
    document.querySelectorAll('[data-wallet]').forEach(el => el.textContent = fmt(S()[el.dataset.wallet]));
  };
  function wheelReady() { return Date.now() - S().wheel.last >= OF.CFG.wheelCooldownMs; }
  function ensureMissions() {
    const d = S(), today = OF.todayKey();
    if (d.missions.day === today) return;
    const r = OF.rng(OF.hash('m' + today));
    const pool = OF.shuffle(OF.MISSIONS.slice(), r).slice(0, 3);
    d.missions = { day: today, list: pool.map(m => {
      const n = m.n[Math.floor(r() * 3)];
      return { id: m.id, type: m.type, text: m.text.replace('{n}', n), target: n, gems: m.gems + (n === m.n[2] ? 1 : 0), progress: 0, claimed: false };
    }) };
    OF.save.write();
  }
  function missionProgress(type, n) {
    ensureMissions();
    for (const m of S().missions.list) {
      if (m.type !== type) continue;
      if (type === 'stage' || type === 'bigorb') m.progress = Math.max(m.progress, n);
      else m.progress += n;
    }
  }
  function refreshDots() {
    ensureMissions();
    $('#dotWheel').classList.toggle('on', wheelReady());
    $('#dotMissions').classList.toggle('on', S().missions.list.some(m => !m.claimed && m.progress >= m.target));
    $('#dotChallenge').classList.toggle('on', !(S().challenge.day === OF.todayKey() && S().challenge.done));
    $('#homeBest').innerHTML = S().bestStage ? `BEST STAGE <b>${S().bestStage}</b> · BEST SCORE <b>${fmt(S().bestScore)}</b>` : 'Reach the goal every stage to climb!';
  }

  /* ---------- HUD ---------- */
  function updateHud() {
    const r = game.run; if (!r || game.attract) return;
    $('#hStage').textContent = r.stage;
    $('#hScore').textContent = fmt(r.stageScore) + ' / ' + fmt(r.target);
    $('#hBar').style.width = Math.min(100, r.stageScore / r.target * 100) + '%';
    const o = r.orbs;
    $('#hOrbs').innerHTML = o <= 8 ? Array.from({ length: Math.max(o, 0) }, () => '<span class="orb-dot"></span>').join('') || '<span class="orb-dot off"></span>'
      : '<span class="orb-dot"></span><b>×' + o + '</b>';
    $('#hNudge').innerHTML = '👆 <b>' + r.nudges + '</b>';
    $('#hCoins').innerHTML = '🪙 <b>' + fmt(r.coins) + '</b>';
    if (game.state === 'drop' && !S().tutorialDone) { S().tutorialDone = true; OF.save.write(); }
  }

  /* ---------- home ---------- */
  UI.home = function () {
    $('#hud').classList.add('hidden');
    $('#home').classList.remove('hidden');
    refreshDots(); OF.onWallet();
    if (!game.attract) game.startAttract();
  };
  function hideHome() { $('#home').classList.add('hidden'); }

  function startRun(mode) {
    OF.audio.init();
    UI.close(); hideHome();
    $('#hud').classList.remove('hidden');
    game.startRun(mode);
    OF.track('run_start', { mode });
  }

  /* ---------- run flow callbacks ---------- */
  function onStageStart(r) {
    const boss = r.stage % OF.CFG.bossEvery === 0;
    UI.banner((boss ? '👑 BOSS ' : '') + 'STAGE ' + r.stage, 'GOAL ' + fmt(r.target));
    updateHud();
  }
  function onClear(info) {
    const r = game.run;
    if (info.boss) OF.save.addGems(1);
    OF.save.write();
    const last = r.mode === 'daily' && r.stage >= OF.CFG.dailyStages;
    UI.open(`
      <h2 class="hl">${info.boss ? '👑 BOSS DEFEATED' : 'STAGE CLEAR!'}</h2>
      <p class="sub">Stage ${info.stage} complete</p>
      <div class="stat"><span>Score</span><b>${fmt(info.score)} / ${fmt(info.target)}</b></div>
      <div class="stat"><span>Spare orbs</span><b>${info.leftover}</b></div>
      <div class="stat"><span>Stage bonus</span><b>+${fmt(info.bonus)} 🪙</b></div>
      ${info.boss ? '<div class="stat"><span>Boss reward</span><b>+1 💎</b></div>' : ''}
      <div class="row"><button class="btn green" data-act="${last ? 'finish' : 'cards'}">${last ? 'FINISH' : 'CHOOSE UPGRADE'}</button></div>`);
  }
  UI.act.cards = function () { showCards(false); };
  let cardState = null;
  function rollCards(n) {
    const r = game.run, rr = r.mode === 'daily' ? OF.rng(r.seed + r.stage * 31 + (cardState ? cardState.rolls : 0)) : Math.random;
    const pool = OF.UPGRADES.filter(u => game.m(u.id) < u.max);
    const out = [];
    while (out.length < n && pool.length) {
      const tot = pool.reduce((s, u) => s + OF.RARITY[u.rarity].w, 0);
      let q = rr() * tot, i = 0;
      for (; i < pool.length; i++) { q -= OF.RARITY[pool[i].rarity].w; if (q <= 0) break; }
      out.push(pool.splice(Math.min(i, pool.length - 1), 1)[0]);
    }
    return out;
  }
  function showCards(reroll) {
    const r = game.run;
    if (!cardState || !reroll) cardState = { rolls: 0, extra: false, list: null };
    else cardState.rolls++;
    if (!cardState.list || reroll) cardState.list = rollCards(3);
    renderCards();
  }
  function renderCards() {
    const r = game.run, st = cardState;
    if (!st.list.length) { UI.close(); game.nextStage(); return; }
    const html = st.list.map((u, i) => {
      const rc = OF.RARITY[u.rarity], lv = game.m(u.id);
      return `<div class="card" style="--rc:${rc.color}" data-act="pick" data-i="${i}" role="button">
        <small>${rc.label}</small><i>${u.icon}</i><h3>${u.name}</h3><p>${u.desc}</p>
        <span class="lv">${lv ? 'Lv ' + lv + ' → ' + (lv + 1) : 'NEW'}</span></div>`;
    }).join('');
    const free = r.rerolls > 0;
    UI.open(`
      <h2>CHOOSE AN UPGRADE</h2><p class="sub">Stage ${r.stage + 1} awaits…</p>
      <div class="cards ${st.list.length > 3 ? 'four' : ''}">${html}</div>
      <div class="row">
        <button class="btn ghost sm" data-act="reroll">🎲 ${free ? 'Reroll (' + r.rerolls + ' free)' : 'Reroll 📺'}</button>
        ${st.extra ? '' : '<button class="btn gold sm" data-act="extracard">➕ 4th card 📺</button>'}
      </div>`);
  }
  UI.act.pick = function (el) {
    const u = cardState.list[+el.dataset.i]; if (!u) return;
    OF.audio.click(); OF.haptic(15);
    game.addUpgrade(u.id); cardState = null;
    UI.close(); game.nextStage();
  };
  UI.act.reroll = async function () {
    const r = game.run;
    if (r.rerolls > 0) { r.rerolls--; showCards(true); return; }
    if (await OF.ads.rewarded('reroll')) showCards(true);
  };
  UI.act.extracard = async function () {
    if (!(await OF.ads.rewarded('extra_card'))) return;
    const more = rollCards(4).filter(u => !cardState.list.find(x => x.id === u.id));
    if (more.length) cardState.list.push(more[0]);
    cardState.extra = true; renderCards();
  };

  function onFail(r) {
    if (r.mode === 'daily' && false) return;
    if (r.revived) return finishRun(false);
    UI.open(`
      <h2 style="color:var(--red)">OUT OF ORBS</h2>
      <p class="sub">Stage ${r.stage} · ${fmt(r.stageScore)} / ${fmt(r.target)}</p>
      <div style="text-align:center;font-size:3.4em">💔</div>
      <p class="sub">So close! Continue with <b class="hl">2 extra orbs</b>?</p>
      <div class="list">
        <button class="btn green block" data-act="reviveAd">📺 WATCH AD · +2 ORBS</button>
        <button class="btn gold block" data-act="reviveGems">💎 ${OF.CFG.reviveGems} GEMS · +2 ORBS</button>
        <button class="btn ghost block" data-act="finish">No thanks</button>
      </div>`);
  }
  UI.act.reviveAd = async function () { if (await OF.ads.rewarded('revive')) { UI.close(); game.revive(); updateHud(); } };
  UI.act.reviveGems = function () {
    if (!OF.save.spend('gems', OF.CFG.reviveGems)) return OF.toast('Not enough gems – check the shop!');
    UI.close(); game.revive(); updateHud();
  };
  UI.act.finish = function () { finishRun(true); };

  function finishRun(failedOrDone) {
    const r = game.run, d = S();
    const reached = r.stage - (game.state === 'fail' ? 1 : 0) + (game.state === 'clear' ? 0 : 0);
    const stageReached = game.state === 'clear' ? r.stage : Math.max(0, r.stage - 1);
    let newBest = false;
    if (r.mode !== 'daily') {
      if (stageReached > d.bestStage) { d.bestStage = stageReached; newBest = true; }
      if (r.totalScore > d.bestScore) d.bestScore = r.totalScore;
    }
    let challengeWon = false, reward = '';
    if (r.mode === 'daily' && game.state === 'clear' && r.stage >= OF.CFG.dailyStages) {
      const today = OF.todayKey();
      if (!(d.challenge.day === today && d.challenge.done)) {
        d.challenge = { day: today, done: true, best: r.totalScore }; challengeWon = true;
        OF.save.addGems(5); OF.save.addCoins(500); reward = '<div class="stat"><span>Daily Challenge reward</span><b>+5 💎 +500 🪙</b></div>';
      }
    }
    const coins = Math.round(r.coins);
    OF.save.addCoins(coins);
    missionProgress('runs', 1);
    OF.save.write();
    UI.resultCtx = { coins, doubled: false, mode: r.mode };
    OF.track('run_end', { stage: stageReached, score: r.totalScore, mode: r.mode });
    UI.open(`
      <h2>${r.mode === 'daily' ? (challengeWon ? '🏆 CHALLENGE DONE' : 'DAILY CHALLENGE') : 'RUN OVER'}</h2>
      ${newBest ? '<p class="sub hl">★ NEW BEST STAGE ★</p>' : '<p class="sub">Nice run!</p>'}
      <div class="stat"><span>Stage reached</span><b>${stageReached}</b></div>
      <div class="stat"><span>Total score</span><b>${fmt(r.totalScore)}</b></div>
      <div class="stat"><span>Pegs lit</span><b>${r.pegsHit}</b></div>
      <div class="stat"><span>Best orb</span><b>${fmt(r.bigOrb)}</b></div>
      <div class="stat"><span>Coins earned</span><b id="resCoins">+${fmt(coins)} 🪙</b></div>
      ${reward}
      <div class="list" style="margin-top:1em">
        ${coins > 0 ? `<button class="btn gold block" id="btnDouble" data-act="doubleCoins">📺 DOUBLE COINS (+${fmt(coins)})</button>` : ''}
        <button class="btn green block" data-act="again">▶ PLAY AGAIN</button>
        <button class="btn ghost block" data-act="toHome">Home</button>
      </div>`);
    game.run = null; game.state = 'idle';
    $('#hud').classList.add('hidden');
    game.startAttract();
  }
  UI.act.doubleCoins = async function (el) {
    const c = UI.resultCtx; if (!c || c.doubled) return;
    if (await OF.ads.rewarded('double_coins')) {
      c.doubled = true; OF.save.addCoins(c.coins);
      $('#resCoins').textContent = '+' + fmt(c.coins * 2) + ' 🪙 (x2)';
      el.remove(); OF.audio.coin();
    }
  };
  UI.act.again = async function () { await OF.ads.interstitial(); const m = UI.resultCtx ? UI.resultCtx.mode : 'normal'; startRun(m === 'daily' ? 'normal' : m); };
  UI.act.toHome = async function () { await OF.ads.interstitial(); UI.close(); UI.home(); };

  UI.act.play = function () { startRun('normal'); };
  UI.act.pause = function () {
    if (!game.run || game.attract) return;
    game.paused = true;
    UI.open(`<h2>PAUSED</h2>
      <p class="sub">Stage ${game.run.stage} · ${fmt(game.run.stageScore)} / ${fmt(game.run.target)}</p>
      ${toggles()}
      <div class="list" style="margin-top:1em">
        <button class="btn green block" data-act="resume">▶ RESUME</button>
        <button class="btn ghost block" data-act="quit">Quit run (keep coins)</button>
      </div>`, { onClose: () => { game.paused = false; } });
  };
  UI.act.resume = function () { UI.close(); };
  UI.act.quit = function () { game.paused = false; UI.onClose = null; finishRun(true); };

  /* ---------- settings ---------- */
  function toggles() {
    const t = (k, label) => `<div class="toggle" data-act="toggle" data-k="${k}"><span>${label}</span><div class="sw ${S()[k] ? 'on' : ''}"></div></div>`;
    return t('sound', '🔊 Sound') + t('music', '🎵 Music') + t('haptics', '📳 Vibration');
  }
  UI.act.toggle = function (el) {
    const k = el.dataset.k; S()[k] = !S()[k]; OF.save.write();
    el.querySelector('.sw').classList.toggle('on', S()[k]);
    if (k === 'music' || k === 'sound') OF.audio.syncMusic();
    OF.audio.click();
  };
  UI.act.settings = function () {
    UI.open(`<h2>SETTINGS</h2><p class="sub">Orbfall v1.0</p>${toggles()}
      <div class="list" style="margin-top:1em">
        <button class="btn ghost block" data-act="privacy">Privacy &amp; ads consent</button>
        <button class="btn ghost block" data-act="resetData">Reset all progress</button>
        <button class="btn block" data-act="close">Close</button>
      </div>`);
  };
  UI.act.privacy = function () { OF.toast('Add your privacy-policy URL in docs/LAUNCH.md'); };
  UI.act.resetData = function () { if (window.confirm('Delete ALL progress?')) { OF.save.reset(); UI.close(); UI.home(); game.setTheme(S().theme); OF.toast('Progress reset'); } };
  UI.act.close = function () { OF.audio.click(); UI.close(); };

  /* ---------- upgrades (meta) ---------- */
  UI.act.upgrades = function () {
    const d = S();
    const rows = OF.META.map(m => {
      const lvl = d.meta[m.id], maxed = lvl >= m.max, cost = maxed ? 0 : OF.metaCost(m, lvl);
      const pips = Array.from({ length: m.max }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('');
      return `<div class="item"><div class="ic">${m.icon}</div>
        <div class="tx"><b>${m.name}</b><span>${m.desc(Math.max(lvl, 1))}${lvl ? '' : ' (next)'}</span><div class="pips">${pips}</div></div>
        ${maxed ? '<b class="hl">MAX</b>' : `<button class="btn gold sm" data-act="buyMeta" data-id="${m.id}" ${d.coins < cost ? 'style="opacity:.6"' : ''}>🪙 ${fmt(cost)}</button>`}</div>`;
    }).join('');
    UI.open(`<h2>UPGRADES</h2><p class="sub">Permanent power-ups · you have <b class="gold" style="color:var(--gold)">${fmt(d.coins)} 🪙</b></p>
      <div class="list">${rows}</div><div class="row"><button class="btn block" data-act="close">Back</button></div>`);
  };
  UI.act.buyMeta = function (el) {
    const m = OF.META.find(x => x.id === el.dataset.id), d = S(), lvl = d.meta[m.id];
    if (lvl >= m.max) return;
    if (!OF.save.spend('coins', OF.metaCost(m, lvl))) { OF.toast('Not enough coins – play a run!'); return; }
    d.meta[m.id]++; OF.save.write(); OF.audio.coin(); OF.haptic(25); UI.act.upgrades(); OF.onWallet();
  };

  /* ---------- shop ---------- */
  UI.act.shop = function () {
    const d = S();
    const adLeft = OF.CFG.maxAdGemsPerDay - (d.adGems.day === OF.todayKey() ? d.adGems.n : 0);
    const prod = OF.PRODUCTS.map(p => {
      const owned = (p.id === 'starter' && d.starterBought) || (p.id === 'noads' && d.adsRemoved);
      return `<div class="item"><div class="ic">${p.id.startsWith('gems') ? '💎' : p.id === 'noads' ? '🚫' : '🎁'}</div>
        <div class="tx"><b>${p.name}${p.badge ? `<span class="tag">${p.badge}</span>` : ''}</b><span>${p.desc}</span></div>
        ${owned ? '<b class="hl">OWNED</b>' : `<button class="btn green sm" data-act="buyIap" data-id="${p.id}">${p.price}</button>`}</div>`;
    }).join('');
    const cos = (arr, kind, cur) => arr.map(s => {
      const owned = (kind === 'skin' ? d.ownedSkins : d.ownedThemes).includes(s.id), eq = (kind === 'skin' ? d.skin : d.theme) === s.id;
      const sw = kind === 'skin'
        ? `<div class="swatch" style="background:${s.c1 === 'rainbow' ? 'conic-gradient(red,yellow,lime,cyan,blue,magenta,red)' : `radial-gradient(circle at 35% 30%,#fff,${s.c1} 35%,${s.c2})`}"></div>`
        : `<div class="swatch" style="background:linear-gradient(${s.bg1},${s.bg2});border-color:${s.peg}"></div>`;
      return `<div class="item">${sw}<div class="tx"><b>${s.name}</b></div>
        ${eq ? '<b class="hl">EQUIPPED</b>' : owned ? `<button class="btn sm" data-act="equip" data-kind="${kind}" data-id="${s.id}">Equip</button>`
          : `<button class="btn gold sm" data-act="buyCos" data-kind="${kind}" data-id="${s.id}">${s.cur === 'gems' ? '💎' : '🪙'} ${fmt(s.price)}</button>`}</div>`;
    }).join('');
    UI.open(`<h2>SHOP</h2><p class="sub"><b style="color:var(--gold)">${fmt(d.coins)} 🪙</b> · <b style="color:var(--cyan)">${fmt(d.gems)} 💎</b></p>
      <div class="section">FREE</div>
      <div class="list"><div class="item"><div class="ic">📺</div><div class="tx"><b>Free gems</b><span>${adLeft} left today</span></div>
        <button class="btn green sm" data-act="adGems" ${adLeft <= 0 ? 'disabled' : ''}>+3 💎</button></div></div>
      <div class="section">OFFERS</div><div class="list">${prod}</div>
      <div class="section">ORB SKINS</div><div class="list">${cos(OF.SKINS, 'skin')}</div>
      <div class="section">BOARD THEMES</div><div class="list">${cos(OF.THEMES, 'theme')}</div>
      <div class="row"><button class="btn block" data-act="close">Back</button></div>`);
  };
  UI.act.adGems = async function () {
    const d = S(), t = OF.todayKey();
    if (d.adGems.day !== t) d.adGems = { day: t, n: 0 };
    if (d.adGems.n >= OF.CFG.maxAdGemsPerDay) return;
    if (await OF.ads.rewarded('free_gems')) { d.adGems.n++; OF.save.addGems(3); OF.audio.coin(); OF.toast('+3 💎'); UI.act.shop(); }
  };
  UI.act.buyIap = async function (el) {
    if (await OF.iap.buy(el.dataset.id)) { OF.audio.win(); OF.toast('Purchase complete – thank you!'); UI.act.shop(); refreshDots(); }
  };
  UI.act.equip = function (el) {
    const d = S();
    if (el.dataset.kind === 'skin') d.skin = el.dataset.id; else { d.theme = el.dataset.id; game.setTheme(d.theme); }
    OF.save.write(); OF.audio.click(); UI.act.shop();
  };
  UI.act.buyCos = function (el) {
    const d = S(), kind = el.dataset.kind, s = (kind === 'skin' ? OF.SKIN : OF.THEME)[el.dataset.id];
    if (!OF.save.spend(s.cur, s.price)) return OF.toast(s.cur === 'gems' ? 'Not enough gems' : 'Not enough coins');
    (kind === 'skin' ? d.ownedSkins : d.ownedThemes).push(s.id);
    if (kind === 'skin') d.skin = s.id; else { d.theme = s.id; game.setTheme(s.id); }
    OF.save.write(); OF.audio.win(); OF.haptic(40); UI.act.shop();
  };

  /* ---------- missions ---------- */
  UI.act.missions = function () {
    ensureMissions();
    const rows = S().missions.list.map((m, i) => {
      const done = m.progress >= m.target, pct = Math.min(100, m.progress / m.target * 100);
      return `<div class="item"><div class="ic">🎯</div><div class="tx"><b>${m.text}</b><span>${fmt(Math.min(m.progress, m.target))} / ${fmt(m.target)}</span><div class="bar"><i style="width:${pct}%"></i></div></div>
        ${m.claimed ? '<b class="hl">✓</b>' : `<button class="btn ${done ? 'green' : 'ghost'} sm" ${done ? '' : 'disabled'} data-act="claimMission" data-i="${i}">+${m.gems} 💎</button>`}</div>`;
    }).join('');
    UI.open(`<h2>DAILY MISSIONS</h2><p class="sub">Fresh missions every day</p><div class="list">${rows}</div>
      <div class="row"><button class="btn block" data-act="close">Back</button></div>`);
  };
  UI.act.claimMission = function (el) {
    const m = S().missions.list[+el.dataset.i];
    if (!m || m.claimed || m.progress < m.target) return;
    m.claimed = true; OF.save.addGems(m.gems); OF.audio.coin(); OF.haptic(30); UI.act.missions(); refreshDots();
  };

  /* ---------- daily challenge ---------- */
  UI.act.challenge = function () {
    const done = S().challenge.day === OF.todayKey() && S().challenge.done;
    UI.open(`<h2>DAILY CHALLENGE</h2><p class="sub">Same board for every player today</p>
      <div style="text-align:center;font-size:3.6em">📅</div>
      <div class="stat"><span>Goal</span><b>Clear ${OF.CFG.dailyStages} stages</b></div>
      <div class="stat"><span>Reward</span><b>5 💎 + 500 🪙</b></div>
      <div class="stat"><span>Status</span><b>${done ? 'Completed ✓' : 'Available'}</b></div>
      <div class="list" style="margin-top:1em">
        <button class="btn green block" data-act="startDaily" ${done ? 'disabled' : ''}>${done ? 'COME BACK TOMORROW' : '▶ START CHALLENGE'}</button>
        <button class="btn ghost block" data-act="close">Back</button></div>`);
  };
  UI.act.startDaily = function () { startRun('daily'); };

  /* ---------- lucky wheel ---------- */
  let spinning = false, wheelRot = 0;
  function drawWheel(cv) {
    const g = cv.getContext('2d'), n = OF.WHEEL.length, R = cv.width / 2, a = Math.PI * 2 / n;
    g.clearRect(0, 0, cv.width, cv.height);
    OF.WHEEL.forEach((s, i) => {
      g.beginPath(); g.moveTo(R, R); g.arc(R, R, R - 4, i * a - Math.PI / 2 - a / 2, (i + 1) * a - Math.PI / 2 - a / 2); g.closePath();
      g.fillStyle = s.color; g.fill(); g.strokeStyle = '#ffffffaa'; g.lineWidth = 3; g.stroke();
      g.save(); g.translate(R, R); g.rotate(i * a); g.fillStyle = '#fff'; g.font = `900 ${R * 0.14}px system-ui`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.shadowColor = '#000'; g.shadowBlur = 4; g.fillText(s.label, 0, -R * 0.68); g.restore();
    });
    g.beginPath(); g.arc(R, R, R * 0.12, 0, 7); g.fillStyle = '#fff'; g.fill();
  }
  UI.act.wheel = function () {
    const d = S(), t = OF.todayKey();
    if (d.wheel.adDay !== t) { d.wheel.adDay = t; d.wheel.adSpins = 0; }
    const free = wheelReady(), adLeft = OF.CFG.maxAdSpinsPerDay - d.wheel.adSpins;
    UI.open(`<h2>LUCKY WHEEL</h2><p class="sub">${free ? 'Your free spin is ready!' : 'Free spin every 20h · extra spins via video'}</p>
      <div class="wheel-wrap"><canvas id="wheelCv" width="500" height="500"></canvas><div class="wheel-pin">▼</div></div>
      <div class="list"><button class="btn ${free ? 'green' : 'gold'} block" id="spinBtn" data-act="spin" ${(!free && adLeft <= 0) ? 'disabled' : ''}>${free ? '🎡 SPIN FREE' : adLeft > 0 ? `📺 SPIN (${adLeft} left)` : 'No spins left today'}</button>
      <button class="btn ghost block" data-act="close">Back</button></div>`);
    const cv = $('#wheelCv'); drawWheel(cv); cv.style.transform = `rotate(${wheelRot}deg)`;
  };
  UI.act.spin = async function () {
    if (spinning) return;
    const d = S(), free = wheelReady();
    if (!free) {
      if (d.wheel.adSpins >= OF.CFG.maxAdSpinsPerDay) return;
      if (!(await OF.ads.rewarded('wheel'))) return;
      d.wheel.adSpins++;
    } else d.wheel.last = Date.now();
    OF.save.write();
    spinning = true;
    const w = OF.WHEEL_WEIGHTS, tot = w.reduce((a, b) => a + b, 0);
    let q = Math.random() * tot, idx = 0; for (; idx < w.length; idx++) { q -= w[idx]; if (q <= 0) break; }
    idx = Math.min(idx, w.length - 1);
    const seg = 360 / OF.WHEEL.length;
    const target = Math.ceil(wheelRot / 360) * 360 + 360 * 5 + (360 - idx * seg);
    wheelRot = target;
    const cv = $('#wheelCv'); if (cv) cv.style.transform = `rotate(${target}deg)`;
    $('#spinBtn').disabled = true;
    let tick = 0; const iv = setInterval(() => { OF.audio.tone(400 + (tick++ % 8) * 40, 0.04, 'square', 0.1); }, 120);
    setTimeout(() => {
      clearInterval(iv); spinning = false;
      const s = OF.WHEEL[idx];
      if (s.coins) OF.save.addCoins(s.coins); if (s.gems) OF.save.addGems(s.gems);
      OF.audio.win(); OF.haptic(60); OF.toast('You won ' + s.label + (s.gems ? '' : ' 🪙') + '!');
      refreshDots();
      if ($('#overlay').classList.contains('show') && $('#wheelCv')) { wheelRot = target % 360; const c = $('#wheelCv'); c.style.transition = 'none'; c.style.transform = `rotate(${wheelRot}deg)`; void c.offsetWidth; c.style.transition = ''; UI.act.wheel(); }
    }, 4300);
  };

  /* ---------- daily login reward ---------- */
  UI.maybeDailyReward = function () {
    const d = S(), today = OF.todayKey();
    if (d.daily.last === today) return;
    const y = new Date(); y.setDate(y.getDate() - 1);
    const yk = y.getFullYear() + '-' + String(y.getMonth() + 1).padStart(2, '0') + '-' + String(y.getDate()).padStart(2, '0');
    const streak = d.daily.last === yk ? d.daily.streak : 0;
    const dayIdx = streak % OF.DAILY_REWARDS.length;
    const days = OF.DAILY_REWARDS.map((r, i) => `<div class="day ${i === dayIdx ? 'today' : i < dayIdx ? 'done' : ''}"><small>Day ${i + 1}</small>${r.coins ? '🪙 ' + r.coins : ''}${r.gems ? '<br>💎 ' + r.gems : ''}</div>`).join('');
    UI.open(`<h2>DAILY REWARD</h2><p class="sub">Come back every day for bigger prizes · streak ${streak}</p>
      <div class="days">${days}</div>
      <div class="list"><button class="btn green block" data-act="claimDaily" data-streak="${streak}">CLAIM</button>
      <button class="btn gold block" data-act="claimDaily2" data-streak="${streak}">📺 CLAIM x2</button></div>`);
  };
  function grantDaily(streak, mult) {
    const d = S(), r = OF.DAILY_REWARDS[streak % OF.DAILY_REWARDS.length];
    if (r.coins) OF.save.addCoins(r.coins * mult); if (r.gems) OF.save.addGems(r.gems * mult);
    d.daily = { last: OF.todayKey(), streak: streak + 1 }; OF.save.write();
    OF.audio.win(); OF.toast('Reward claimed!'); UI.close(); refreshDots();
  }
  UI.act.claimDaily = function (el) { grantDaily(+el.dataset.streak, 1); };
  UI.act.claimDaily2 = async function (el) { if (await OF.ads.rewarded('daily_x2')) grantDaily(+el.dataset.streak, 2); };

  /* ---------- init ---------- */
  UI.init = function (g) {
    game = g;
    g.cb.stageStart = onStageStart;
    g.cb.hud = updateHud;
    g.cb.clear = onClear;
    g.cb.fail = onFail;
    g.cb.mission = missionProgress;
    $('#app').addEventListener('click', e => {
      const el = e.target.closest('[data-act]'); if (!el) return;
      OF.audio.init();
      const fn = UI.act[el.dataset.act]; if (fn) { if (el.dataset.act !== 'pick') OF.audio.click(); fn(el); }
    });
    // pointer input on the canvas
    const cv = g.cv;
    const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * 540, (e.clientY - r.top) / r.height * g.H]; };
    cv.addEventListener('pointerdown', e => { OF.audio.init(); if (UI.sheetOpen || g.paused) return; cv.setPointerCapture(e.pointerId); const [x, y] = pos(e); g.pointerDown(x, y); });
    cv.addEventListener('pointermove', e => { const [x] = pos(e); g.pointerMove(x); });
    cv.addEventListener('pointerup', () => g.pointerUp());
    cv.addEventListener('pointercancel', () => { g.dragging = false; });
    window.addEventListener('keydown', e => {
      if (UI.sheetOpen) return;
      if (e.key === 'ArrowLeft') g.aimX = Math.max(28, g.aimX - 18);
      if (e.key === 'ArrowRight') g.aimX = Math.min(512, g.aimX + 18);
      if (e.key === ' ' || e.key === 'Enter') { if (g.state === 'drop') g.nudge(g.balls[0] ? g.balls[0].x + 1 : g.aimX); else g.drop(); }
    });
    OF.onWallet();
  };
  UI.refreshDots = refreshDots;
})(window.OF);
