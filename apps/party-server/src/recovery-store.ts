import { mkdir, open, readFile, rename, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { MAX_SAVE_BYTES } from '../../../packages/party-contract/src/index';
export type RecoverySlot = 'latest' | 'previous';
export type RecoveryMetadata = { slot: RecoverySlot; savedAt: number; bytes: number };
export type RecoverySave = { save: string; worldId: string };
export type RecoveryStore = { write(gameId: string, worldId: string, save: string, savedAt: number): Promise<void>; list(gameId: string): Promise<RecoveryMetadata[]>; read(gameId: string, slot: RecoverySlot): Promise<RecoverySave>; flush(): Promise<void> };
type Checkpoint = { version: 1; gameId: string; worldId: string; savedAt: number; save: unknown };
export function createRecoveryStore(root: string): RecoveryStore {
  let pending = Promise.resolve();
  const path = (gameId: string, slot: RecoverySlot) => { if (!/^[a-z]+(?:-[a-z]+)*$/.test(gameId) || !['latest', 'previous'].includes(slot)) throw new Error('Invalid recovery selection.'); return join(root, `${gameId}.${slot}.json`); };
  async function readCheckpoint(gameId: string, slot: RecoverySlot): Promise<Checkpoint | null> {
    const file = path(gameId, slot);
    try {
      if ((await stat(file)).size > MAX_SAVE_BYTES) return null;
      const checkpoint = JSON.parse(await readFile(file, 'utf8')) as Checkpoint;
      return checkpoint?.version === 1 && checkpoint.gameId === gameId && typeof checkpoint.worldId === 'string' && checkpoint.worldId.length > 0 && checkpoint.worldId.length <= 80 && Number.isFinite(checkpoint.savedAt) && Object.hasOwn(checkpoint, 'save') ? checkpoint : null;
    } catch (error) { if (error instanceof SyntaxError || (error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
  }
  async function atomic(file: string, value: Checkpoint) {
    const temporary = `${file}.${randomUUID()}.tmp`;
    try {
      const handle = await open(temporary, 'wx', 0o600);
      try { await handle.writeFile(JSON.stringify(value)); await handle.sync(); } finally { await handle.close(); }
      await rename(temporary, file);
    } finally { await rm(temporary, { force: true }); }
  }
  return {
    async write(gameId, worldId, save, savedAt) {
      const file = path(gameId, 'latest');
      if (!worldId || worldId.length > 80 || !Number.isFinite(savedAt)) throw new Error('Invalid recovery checkpoint.');
      const checkpoint: Checkpoint = { version: 1, gameId, worldId, savedAt, save: JSON.parse(save) };
      if (Buffer.byteLength(JSON.stringify(checkpoint)) > MAX_SAVE_BYTES) throw new Error('Recovery save exceeds 256 KiB.');
      const write = pending.then(async () => {
        await mkdir(root, { recursive: true, mode: 0o700 });
        const previous = await readCheckpoint(gameId, 'latest');
        // Keep the previous world across every autosave of the current world.
        if (previous && previous.worldId !== worldId) await atomic(path(gameId, 'previous'), previous);
        await atomic(file, checkpoint);
      });
      pending = write.catch(() => {}); await write;
    },
    async list(gameId) {
      await pending; const result: RecoveryMetadata[] = [];
      for (const slot of ['latest', 'previous'] as const) { const checkpoint = await readCheckpoint(gameId, slot); if (checkpoint) result.push({ slot, savedAt: checkpoint.savedAt, bytes: Buffer.byteLength(JSON.stringify(checkpoint.save)) }); }
      return result;
    },
    async read(gameId, slot) { await pending; const checkpoint = await readCheckpoint(gameId, slot); if (!checkpoint) throw new Error('Recovery save is unavailable or invalid.'); return { save: JSON.stringify(checkpoint.save), worldId: checkpoint.worldId }; },
    async flush() { await pending; },
  };
}
