# 🔵 ORBFALL — Drop. Bounce. Multiply.

A roguelite peg-drop game for mobile (portrait, one-thumb). Built with plain HTML5 Canvas + JS
(zero dependencies, zero asset files) and packaged to Android/iOS with free **Capacitor**.

## The game
* Aim and drop glowing orbs into a field of pegs. Every peg builds a **combo tally**; the **slot** you land in multiplies it.
* **Nudge** mid-fall to steer into a big multiplier (limited per stage).
* Hit the **stage goal** to advance. After each stage pick **1 of 3 upgrade cards** (13 upgrades, 3 rarities, stackable) – every run plays differently.
* Special pegs: 🟡 gold (coins), 🔴 red (high value), 💣 bomb (area blast), 🟣 bumper (bouncy, indestructible).
* Boss stage every 5th stage. Procedurally generated boards (hex, rows, rings, diamond, scatter).
* Meta-game: permanent upgrades, orb skins, board themes, daily login streak, **daily challenge** (same board for everyone), 3 **daily missions**, **lucky wheel**.

## Run it
```bash
npm start            # http://localhost:8080  (or just open www/index.html)
```
Desktop testing keys: ←/→ aim, Space drop / nudge.

## Build the Android app (free)
```bash
npm install
npx cap add android
npm run android:debug     # -> android/app/build/outputs/apk/debug/app-debug.apk
```
A GitHub Action (`.github/workflows/android.yml`) builds the debug APK on every push.
See **docs/LAUNCH.md** for Play Store release, AdMob, IAP and consent steps and
**docs/MONETIZATION.md** for the revenue plan and honest numbers.

## Code map
| file | what |
|---|---|
| `www/js/game.js` | board generation, physics, scoring, effects, rendering |
| `www/js/data.js` | **all tuning**: targets, upgrades, shop, rewards |
| `www/js/ui.js` | menus, run flow, meta-game screens |
| `www/js/services.js` | save, audio (synth), haptics, **ads + IAP adapters** |
