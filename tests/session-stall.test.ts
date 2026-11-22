import assert from 'node:assert/strict';
import test from 'node:test';
import { PartySession } from '../packages/party-client/src/session';

// A game scene that compiles shaders can block a phone's only thread for many seconds. The session's liveness timer then
// runs before the messages queued behind it; treating that as a dead connection reloaded the scene that had just loaded.
test('a blocked main thread is not a silent connection; a quiet socket still is', t => {
  const originals = ['WebSocket', 'location', 'sessionStorage'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  const sockets: FakeSocket[] = [];
  class FakeSocket {
    static OPEN = 1; readyState = 0; closed: number | null = null; onopen?: () => void; onclose?: (event: { code: number }) => void; onmessage?: (event: { data: string }) => void;
    constructor() { sockets.push(this); }
    send() {}
    close(code = 1000) { this.readyState = 3; this.closed = code; }
  }
  Object.defineProperty(globalThis, 'WebSocket', { configurable: true, value: FakeSocket });
  Object.defineProperty(globalThis, 'location', { configurable: true, value: { protocol: 'http:', host: 'localhost:4360' } });
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: { getItem: () => null, setItem() {}, removeItem() {} } });
  let now = 1_000_000; const realNow = Date.now; Date.now = () => now;
  t.mock.timers.enable({ apis: ['setInterval', 'setTimeout'] });
  const session = new PartySession({ deferConnection: true });
  try {
    session.join('room.create', {}); const socket = sockets[0]; socket.readyState = 1; socket.onopen?.();
    const run = (ms: number) => { for (let passed = 0; passed < ms; passed += 500) { now += 500; t.mock.timers.tick(500); } };
    const pong = () => socket.onmessage?.({ data: JSON.stringify({ v: '1.0', type: 'clock.pong', clientTime: now, serverTime: now }) });
    run(14000); assert.equal(socket.closed, null, 'fourteen quiet seconds are tolerated');
    pong(); run(5000);
    // The thread stalls for twenty seconds: no timer, no message handler. The first timer afterwards must not hang up.
    now += 20000; t.mock.timers.tick(500); assert.equal(socket.closed, null, 'the stall itself is forgiven');
    pong(); run(10000); assert.equal(socket.closed, null);
    // Now the server really goes quiet while the page keeps running.
    run(16000); assert.equal(socket.closed, 4000, 'sixteen quiet seconds on a running page close the socket');
  } finally { session.dispose(); Date.now = realNow; for (const [key, descriptor] of originals) if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
});
