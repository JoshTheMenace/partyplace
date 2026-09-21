/* eslint-disable no-unused-expressions -- Playwright CLI entry point. */
/* Run with the Playwright CLI in an owned, already-playing Night Job room.
 * Uses observed public WebSocket snapshots and real touch or keyboard/button controls only. */
async (page) => {
  const base = page.url().split('/').slice(0, 3).join('/'), browser = page.context().browser();
  const pages = browser.contexts().flatMap(context => context.pages()).filter(p => p.url().startsWith(base));
  const report = { mode: 'real UI controls; public snapshot navigation; no state injection', assertions: [], snapshots: 0, maxBytes: 0, actions: 0, errors: [], players: [], outcome: null, maxVisible: 0 };
  const peers = pages.map(p => ({ page: p, id: null, view: null, keys: new Set(), waypoint: null, target: '', lastTool: 0 }));
  const handlers = [];
  for (const peer of peers) {
    const onSocket = socket => socket.on('framereceived', frame => {
      const packet = JSON.parse(String(frame.payload));
      if (packet.type === 'room.welcome') peer.id = packet.playerId;
      if (packet.type === 'game.snapshot' || packet.type === 'round.results') {
        peer.view = packet.publicView; report.snapshots++; report.maxBytes = Math.max(report.maxBytes, String(frame.payload).length);
        if (packet.outcome) report.outcome = packet.outcome;
      }
      if (packet.type === 'action.ack' && packet.accepted) report.actions++;
      if (packet.type === 'error') report.errors.push(packet.reason);
    });
    const onError = error => report.errors.push(error.message);
    peer.page.on('websocket', onSocket); peer.page.on('pageerror', onError); handlers.push([peer.page, onSocket, onError]);
    await peer.page.reload();
  }
  const wait = ms => page.waitForTimeout(ms);
  const assert = (value, message) => { if (!value) throw Error(message); report.assertions.push(message); };
  const route = (view, from, target) => {
    const w = view.tiles[0].length, start = Math.floor(from.y) * w + Math.floor(from.x), end = Math.floor(target.y) * w + Math.floor(target.x);
    const queue = [start], prev = new Map([[start, -1]]), avoid = new Set(view.objects.filter(o => ['hide', 'vent'].includes(o.kind)).map(o => Math.floor(o.y) * w + Math.floor(o.x)));
    for (let i = 0; i < queue.length && !prev.has(end); i++) {
      const at = queue[i], x = at % w, y = Math.floor(at / w);
      for (const [nx, ny] of [[x + 1,y],[x,y + 1],[x - 1,y],[x,y - 1]]) {
        const tile = view.tiles[ny]?.[nx], n = ny * w + nx;
        if (tile && !'#%=~'.includes(tile) && !prev.has(n) && !avoid.has(n)) { prev.set(n, at); queue.push(n); }
      }
    }
    if (!prev.has(end)) return null;
    let next = end;
    while (prev.get(next) !== start && prev.get(next) !== -1) next = prev.get(next);
    return { x: next % w + .5, y: Math.floor(next / w) + .5 };
  };
  const keys = async (peer, wanted) => {
    if (peer.cdp) {
      if ([...wanted].sort().join() === [...peer.keys].sort().join()) return;
      const x = Number(wanted.has('ArrowRight')) - Number(wanted.has('ArrowLeft')), y = Number(wanted.has('ArrowDown')) - Number(wanted.has('ArrowUp')), length = Math.hypot(x, y) || 1, box = peer.pad;
      const points = wanted.size ? [{ id: 1, x: box.x + box.width / 2 + x / length * box.width * .4, y: box.y + box.height / 2 + y / length * box.height * .4 }] : [];
      await peer.cdp.send('Input.dispatchTouchEvent', { type: wanted.size ? peer.keys.size ? 'touchMove' : 'touchStart' : 'touchEnd', touchPoints: points }); peer.keys = wanted; return;
    }
    for (const key of peer.keys) if (!wanted.has(key)) await peer.page.keyboard.up(key);
    for (const key of wanted) if (!peer.keys.has(key)) await peer.page.keyboard.down(key);
    peer.keys = wanted;
  };
  try {
    for (let i = 0; i < 200 && peers.some(p => !p.view); i++) await wait(25);
    assert(peers.every(p => p.view?.heistId), 'every screen resumes an authoritative heist snapshot');
    const crew = peers.filter(p => p.id);
    assert(crew.length > 0, 'real seated players are present');
    const focus = peer => peer.page.getByRole('button', { name: 'Move: drag or use arrow keys or WASD', exact: true }).focus();
    for (const peer of crew) { await focus(peer); if (crew.length === 1) { peer.cdp = await peer.page.context().newCDPSession(peer.page); peer.pad = await peer.page.getByRole('button', { name: 'Move: drag or use arrow keys or WASD', exact: true }).boundingBox(); report.mode = 'real emulated touch on phone; public snapshots; no state injection'; } }
    await page.screenshot({ path: 'output/playwright/night-job/playing.png' });
    const started = Date.now();
    while (Date.now() - started < 85000 && !report.outcome) {
      await Promise.all(crew.map(async peer => {
        const view = peer.view, me = view.players.find(p => p.id === peer.id);
        if (!me || me.down || ['clear','failed'].includes(view.phase)) { await keys(peer, new Set()); return; }
        const down = view.players.find(p => p.down && !p.suspended);
        const target = down ?? view.objects.find(o => o.kind === (view.objectiveTaken ? 'exit' : 'objective'));
        const targetKey = target.id;
        if (peer.target !== targetKey || !peer.waypoint || Math.hypot(peer.waypoint.x - me.x, peer.waypoint.y - me.y) < .2) {
          peer.target = targetKey; peer.waypoint = route(view, me, target) ?? target;
        }
        const dx = peer.waypoint.x - me.x, dy = peer.waypoint.y - me.y;
        const wanted = new Set();
        if (Math.abs(dx) > .08) wanted.add(dx > 0 ? 'ArrowRight' : 'ArrowLeft');
        if (Math.abs(dy) > .08) wanted.add(dy > 0 ? 'ArrowDown' : 'ArrowUp');
        await keys(peer, wanted);
        if (me.charges && view.guards.some(g => Math.hypot(g.x - me.x,g.y - me.y) < 2.2) && Date.now() - peer.lastTool > 7000 && me.tool === 'smoke') {
          peer.lastTool = Date.now(); await keys(peer, new Set()); await peer.page.locator('[data-tool]').click(); await focus(peer);
        }
      }));
      if (peers[0].view.visible.length > report.maxVisible + 35) { report.maxVisible = peers[0].view.visible.length; await page.screenshot({ path: `output/playwright/night-job/${peers[0].view.mission}-${crew.length}-playing.png` }); }
      await wait(55);
    }
    for (const peer of crew) await keys(peer, new Set());
    report.players = peers[0].view.players.map(({ id, name, health, coins }) => ({ id, name, health, coins }));
    report.phase = peers[0].view.phase; report.elapsed = peers[0].view.elapsed; report.loot = peers[0].view.collected;
    if (report.outcome) await page.locator('.nj-results').waitFor();
    await page.screenshot({ path: `output/playwright/night-job/${peers[0].view.mission}-${crew.length}-end.png`, fullPage: true });
    assert(report.outcome?.complete, 'real controls reach authoritative results');
    assert(report.phase === 'clear', 'crew steals the objective and escapes');
    assert(report.outcome.winners.length === crew.length, 'every teammate shares the win');
    assert(report.loot > 0, 'real movement collects loot');
    assert(!report.errors.length, 'no browser or protocol errors');
    return report;
  } finally {
    for (const peer of peers) { await keys(peer, new Set()); await peer.cdp?.detach(); }
    for (const [target, socket, error] of handlers) { target.off('websocket', socket); target.off('pageerror', error); }
  }
}
