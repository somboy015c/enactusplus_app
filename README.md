# EnactusNG Plus – Android app

A real app with its own screens (splash with the web spinner, 3-slide welcome, timeline, connect, messages, projects…).
It does **not** load the website: the interface is inside the app and only the data comes from your Plus server.
Everything is built by GitHub Actions – you never run a command.

## Set up (once, in the browser only)
1. Create a **private** GitHub repository and upload the *contents* of this folder (include the hidden `.github` folder).
2. Open `app.config.json`: `plusUrl` is `https://plus.enactus.org.ng`. Change it only if your Plus address is different.
3. Open the **Actions** tab – the build starts automatically (about 8–12 minutes).
4. Open **Releases**: **EnactusNGPlus.apk**.

## Customising
- Splash background: `www/assets/img/splash-bg.jpg`. App icon / native splash: PNGs in `branding/`. Colours and buttons: `www/assets/native.css`.
- Welcome slides: `www/index.html` (search for `b-slide`).
- When you update `app.js` / `plus.css` on the website, copy the new files into `www/assets/`.

## Notes
- Keep the repository **private**: `signing/plus.keystore` signs your APK (same key every release, so updates install over old versions).

## Icon, logo and welcome slides
- The app icon, splash and logo were made from your uploaded Plus favicon and logo. To change them replace `branding/*.png` and `www/assets/img/logo.png` / `favicon.png`.
- The 3 welcome slides load **live from your server** (Site settings → EnactusNG Plus → sign-in slides: picture, headline, text), so changing them on the website changes the app. If the phone is offline on first launch, built-in illustrations are shown instead.
