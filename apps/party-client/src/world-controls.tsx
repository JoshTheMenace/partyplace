import { useEffect, useRef, useState } from 'react';
import { MAX_SAVE_BYTES, type GameManifest } from '../../../packages/party-contract/src/index';
import type { RoomView } from '../../../packages/party-contract/src/protocol';
import type { PartySession } from '../../../packages/party-client/src/session';
import { ArcadeButton, StatusNotice } from '../../../packages/party-ui/src/index';

function downloadWorld(gameId: string, raw: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(raw)], { type: 'application/json' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${gameId}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

type Checkpoint = { slot: 'latest' | 'previous'; savedAt: number; bytes: number };
export function RecoveryControls({ session, gameId, canRestore, connected }: { session: PartySession; gameId: string; canRestore: boolean; connected: boolean }) {
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]), [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false), [retry, setRetry] = useState(0);
  useEffect(() => { let active = true; if (connected) void session.worldRecovery('GET', gameId).then(raw => { if (active) { setCheckpoints((raw as { checkpoints: Checkpoint[] }).checkpoints); setError(''); } }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Could not check saved worlds.'); }); return () => { active = false; }; }, [session, gameId, connected, retry]);
  const run = async (work: () => Promise<void>) => { setBusy(true); setError(''); setNotice(''); try { await work(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'World recovery failed.'); } finally { setBusy(false); } };
  return <section aria-label="Saved worlds" className="kp-recovery-controls">
    <h2>Saved worlds</h2><p>Your latest world is saved on this server every 30 seconds. Keep a downloaded copy for a permanent backup.</p>
    {checkpoints.map(checkpoint => <div key={checkpoint.slot}><p><strong>{checkpoint.slot === 'latest' ? 'Latest world' : 'Previous world'}</strong> · {new Date(checkpoint.savedAt).toLocaleString()}</p><div className="kp-row">
      <ArcadeButton size="sm" disabled={busy || !connected || !canRestore} onClick={() => void run(async () => { await session.worldRecovery('PUT', gameId, checkpoint.slot); })}>{checkpoint.slot === 'latest' ? 'Resume autosave' : 'Resume previous world'}</ArcadeButton>
      <ArcadeButton size="sm" tone="ghost" disabled={busy || !connected} onClick={() => void run(async () => { downloadWorld(gameId, await session.worldRecovery('GET', gameId, checkpoint.slot, true)); setNotice('World save downloaded.'); })}>{checkpoint.slot === 'latest' ? 'Download autosave' : 'Download previous world'}</ArcadeButton>
    </div></div>)}
    {!checkpoints.length && !error && <p>No saved world yet. Start your first expedition.</p>}
    {!!checkpoints.length && !canRestore && <p>Everyone must join and tap Ready before resuming.</p>}
    {error && <StatusNotice tone="error">{error} <ArcadeButton size="sm" tone="ghost" onClick={() => setRetry(value => value + 1)}>Check again</ArcadeButton></StatusNotice>}
    {busy && <StatusNotice>Working…</StatusNotice>}{notice && <StatusNotice tone="success">{notice}</StatusNotice>}
  </section>;
}

export function WorldControls({ session, game, room, onFinish }: { session: PartySession; game: GameManifest; room: RoomView; onFinish(): void }) {
  const input = useRef<HTMLInputElement>(null);
  const [candidate, setCandidate] = useState<{ name: string; raw: unknown } | null>(null);
  const [finish, setFinish] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  if (!room.roundId || !['playing', 'results'].includes(room.phase) || !game.sessionControls?.length) return null;
  const roundId = room.roundId;
  async function run(work: () => Promise<void>) { setBusy(true); setError(''); setNotice(''); try { await work(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'World save failed.'); } finally { setBusy(false); } }
  const save = () => run(async () => {
    const raw = await session.worldSave('GET', roundId);
    downloadWorld(game.id, raw);
    setNotice('World save downloaded. Keep the file to return to this world.');
  });
  return <section aria-label="World controls">
    <div className="kp-row">
      {game.sessionControls.includes('save') && room.phase === 'results' && <ArcadeButton size="sm" disabled={busy} onClick={() => { if (session.send('round.resume', { roundId })) onFinish(); else setError('Reconnect before resuming this world.'); }}>Resume this world</ArcadeButton>}
      {game.sessionControls.includes('save') && <><ArcadeButton size="sm" disabled={busy} onClick={() => void save()}>Save world</ArcadeButton><ArcadeButton size="sm" tone="sky" disabled={busy} onClick={() => input.current?.click()}>Load world</ArcadeButton><input ref={input} type="file" accept=".json,application/json" hidden aria-label="Choose world save" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (!file) return; void run(async () => { if (file.size > MAX_SAVE_BYTES) throw new Error('Choose a world save smaller than 256 KiB.'); let raw: unknown; try { raw = JSON.parse(await file.text()); } catch { throw new Error('The file is not valid JSON.'); } setFinish(false); setCandidate({ name: file.name, raw }); }); }} /></>}
      {game.sessionControls.includes('finish') && room.phase === 'playing' && <ArcadeButton size="sm" tone="lime" disabled={busy} onClick={() => { setCandidate(null); setFinish(true); }}>Finish session</ArcadeButton>}
    </div>
    {candidate && <div><p>Load <strong>{candidate.name}</strong>? This replaces the current world. Everyone keeps their seat. Save this world first if you want to keep it.</p><div className="kp-row"><ArcadeButton tone="coral" disabled={busy} onClick={() => void run(async () => { await session.worldSave('PUT', roundId, candidate.raw); setCandidate(null); setNotice('World loaded. Preparing every screen…'); })}>Replace world</ArcadeButton><ArcadeButton tone="ghost" disabled={busy} onClick={() => setCandidate(null)}>Cancel load</ArcadeButton></div></div>}
    {finish && <div><p>Finish and show everyone’s results? You can save the world from the results screen.</p><div className="kp-row"><ArcadeButton tone="lime" disabled={busy} onClick={() => { if (session.send('round.finish', { roundId })) onFinish(); else setError('Reconnect before finishing the session.'); }}>Show results</ArcadeButton><ArcadeButton tone="ghost" onClick={() => setFinish(false)}>Keep playing</ArcadeButton></div></div>}
    {busy && <StatusNotice>Working…</StatusNotice>}{error && <StatusNotice tone="error">{error}</StatusNotice>}{notice && <StatusNotice tone="success">{notice}</StatusNotice>}
  </section>;
}
