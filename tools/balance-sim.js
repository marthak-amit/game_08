// Balance bot: random-aim player. Usage: npm i -D playwright && node tools/balance-sim.js 40
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  await p.goto('file://' + require('path').resolve(__dirname, '../www/index.html') + '');
  await p.waitForTimeout(500);
  const res = await p.evaluate((N) => {
    const g = OF.game; g.cb = {}; const out = []; const t0 = performance.now();
    for (let n = 0; n < N; n++) {
      g.startRun('normal'); let guard = 0, stage = 0;
      while (guard++ < 5000) {
        if (g.state === 'intro') { g.update(1/60); continue; }
        if (g.state === 'aim') { g.aimX = 60 + Math.random() * 420; g.drop(); continue; }
        if (g.state === 'drop' || g.state === 'settle') {
          if (g.state==='drop' && g.run.nudges>0 && Math.random()<0.01) g.nudge(g.balls[0]? (Math.random()<.5? 0:540):0);
          g.update(1/60); continue; }
        if (g.state === 'clear') {
          stage = g.run.stage;
          const pool = OF.UPGRADES.filter(u => g.m(u.id) < u.max);
          g.addUpgrade(pool[Math.floor(Math.random() * pool.length)].id);
          g.nextStage(); continue;
        }
        if (g.state === 'fail') break;
        g.update(1/60);
      }
      out.push(stage);
    }
    return { out, ms: performance.now() - t0 };
  }, +process.argv[2] || 30);
  const s = res.out.slice().sort((a,b)=>a-b);
  console.log('stages cleared per run:', s.join(','), 'median', s[s.length>>1], 'ms', Math.round(res.ms));
  console.log(errs.join('\n') || 'no errors');
  await b.close();
})();
