// Renders app icon + splash PNGs into resources/ using headless Chromium.  node tools/make-icons.js
const { chromium } = require('playwright');
const fs = require('fs');
function draw(kind) {
  const S = kind === 'splash' ? 2732 : 1024;
  const c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
  const k = S / 1024, cx = S / 2, cy = S / 2;
  if (kind !== 'fg') {
    const gr = g.createLinearGradient(0, 0, 0, S);
    gr.addColorStop(0, kind === 'bg' ? '#1a2160' : '#141a55'); gr.addColorStop(1, '#05061a');
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
  }
  if (kind === 'bg') return c.toDataURL();
  const scale = kind === 'fg' ? 0.72 : kind === 'splash' ? 0.42 : 1;
  g.save(); g.translate(cx, cy); g.scale(scale * k, scale * k); g.translate(-512, -512);
  if (kind === 'icon' || kind === 'splash') { // pegs
    const pegs = [[200, 240, '#5aa9ff'], [512, 200, '#ff4d6d'], [824, 240, '#ffd23f'], [350, 420, '#5aa9ff'], [674, 420, '#5aa9ff'], [200, 600, '#ffd23f'], [824, 600, '#5aa9ff'], [512, 640, '#b266ff']];
    for (const [x, y, col] of pegs) {
      const r = g.createRadialGradient(x, y, 0, x, y, 70); r.addColorStop(0, col + 'aa'); r.addColorStop(1, col + '00');
      g.fillStyle = r; g.fillRect(x - 70, y - 70, 140, 140);
      g.fillStyle = col; g.beginPath(); g.arc(x, y, 26, 0, 7); g.fill();
    }
  }
  // trail
  const tr = g.createLinearGradient(512, 80, 512, 560); tr.addColorStop(0, 'rgba(110,231,255,0)'); tr.addColorStop(1, 'rgba(110,231,255,.55)');
  g.fillStyle = tr; g.beginPath(); g.moveTo(470, 80); g.lineTo(554, 80); g.lineTo(580, 560); g.lineTo(444, 560); g.fill();
  // orb
  const gl = g.createRadialGradient(512, 600, 0, 512, 600, 330); gl.addColorStop(0, 'rgba(110,231,255,.8)'); gl.addColorStop(1, 'rgba(110,231,255,0)');
  g.fillStyle = gl; g.fillRect(100, 200, 824, 824);
  const o = g.createRadialGradient(440, 520, 20, 512, 600, 190); o.addColorStop(0, '#fff'); o.addColorStop(0.35, '#6ee7ff'); o.addColorStop(1, '#2b5cff');
  g.fillStyle = o; g.beginPath(); g.arc(512, 600, 190, 0, 7); g.fill();
  g.restore();
  return c.toDataURL();
}
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const p = await b.newPage();
  for (const [kind, file] of [['icon', 'icon-only.png'], ['fg', 'icon-foreground.png'], ['bg', 'icon-background.png'], ['splash', 'splash.png'], ['splash', 'splash-dark.png']]) {
    const url = await p.evaluate(`(${draw.toString()})('${kind}')`);
    fs.writeFileSync(__dirname + '/../resources/' + file, Buffer.from(url.split(',')[1], 'base64'));
    console.log('wrote', file);
  }
  await b.close();
})();
