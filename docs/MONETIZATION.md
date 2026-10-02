# Orbfall – Monetization & the 10 lakh/month goal

## Honest expectations
No game can *guarantee* ₹10,00,000/month (~US$12,000). It is achievable by hit hyper-casual/casual titles, but it
depends on **user acquisition + retention**, not only on the game. This build maximises the part we control:
retention hooks and ad/IAP placements that don't annoy players.

Rough math (use as a planning model, tune with real data):
* Rewarded video eCPM: India ≈ $4–8, US/EU ≈ $15–40. Interstitial eCPM: India ≈ $1–3, tier‑1 ≈ $8–15.
* Orbfall shows ~3–5 rewarded + ~1–2 interstitial impressions per DAU per day at healthy engagement
  → ARPDAU ≈ **$0.04–0.06 (India-heavy)** … **$0.15–0.30 (tier‑1 mix)**, plus IAP ≈ 1.5–3 % payers.
* ₹10 L ≈ $12k/month ≈ $400/day → roughly **8,000–10,000 DAU at tier‑1 ARPDAU**, or **70,000–100,000 DAU India‑only**.
* So the real job after launch: get installs (organic/ASO, short-form video ads, creators), watch D1/D7 retention
  (targets: D1 ≥ 40 %, D7 ≥ 12 %), and tune.

## Revenue streams built in
| Stream | Where | Notes |
|---|---|---|
| Rewarded video | Revive (+2 orbs) · Double coins at run end · Card reroll · 4th upgrade card · Wheel extra spins · Daily reward ×2 · Free gems (3/day) | Always opt-in; biggest earner |
| Interstitial | Between runs (not first 3 runs, ≥ 100 s apart, every 2nd run) | Removed by "Orbfall Plus" |
| IAP | Starter Pack (one-time), Orbfall Plus (no pop-up ads, +50 % coins), gem packs | Gems buy revives & premium skins/themes |
| Cosmetics | Orb skins & themes (coins or gems) | Pure sink, no pay-to-win |

## Retention loops
* Short run (3–6 min), always "one more run" – near-miss revive prompt.
* Roguelite upgrade picks → build variety. Boss every 5 stages.
* Permanent upgrades give constant progress; skins give goals.
* Daily reward streak (7 days) · Daily challenge · Daily missions · Free wheel every 20 h. (Add push notifications for these after launch.)

## Where to tune (all in `www/js/data.js`)
`CFG` (orbs, ad frequency, caps), `targetFor` (difficulty curve), `UPGRADES`, `META` costs, `PRODUCTS`, `WHEEL`, `DAILY_REWARDS`.
Test with `node tools/balance-sim.js` (random-aim bot): the stage-clear median should be ~4–6 for a new player, rising with meta upgrades.

## Next growth steps (post-launch)
1. Soft-launch in 2–3 countries, watch D1/D7, ad impressions/DAU, ARPDAU.
2. Firebase Analytics + Remote Config (hook is `OF.track` in `services.js`).
3. Google Play Games leaderboards, seasonal events, more themes, rewarded "mega‑wheel" weekends.
4. Localise (Hindi + top languages) – game is almost text‑free.
