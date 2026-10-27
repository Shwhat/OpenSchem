// OpenSchem test runner.
// Assembles ui/ into one page (same as the exe does), opens it in headless Chromium and runs every suite.
// Usage: npm test            (all suites)
//        npm test -- floor   (only suites whose file name contains "floor")
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { createRequire } from 'module';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const require = createRequire(import.meta.url);
function loadPlaywright() {
  for (const p of ['playwright', '/opt/npm-tools/node_modules/playwright']) { try { return require(p); } catch (e) {} }
  console.error('Playwright is not installed. Run: npm install'); process.exit(2);
}
const { chromium } = loadPlaywright();

class Tester {
  constructor(page, root, url) { this.page = page; this.root = root; this.url = url; this.promptAnswer = 'X'; }
  async open(hash = '') { await this.page.goto(this.url + hash); await this.page.waitForFunction(() => typeof P !== 'undefined' && P && P.pages); await this.page.waitForTimeout(150); }
  eval(fn, arg) { return this.page.evaluate(fn, arg); }
  eq(actual, expected, msg = '') {
    const a = JSON.stringify(actual), e = JSON.stringify(expected);
    if (a !== e) throw new Error(`${msg}\n  expected ${e}\n  got      ${a}`);
  }
  ok(v, msg = 'expected true') { if (!v) throw new Error(msg); }
  // screen position of sheet coordinates (mm) on the current page; floor pages use plan coordinates
  scr(x, y) {
    return this.page.evaluate(([x, y]) => {
      const pg = page(); const s = isFloor(pg) ? toSheet(pg, x, y) : [x, y];
      const r = svg.getBoundingClientRect(); return [r.left + (s[0] - view.x) * view.s, r.top + (s[1] - view.y) * view.s];
    }, [x, y]);
  }
  async click(x, y) { const [a, b] = await this.scr(x, y); await this.page.mouse.click(a, b); }
  async drag(x1, y1, x2, y2) {
    const [a, b] = await this.scr(x1, y1); await this.page.mouse.move(a, b); await this.page.mouse.down();
    const [c, d] = await this.scr(x2, y2); await this.page.mouse.move(c, d, { steps: 6 }); await this.page.mouse.up();
  }
  key(k) { return this.page.keyboard.press(k); }
  // press the dialog's main button and wait until its close handler has run
  async confirm() { await this.page.click('#dlgbtns .primary'); await this.page.waitForFunction(() => !$('#dlg').open); await this.page.waitForTimeout(30); }
  async enter() { await this.key('Enter'); await this.page.waitForFunction(() => !$('#dlg').open); await this.page.waitForTimeout(30); }
  goPage(name) { return this.page.evaluate(n => { const p = allPages().find(x => pageName(x) === n); if (!p) throw new Error('no page ' + n); goPage(p.id); zoomFit(); }, name); }
}

export function assemble() {
  const ui = n => fs.readFileSync(path.join(ROOT, 'ui', n), 'utf8');
  const names = ui('manifest.txt').split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('#'));
  const js = names.map(ui).join('\n').replace(/<\/script/g, '<\\/script').replace(/<script/g, '<\\x73cript');
  return ui('index.html').replace('/*CSS*/', ui('style.css')).replace('/*JS*/', () => js);
}

const out = path.join(ROOT, 'build', 'test.html');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, assemble());
const URL = pathToFileURL(out).href;

const filter = process.argv[2] || '';
const dir = path.join(ROOT, 'tests', 'suites');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.mjs') && f.includes(filter)).sort();

const browser = await chromium.launch();
let pass = 0, fail = 0;
const failures = [];
for (const f of files) {
  const suite = await import(pathToFileURL(path.join(dir, f)).href);
  for (const [name, fn] of Object.entries(suite.tests)) {
    const ctx = await browser.newContext({ viewport: { width: 1500, height: 900 }, acceptDownloads: true });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('dialog', d => (d.type() === 'prompt' ? d.accept(t.promptAnswer) : d.accept()));
    const t = new Tester(page, ROOT, URL);
    try {
      await fn(t);
      if (errors.length) throw new Error('page error: ' + errors.join(' | '));
      pass++; process.stdout.write(`  ok    ${f.replace('.mjs', '')}: ${name}\n`);
    } catch (e) {
      fail++; failures.push(`${f}: ${name}\n        ${e.message.split('\n').join('\n        ')}`);
      process.stdout.write(`  FAIL  ${f.replace('.mjs', '')}: ${name}\n`);
    }
    await ctx.close();
  }
}
await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
if (failures.length) { console.log('\nFailures:\n  ' + failures.join('\n  ')); process.exit(1); }
