/* ORBFALL – bootstrap */
(function (OF) {
  const app = document.getElementById('app');
  const game = OF.game = new OF.Game(document.getElementById('cv'));
  OF.ui.init(game);

  function fit() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const { cssW, cssH } = game.layout(vw, vh);
    app.style.width = cssW + 'px'; app.style.height = cssH + 'px';
    app.style.fontSize = Math.max(11, cssW / 540 * 20) + 'px';
  }
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', () => setTimeout(fit, 150));
  fit();

  OF.ads.init();
  OF.notify.refresh();
  // Android hardware back button
  try {
    const App = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
    if (App && App.addListener) App.addListener('backButton', () => {
      if (OF.ui.sheetOpen) { const b = document.querySelector('#sheet [data-act=close],#sheet [data-act=resume],#sheet [data-act=toHome]'); if (b) b.click(); return; }
      if (game.run && !game.attract) return OF.ui.act.pause();
      if (App.exitApp) App.exitApp();
    });
  } catch (e) { /* ignore */ }
  OF.ui.home();
  game.startAttract();
  OF.ui.maybeDailyReward();

  function loop(ts) { game.frame(ts); requestAnimationFrame(loop); }
  requestAnimationFrame(loop);

  document.addEventListener('visibilitychange', () => { if (document.hidden && game.run && !game.attract && !game.paused && !OF.ui.sheetOpen) OF.ui.act.pause(); });
  document.addEventListener('contextmenu', e => e.preventDefault());
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
})(window.OF);
