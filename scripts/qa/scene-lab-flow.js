/* eslint-disable no-unused-expressions -- Playwright CLI entry point. */
async (page) => {
  const base = page.url().split('/').slice(0, 3).join('/'), browser = page.context().browser(), failures = [], contexts = [], report = { mode: 'real browser UI and websocket observation', assertions: [], layouts: [] };
  const check = (condition, message) => { if (!condition) throw new Error(message); report.assertions.push(message); };
  const observe = target => { const data = { current: null, sent: [], snapshots: [], errors: [] }; target.on('pageerror', error => data.errors.push(error.message)); target.on('websocket', socket => { socket.on('framesent', frame => { const packet = JSON.parse(String(frame.payload)); if (packet.type.startsWith('input.')) data.sent.push({ ...packet, at: Date.now() }); }); socket.on('framereceived', frame => { const packet = JSON.parse(String(frame.payload)); if (packet.type === 'game.snapshot') { data.current = packet; data.snapshots.push({ at: Date.now(), bytes: String(frame.payload).length }); } if (packet.type === 'error') data.errors.push(packet.reason); }); }); return data; };
  const host = observe(page); await page.setViewportSize({ width: 1440, height: 1000 });
  if (await page.getByRole('button', { name: 'Host on this screen' }).isVisible()) await page.getByRole('button', { name: 'Host on this screen' }).click();
  const code = await page.locator('.kp-code').textContent();
  const phones = [], observations = [];
  for (let i = 0; i < 2; i++) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); contexts.push(context);
    const phone = await context.newPage(), observed = observe(phone); phones.push(phone); observations.push(observed);
    await phone.goto(`${base}/?join=${code}`); await phone.getByRole('textbox', { name: 'Your name' }).fill(`Pilot ${i + 1}`); await phone.getByRole('button', { name: 'Join the room' }).click();
  }
  await page.getByRole('button', { name: 'Play 3D Scene Lab', exact: true }).click();
  for (const phone of phones) await phone.getByRole('button', { name: 'Ready to play' }).click();
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  await phones[0].getByRole('button', { name: 'Boost', exact: true }).waitFor();
  check(await page.locator('canvas').count() === 1, 'one scene canvas after readiness');
  check(await phones[0].locator('canvas').count() === 0, 'phone does not construct a world');
  const phone = phones[0], observed = observations[0]; const first = observed.current.publicView.players[0];
  const pad = phone.getByRole('button', { name: 'Move: drag or use arrow keys or WASD' });
  await pad.focus(); await phone.keyboard.down('ArrowLeft'); await phone.keyboard.down('ArrowUp'); await phone.waitForTimeout(2100);
  await phone.keyboard.up('ArrowLeft'); await phone.keyboard.up('ArrowUp'); await phone.waitForTimeout(150);
  const moved = observed.current.publicView.players[0]; report.collectedStars = moved.score; check(moved.score > 0, 'real held controls collect stars and change the authoritative score');
  check(first.x - moved.x > 4, 'held movement continues beyond the server 1.5 second stale-input window');
  check(observed.sent.filter(p => p.type === 'input.state').length >= 35, 'bounded heartbeat resends sustained controls');
  check(observed.sent.at(-1).type === 'input.release', 'key release emits explicit neutral release');
  const stopped = [moved.x, moved.z]; await phone.waitForTimeout(250); check(JSON.stringify(stopped) === JSON.stringify([observed.current.publicView.players[0].x, observed.current.publicView.players[0].z]), 'released input stops authoritative movement');
  const cdp = await phone.context().newCDPSession(phone), stickBox = await pad.boundingBox(), boostBox = await phone.getByRole('button', { name: 'Boost', exact: true }).boundingBox();
  const point = { x: stickBox.x + stickBox.width * .65, y: stickBox.y + stickBox.height * .8, id: 1 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point, { x: boostBox.x + boostBox.width / 2, y: boostBox.y + boostBox.height / 2, id: 2 }] }); await phone.waitForTimeout(150);
  check(observed.sent.at(-1).payload?.boost && observed.sent.at(-1).payload?.x > 0, 'two simultaneous real touch pointers preserve steering plus boost');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); await phone.waitForTimeout(100); check(observed.sent.at(-1).type === 'input.release', 'pointer cancellation releases both controls');
  await pad.focus(); await phone.keyboard.down('ArrowDown'); await phone.waitForTimeout(100); await phone.evaluate(() => window.dispatchEvent(new Event('blur'))); await phone.keyboard.up('ArrowDown'); await phone.waitForTimeout(100); check(observed.sent.at(-1).type === 'input.release', 'window blur clears held input');
  for (const [width, height] of [[320,568],[390,844],[667,375],[844,390]]) { await phone.setViewportSize({ width, height }); await phone.waitForTimeout(50); const layout = await phone.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, canvas: document.querySelectorAll('canvas').length })); check(layout.scrollWidth <= width + 1, `controller fits ${width}x${height}`); report.layouts.push({ width, height, ...layout }); await phone.screenshot({ path: `output/playwright/scene-lab/controller-${width}x${height}.png`, fullPage: true }); }
  await page.screenshot({ path: 'output/playwright/scene-lab/arena-1440.png' });
  await page.getByText('Scene diagnostics', { exact: false }).click(); report.metrics = JSON.parse(await page.getByTestId('scene-metrics').textContent()); check(report.metrics.frames > 60 && report.metrics.calls > 0, 'actual rendered frames and GPU resource counts reported');
  await page.getByRole('heading', { name: 'Round results', exact: true }).waitFor({ timeout: 25000 });
  check(await page.locator('.kp-results tbody tr').count() === 2, 'two-player real round reaches authoritative results');
  check(await page.locator('canvas').count() === 0, 'results tear down the canvas');
  await page.reload(); await page.getByRole('heading', { name: 'Round results', exact: true }).waitFor(); check(await page.locator('.kp-results tbody tr').count() === 2, 'display reconnects directly to results');
  await page.getByRole('button', { name: 'Play again', exact: true }).click();
  for (const phone of phones) await phone.getByRole('button', { name: 'Ready to play' }).click(); await page.getByRole('button', { name: 'Start game', exact: true }).click();
  await phones[0].getByRole('button', { name: 'Boost', exact: true }).waitFor(); check(await page.locator('canvas').count() === 1, 'replay creates exactly one fresh scene');
  for (const data of [host, ...observations]) failures.push(...data.errors); check(!failures.length, `no browser or protocol errors: ${failures.join('; ')}`);
  report.network = observations.map(data => ({ snapshotCount: data.snapshots.length, maxSnapshotBytes: Math.max(...data.snapshots.map(item => item.bytes)), inputStates: data.sent.filter(p => p.type === 'input.state').length }));
  return report;
  // Leave owned pages and room for subsequent lifecycle and maximum-roster QA.
}
