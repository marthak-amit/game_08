#!/usr/bin/env node
/* Patches the generated android/ project (run after `npx cap add android`). Idempotent.
   Env: ADMOB_ANDROID_APP_ID (default: value in www/js/config.js = Google TEST id)
        KEYSTORE_PATH, KEYSTORE_PASSWORD, KEY_ALIAS, KEY_PASSWORD  -> enables signed release builds */
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..'), android = path.join(root, 'android');
if (!fs.existsSync(android)) { console.error('android/ not found – run `npx cap add android` first'); process.exit(1); }

const cfg = fs.readFileSync(path.join(root, 'www/js/config.js'), 'utf8');
const m = cfg.match(/android:\s*{\s*appId:\s*'([^']+)'/);
const appId = process.env.ADMOB_ANDROID_APP_ID || (m && m[1]);
if (!appId) throw new Error('No AdMob Android app id found');

// 1. AndroidManifest
const mf = path.join(android, 'app/src/main/AndroidManifest.xml');
let x = fs.readFileSync(mf, 'utf8');
if (!x.includes('gms.ads.APPLICATION_ID')) {
  x = x.replace('</application>', '    <meta-data android:name="com.google.android.gms.ads.APPLICATION_ID" android:value="@string/admob_app_id"/>\n    </application>');
}
for (const perm of ['com.google.android.gms.permission.AD_ID', 'android.permission.VIBRATE', 'android.permission.POST_NOTIFICATIONS', 'android.permission.INTERNET', 'android.permission.ACCESS_NETWORK_STATE']) {
  if (!x.includes(perm)) x = x.replace('</manifest>', `    <uses-permission android:name="${perm}"/>\n</manifest>`);
}
if (!x.includes('android:screenOrientation')) x = x.replace('<activity', '<activity\n            android:screenOrientation="portrait"');
fs.writeFileSync(mf, x);

// 2. strings.xml (admob app id)
const sf = path.join(android, 'app/src/main/res/values/strings.xml');
let s = fs.readFileSync(sf, 'utf8');
s = s.replace(/\s*<string name="admob_app_id">[^<]*<\/string>/, '');
s = s.replace('</resources>', `    <string name="admob_app_id">${appId}</string>\n</resources>`);
fs.writeFileSync(sf, s);

// 3. optional release signing
if (process.env.KEYSTORE_PATH) {
  const bg = path.join(android, 'app/build.gradle');
  let b = fs.readFileSync(bg, 'utf8');
  if (!b.includes('signingConfigs')) {
    const sc = `    signingConfigs {
        release {
            storeFile file(System.getenv("KEYSTORE_PATH"))
            storePassword System.getenv("KEYSTORE_PASSWORD")
            keyAlias System.getenv("KEY_ALIAS")
            keyPassword System.getenv("KEY_PASSWORD")
        }
    }
`;
    const i = b.indexOf('    buildTypes {');
    let tail = b.slice(i).replace(/(release \{\n)/, '$1            signingConfig signingConfigs.release\n');
    b = b.slice(0, i) + sc + tail;
    fs.writeFileSync(bg, b);
  }
}
console.log('android project patched (AdMob app id: ' + appId + ')');
