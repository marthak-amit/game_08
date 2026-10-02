/* ORBFALL – static game data & tuning */
(function (OF) {
  OF.CFG = {
    baseOrbs: 5,
    baseNudges: 2,
    slotMults: [4, 2, 1, 3, 1, 2, 4],
    targetBase: 450,
    targetGrow: 1.38,
    bossEvery: 5,
    dailyStages: 3,
    reviveGems: 8,
    interstitialEveryRuns: 2,
    interstitialMinGapMs: 100000,
    firstInterstitialAfterRuns: 3,
    wheelCooldownMs: 20 * 3600 * 1000,
    maxAdSpinsPerDay: 3,
    maxAdGemsPerDay: 3,
  };

  OF.targetFor = function (stage, mode) {
    let t = OF.CFG.targetBase * Math.pow(OF.CFG.targetGrow, stage - 1);
    if (stage % OF.CFG.bossEvery === 0) t *= 1.2;
    if (mode === 'daily') t *= 0.9;
    return Math.round(t / 10) * 10;
  };

  /* In-run upgrade cards (the roguelite layer) */
  OF.UPGRADES = [
    { id: 'pouch',  name: 'Orb Pouch',     icon: '🎒', rarity: 'rare',   max: 2, desc: '+1 orb every stage.' },
    { id: 'blast',  name: 'Blast Start',   icon: '💥', rarity: 'common', max: 3, desc: 'Your orb explodes on its first peg. Bigger blast per level.' },
    { id: 'chain',  name: 'Chain Bolt',    icon: '⚡', rarity: 'common', max: 3, desc: 'Every 4th hit zaps 2 more pegs per level.' },
    { id: 'gold',   name: 'Gold Fever',    icon: '🪙', rarity: 'common', max: 3, desc: 'Gold pegs: x2 points, +1 coin, and more of them appear.' },
    { id: 'slot',   name: 'Jackpot Slots', icon: '🎰', rarity: 'epic',   max: 3, desc: '+1 to every slot multiplier.' },
    { id: 'split',  name: 'Twin Split',    icon: '🔀', rarity: 'epic',   max: 2, desc: 'Orb splits in two after 6 hits (4 at level 2).' },
    { id: 'magnet', name: 'Red Magnet',    icon: '🧲', rarity: 'rare',   max: 3, desc: 'Your orb is pulled toward red pegs.' },
    { id: 'nudge',  name: 'Nudge Pack',    icon: '👆', rarity: 'common', max: 3, desc: '+2 nudges every stage.' },
    { id: 'combo',  name: 'Combo Master',  icon: '🔥', rarity: 'common', max: 3, desc: 'Each hit adds 50% more combo bonus per level.' },
    { id: 'heavy',  name: 'Big Orb',       icon: '🔮', rarity: 'common', max: 2, desc: 'Bigger orb touches more pegs.' },
    { id: 'edge',   name: 'Edge Lord',     icon: '🎯', rarity: 'rare',   max: 2, desc: 'Edge slots get +2 multiplier per level.' },
    { id: 'second', name: 'Second Chance', icon: '♻️', rarity: 'epic',   max: 2, desc: 'Landing in a x1 slot refunds the orb (once per level, per stage).' },
    { id: 'fortune',name: 'Fortune',       icon: '🍀', rarity: 'common', max: 3, desc: '+25% coins from everything.' },
  ];
  OF.UP = {}; OF.UPGRADES.forEach(u => OF.UP[u.id] = u);
  OF.RARITY = {
    common: { w: 60, color: '#6ee7ff', label: 'COMMON' },
    rare:   { w: 28, color: '#c084fc', label: 'RARE' },
    epic:   { w: 12, color: '#ffb340', label: 'EPIC' },
  };

  /* Permanent (meta) upgrades bought with coins */
  OF.META = [
    { id: 'orbs',   name: 'Extra Orb',     icon: '🔵', max: 3,  base: 300, grow: 3.0, desc: l => `+${l} orb at the start of every stage` },
    { id: 'coin',   name: 'Coin Magnet',   icon: '🪙', max: 10, base: 100, grow: 1.55, desc: l => `+${l * 10}% coins from every run` },
    { id: 'peg',    name: 'Peg Power',     icon: '💎', max: 10, base: 150, grow: 1.55, desc: l => `+${l * 6}% points from pegs` },
    { id: 'nudge',  name: 'Steady Hands',  icon: '👆', max: 5,  base: 120, grow: 1.9, desc: l => `+${l} nudge per stage` },
    { id: 'start',  name: 'Head Start',    icon: '🎁', max: 3,  base: 400, grow: 3.0, desc: l => `Begin each run with ${l} random upgrade${l > 1 ? 's' : ''}` },
    { id: 'reroll', name: 'Lucky Reroll',  icon: '🎲', max: 3,  base: 250, grow: 2.6, desc: l => `${l} free card reroll${l > 1 ? 's' : ''} per run` },
  ];
  OF.metaCost = (m, lvl) => Math.round(m.base * Math.pow(m.grow, lvl) / 10) * 10;

  /* Cosmetics */
  OF.SKINS = [
    { id: 'cyan',    name: 'Aqua Pulse',  c1: '#6ee7ff', c2: '#2b8cff', price: 0,    cur: 'coins' },
    { id: 'magenta', name: 'Hot Pink',    c1: '#ff7ad9', c2: '#d4119e', price: 600,  cur: 'coins' },
    { id: 'lime',    name: 'Toxic Lime',  c1: '#d4ff6e', c2: '#3ec21d', price: 1200, cur: 'coins' },
    { id: 'gold',    name: 'Solar Gold',  c1: '#fff2a8', c2: '#ffb300', price: 3000, cur: 'coins' },
    { id: 'ember',   name: 'Ember',       c1: '#ffd0a0', c2: '#ff4d1a', price: 40,   cur: 'gems' },
    { id: 'ghost',   name: 'Ghost',       c1: '#ffffff', c2: '#9aa7c7', price: 60,   cur: 'gems' },
    { id: 'rainbow', name: 'Prism',       c1: 'rainbow', c2: 'rainbow', price: 120, cur: 'gems' },
    { id: 'void',    name: 'Void Star',   c1: '#c9a7ff', c2: '#2a0a6b', price: 200,  cur: 'gems' },
  ];
  OF.THEMES = [
    { id: 'night',  name: 'Midnight',  bg1: '#0d1236', bg2: '#05061a', peg: '#5aa9ff', star: '#9fb4ff', price: 0,    cur: 'coins' },
    { id: 'sunset', name: 'Sunset',    bg1: '#3b1259', bg2: '#12051f', peg: '#ff9ad5', star: '#ffc2a0', price: 1500, cur: 'coins' },
    { id: 'forest', name: 'Aurora',    bg1: '#06323a', bg2: '#020e14', peg: '#5dffc0', star: '#a0ffe6', price: 2500, cur: 'coins' },
    { id: 'candy',  name: 'Candy',     bg1: '#4a1747', bg2: '#1a0620', peg: '#ffd966', star: '#ffffff', price: 50,   cur: 'gems' },
    { id: 'void',   name: 'Deep Void', bg1: '#08080c', bg2: '#000000', peg: '#8a8aff', star: '#ffffff', price: 90,   cur: 'gems' },
  ];
  OF.SKIN = {}; OF.SKINS.forEach(s => OF.SKIN[s.id] = s);
  OF.THEME = {}; OF.THEMES.forEach(s => OF.THEME[s.id] = s);

  /* Daily login ladder (7 days, loops) */
  OF.DAILY_REWARDS = [
    { coins: 100 }, { coins: 200 }, { gems: 3 }, { coins: 400 }, { coins: 600 }, { gems: 6 }, { coins: 1500, gems: 15 },
  ];

  /* Lucky wheel */
  OF.WHEEL = [
    { label: '100',  coins: 100,  color: '#2b8cff' },
    { label: '2 💎', gems: 2,     color: '#a855f7' },
    { label: '250',  coins: 250,  color: '#14b8a6' },
    { label: '500',  coins: 500,  color: '#f59e0b' },
    { label: '5 💎', gems: 5,     color: '#ec4899' },
    { label: '150',  coins: 150,  color: '#22c55e' },
    { label: '1000', coins: 1000, color: '#ef4444' },
    { label: '12 💎',gems: 12,    color: '#eab308' },
  ];
  OF.WHEEL_WEIGHTS = [26, 14, 18, 10, 7, 20, 4, 1];

  /* Mission templates – 3 are picked per day */
  OF.MISSIONS = [
    { id: 'pegs',   text: 'Light up {n} pegs',          type: 'pegs',  n: [150, 250, 400], gems: 2 },
    { id: 'stage',  text: 'Reach stage {n} in one run', type: 'stage', n: [4, 6, 8],       gems: 3 },
    { id: 'coins',  text: 'Collect {n} coins',          type: 'coins', n: [200, 400, 700], gems: 2 },
    { id: 'gold',   text: 'Hit {n} gold pegs',          type: 'gold',  n: [10, 20, 30],    gems: 2 },
    { id: 'bombs',  text: 'Detonate {n} bomb pegs',     type: 'bombs', n: [4, 8, 12],      gems: 2 },
    { id: 'runs',   text: 'Play {n} runs',              type: 'runs',  n: [2, 3, 4],       gems: 2 },
    { id: 'big',    text: 'Land one orb for {n}+ points', type: 'bigorb', n: [400, 800, 1500], gems: 3 },
  ];

  /* Shop (real-money products; prices are placeholders, real ones come from the store) */
  OF.PRODUCTS = [
    { id: 'starter',   name: 'Starter Pack',  desc: '1500 coins + 60 gems + Solar Gold orb', price: '₹149', badge: 'BEST VALUE', once: true },
    { id: 'noads',     name: 'Orbfall Plus',  desc: 'No pop-up ads, forever + 50% coin boost', price: '₹199', once: true },
    { id: 'gems_s',    name: '80 Gems',       desc: 'Small pouch',  price: '₹79',  gems: 80 },
    { id: 'gems_m',    name: '450 Gems',      desc: 'Medium chest (+12% bonus)', price: '₹349', gems: 450, badge: 'POPULAR' },
    { id: 'gems_l',    name: '1100 Gems',     desc: 'Huge vault (+30% bonus)', price: '₹749', gems: 1100 },
  ];
})(window.OF);
