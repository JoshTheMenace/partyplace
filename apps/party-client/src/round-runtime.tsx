import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArcadeButton, Countdown, Panel, RotatePrompt, StatusNotice, usePhoneOrientation } from '../../../packages/party-ui/src/index';
import { usesScene } from '../../../packages/party-runtime/src/scene-policy';
import { ResourceScope } from '../../../packages/party-runtime/src/resources';
import type { GameManifest } from '../../../packages/party-contract/src/index';
import type { RoomView, Snapshot } from '../../../packages/party-contract/src/protocol';
import type { PartySession } from '../../../packages/party-client/src/session';
import type { LoadedClient } from './registry';
type Props = { module: LoadedClient; room: RoomView; snapshot: Snapshot | null; playerId: string | null; isHost: boolean; connected: boolean; game: GameManifest; session: PartySession; onError(error: unknown): void; onDispose(): void };
export function RoundRuntime({ module, room, snapshot, playerId, isHost, connected, game, session, onError, onDispose }: Props) {
  const [boot, setBoot] = useState<{ scope: ResourceScope; roundId: string; ready: boolean } | null>(null);
  const callbacks = useRef({ onError, onDispose }); callbacks.current = { onError, onDispose };
  const role = playerId ? 'controller' : 'display';
  const results = room.phase === 'results';
  const orientation = usePhoneOrientation(), landscapePhone = !!playerId && orientation.phone && game.orientation[isHost ? 'personalView' : 'controller'] === 'landscape';
  const blocked = landscapePhone && orientation.portrait && !results, blockedRef = useRef(blocked); blockedRef.current = blocked;
  const setInput = useCallback((input: unknown) => { if (!blockedRef.current) session.setInput(input); }, [session]);
  const sendAction = useCallback((action: unknown) => blockedRef.current ? Promise.resolve({ accepted: false, reason: 'Turn your phone sideways to play.' }) : session.sendAction(action), [session]);
  useLayoutEffect(() => { if (blocked) { session.releaseInput(); if (document.pointerLockElement) document.exitPointerLock(); } }, [blocked, session]);
  const active = !playerId || room.activePlayerIds.includes(playerId), needsScene = usesScene(module, isHost ? 'display' : role, active);
  useEffect(() => {
    if (!connected || !room.roundId) return;
    const scope = new ResourceScope(), roundId = room.roundId;
    scope.defer(() => { session.releaseInput(); module.dispose(); callbacks.current.onDispose(); });
    Promise.resolve().then(() => { if (!scope.signal.aborted) return module.prepare({ role, signal: scope.signal, assetBase: game.assetBase }); }).then(() => {
      if (scope.signal.aborted) return;
      if (needsScene && !results) setBoot({ scope, roundId, ready: false });
      else {
        const first = requestAnimationFrame(() => { const second = requestAnimationFrame(() => { if (!scope.signal.aborted) { setBoot({ scope, roundId, ready: true }); session.assetsReady(roundId); } }); scope.defer(() => cancelAnimationFrame(second)); });
        scope.defer(() => cancelAnimationFrame(first));
      }
    }).catch(error => { if (!scope.signal.aborted) callbacks.current.onError(error); });
    return scope.dispose;
  }, [module, room.roundId, role, connected, game.assetBase, session, needsScene, results]);
  const current = boot?.roundId === room.roundId && !boot.scope.signal.aborted && connected ? boot : null;
  const sceneReady = () => { if (current && !current.ready) { setBoot({ ...current, ready: true }); session.assetsReady(current.roundId); } };
  const sceneError = (error: unknown) => { if (current) { current.scope.dispose(); callbacks.current.onError(error); } };
  const validSnapshot = snapshot?.roundId === room.roundId ? snapshot : null;
  const playing = room.phase === 'playing' && current?.ready && validSnapshot;
  const view = playing && active && !blocked && (() => { const View = playerId ? isHost && module.PersonalView ? module.PersonalView : module.ControllerView : module.DisplayView; return <View roomId={room.id} roundId={room.roundId!} playerId={playerId} viewRole={role} isHost={isHost} connected={connected} publicView={validSnapshot!.publicView} privateView={validSnapshot!.privateView} serverNowMs={session.serverNowMs} setInput={setInput} releaseInput={session.releaseInput} sendAction={sendAction} assetsReady={() => session.assetsReady(room.roundId)}/>; })();
  const hasScene = !!needsScene && room.phase !== 'results';
  return <><div className={landscapePhone && !results ? 'kp-landscape-controller' : undefined} inert={blocked}>
    {hasScene ? <div className={`kp-scene-stage kp-scene-stage-${role}`} data-view-role={role}>
      {current && module.SceneView && <div className="kp-scene-surface"><module.SceneView key={current.roundId + String(current.scope.signal.aborted)} roundId={current.roundId} phase={room.phase as 'preparing' | 'playing'} players={room.players.filter(p => room.activePlayerIds.includes(p.id))} settings={room.settings} playerId={playerId} viewRole={role} isHost={isHost} connected={connected} privateView={validSnapshot?.privateView ?? null} setInput={setInput} releaseInput={session.releaseInput} sendAction={sendAction} publicView={validSnapshot?.publicView ?? null} snapshotTime={validSnapshot?.serverTime ?? null} signal={current.scope.signal} serverNowMs={session.serverNowMs} onReady={sceneReady} onError={sceneError}/></div>}
      <div className="kp-scene-overlay">{room.phase === 'preparing' ? <StatusNotice>{current?.ready ? 'Scene ready. Waiting for the other screens…' : 'Loading the scene and warming up graphics…'}{room.startAt && <Countdown deadline={room.startAt} serverNowMs={session.serverNowMs}/>}</StatusNotice> : view}</div>
    </div> : <>
      {room.phase === 'preparing' && <Panel className="kp-preparing"><h1>{room.startAt ? 'Here we go.' : 'Everyone getting ready…'}</h1>{room.startAt && <Countdown deadline={room.startAt} serverNowMs={session.serverNowMs}/>}<module.InstructionsView role={role}/></Panel>}
      {view && <fieldset disabled={!connected} className="kp-game-viewport">{view}</fieldset>}
    </>}
    {room.phase === 'playing' && !active && <StatusNotice>You joined after the round began. Watch the shared screen; you will play in the next round.</StatusNotice>}
    {room.phase === 'playing' && !playing && <StatusNotice>{connected ? 'Preparing your view…' : 'Reconnecting. Controls are released.'}</StatusNotice>}
    {room.phase === 'results' && current && validSnapshot?.outcome && <Panel className="kp-round-results">{module.ResultsView ? <module.ResultsView outcome={validSnapshot.outcome} publicView={validSnapshot.publicView} playerId={playerId} isHost={isHost}/> : <><h1>Round results</h1><table className="kp-results"><thead><tr><th>Player</th><th>Result</th></tr></thead><tbody>{validSnapshot.outcome.rows.map(row => <tr key={row.playerId}><td>{room.players.find(p => p.id === row.playerId)?.name ?? 'Player'}</td><td>{row.score ?? row.label ?? row.rank ?? 'Finished'}</td></tr>)}</tbody></table></>}{isHost ? <div className="kp-row kp-result-actions"><ArcadeButton size="lg" onClick={() => session.send('game.select', { gameId: game.id, settings: room.settings })}>Play again</ArcadeButton><ArcadeButton size="lg" tone="sky" onClick={() => session.send('room.returnToPicker')}>Choose another game</ArcadeButton></div> : <StatusNotice>Stay connected. The host will choose a rematch or the next game.</StatusNotice>}</Panel>}
  </div>{blocked && <RotatePrompt/>}</>;
}
