import type { ActionResult } from '../../../packages/party-contract/src/index';

// Only the authenticated client can retire commands it has acknowledged or abandoned.
// Missing sequences remain usable until explicitly retired; arrival order is irrelevant.
export class ActionWindow {
  retiredThrough = 0;
  highestSequence = 0;
  readonly entries = new Map<number, { payload: string; result: ActionResult }>();
  constructor(readonly capacity: number) {}
  execute(actionId: string, retireThrough: unknown, payload: string, apply: () => ActionResult): ActionResult {
    const sequence = Number(actionId);
    if (!Number.isSafeInteger(sequence) || sequence < 1 || String(sequence) !== actionId || !Number.isSafeInteger(retireThrough) || Number(retireThrough) < 0 || Number(retireThrough) >= sequence) throw new Error('Invalid action sequence or retirement watermark.');
    if (sequence <= this.retiredThrough) throw new Error('This action was retired and cannot execute again.');
    if (sequence - Math.max(this.retiredThrough, Number(retireThrough)) > this.capacity) throw new Error('Action window is full. Wait for pending submissions.');
    if (Number(retireThrough) > this.retiredThrough) {
      this.retiredThrough = Number(retireThrough);
      for (const id of this.entries.keys()) if (id <= this.retiredThrough) this.entries.delete(id);
    }
    const previous = this.entries.get(sequence);
    if (previous) return previous.payload === payload ? previous.result : { accepted: false, reason: 'Action ID reused with different payload.' };
    const result = apply();
    this.entries.set(sequence, { payload, result });
    this.highestSequence = Math.max(this.highestSequence, sequence);
    return result;
  }
}
