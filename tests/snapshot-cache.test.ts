import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SnapshotEncoder, SnapshotDecoder, snapshotForCursor, validateSnapshotCache } from '../packages/party-contract/src/snapshot-cache';
const policy = { revisionField: 'revision', fields: ['edits'] };
test('terrain cache sends a baseline, compresses unchanged edits, and reconstructs complete views without touching private state', () => {
  const encoder = new SnapshotEncoder(), decoder = new SnapshotDecoder();
  const view = { revision: 0, edits: Array.from({ length: 4096 }, (_, i) => [i, 3]), time: 1 };
  const wire = (publicView = view, roundId = 'one') => ({ roundId, revision: 1, serverTime: 1, privateView: { inventory: [9] }, ...encoder.encode(roundId, publicView, policy) });
  const first = wire(); assert.equal(first.publicCache?.reused, false); assert.deepEqual(decoder.decode(first, policy)?.publicView, view);
  const second = wire({ ...view, time: 2 }); assert.equal(second.publicCache?.reused, true); assert(JSON.stringify(second).length < JSON.stringify(first).length / 100);
  assert.deepEqual(decoder.decode(second, policy)?.publicView, { ...view, time: 2 }); assert.deepEqual(second.privateView, { inventory: [9] }); assert.equal(view.edits.length, 4096);
  const changed = wire({ ...view, revision: 1, edits: [] }); assert.equal(changed.publicCache?.reused, false); assert.deepEqual(decoder.decode(changed, policy)?.publicView, { ...view, revision: 1, edits: [] });
  assert.equal(wire(view, 'two').publicCache?.reused, false);
  decoder.reset(); assert.equal(decoder.decode(wire(view, 'two'), policy), null);
  encoder.reset(); assert(decoder.decode(wire(view, 'two'), policy));
  assert.deepEqual(new SnapshotEncoder().encode('one', view), { publicView: view });
});
test('cache rejects invalid policies and incomplete baselines', () => {
  for (const fields of [[], ['revision'], ['constructor'], ['edits', 'edits']]) assert.throws(() => validateSnapshotCache({ ...policy, fields }));
  assert.throws(() => new SnapshotEncoder().encode('one', { revision: -1, edits: [] }, policy));
  const decoder = new SnapshotDecoder();
  assert.equal(decoder.decode({ roundId: 'one', revision: 1, serverTime: 1, publicView: { revision: 1 }, privateView: null, publicCache: { revision: 1, reused: false } }, policy), null);
});

test('keyed terrain deltas insert, replace and remove against exact revisions; missing deltas recover by baseline', () => {
  const policy = { revisionField: 'revision', fields: ['edits'], keyedPairsFields: ['edits'] }, encoder = new SnapshotEncoder(), decoder = new SnapshotDecoder();
  const original = Array.from({ length: 16384 }, (_, i) => [i, 1]);
  const wire = (revision: number, edits: number[][]) => ({ roundId: 'world', revision, serverTime: revision, privateView: null, ...encoder.encode('world', { revision, edits, time: revision }, policy) });
  const baseline = wire(0, original); assert(decoder.decode(baseline, policy));
  const edited = original.filter(([key]) => key !== 5).map(([key, value]) => [key, key === 9 ? 3 : value]); edited.push([90000, 2]);
  const delta = wire(1, edited); assert.deepEqual(delta.publicCache?.patches?.edits, { set: [[9, 3], [90000, 2]], remove: [5] });
  assert(JSON.stringify(delta).length < 400); assert(JSON.stringify(baseline).length > 150000);
  const decoded = decoder.decode(delta, policy)!; assert.deepEqual((decoded.publicView as any).edits, edited); assert.deepEqual(original[9], [9, 1]);
  assert(decoder.decode(wire(1, edited), policy));
  wire(2, [...edited, [90001, 3]]); const skipped = wire(3, [...edited, [90002, 3]]); assert.equal(decoder.decode(skipped, policy), null);
  encoder.reset(); const recovery = wire(3, [...edited, [90002, 3]]); assert.equal(recovery.publicCache?.patches, undefined); assert(decoder.decode(recovery, policy));
  const empty = wire(4, []); assert.equal(empty.publicCache?.patches, undefined); assert.deepEqual((decoder.decode(empty, policy)!.publicView as any).edits, []);
  assert.throws(() => encoder.encode('world', { revision: 5, edits: [[1, 2], [1, 3]] }, policy));
  assert.throws(() => validateSnapshotCache({ ...policy, keyedPairsFields: ['privateView'] }));
});


test('one shared delta serves current recipients while new, stale and rejoined screens receive baselines', () => {
  const policy = { revisionField: 'revision', fields: ['edits'], keyedPairsFields: ['edits'] }, encoder = new SnapshotEncoder();
  const first = { revision: 1, edits: Array.from({ length: 100 }, (_, i) => [i, 1]), time: 1 };
  encoder.encode('world', first, policy);
  const next = { ...first, revision: 2, edits: first.edits.map(([key, value]) => [key, key === 3 ? 5 : value]), time: 2 }, delta = encoder.encode('world', next, policy);
  assert.deepEqual(snapshotForCursor('world', next, delta, policy, { roundId: 'world', revision: 1 }), delta);
  for (const cursor of [undefined, { roundId: 'world', revision: 0 }, { roundId: 'old-world', revision: 1 }]) {
    const baseline = snapshotForCursor('world', next, delta, policy, cursor); assert.equal(baseline.publicCache?.reused, false); assert.equal(baseline.publicCache?.patches, undefined); assert.deepEqual(baseline.publicView, next);
  }
  const current = snapshotForCursor('world', next, delta, policy, { roundId: 'world', revision: 2 }); assert.equal(current.publicCache?.reused, true); assert.deepEqual(current.publicView, { revision: 2, time: 2 });
});
