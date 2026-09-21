/* eslint-disable no-unused-expressions -- Playwright CLI entry point. */
/* Real touch cancellation, rotation, reconnect, layout and browser cadence. */
async (page) => {
  const peers = page.context().browser().contexts().flatMap(c => c.pages()), phone = peers.find(p => p !== page && p.url().includes('?join='));
  if (!phone) throw Error('Start an owned four-player room first');
  const report = { assertions: [], layouts: [], inputToSnapshotMs: [], errors: [] }, sent = [];
  const check = (ok, message) => { if (!ok) throw Error(message); report.assertions.push(message); };
  let id, current, prior, inputAt = 0;
  const onSocket = socket => {
    socket.on('framesent', f => { const m = JSON.parse(String(f.payload)); if (m.type.startsWith('input.')) { sent.push(m); if (m.type === 'input.state' && !inputAt) inputAt = Date.now(); } });
    socket.on('framereceived', f => { const m = JSON.parse(String(f.payload)); if (m.type === 'room.welcome') id = m.playerId; if (m.type === 'game.snapshot') { current = m.publicView; const me = current.players.find(p => p.id === id); if (me && prior && inputAt && Math.hypot(me.x - prior.x, me.y - prior.y) > .01) { report.inputToSnapshotMs.push(Date.now() - inputAt); inputAt = 0; } prior = me; } });
  };
  phone.on('websocket', onSocket); await phone.reload(); await phone.locator('.nj-controller').waitFor();
  const pad = phone.getByRole('button', { name: 'Move: drag or use arrow keys or WASD', exact: true }), sneak = phone.getByRole('button', { name: 'Sneak', exact: true });
  const cdp = await phone.context().newCDPSession(phone), a = await pad.boundingBox(), b = await sneak.boundingBox();
  const left = { id: 1, x: a.x + a.width * .8, y: a.y + a.height * .5 }, right = { id: 2, x: b.x + b.width / 2, y: b.y + b.height / 2 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [left] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [left, right] }); await phone.waitForTimeout(300);
  check(sent.some(p => p.payload?.x > .1 && p.payload?.sneak), 'simultaneous touch preserves movement and sneak');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); await phone.waitForTimeout(120);
  check(sent.at(-1)?.type === 'input.release', 'pointer cancellation sends neutral release');
  const stopped = current.players.find(p => p.id === id); await phone.waitForTimeout(200);
  check(Math.hypot(stopped.x - current.players.find(p => p.id === id).x, stopped.y - current.players.find(p => p.id === id).y) < .01, 'cancelled input stops authoritative movement');
  await pad.focus(); await phone.keyboard.down('ArrowRight'); await phone.waitForTimeout(100); await phone.setViewportSize({ width: 390, height: 844 }); await phone.keyboard.up('ArrowRight'); await phone.waitForTimeout(150);
  check(await phone.getByRole('heading', { name: 'Turn your phone sideways', exact: true }).isVisible(), 'portrait shows rotation fallback');
  check(sent.at(-1)?.type === 'input.release', 'rotation releases held movement');
  for (const [width, height] of [[320,568],[390,844],[667,375],[844,390]]) {
    await phone.setViewportSize({ width, height }); await phone.waitForTimeout(120);
    const metric = await phone.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, canvas: document.querySelectorAll('.nj-canvas').length, targets: [...document.querySelectorAll('.nj-controller button')].map(e => ({ name: e.getAttribute('aria-label'), width: e.getBoundingClientRect().width, height: e.getBoundingClientRect().height })) }));
    check(metric.scrollWidth <= width + 1, `phone fits ${width}x${height}`); check(metric.targets.every(b => b.width >= 44 && b.height >= 44), `controls meet 44px targets at ${width}x${height}`);
    report.layouts.push(metric); await phone.screenshot({ path: `output/playwright/night-job/phone-${width}x${height}.png` });
  }
  const before = current.players.find(p => p.id === id); await phone.reload(); await phone.locator('.nj-controller').waitFor(); await phone.waitForTimeout(150);
  check(current.players.find(p => p.id === id).role === before.role, 'reload retains seat and chosen role');
  check(await phone.locator('.nj-canvas').count() === 0, 'phone reconnect remains controller-only without a canvas');
  for (const [width, height] of [[1280,720],[1920,1080]]) { await page.setViewportSize({ width, height }); await page.waitForTimeout(100); report.layouts.push(await page.evaluate(() => ({ width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight, crew: document.querySelectorAll('.nj-crew-card').length, canvas: document.querySelectorAll('.nj-canvas').length }))); await page.screenshot({ path: `output/playwright/night-job/host-${width}x${height}.png` }); }
  await page.setViewportSize({ width: 1280, height: 720 });
  report.cadence = await page.evaluate(() => new Promise(resolve => { const samples = []; let prior = performance.now(); const frame = now => { samples.push(now - prior); prior = now; if (samples.length < 180) requestAnimationFrame(frame); else { samples.shift(); samples.sort((a,b) => a-b); resolve({ frames: samples.length, p50: samples[Math.floor(samples.length * .5)], p95: samples[Math.floor(samples.length * .95)], max: samples.at(-1), over33ms: samples.filter(n => n > 33).length }); } }; requestAnimationFrame(frame); }));
  await phone.emulateMedia({ reducedMotion: 'reduce' }); await phone.screenshot({ path: 'output/playwright/night-job/reduced-motion.png' });
  report.reducedMotion = await phone.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches); check(report.reducedMotion, 'reduced motion browser preference reaches the game');
  await phone.emulateMedia({ reducedMotion: 'no-preference' }); await cdp.detach(); phone.off('websocket', onSocket);
  return report;
}
