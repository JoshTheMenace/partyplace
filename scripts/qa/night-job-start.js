/* eslint-disable no-unused-expressions -- Playwright CLI entry point. */
/* Start the maximum roster through the real lobby, with a watching host. */
async (page) => {
  const browser = page.context().browser(), base = page.url().split('/').slice(0, 3).join('/');
  if (await page.getByRole('button', { name: 'Watch only', exact: true }).count()) throw Error('TV must not occupy a player seat');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('switch', { name: 'Relaxed · guards hurt less' }).check();
  await page.getByRole('button', { name: 'Apply settings', exact: true }).click();
  const code = await page.locator('.kp-code').textContent(), phones = [];
  for (let i = 0; i < 4; i++) {
    const context = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
    const phone = await context.newPage(); phones.push(phone);
    await phone.goto(`${base}/?join=${code}`);
    await phone.getByRole('textbox', { name: 'Your name' }).fill(['Locksmith','Lookout','Collector','Negotiator'][i].padEnd(16, 'X'));
    await phone.getByRole('button', { name: 'Join the room', exact: true }).click();
    await phone.getByRole('radio', { name: new RegExp(`^${['Cracker','Scout','Magpie','Face'][i]} `) }).click();
    if (i === 0) await phone.screenshot({ path: 'output/playwright/night-job/phone-lobby.png', fullPage: true });
    await phone.getByRole('button', { name: 'Ready to play', exact: true }).click();
  }
  await page.screenshot({ path: 'output/playwright/night-job/host-lobby.png', fullPage: true });
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  await phones[0].locator('.nj-controller').waitFor();
  await page.locator('.nj-hud').waitFor();
  await page.screenshot({ path: 'output/playwright/night-job/host-four-start.png' });
  await phones[0].screenshot({ path: 'output/playwright/night-job/phone-four-start.png' });
  for (const phone of phones) if (await phone.locator('canvas').count()) throw Error('A controller must not render a map');
  return { room: code, players: 4, hostCanvas: await page.locator('canvas').count(), phoneCanvases: await Promise.all(phones.map(p => p.locator('canvas').count())) };
}
