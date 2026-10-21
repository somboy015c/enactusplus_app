// Reads the dashboard address and writes it into the app. Runs automatically in GitHub Actions.
import fs from 'node:fs';
const outDir = process.argv[2] || 'src';
const cfg = JSON.parse(fs.readFileSync('app.config.json', 'utf8'));
const url = (process.env.ADMIN_URL || cfg.adminUrl || '').trim().replace(/\/+$/, '');
let host;
try { const u = new URL(url); if (u.protocol !== 'https:') throw new Error('must start with https://'); host = u.host; }
catch (e) { console.error(`\n❌ Invalid dashboard address "${url}": ${e.message}\n   Edit app.config.json and set "adminUrl" to your real dashboard address.\n`); process.exit(1); }
if (/yourdomain|example\.com/i.test(host)) {
  console.error('\n❌ app.config.json still contains the placeholder address.\n   Open app.config.json on GitHub, set "adminUrl" to your real dashboard (e.g. https://admin.enactus.ng) and commit.\n');
  process.exit(1);
}
fs.writeFileSync(`${outDir}/config.js`, `window.APP_CONFIG=${JSON.stringify({ adminUrl: url, device: cfg.device || 'phone' })};\n`);
if (fs.existsSync('capacitor.config.json')) {
  const c = JSON.parse(fs.readFileSync('capacitor.config.json', 'utf8'));
  c.server = { ...(c.server || {}), allowNavigation: [host] };
  fs.writeFileSync('capacitor.config.json', JSON.stringify(c, null, 2) + '\n');
}
console.log(`✅ Dashboard address set to ${url}`);
