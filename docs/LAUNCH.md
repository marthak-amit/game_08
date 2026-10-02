# Launch checklist (things you provide later)

1. **Package id / name** – edit `capacitor.config.json` (`appId`, `appName`).
2. **AdMob** – create app + units, then
   * set real ids in `OF.AD_IDS` (`www/js/services.js`) and `testing:false`,
   * add the AdMob **App ID** meta-data to `android/app/src/main/AndroidManifest.xml`
     (see `@capacitor-community/admob` README),
   * add Google **UMP consent** form before first ad (required in EU/UK; recommended everywhere).
   The adapter in `OF.ads` already calls `prepareRewardVideoAd/showRewardVideoAd/prepareInterstitial/showInterstitial` –
   verify method names against the plugin version you install.
3. **In-app purchases** – install `cordova-plugin-purchase`, register products with the ids in `OF.PRODUCTS`
   (`starter`, `noads`, `gems_s`, `gems_m`, `gems_l`), and call `OF.iap.grant(id)` from the store's *approved* callback.
   The web build only simulates purchases.
4. **Icon & splash** – put a 1024² icon in `resources/` and run `npx @capacitor/assets generate`.
5. **Privacy policy URL** (required for ads/IAP) and Data Safety form in Play Console.
6. **Signing** – create a keystore (never commit it), build `npm run android:release` → upload the `.aab`.
7. Replace the placeholder `₹` prices with store-provided prices at runtime.

Status: the game, economy, UI, audio, and ad/IAP *flows* are complete and tested in a browser;
the native Android build, real ads and real purchases are **not yet verified on a device**.
