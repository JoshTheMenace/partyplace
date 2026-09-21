/* eslint-disable no-unused-expressions -- Playwright CLI entry point. */
/* Phone control-to-TV movement, observed from painted skin pixels. No game-state injection. */
async (page) => {
  if (await page.locator('.nj-crew-card').count() !== 1) throw Error('Requires one phone player at a safe starting point');
  const readings = [], phone = page.context().browser().contexts().flatMap(c => c.pages()).find(p => p !== page && p.url().includes('?join='));
  if (!phone) throw Error('A phone controller must be joined');
  const pad = await phone.getByRole('button', { name: 'Move: drag or use arrow keys or WASD', exact: true }).boundingBox(), cdp = await phone.context().newCDPSession(phone);
  for (const key of ['ArrowRight','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','ArrowLeft']) {
    await page.waitForTimeout(350);
    await page.evaluate(() => {
      const canvas = document.querySelector('.nj-canvas'), actor = document.querySelector('.nj-crew-card'), ctx = canvas.getContext('2d');
      const s = Math.floor(Math.min(canvas.width / 512, canvas.height / 288)), ox = Math.floor((canvas.width - 512 * s) / 2), oy = Math.floor((canvas.height - 288 * s) / 2);
      const x = Math.round(ox + Number(actor.dataset.x) * 16 * s - 16 * s), y = Math.round(oy + Number(actor.dataset.y) * 16 * s - 20 * s), width = 32 * s, height = 22 * s;
      const position = () => { const data = ctx.getImageData(x, y, width, height).data; let sum = 0, count = 0; for (let i = 0; i < data.length; i += 4) if (data[i] === 240 && data[i + 1] === 200 && data[i + 2] === 160) { sum += i / 4 % width; count++; } return count ? sum / count : null; };
      const initial = position();
      window.__nightJobProbe = new Promise(resolve => {
        const start = performance.now(); const frame = now => { const current = position(); if (initial !== null && current !== null && Math.abs(current - initial) >= s * .75) resolve({ detectedAt: Date.now(), shiftPixels: current - initial }); else if (now - start >= 1200) resolve({ error: 'No visible skin-pixel displacement', initial, current }); else requestAnimationFrame(frame); }; requestAnimationFrame(frame);
      });
    });
    await phone.evaluate(() => { document.addEventListener('pointerdown', () => { window.__nightJobPressed = Date.now(); }, { once: true, capture: true }); });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, x: pad.x + pad.width * (key === 'ArrowRight' ? .85 : .15), y: pad.y + pad.height / 2 }] }); const measured = await page.evaluate(() => window.__nightJobProbe), pressedAt = await phone.evaluate(() => window.__nightJobPressed); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); readings.push({ key, ms: measured.detectedAt - pressedAt, ...measured });
  }
  await cdp.detach(); await page.evaluate(() => { delete window.__nightJobProbe; }); await phone.evaluate(() => { delete window.__nightJobPressed; });
  const cadence = target => target.evaluate(() => new Promise(resolve => { const values = []; let last; const frame = time => { if (last) values.push(time - last); last = time; if (values.length < 90) requestAnimationFrame(frame); else { values.sort((a,b) => a-b); resolve({ p50: values[45], p95: values[85], max: values.at(-1) }); } }; requestAnimationFrame(frame); }));
  const gameCadence = await cadence(page), context = await page.context().browser().newContext(), blank = await context.newPage();
  const blankCadence = await cadence(blank); await context.close();
  return { readings, gameCadence, blankCadence, browser: await page.evaluate(() => navigator.userAgent) };
}
