// Drives real Ichi rounds through the shared launcher with one bot per phone, using only the QA hooks.
// Usage: [ICHI_TAG=run] node scripts/qa/ichi-play.mjs <a|b|c|d> [base-url]. Headless; evidence goes to output/playwright/ichi/[run/]<scenario>.
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
const require = createRequire(`${process.env.HOME}/.npm/_npx/31e32ef8478fbf80/node_modules/`);
const { chromium } = require('playwright');

const scenario = process.argv[2], base = process.argv[3] ?? 'http://localhost:4372', out = `output/playwright/ichi/${process.env.ICHI_TAG ? `${process.env.ICHI_TAG}/` : ''}${scenario}`;
if (!['a', 'b', 'c', 'd'].includes(scenario)) throw Error('Usage: node scripts/qa/ichi-play.mjs <a|b|c|d> [base-url]');
mkdirSync(out, { recursive: true });
const shell = `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
const browser = await chromium.launch(existsSync(shell) ? { executablePath: shell } : {});
const wait = ms => new Promise(r => setTimeout(r, ms));
const pick = list => list[Math.floor(Math.random() * list.length)];
const bump = (o, k) => { o[k] = (o[k] ?? 0) + 1; };
const stats = { scenario, base, sent: {}, accepted: {}, rejected: {}, hands: 0, matches: 0, console: [], layout: [], checks: {}, shots: [] };
const actionKinds = new Map(), acked = new Set();

function track(page, label) {
  page.on('console', m => { if (m.type() === 'error') stats.console.push(`${label}: ${m.text()}`); });
  page.on('pageerror', e => stats.console.push(`${label} pageerror: ${e.message}`));
  page.on('websocket', ws => {
    ws.on('close', () => bump(stats, 'socketCloses'));
    ws.on('framesent', f => { try { const m = JSON.parse(f.payload); if (m.type === 'game.action' && !actionKinds.has(`${label}:${m.actionId}`)) { actionKinds.set(`${label}:${m.actionId}`, m.payload.kind); bump(stats.sent, m.payload.kind); } } catch { /* Binary or non-JSON. */ } });
    ws.on('framereceived', f => { try { const m = JSON.parse(f.payload); const id = `${label}:${m.actionId}`; if (m.type !== 'action.ack' || acked.has(id)) return; acked.add(id); const k = actionKinds.get(id) ?? '?'; if (m.accepted) bump(stats.accepted, k); else bump(stats.rejected, `${k}: ${m.reason}`); } catch { /* Binary or non-JSON. */ } });
  });
}

/** Screenshot plus layout metrics: horizontal overflow, page scroll and visible controls under 44px. */
async function shot(page, name) {
  const path = `${out}/${name}.png`;
  await page.screenshot({ path });
  const m = await page.evaluate(() => {
    const d = document.documentElement, small = [...document.querySelectorAll('.ichi button, .kp-shell-phone .ichi ~ * button')].filter(b => { const r = b.getBoundingClientRect(); return r.width && r.height && !b.classList.contains('ichi-card-button') && (r.height < 44 || r.width < 44); }).map(b => `${(b.getAttribute('aria-label') || b.textContent).trim().slice(0, 20)} ${Math.round(b.getBoundingClientRect().width)}x${Math.round(b.getBoundingClientRect().height)}`);
    const rows = [...document.querySelectorAll('.ichi-hand-row')];
    return { w: innerWidth, h: innerHeight, overflowX: d.scrollWidth > innerWidth + 1, scrollH: d.scrollHeight, small, handRows: rows.length, handScroll: rows.some(r => r.scrollWidth > r.clientWidth + 1), cards: document.querySelectorAll('.ichi-card-button').length };
  });
  stats.shots.push(path); stats.layout.push({ name, ...m });
  return path;
}

async function newPage(viewport, label, mobile = true) {
  const context = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 });
  const page = await context.newPage(); track(page, label); return page;
}

/** Host creates a room with Ichi through the library, applies settings, phones join and ready up. */
async function setup({ players, names, viewports, settings, tvs = [{ width: 1280, height: 720 }] }) {
  const host = await newPage(tvs[0], 'tv', false);
  await host.goto(`${base}/?game=ichi`);
  await host.getByRole('button', { name: 'Add to library', exact: true }).first().click();
  await host.getByRole('button', { name: 'Play on this screen', exact: true }).first().click();
  const code = (await host.locator('.kp-code').textContent({ timeout: 15000 })).trim();
  if (settings) await applySettings(host, settings);
  const extraTvs = [];
  for (const [k, vp] of tvs.slice(1).entries()) { const tv = await newPage(vp, `tv${k + 2}`, false); await tv.goto(`${base}/?join=${code}&display`); await tv.getByRole('button', { name: 'Join as display' }).click(); extraTvs.push(tv); }
  const phones = [];
  for (let i = 0; i < players; i++) {
    const page = await newPage(viewports[i % viewports.length], `p${i}`);
    await page.goto(`${base}/?join=${code}`);
    await page.getByRole('textbox', { name: 'Your name' }).fill(names[i]);
    await page.getByRole('button', { name: 'Join the room', exact: true }).click();
    phones.push({ page, name: names[i], i, bot: {} });
  }
  return { host, code, phones, extraTvs };
}
async function applySettings(host, settings) {
  await host.getByRole('button', { name: 'Settings', exact: true }).click();
  if (settings.preset) await host.locator('.ichi-preset', { hasText: settings.preset }).click();
  for (const [label, value] of Object.entries(settings.selects ?? {})) await host.getByLabel(label).selectOption({ label: value });
  await host.getByRole('button', { name: 'Apply settings', exact: true }).click();
}
async function start(host, phones) {
  for (const p of phones) await p.page.getByRole('button', { name: 'Ready to play', exact: true }).click({ timeout: 15000 });
  await host.getByRole('button', { name: 'Start game', exact: true }).click({ timeout: 15000 });
  await host.locator('.ichi-display').waitFor({ timeout: 30000 });
  await Promise.all(phones.map(p => p.page.locator('.ichi-phone').waitFor({ timeout: 30000 })));
}

const readPhone = page => page.evaluate(() => {
  const root = document.querySelector('.ichi-phone');
  if (!root) return { phase: document.querySelector('.kp-round-results') ? 'results' : 'none' };
  const named = b => (b.getAttribute('aria-label') || b.textContent).trim();
  return {
    phase: root.dataset.phase, myTurn: root.dataset.myTurn === 'true', busy: root.querySelector('.ichi-actions')?.getAttribute('aria-busy') === 'true',
    cards: [...root.querySelectorAll('.ichi-card-button')].map(b => ({ id: b.dataset.cardId, playable: b.dataset.playable === 'true', jumpable: b.dataset.jumpable === 'true', label: named(b), selected: b.getAttribute('aria-pressed') === 'true', isNew: b.dataset.new === 'true' })),
    buttons: [...root.querySelectorAll('button:not(.ichi-card-button)')].filter(b => !b.disabled).map(named),
    error: root.querySelector('.kp-notice-error')?.textContent ?? '', urgent: !!root.querySelector('.ichi-shout[data-urgent="true"]'),
    prompt: root.querySelector('.ichi-prompt strong')?.textContent ?? '', ouch: root.querySelector('.ichi-ouch')?.textContent ?? '',
  };
});
const has = (s, name) => s.buttons?.includes(name);
const press = (page, name) => page.getByRole('button', { name, exact: true }).first().click({ timeout: 2500 }).catch(e => { throw Error(`press ${name}: ${e.message.split('\n').filter(l => /intercepts|stable|visible|enabled|detached|outside/.test(l)).at(-1)?.trim() ?? e.message.split('\n')[0]}`); });
// Tap the top-left corner: in a two-row hand the lower half of a first-row card sits under the second row.
const tapCard = (page, id) => page.locator(`.ichi-card-button[data-card-id="${id}"]`).click({ timeout: 2500, position: { x: 8, y: 10 } }).catch(e => { throw Error(`card: ${e.message.split('\n').filter(l => /intercepts|stable|visible|enabled|detached|outside/.test(l)).at(-1)?.trim() ?? e.message.split('\n')[0]}`); });

/**
 * One decision per phone per tick. Options: forget (chance to skip calling Ichi), hoard (draw until N cards),
 * onState(phone, state) runs first and may return true to claim the tick (for scripted screenshots).
 */
async function act(phone, opts, now) {
  const { page, bot } = phone, s = await readPhone(page);
  phone.state = s;
  if (opts.onState && await opts.onState(phone, s)) return;
  if (s.busy || !s.phase || s.phase === 'none') return;
  if (s.phase === 'intermission') { bot.nextAt ??= now + 800 + Math.random() * 2500; if (now > bot.nextAt && has(s, 'Next hand')) await press(page, 'Next hand'); return; }
  bot.nextAt = undefined;
  if (s.phase !== 'playing') return;
  const hand = s.cards.length, hoard = typeof opts.hoard === 'function' ? opts.hoard(phone) : opts.hoard;
  if (hand > 2) bot.forget = typeof opts.forget === 'function' ? opts.forget(phone) : Math.random() < (opts.forget ?? 0.3);
  if (has(s, 'Catch!')) { bot.catchAt ??= now + 300 + Math.random() * 2200; if (now > bot.catchAt) { bot.catchAt = undefined; return press(page, 'Catch!'); } } else bot.catchAt = undefined;
  if (s.urgent && has(s, 'Ichi!')) { bot.lateAt ??= now + (Math.random() < 0.4 ? 900 + Math.random() * 2000 : 99999); if (now > bot.lateAt) return press(page, 'Ichi!'); } else bot.lateAt = undefined;
  const colorsOpen = ['Coral', 'Sky', 'Lime', 'Sun'].filter(c => has(s, c)), swaps = s.buttons.filter(b => b.startsWith('Swap with '));
  if (colorsOpen.length) return press(page, pick(colorsOpen));
  if (swaps.length) return press(page, pick(swaps));
  const selected = s.cards.find(c => c.selected);
  if (!s.myTurn) {
    const jump = s.cards.find(c => c.jumpable);
    if (selected?.jumpable) return Math.random() < 0.5 ? tapCard(page, selected.id) : press(page, `Play ${selected.label}`);
    if (jump && Math.random() < 0.5) return tapCard(page, jump.id);
    return;
  }
  bot.turnSeen ??= now; if (now - bot.turnSeen < (opts.think ?? 150)) return; // A human beat; also lets the TV animate.
  bot.turnSeen = undefined;
  if (hoard && hand < hoard && !has(s, 'Keep card')) { if (s.buttons.some(b => b.startsWith('Draw'))) return press(page, s.buttons.find(b => b.startsWith('Draw'))); }
  if (has(s, 'Challenge') && Math.random() < 0.35) return press(page, 'Challenge');
  if (selected && (selected.playable)) return Math.random() < 0.5 ? tapCard(page, selected.id) : press(page, `Play ${selected.label}`);
  const playable = s.cards.filter(c => c.playable);
  if (has(s, 'Keep card')) return playable.length && !(hoard && hand < hoard) && Math.random() < 0.75 ? tapCard(page, playable[0].id) : press(page, 'Keep card');
  if (playable.length && Math.random() < 0.93) return tapCard(page, pick(playable).id);
  const draw = s.buttons.find(b => b.startsWith('Draw'));
  if (draw) return press(page, draw);
}

/** Runs every phone's bot until done() or the time limit; tv(phase) hooks watch the display between ticks. */
async function run(ctx, opts) {
  const until = Date.now() + (opts.limitMs ?? 600000);
  let phase = '';
  while (Date.now() < until) {
    const tvPhase = await ctx.host.locator('.ichi-display').getAttribute('data-phase', { timeout: 500 }).catch(() => null) ?? (await ctx.host.locator('.kp-round-results').count() ? 'results' : 'none');
    if (tvPhase !== phase) { if (tvPhase === 'intermission' || (['complete', 'results'].includes(tvPhase) && phase === 'playing')) stats.hands++; if (['complete', 'results'].includes(tvPhase) && !['complete', 'results'].includes(phase)) stats.matches++; phase = tvPhase; }
    if (opts.tv) await opts.tv(tvPhase);
    if (await opts.done?.(tvPhase)) return true;
    if (!ctx.hold) for (const p of ctx.phones) await act(p, opts, Date.now()).catch(e => bump(stats.rejected, `ui: ${e.message.split('\n')[0].slice(0, 90)}`));
    await wait(40);
  }
  return false;
}
const tvState = host => host.evaluate(() => { const d = document.querySelector('.ichi-display'); return d ? { phase: d.dataset.phase, stack: !!d.querySelector('.ichi-stack'), window: !!d.querySelector('.ichi-window'), splash: d.querySelector('.ichi-splash strong')?.textContent ?? '', hand: d.querySelector('.ichi-hud strong')?.textContent } : null; });
const names16 = ['Aurelia Blossoms', 'Bartholomew Keys', 'Constantina Moon', 'Dmitri Vasquezzz', 'Evangeline Frost', 'Fitzgerald Dunne', 'Guinevere Stokes', 'Horatio Pemberly', 'Isadora Whitlock', 'Jebediah Hawkins'];
const finish = async ctx => {
  const done = await ctx.host.locator('.kp-round-results').waitFor({ timeout: 20000 }).then(() => true, () => false);
  if (done) await shot(ctx.host, 'tv-results');
  return done;
};

let ctx;
try {
  if (scenario === 'a') {
    // 2 players, defaults (target 200): full match with intermissions, results, then Play again from zero.
    ctx = await setup({ players: 2, names: ['Mika', 'Jonah'], viewports: [{ width: 390, height: 844 }] });
    await start(ctx.host, ctx.phones);
    await shot(ctx.host, 'tv-start'); await shot(ctx.phones[0].page, 'p0-start');
    let inter = 0;
    // The tally is held back 1.5 s so the winning card shows first: shoot that moment, then the settled tally.
    const ok = await run(ctx, { limitMs: 900000, done: p => p === 'results' || p === 'complete', tv: async p => { if (p === 'intermission' && inter < stats.hands) { inter = stats.hands; if (inter <= 2) { await wait(250); await shot(ctx.host, `tv-goes-out-${inter}`); await wait(3200); await shot(ctx.host, `tv-intermission-${inter}`); await shot(ctx.phones[0].page, `p0-intermission-${inter}`); } } } });
    stats.checks.completed = ok && await finish(ctx);
    await shot(ctx.phones[0].page, 'p0-results');
    stats.checks.finalScores = await ctx.host.locator('.ichi-standings li').allTextContents();
    await ctx.host.getByRole('button', { name: 'Play again', exact: true }).click();
    await start(ctx.host, ctx.phones);
    await wait(1200);
    stats.checks.replayScores = await ctx.host.locator('.ichi-seat').evaluateAll(list => list.map(li => li.getAttribute('aria-label')));
    stats.checks.replayZero = stats.checks.replayScores.every(l => / 0 points/.test(l));
    stats.checks.replayHand = await ctx.host.locator('.ichi-hud strong').textContent();
    await shot(ctx.host, 'tv-replay'); await shot(ctx.phones[1].page, 'p1-replay');
  }

  if (scenario === 'b') {
    // 10 players, 16-character names, Chaos, one-hand match; second display at 1080p.
    ctx = await setup({ players: 10, names: names16, viewports: [{ width: 390, height: 844 }], settings: { preset: 'Chaos', selects: { 'Match length': 'One hand' } }, tvs: [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }] });
    await start(ctx.host, ctx.phones);
    const tvs = [ctx.host, ...ctx.extraTvs], got = {};
    const both = async name => { ctx.hold = true; for (const [k, tv] of tvs.entries()) await shot(tv, `tv${k ? 1080 : 720}-${name}`); ctx.hold = false; };
    await wait(900); await both('start');
    const started = Date.now();
    const ok = await run(ctx, { limitMs: 900000, forget: 0.5, done: p => p === 'complete' || p === 'results', tv: async () => {
      const t = await tvState(ctx.host); if (!t) return;
      if (!got.mid && Date.now() - started > 12000) { got.mid = 1; await both('mid'); }
      if (!got.stack && t.stack) { got.stack = 1; await both('stack'); await shot(ctx.phones.find(p => p.state?.myTurn)?.page ?? ctx.phones[0].page, 'phone-stack'); }
      if (!got.window && t.window) { got.window = 1; await both('ichi-window'); }
      // Color calls and stacks vary in text; one capture each so they don't crowd out the rest.
      const key = /^(Coral|Sky|Lime|Sun)!$/.test(t.splash) ? 'color' : t.splash.startsWith('Stack!') ? 'stack' : t.splash.endsWith(' goes out!') ? 'goesout' : t.splash.replace(/\W+/g, '').toLowerCase();
      if (t.splash && !got[`splash-${key}`] && Object.keys(got).filter(k => k.startsWith('splash')).length < 10) { got[`splash-${key}`] = 1; await both(`splash-${key}`); }
    } });
    await wait(300); await both('complete');
    stats.checks.captured = Object.keys(got);
    stats.checks.completed = ok && await finish(ctx);
    if (ctx.extraTvs[0]) await shot(ctx.extraTvs[0], 'tv1080-results');
    await shot(ctx.phones[0].page, 'p0-results');
  }

  if (scenario === 'c') {
    // One phone per target viewport. Phone 0 hoards to 22 cards and is also shot at every viewport; the rest play normally.
    const vps = [[320, 568], [390, 844], [667, 375], [844, 390]].map(([width, height]) => ({ width, height }));
    ctx = await setup({ players: 4, names: ['Wren Tanaka-Ruiz', 'Oli', 'Priya Ramaswamy', 'Sal'], viewports: vps, settings: { selects: { 'Match length': 'First to 500 points' } } });
    await start(ctx.host, ctx.phones);
    const taken = new Set(), tag = (p, s) => `${p.page.viewportSize().width}x${p.page.viewportSize().height}-${s}`;
    const snap = async (p, s) => { if (taken.has(tag(p, s))) return false; taken.add(tag(p, s)); await shot(p.page, tag(p, s)); return true; };
    const all = s => vps.every(v => taken.has(`${v.width}x${v.height}-${s}`));
    const ok = await run(ctx, { limitMs: 900000, hoard: p => p.i === 0 ? 22 : 0, forget: 0.6, think: 250, done: p => p === 'complete' || p === 'results' || (all('intermission') && all('catch') && all('wild-sheet')),
      onState: async (p, s) => {
        if (s.phase === 'playing' && !s.myTurn && s.cards.length && !has(s, 'Catch!')) await snap(p, 'waiting');
        if (s.phase === 'playing' && s.myTurn && !s.busy) await snap(p, 'your-turn');
        if (['Coral', 'Sky', 'Lime', 'Sun'].every(c => has(s, c))) await snap(p, 'wild-sheet');
        if (p.i === 0 && s.cards?.length >= 20 && !all('big-hand')) { ctx.hold = true; const own = p.page.viewportSize(); for (const vp of vps) { await p.page.setViewportSize(vp); await wait(350); await snap(p, 'big-hand'); } await p.page.setViewportSize(own); ctx.hold = false; }
        if (has(s, 'Catch!')) await snap(p, 'catch');
        if (s.urgent) await snap(p, 'ichi-urgent');
        if (s.ouch) await snap(p, 'penalty-toast');
        if (s.prompt === 'You’re next!') await snap(p, 'up-next');
        if (s.phase === 'intermission' && !taken.has(tag(p, 'intermission'))) { await wait(400); await snap(p, 'intermission'); }
        return false;
      } });
    stats.checks.captured = [...taken].sort();
    stats.checks.stopped = ok;
    await shot(ctx.host, 'tv-end');
  }

  if (scenario === 'd') {
    // Reload mid-turn keeps seat, hand and the selected-card draft; a lost Catch! race shows the server reason.
    ctx = await setup({ players: 3, names: ['Reloader', 'Catcher One', 'Catcher Two'], viewports: [{ width: 390, height: 844 }] });
    await start(ctx.host, ctx.phones);
    const [a, b, c] = ctx.phones;
    let reloaded = false, raced = false;
    await run(ctx, { limitMs: 600000, forget: p => p === a, done: () => reloaded && raced, onState: async (p, s) => {
      if (!reloaded && p === a && s.myTurn && !s.busy && s.cards.some(x => x.playable) && !has(s, 'Keep card') && !['Coral', 'Sky', 'Lime', 'Sun'].some(x => has(s, x))) {
        const card = s.cards.find(x => x.playable && !x.label.startsWith('Wild') && !x.label.endsWith(' 7')) ?? s.cards.find(x => x.playable);
        await tapCard(a.page, card.id); await wait(300);
        const before = await readPhone(a.page); await shot(a.page, 'reload-before');
        await a.page.reload(); await a.page.locator('.ichi-card-button').first().waitFor({ timeout: 15000 }); await wait(500);
        const after = await readPhone(a.page); await shot(a.page, 'reload-after');
        stats.checks.reload = { sameHand: JSON.stringify(before.cards.map(x => x.id).sort()) === JSON.stringify(after.cards.map(x => x.id).sort()), stillMyTurn: after.myTurn, selectedBefore: before.cards.find(x => x.selected)?.label, selectedAfter: after.cards.find(x => x.selected)?.label, pill: await a.page.locator('.kp-session-pill').textContent() };
        reloaded = true; return true;
      }
      // The reloader always forgets Ichi; when the window opens both others press Catch! at once.
      if (!raced && p === b && has(s, 'Catch!')) {
        ctx.hold = true;
        await Promise.all([press(b.page, 'Catch!'), press(c.page, 'Catch!')]); await wait(700);
        const [sb, sc] = [await readPhone(b.page), await readPhone(c.page)];
        const loser = sb.error ? b : sc.error ? c : null;
        stats.checks.race = { errorB: sb.error, errorC: sc.error };
        if (loser) { await shot(loser.page, 'rejected-catch'); await wait(3300); stats.checks.errorCleared = !(await readPhone(loser.page)).error; await shot(loser.page, 'rejected-catch-cleared'); }
        await shot(ctx.host, 'tv-after-catch');
        raced = true; ctx.hold = false; return true;
      }
      return false;
    } });
  }
} catch (e) { stats.error = e.stack; console.error(e); }
finally {
  writeFileSync(`${out}/stats.json`, JSON.stringify(stats, null, 2));
  console.log(JSON.stringify({ ...stats, layout: stats.layout.filter(l => l.overflowX || l.small.length || l.scrollH > l.h + 2) }, null, 2));
  await browser.close();
}
