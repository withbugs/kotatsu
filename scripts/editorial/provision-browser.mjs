import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const testRequire = createRequire(require.resolve('@playwright/test'));
const playwrightRequire = createRequire(testRequire.resolve('playwright'));
const core = playwrightRequire.resolve('playwright-core/package.json');
const browsers = JSON.parse(fs.readFileSync(core.replace('package.json','browsers.json'),'utf8')).browsers;
if (JSON.parse(fs.readFileSync(testRequire.resolve('playwright/package.json'),'utf8')).version !== '1.61.1'
    || !browsers.some(b => b.name === 'chromium' && b.revision === '1228' && b.browserVersion === '149.0.7827.55')) {
  throw new Error('Browser policy changed; review lockfile and pinned provisioning before continuing');
}
if (process.env.PLAYWRIGHT_BROWSERS_PATH !== '/workspace/.onboarding/kotatsu/playwright-browsers') throw new Error('set the documented browser cache');
for (const name of ['PLAYWRIGHT_DOWNLOAD_HOST','PLAYWRIGHT_CHROMIUM_DOWNLOAD_HOST','PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD']) {
  if (process.env[name]) throw new Error(`unsupported browser provisioning override: ${name}`);
}
const installed = spawnSync('pnpm',['exec','playwright','install','chromium'],{stdio:'inherit'});
if (installed.error || installed.status !== 0) throw new Error('Official browser provisioning failed; stop without mirror or repeated retry');
const { chromium } = testRequire('playwright');
const browser = await chromium.launch();
try { if (browser.version() !== '149.0.7827.55') throw new Error('unexpected browser runtime'); }
finally { await browser.close(); }
console.log('Playwright 1.61.1 / Chromium revision1228 / runtime149.0.7827.55 launch verified');
