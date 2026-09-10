import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FixedStepClock, ResourceScope, FrameMetrics, SnapshotBuffer, usesScene } from '../packages/party-runtime/src/index';
import { HeldInputChannel } from '../packages/party-client/src/held-input';
test('fixed steps are identical across irregular scheduling; deadlines survive bounded catch-up', () => {
  const run = (times: number[]) => { const clock = new FixedStepClock(1000), steps: number[][] = []; times.forEach(time => clock.advance(time, (dt, now) => steps.push([dt, now]))); return { clock, steps }; };
  const a = run(Array.from({ length: 125 }, (_, i) => 1000 + (i + 1) * 8)), b = run(Array.from({ length: 40 }, (_, i) => 1000 + (i + 1) * 25));
  assert.equal(a.steps.length, 60); assert.deepEqual(a.steps, b.steps); assert.equal(a.steps[0][0], 1 / 60);
  const count = a.steps.length; a.clock.advance(1900, () => assert.fail()); a.clock.advance(NaN, () => assert.fail()); assert.equal(a.steps.length, count);
  const clock = new FixedStepClock(0); const times: number[] = []; assert.equal(clock.advance(10000, (dt, now) => { assert.equal(dt, 1 / 60); times.push(now); }), 6);
  assert(clock.droppedMs > 9899); assert(Math.abs(times.at(-1)! - 10000) < 1e-6); assert.throws(() => new FixedStepClock(0, 1000));
});
test('held input coalesces bursts, keeps a stationary hold alive, copies values, and releases immediately', () => {
  const packets: unknown[] = [], channel = new HeldInputChannel((kind, value) => packets.push({ kind, value })); const input = { x: 1 };
  channel.set(input, 0); input.x = 99;
  for (let i = 1; i < 50; i++) channel.set({ x: i }, i);
  assert.equal(packets.length, 1); assert.deepEqual(packets[0], { kind: 'state', value: { x: 1 } });
  channel.flush(50); assert.deepEqual(packets[1], { kind: 'state', value: { x: 49 } });
  for (let time = 100; time <= 2000; time += 50) channel.flush(time); assert.equal(packets.length, 41);
  channel.release(); assert.deepEqual(packets.at(-1), { kind: 'release', value: undefined }); const count = packets.length;
  channel.release(); channel.flush(5000); assert.equal(packets.length, count);
  channel.set({ x: 1 }, 5001); channel.release(false); channel.flush(6000); assert.equal(packets.length, count + 1);
});
test('resource scopes abort children, remove listeners, dispose once in reverse order and clean late resources', () => {
  const parent = new ResourceScope(), child = new ResourceScope(parent.signal), calls: number[] = [], events = new EventTarget();
  child.defer(() => calls.push(1)); child.own({ dispose: () => calls.push(2) }); child.listen(events, 'test', () => calls.push(3)); events.dispatchEvent(new Event('test'));
  parent.dispose(); parent.dispose(); child.dispose(); events.dispatchEvent(new Event('test')); child.own({ dispose: () => calls.push(4) });
  assert.deepEqual(calls, [3, 2, 1, 4]); assert(child.signal.aborted); const late = new ResourceScope(parent.signal); assert(late.signal.aborted);
});
test('snapshot interpolation is delayed, bounded and never extrapolates; metrics retain bounded frame samples', () => {
  const buffer = new SnapshotBuffer<number>(100, 3), mix = (a: number, b: number, alpha: number) => a + (b - a) * alpha;
  buffer.push(1000, 0); buffer.push(1100, 10); buffer.push(1050, 999); assert.equal(buffer.sample(1150, mix), 5); assert.equal(buffer.sample(1400, mix), 10);
  buffer.push(1200, 20); buffer.push(1300, 30); assert.equal(buffer.sample(1000, mix), 10); buffer.clear(); assert.equal(buffer.sample(2000, mix), undefined);
  const metrics = new FrameMetrics(3); [60, 10, 20, 30, NaN].forEach(time => metrics.record(time)); assert.deepEqual(metrics.snapshot(), { frames: 4, slowFrames: 1, sampleCount: 3, p50Ms: 20, p95Ms: 20, maxMs: 30 });
});

test('small timer jitter does not halve held-input cadence', () => { let sent = 0; const channel = new HeldInputChannel(() => sent++); channel.set({ x: 1 }, 0); for (let i = 1; i <= 40; i++) channel.flush(i * 50 - (i % 2 ? .2 : .4)); assert(sent >= 39); });

test('controller scenes require opt-in and active membership; ordinary display scenes remain the default', () => { const module = { SceneView: () => null }; assert.equal(usesScene(module, 'display', true), true); assert.equal(usesScene(module, 'controller', true), false); const personal = { ...module, sceneRoles: ['display', 'controller'] as const }; assert.equal(usesScene(personal, 'controller', true), true); assert.equal(usesScene(personal, 'controller', false), false); assert.equal(usesScene({ sceneRoles: ['controller'] }, 'controller', true), false); });
