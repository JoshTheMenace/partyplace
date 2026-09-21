/* eslint-disable no-unused-expressions -- Playwright CLI entry point. */
/* Replay the same real crew into the next authored job. */
async (page) => {
  const title = await page.locator('.nj-results .kp-eyebrow').textContent();
  const next = title === 'The Velvet Ledger' ? 'Glasshouse Exchange' : title === 'Glasshouse Exchange' ? 'Last Ferry' : 'The Velvet Ledger';
  const base = page.url().split('/').slice(0, 3).join('/');
  const peers = page.context().browser().contexts().flatMap(c => c.pages()).filter(p => p.url().startsWith(base));
  if (await page.locator('.nj-canvas').count()) throw Error('Results leaked a scene canvas');
  await page.getByRole('button', { name: 'Play again', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('radio', { name: new RegExp(`^${next}`) }).click();
  await page.getByRole('button', { name: 'Apply settings', exact: true }).click();
  for (const peer of peers.filter(p => p !== page)) await peer.getByRole('button', { name: 'Ready to play', exact: true }).click();
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  await page.locator('.nj-hud, .nj-controller').waitFor();
  return { mission: next, canvases: await Promise.all(peers.map(p => p.locator('.nj-canvas').count())) };
}
