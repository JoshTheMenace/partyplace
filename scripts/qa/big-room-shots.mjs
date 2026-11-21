/**
 * Big-roster shell check on a running QA build (`npm run build:isolated -- <run> --3d`, which registers Crowd Lab).
 * One real host display, one real phone and socket bots for the rest walk the shell from an over-full lobby to results,
 * saving a screenshot and layout metrics for each state.
 *
 *   PLAYWRIGHT_CORE=<dir containing playwright-core> node scripts/qa/big-room-shots.mjs --port 4401 --players 32 --out output/platform-cap/32
 *
 * Steps: Ichi (seats 10) with the whole room present, a round the extra people watch, the picker, Crowd Lab (seats 64) with
 * waiting, disconnected and removed seats, then a full round and its results. report.json lists horizontal overflow, the
 * roster count and where the primary button sits in each shot.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { parseArgs } from 'node:util';

const { values: args } = parseArgs({ options: { port: { type: 'string' }, players: { type: 'string', default: '32' }, out: { type: 'string' } } });
const total = Number(args.players), out = args.out ?? `output/platform-cap/${total}`, base = `http://localhost:${args.port}`;
if (!args.port || !process.env.PLAYWRIGHT_CORE || !(total >= 12 && total <= 64)) throw new Error('Usage: PLAYWRIGHT_CORE=<dir> node scripts/qa/big-room-shots.mjs --port <port> --players <12-64> [--out <dir>]');
const { chromium } = createRequire(`${process.env.PLAYWRIGHT_CORE}/`)('playwright-core');
mkdirSync(out, { recursive: true });
const report = { base, players: total, shots: [], errors: [] }, children = [];
const bots = (count, offset, ...extra) => { const child = spawn(process.execPath, ['--import', 'tsx', 'scripts/qa/room-bots.ts', '--port', args.port, '--code', code, '--players', String(count), '--offset', String(offset), '--input', '{"x":0.7,"y":1}', ...extra], { stdio: 'ignore' }); children.push(child); return child; };
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let code = '';
async function open(label, viewport, mobile) {
  const page = await (await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 })).newPage();
  page.setDefaultTimeout(90000);
  page.on('pageerror', error => report.errors.push(`${label}: ${error.message}`));
  return page;
}
/** Screenshot plus the facts a picture cannot prove: sideways overflow, anything clipped off the right edge, and the main button's place. */
async function shot(page, name, { button, fullPage = false } = {}) {
  await page.evaluate(() => { scrollTo(0, 0); return new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))); });
  const metrics = await page.evaluate(label => {
    const root = document.documentElement, wide = [...document.querySelectorAll('main *')].filter(node => node.getClientRects().length && node.getBoundingClientRect().right > root.clientWidth + 1 && getComputedStyle(node).position !== 'fixed').length;
    const target = label && [...document.querySelectorAll('button')].find(node => node.textContent.trim() === label), box = target?.getBoundingClientRect();
    return { viewport: [innerWidth, innerHeight], pageHeight: root.scrollHeight, sidewaysOverflow: root.scrollWidth > root.clientWidth, clippedRight: wide, roster: document.querySelectorAll('.kp-roster li').length, rosterOpen: !!document.querySelector('.kp-player-details[open]'), results: document.querySelectorAll('.kp-results tr').length,
      ...(label ? { button: label, buttonFound: !!target, buttonInView: !!box && box.top >= 0 && box.bottom <= innerHeight, buttonTop: box && Math.round(box.top), buttonDisabled: target?.disabled } : {}) };
  }, button ?? null);
  await page.screenshot({ path: `${out}/${name}.png`, fullPage });
  report.shots.push({ name, ...metrics }); console.log(name, JSON.stringify(metrics));
}
const click = (page, name) => page.getByRole('button', { name, exact: true }).first().click();
const seated = (page, count) => page.waitForFunction(n => document.querySelector('.kp-rail-heading span')?.textContent === `${n}/64`, count);
try {
  const host = await open('display', { width: 1280, height: 720 }, false), phone = await open('phone', { width: 390, height: 844 }, true);
  await host.goto(`${base}/?game=ichi`); await click(host, 'Add to library'); await click(host, 'Play on this screen');
  code = (await host.locator('.kp-code').textContent()).trim();
  await phone.goto(`${base}/?join=${code}`); await phone.getByLabel('Your name').fill('Zephyrine Quince'); await click(phone, 'Join the room');
  await seated(host, 1);
  // Everyone but five bots taps Ready; Ichi seats ten, so the first ten take the round and the rest are told they will watch.
  const eager = total - 6; bots(eager, 0); const idle = bots(5, eager, '--no-ready'); await seated(host, total);
  await host.getByText('10/10 spots taken').waitFor();
  await shot(host, '01-over-capacity-display', { button: 'Start game' }); await shot(phone, '02-over-capacity-phone', { button: 'Round is full' });
  await click(host, 'Start game'); await phone.getByText('You are watching this round').waitFor(); await shot(phone, '03-watching-phone');
  await click(host, 'Room menu'); await click(host, 'End round'); await click(host, 'Confirm');
  await click(host, 'Back to picker'); await click(host, 'Confirm'); await host.getByText('What are we playing?').waitFor();
  await shot(host, '04-picker-display', { button: 'Play Crowd Lab' }); await host.locator('.kp-player-details summary').click(); await shot(host, '05-picker-display-roster-open');
  await click(host, 'Play Crowd Lab'); await host.getByText(/Waiting for Zephyrine Quince, .* and 4 more to tap Ready/).waitFor();
  await shot(host, '06-lobby-waiting-display', { button: 'Start game' });
  idle.kill('SIGKILL'); await host.getByText('Wait for disconnected players or remove their seats.').waitFor({ timeout: 120000 }); await shot(host, '07-lobby-away-display', { button: 'Start game' });
  for (let left = 5; left > 0; left--) { await host.getByRole('button', { name: /^Remove / }).first().click(); await seated(host, total - 6 + left); }
  bots(5, eager); await seated(host, total); await click(phone, 'Ready to play'); await host.getByText('Everyone is ready').waitFor();
  await shot(host, '08-lobby-ready-display', { button: 'Start game' });
  await host.setViewportSize({ width: 1920, height: 1080 }); await shot(host, '09-lobby-ready-display-1080', { button: 'Start game' }); await host.setViewportSize({ width: 1280, height: 720 });
  await phone.locator('.kp-player-details summary').click(); await shot(phone, '10-lobby-phone-roster', { button: 'Not ready', fullPage: true });
  await phone.setViewportSize({ width: 320, height: 568 }); await shot(phone, '11-lobby-phone-roster-320', { button: 'Not ready' }); await phone.setViewportSize({ width: 390, height: 844 });
  await click(host, 'Start game'); await host.getByText('Crowd dash').waitFor(); await phone.getByRole('button', { name: 'Run' }).waitFor();
  await shot(host, '12-playing-display'); await shot(phone, '13-playing-phone', { button: 'Run' });
  await host.getByText('Round results').waitFor({ timeout: 120000 });
  await shot(host, '14-results-display', { button: 'Play again' });
  await host.setViewportSize({ width: 1920, height: 1080 }); await shot(host, '15-results-display-1080', { button: 'Play again' }); await host.setViewportSize({ width: 1280, height: 720 });
  await phone.getByText('Round results').waitFor(); await shot(phone, '16-results-phone', { fullPage: true });
} catch (error) { report.errors.push(String(error?.stack ?? error)); process.exitCode = 1; }
finally { for (const child of children) child.kill('SIGTERM'); await browser.close(); writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2)); if (report.errors.length) console.error(report.errors.join('\n')); }
