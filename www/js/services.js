/* ORBFALL – save data, audio, haptics, ads, purchases */
(function (OF) {
  /* ---------------- SAVE ---------------- */
  const KEY = 'orbfall_save_v1';
  const DEFAULTS = {
    coins: 0, gems: 0, best: 0, bestStage: 0, bestScore: 0, runs: 0, totalPegs: 0,
    meta: { orbs: 0, coin: 0, peg: 0, nudge: 0, start: 0, reroll: 0 },
    skin: 'cyan', theme: 'night', ownedSkins: ['cyan'], ownedThemes: ['night'],
    adsRemoved: false, starterBought: false,
    sound: true, music: true, haptics: true,
    daily: { last: '', streak: 0 },
    wheel: { last: 0, adSpins: 0, adDay: '' },
    adGems: { day: '', n: 0 },
    missions: { day: '', list: [] },
    challenge: { day: '', done: false, best: 0 },
    tutorialDone: false, lastInterstitial: 0, runsSinceAd: 0, notifAsked: false, notifOn: false, rated: false,
  };
  function deepMerge(base, src) {
    const out = Array.isArray(base) ? base.slice() : Object.assign({}, base);
    if (!src || typeof src !== 'object') return out;
    for (const k of Object.keys(src)) {
      if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) out[k] = deepMerge(base[k], src[k]);
      else out[k] = src[k];
    }
    return out;
  }
  const Save = OF.save = {
    d: null,
    load() {
      let raw = null;
      try { raw = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* ignore */ }
      this.d = deepMerge(DEFAULTS, raw);
      return this.d;
    },
    write() { try { localStorage.setItem(KEY, JSON.stringify(this.d)); } catch (e) { /* ignore */ } },
    reset() { try { localStorage.removeItem(KEY); } catch (e) {} this.load(); },
    addCoins(n) { this.d.coins += Math.round(n); this.write(); OF.onWallet && OF.onWallet(); },
    addGems(n) { this.d.gems += Math.round(n); this.write(); OF.onWallet && OF.onWallet(); },
    spend(cur, n) {
      if (this.d[cur] < n) return false;
      this.d[cur] -= n; this.write(); OF.onWallet && OF.onWallet(); return true;
    },
  };
  Save.load();

  /* ---------------- HAPTICS ---------------- */
  OF.haptic = function (ms) {
    if (!Save.d.haptics) return;
    try {
      const H = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics;
      if (H && H.vibrate) { H.vibrate({ duration: ms }); return; }
      if (navigator.vibrate) navigator.vibrate(ms);
    } catch (e) { /* ignore */ }
  };

  /* ---------------- AUDIO (fully synthesised, zero asset files) ---------------- */
  const Audio = OF.audio = {
    ctx: null, master: null, sfxGain: null, musicGain: null, musicOn: false, nextNote: 0, step: 0, timer: null,
    init() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.gain.value = 0.8; this.master.connect(this.ctx.destination);
      this.sfxGain = this.ctx.createGain(); this.sfxGain.gain.value = 0.55; this.sfxGain.connect(this.master);
      this.musicGain = this.ctx.createGain(); this.musicGain.gain.value = 0.12; this.musicGain.connect(this.master);
      this.syncMusic();
    },
    tone(freq, dur, type, vol, when, slide) {
      if (!this.ctx || !Save.d.sound) return;
      const t = (when || this.ctx.currentTime);
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.3, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.sfxGain); o.start(t); o.stop(t + dur + 0.02);
    },
    noise(dur, vol, cutoff) {
      if (!this.ctx || !Save.d.sound) return;
      const n = Math.floor(this.ctx.sampleRate * dur), buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      const s = this.ctx.createBufferSource(); s.buffer = buf;
      const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff || 900;
      const g = this.ctx.createGain(); g.gain.value = vol || 0.4;
      s.connect(f); f.connect(g); g.connect(this.sfxGain); s.start();
    },
    // pentatonic scale rising with combo
    scale: [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31],
    peg(combo, type) {
      const note = this.scale[Math.min(combo, this.scale.length - 1)];
      const f = 261.63 * Math.pow(2, note / 12);
      this.tone(f, 0.22, type === 'gold' ? 'triangle' : 'sine', 0.32);
      if (type === 'gold') { this.tone(f * 2, 0.25, 'sine', 0.18, this.ctx && this.ctx.currentTime + 0.05); }
    },
    bump() { this.tone(180, 0.16, 'square', 0.18, null, 420); },
    bomb() { this.noise(0.5, 0.7, 700); this.tone(110, 0.4, 'sawtooth', 0.3, null, 40); },
    zap() { this.tone(900, 0.12, 'sawtooth', 0.12, null, 200); },
    drop() { this.tone(520, 0.12, 'triangle', 0.25, null, 260); },
    nudge() { this.tone(300, 0.1, 'square', 0.15, null, 600); },
    land(mult) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime, base = 330 + mult * 30;
      [0, 4, 7, 12].slice(0, Math.min(4, 1 + mult)).forEach((n, i) =>
        this.tone(base * Math.pow(2, n / 12), 0.35, 'triangle', 0.25, t + i * 0.06));
    },
    coin() { const t = this.ctx && this.ctx.currentTime; this.tone(988, 0.08, 'square', 0.12, t); this.tone(1319, 0.2, 'square', 0.12, t + 0.07); },
    click() { this.tone(660, 0.05, 'triangle', 0.2); },
    win() { if (!this.ctx) return; const t = this.ctx.currentTime; [0, 4, 7, 12, 16].forEach((n, i) => this.tone(392 * Math.pow(2, n / 12), 0.4, 'triangle', 0.28, t + i * 0.09)); },
    lose() { if (!this.ctx) return; const t = this.ctx.currentTime; [0, -3, -7, -12].forEach((n, i) => this.tone(330 * Math.pow(2, n / 12), 0.4, 'sawtooth', 0.15, t + i * 0.14)); },
    syncMusic() {
      if (!this.ctx) return;
      const want = Save.d.music && Save.d.sound;
      if (want && !this.musicOn) {
        this.musicOn = true; this.nextNote = this.ctx.currentTime + 0.1;
        this.timer = setInterval(() => this.sched(), 120);
      } else if (!want && this.musicOn) { this.musicOn = false; clearInterval(this.timer); }
    },
    sched() {
      if (!this.ctx || !this.musicOn) return;
      const prog = [[0, 4, 7, 11], [-3, 0, 4, 7], [-7, -3, 0, 4], [-5, -1, 2, 7]];
      const spb = 0.26;
      while (this.nextNote < this.ctx.currentTime + 0.4) {
        const bar = Math.floor(this.step / 16) % 4, chord = prog[bar], k = this.step % 16;
        const pat = [0, 1, 2, 3, 2, 1, 3, 2];
        if (k % 2 === 0) {
          const n = chord[pat[(k / 2) % 8] % 4] + 12;
          this.mtone(220 * Math.pow(2, n / 12), 0.5, 'triangle', 0.5, this.nextNote);
        }
        if (k === 0) this.mtone(110 * Math.pow(2, chord[0] / 12), 1.6, 'sine', 0.7, this.nextNote);
        this.nextNote += spb; this.step++;
      }
    },
    mtone(freq, dur, type, vol, when) {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, when); g.gain.exponentialRampToValueAtTime(vol, when + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      o.connect(g); g.connect(this.musicGain); o.start(when); o.stop(when + dur + 0.05);
    },
  };

  /* ---------------- ADS ----------------
     Web / dev builds show a fake ad so the whole flow is testable.
     On device (Capacitor + @capacitor-community/admob) real (currently TEST) ads are used.
     Ids live in www/js/config.js. */
  const Ads = OF.ads = {
    ready: false, busy: false,
    plat() { try { return window.Capacitor.getPlatform(); } catch (e) { return 'web'; } },
    plugin() { return window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform() && window.Capacitor.Plugins && window.Capacitor.Plugins.AdMob; },
    ids() { const c = OF.CONFIG.ads; return Object.assign({ testing: c.testing }, this.plat() === 'ios' ? c.ios : c.android); },
    async init() {
      const A = this.plugin(); if (!A) return;
      try {
        // GDPR / UMP consent (only shows a form where legally required)
        try {
          const info = await A.requestConsentInfo();
          if (info && info.isConsentFormAvailable && info.status === 'REQUIRED') await A.showConsentForm();
        } catch (e) { console.warn('consent', e); }
        if (this.plat() === 'ios') { try { await A.requestTrackingAuthorization(); } catch (e) { /* ignore */ } }
        await A.initialize({ initializeForTesting: OF.CONFIG.ads.testing });
        this.ready = true;
        this.preload();
      } catch (e) { console.warn('AdMob init failed', e); }
    },
    preload() {
      const A = this.plugin(); if (!A || !this.ready) return;
      const id = this.ids();
      A.prepareInterstitial({ adId: id.interstitial, isTesting: id.testing }).catch(() => {});
    },
    mute(on) { if (OF.audio.master) OF.audio.master.gain.value = on ? 0 : 0.8; },
    fake(kind) {
      return new Promise(res => {
        const el = document.getElementById('adOverlay'); if (!el) return res(true);
        const secs = kind === 'rewarded' ? 3 : 2;
        el.querySelector('.ad-kind').textContent = kind === 'rewarded' ? 'REWARDED VIDEO (test ad)' : 'INTERSTITIAL (test ad)';
        const btn = el.querySelector('button'), cd = el.querySelector('.ad-count');
        let left = secs; btn.disabled = true; btn.textContent = 'Wait…'; cd.textContent = left;
        el.classList.add('show');
        const iv = setInterval(() => {
          left--; cd.textContent = Math.max(0, left);
          if (left <= 0) { clearInterval(iv); btn.disabled = false; btn.textContent = kind === 'rewarded' ? 'Claim reward ✓' : 'Close ✕'; }
        }, 1000);
        btn.onclick = () => { el.classList.remove('show'); res(true); };
      });
    },
    /** resolves true only if the user earned the reward */
    async rewarded(placement) {
      if (this.busy) return false;
      this.busy = true; OF.track('ad_rewarded_request', { placement });
      try {
        const A = this.plugin();
        if (!A) return await this.fake('rewarded');
        const id = this.ids();
        this.mute(true);
        return await new Promise(async res => {
          let rewarded = false, fin = false; const hs = [];
          const done = () => { if (fin) return; fin = true; hs.forEach(h => { try { h.remove(); } catch (e) {} }); res(rewarded); };
          try {
            hs.push(await A.addListener('onRewardedVideoAdReward', () => { rewarded = true; }));
            hs.push(await A.addListener('onRewardedVideoAdDismissed', () => setTimeout(done, 150)));
            hs.push(await A.addListener('onRewardedVideoAdFailedToShow', done));
            await A.prepareRewardVideoAd({ adId: id.rewarded, isTesting: id.testing });
            await A.showRewardVideoAd();
            setTimeout(done, 90000); // safety net
          } catch (e) { console.warn('rewarded failed', e); OF.toast('No ad available right now – try again soon'); done(); }
        });
      } finally { this.mute(false); this.busy = false; }
    },
    async interstitial() {
      const d = Save.d;
      if (d.adsRemoved || this.busy) return false;
      const now = Date.now();
      d.runsSinceAd++;
      if (d.runs < OF.CFG.firstInterstitialAfterRuns) { Save.write(); return false; }
      if (d.runsSinceAd < OF.CFG.interstitialEveryRuns || now - d.lastInterstitial < OF.CFG.interstitialMinGapMs) { Save.write(); return false; }
      d.runsSinceAd = 0; d.lastInterstitial = now; Save.write();
      this.busy = true;
      try {
        const A = this.plugin();
        if (!A) return await this.fake('interstitial');
        const id = this.ids();
        this.mute(true);
        try { await A.prepareInterstitial({ adId: id.interstitial, isTesting: id.testing }); await A.showInterstitial(); return true; }
        catch (e) { return false; }
      } finally { this.mute(false); this.busy = false; this.preload(); }
    },
  };

  /* ---------------- PURCHASES ----------------
     Web build simulates purchases. For release plug in cordova-plugin-purchase
     (free) inside OF.iap.buy and keep the grant() logic below. */
  OF.iap = {
    grant(id) {
      const d = Save.d, p = OF.PRODUCTS.find(x => x.id === id); if (!p) return false;
      if (p.once && ((id === 'starter' && d.starterBought) || (id === 'noads' && d.adsRemoved))) return false;
      if (p.gems) Save.addGems(p.gems);
      if (id === 'starter') { d.starterBought = true; Save.addCoins(1500); Save.addGems(60); if (!d.ownedSkins.includes('gold')) d.ownedSkins.push('gold'); }
      if (id === 'noads') d.adsRemoved = true;
      Save.write(); OF.onWallet && OF.onWallet();
      OF.track && OF.track('iap', { id });
      return true;
    },
    async buy(id) {
      const ok = await (OF.confirmPurchase ? OF.confirmPurchase(id) : Promise.resolve(true));
      return ok ? this.grant(id) : false;
    },
  };

  /* ---------------- RETENTION REMINDERS (local notifications, native only) ---------------- */
  OF.notify = {
    plugin() { return window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform() && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications; },
    async ask() {
      const N = this.plugin(), d = Save.d; if (!N || d.notifAsked) return;
      d.notifAsked = true;
      try { const p = await N.requestPermissions(); d.notifOn = p.display === 'granted'; } catch (e) { /* ignore */ }
      Save.write(); this.refresh();
    },
    async refresh() {
      const N = this.plugin(), d = Save.d; if (!N || !d.notifOn) return;
      try {
        await N.cancel({ notifications: [{ id: 1 }, { id: 2 }, { id: 3 }] });
        const list = [], now = Date.now();
        const wheelAt = d.wheel.last + OF.CFG.wheelCooldownMs;
        if (d.wheel.last && wheelAt > now) list.push({ id: 1, title: '🎡 Free spin ready!', body: 'Your lucky wheel is waiting – come win gems!', schedule: { at: new Date(wheelAt) } });
        const t = new Date(); t.setDate(t.getDate() + 1); t.setHours(10, 30, 0, 0);
        list.push({ id: 2, title: '🎁 Daily reward', body: 'Claim today\'s reward and keep your streak alive!', schedule: { at: t } });
        const u = new Date(now + 3 * 86400000); u.setHours(19, 0, 0, 0);
        list.push({ id: 3, title: '🔵 Your orbs miss you', body: 'New daily challenge is live. Can you beat the boss?', schedule: { at: u } });
        await N.schedule({ notifications: list });
      } catch (e) { console.warn('notify', e); }
    },
  };

  /* ---------------- ANALYTICS STUB ---------------- */
  OF.track = function (name, params) {
    if (OF.debug) console.log('[track]', name, params || '');
    /* hook Firebase Analytics here later */
  };
})(window.OF);
