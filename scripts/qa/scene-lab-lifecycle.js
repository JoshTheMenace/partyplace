/* eslint-disable no-unused-expressions -- Playwright CLI entry point. */
async (page) => {
  const browser = page.context().browser(), base = page.url().split('/').slice(0, 3).join('/'), report = { assertions: [], metrics: [] };
  const check = (value, message) => { if (!value) throw new Error(message); report.assertions.push(message); };
  const phones = browser.contexts().flatMap(context => context.pages()).filter(target => target !== page && target.url().startsWith(base) && target.url().includes('?join='));
  const ready = async () => { for (const phone of phones) await phone.getByRole('button', { name: 'Ready to play', exact: true }).click(); await page.getByRole('button', { name: 'Start game', exact: true }).click(); };
  const abort = async () => { await page.getByRole('button', { name: 'Room menu', exact: true }).click(); await page.getByRole('button', { name: 'End round', exact: true }).click(); await page.getByRole('button', { name: 'Confirm', exact: true }).click(); await page.getByRole('button', { name: 'Start game', exact: true }).waitFor(); };
  const picker = async () => { await page.getByRole('button', { name: 'Back to picker', exact: true }).click(); await page.getByRole('button', { name: 'Confirm', exact: true }).click(); };
  if (await page.locator('.quiz-panic-display').count()) { await abort(); await picker(); } else { await page.getByRole('button', { name: 'Choose another game', exact: true }).waitFor({ timeout: 25000 }); await page.getByRole('button', { name: 'Choose another game', exact: true }).click(); }
  const code = await page.locator('.kp-code').textContent();
  await Promise.all(Array.from({ length: 10 - phones.length }, async (_, index) => { const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }), phone = await context.newPage(); phones.push(phone); await phone.goto(`${base}/?join=${code}`); await phone.getByRole('textbox', { name: 'Your name' }).fill(`PLAYER-${String(index + 3).padStart(9, '0')}`); await phone.getByRole('button', { name: 'Join the room', exact: true }).click(); }));
  await page.getByRole('button', { name: 'Play Quiz Panic', exact: true }).click(); await ready(); await phones[0].locator('.quiz-panic-phone').waitFor({ timeout: 10000 }); await abort(); await picker();
  check(await page.locator('.kp-roster li').count() === 10, 'A to DOM game preserves all ten seats');
  await page.getByRole('button', { name: 'Play 3D Scene Lab', exact: true }).click();
  await page.reload(); await page.getByRole('button', { name: 'Start game', exact: true }).waitFor();
  let release; await page.route('**/scene-*.js', route => new Promise(resolve => { release = async () => { await route.continue(); resolve(); }; }));
  await ready(); for (let i = 0; i < 100 && !release; i++) await page.waitForTimeout(20);
  check(!!release, 'scene module is lazy-loaded only for the display'); await page.waitForTimeout(300);
  check(!(await phones[0].getByRole('button', { name: 'Boost', exact: true }).isVisible()), 'gameplay waits behind the scene load barrier');
  await abort(); await release(); await page.unroute('**/scene-*.js'); await page.waitForTimeout(200); check(await page.locator('canvas').count() === 0, 'aborted preparation cannot mount a late canvas');
  await page.getByRole('button', { name: 'Settings', exact: true }).click(); await page.getByRole('button', { name: 'Graphics: balanced', exact: true }).click(); await page.getByRole('button', { name: 'Apply settings', exact: true }).click();
  await ready(); await phones[0].getByRole('button', { name: 'Boost', exact: true }).waitFor();
  check(await page.locator('.sl-roster > span').count() === 10, 'A to B to A displays ten active numbered players');
  await page.waitForTimeout(1200); await page.getByText('Scene diagnostics', { exact: false }).click(); report.metrics.push(JSON.parse(await page.getByTestId('scene-metrics').textContent()));
  check(report.metrics[0].pixelRatio === 1, 'low graphics caps pixel ratio at one');
  await page.getByText('Scene diagnostics', { exact: false }).click();
  for (const [width, height] of [[1280,720],[1920,1080]]) { await page.setViewportSize({ width, height }); await page.waitForTimeout(100); check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `ten-player display fits ${width}x${height}`); await page.screenshot({ path: `output/playwright/scene-lab/arena-ten-${width}.png` }); }
  const canvas = page.locator('canvas'); check(await canvas.count() === 1, 'one canvas before context-loss recovery');
  await canvas.evaluate(element => element.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
  await page.getByRole('button', { name: 'Retry loading', exact: true }).waitFor(); check(await page.locator('canvas').count() === 0, 'context loss stops the round and disposes its canvas');
  await page.getByRole('button', { name: 'Retry loading', exact: true }).click(); await ready(); await phones[0].getByRole('button', { name: 'Boost', exact: true }).waitFor();
  await page.waitForTimeout(1200); await page.getByText('Scene diagnostics', { exact: false }).click(); report.metrics.push(JSON.parse(await page.getByTestId('scene-metrics').textContent()));
  check(report.metrics[0].geometries === report.metrics[1].geometries && report.metrics[0].textures === report.metrics[1].textures, 'fresh scene resource counts stay stable across context-loss retry');
  const phone = phones[0]; await phone.getByRole('button', { name: 'Move: drag or use arrow keys or WASD' }).focus(); await phone.keyboard.down('ArrowLeft'); await phone.waitForTimeout(150); await phone.reload(); await phone.getByRole('button', { name: 'Boost', exact: true }).waitFor();
  check(await page.locator('.sl-roster > span').count() === 10, 'controller reconnect keeps its seat during 3D play');
  await page.getByRole('heading', { name: 'Round results', exact: true }).waitFor({ timeout: 25000 }); check(await page.locator('.kp-results tbody tr').count() === 10, 'ten-player round reaches results after reconnect');
  await page.screenshot({ path: 'output/playwright/scene-lab/results-ten.png' });
  return report;
}
