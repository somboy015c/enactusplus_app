# Enactus NG – Android app

Wraps the Enactus admin dashboard in a native Android app (Capacitor) with an animated splash screen
(the same spinner as the website), a 3-slide onboarding on first launch, and an offline/retry screen.
Everything is built by GitHub Actions – you never run a command.

## Set up (once, in the browser only)
1. Create a **private** GitHub repository and upload the *contents* of this folder (unzip first; make sure the `.github` folder is included).
2. Open `app.config.json` on GitHub → ✏️ edit → check that `"adminUrl"` is `https://admin.enactus.org.ng` → Commit only if you change it.
3. Open the **Actions** tab. The build starts automatically on every commit (or press *Run workflow*). It takes about 8–12 minutes.
4. When it finishes, open **Releases**: **EnactusNG.apk** is attached. Download it on the phone and install.

## Customising
- Splash background: replace `www/img/splash-bg.jpg` (same file name). App icon / native splash: replace the PNGs in `branding/`.
- Onboarding text: `www/index.html` (search for `<h2>`).
- Colours / buttons: `www/style.css`.

## Notes
- Keep the repository **private**: `signing/enactus.keystore` is the key that signs your APK. Every release uses the same key, so new versions install over old ones.
- The dashboard is a live PHP site, so the app needs an internet connection.
