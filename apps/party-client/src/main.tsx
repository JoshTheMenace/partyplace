import { GameDashboard, LibraryNavigation } from './dashboard';
import { GameDetails, GamePage } from './game-page';
import { Link, useRoute } from './routes';
import { library as personalLibrary, useLibrary } from './library-store';
import { gameCatalog, type CatalogGame } from './catalog';
import { useCatalog } from './use-catalog';
import { RecoveryControls, WorldControls } from './world-controls';
import { RoundRuntime } from './round-runtime';
import { Component, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import QRCode from 'qrcode';
import { ArcadeButton, Eyebrow, Modal, Panel, StatusNotice, TextInput } from '../../../packages/party-ui/src/index';
import { PartySession } from '../../../packages/party-client/src/session';
import { MusicBus } from '../../../packages/party-client/src/music';
import { clients, type LoadedClient } from './registry';
import { GameArt, gameLooks } from './art';
import { KartArt } from './dashboard-art';
import '../../../packages/party-ui/src/style.css';
const session = new PartySession({ deferConnection: true });
const music = new MusicBus();
class GameBoundary extends Component<{ children: ReactNode; onFailure(): void }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.error ? <StatusNotice tone="error">The game view could not render. The host can return to the picker and retry.</StatusNotice> : this.props.children; }
}
function App() {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const { room, identity, snapshot } = state;
  const [name, setName] = useState('');
  const curated = useCatalog(), myLibrary = useLibrary();
  const [joinOpen, setJoinOpen] = useState(false);
  const [pendingGame, setPendingGame] = useState<string | null>(null);
  const query = useRef(new URLSearchParams(location.search));
  const [code, setCode] = useState(query.current.get('join') ?? query.current.get('display') ?? '');
  const [module, setModule] = useState<LoadedClient | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<any>({});
  const [addresses, setAddresses] = useState<string[]>([]);
  const [address, setAddress] = useState('');
  const [qr, setQr] = useState('');
  const [confirm, setConfirm] = useState<'picker' | 'abort' | 'close' | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [muted, setMuted] = useState(() => { try { return localStorage.getItem('party.sound.muted') === 'true'; } catch { return false; } });
  const [retryLoad, setRetryLoad] = useState(0);
  const [detailsGame, setDetailsGame] = useState<string | null>(null);
  const route = useRoute();
  const game = state.games.find(item => item.id === room?.gameId);
  const inGameTitle = room && ['playing', 'preparing', 'results'].includes(room.phase) && game ? game.title : '';
  const isHost = !!identity && identity.clientId === room?.hostId;
  const player = room?.players.find(item => item.id === identity?.playerId);
  const role = identity?.playerId ? 'controller' as const : 'display' as const;
  const settingsKey = JSON.stringify(room?.settings ?? {});
  const joinUrl = address && room ? `${address}/?join=${room.code}` : '';
  useEffect(() => { let cancelled = false; async function refresh() { try { const response = await fetch('/api/addresses'); if (!response.ok) throw new Error('Address discovery failed'); const data = await response.json() as { urls: string[] }; if (!cancelled) { setAddresses(data.urls); setAddress(current => data.urls.includes(current) ? current : data.urls[0] ?? ''); } } catch { if (!cancelled) setAddresses([]); } } void refresh(); const timer = setInterval(refresh, 15000); return () => { cancelled = true; clearInterval(timer); }; }, []);
  useEffect(() => { let cancelled = false; setQr(''); if (joinUrl) QRCode.toDataURL(joinUrl, { width: 720, margin: 4, errorCorrectionLevel: 'M', color: { dark: '#05071a', light: '#fff6e5' } }).then(value => { if (!cancelled) setQr(value); }).catch(() => { if (!cancelled) setQr(''); }); return () => { cancelled = true; }; }, [joinUrl]);
  useEffect(() => { setDraft(JSON.parse(settingsKey)); }, [settingsKey]);
  useEffect(() => { setLoadError(null); }, [room?.roundId]);
  useEffect(() => {
    let cancelled = false;
    setModule(null); setLoadError(null);
    if (room?.gameId) { const loader = clients[room.gameId]; if (!loader) setLoadError('This game is unavailable in this browser build. Refresh the page.'); else loader().then(value => { if (!cancelled) setModule(value); }).catch(() => { if (!cancelled) setLoadError('Game files could not load. Check the connection and retry.'); }); }
    return () => { cancelled = true; music.stop(); };
  }, [room?.gameId, retryLoad]);
  useEffect(() => { const neutral = () => { session.releaseInput(); queueMicrotask(session.releaseInput); }; window.addEventListener('blur', neutral); const hidden = () => { if (document.hidden) neutral(); }; document.addEventListener('visibilitychange', hidden); return () => { window.removeEventListener('blur', neutral); document.removeEventListener('visibilitychange', hidden); }; }, []);
  useEffect(() => {
    music.setMuted(muted);
    try { localStorage.setItem('party.sound.muted', String(muted)); } catch {}
    window.dispatchEvent(new CustomEvent('party-sound', { detail: { muted } }));
    if (muted) return;
    const unlock = () => { void music.enable().catch(() => {}); };
    window.addEventListener('pointerdown', unlock, { once: true }); window.addEventListener('keydown', unlock, { once: true });
    return () => { window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  }, [muted]);
  const connected = state.connection === 'connected';
  const canJoin = connected || state.connection === 'idle' || state.connection === 'closed';

  useEffect(() => { if (pendingGame && isHost && room?.phase === 'picker' && connected) { session.send('game.select', { gameId: pendingGame, settings: {}, play: true }); setPendingGame(null); } }, [pendingGame, isHost, room?.phase, connected]);
  const playFromLibrary = (item: CatalogGame) => { if (item.launch === 'unavailable') return; if (item.launch === 'external') { if (item.playUrl) { personalLibrary.touch(item.id); window.open(item.playUrl, '_blank', 'noopener,noreferrer'); } return; } personalLibrary.touch(item.id); setDetailsGame(null); if (room) session.send('game.select', { gameId: item.id, settings: {} }); else { setPendingGame(item.id); session.join('room.create', {}); } };
  useEffect(() => { if (room) setJoinOpen(false); }, [room?.id]);
  useEffect(() => { if (state.error) setPendingGame(null); }, [state.error]);
  const catalog = room ? gameCatalog(state.games) : curated.sources.flatMap(source => source.games);
  const manifestFor = (id: string) => (room ? state.games : curated.games).find(item => item.id === id);
  const savedGame = route.view === 'game' ? myLibrary.games.find(item => item.id === route.id) : undefined;
  const routeGame = route.view === 'game' ? catalog.find(item => item.id === route.id) ?? (savedGame && { ...savedGame, launch: 'unavailable' as const }) : undefined;
  useEffect(() => { if (!room && !query.current.has('join') && !query.current.has('display')) document.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true }); }, [route, routeGame?.id, room?.id]);
  useEffect(() => { document.title = inGameTitle ? `${inGameTitle} · PartyPlay` : routeGame ? `${routeGame.title} · PartyPlay` : `PartyPlay · ${route.view === 'discover' ? 'Discover' : 'My Library'}`; }, [inGameTitle, routeGame?.title, route.view]);
  useEffect(() => { if (room?.phase === 'playing' && room.gameId) personalLibrary.touch(room.gameId); }, [room?.phase, room?.gameId]);
  useEffect(() => { if (!room || room.phase !== 'picker') setDetailsGame(null); }, [room?.phase, room?.id]);
  const readyReason = !game ? 'Choose a game.' : !room ? '' : room.players.length < game.players.min || room.players.length > game.players.max ? `${game.title} needs ${game.players.min}–${game.players.max} players.` : room.players.some(item => !item.connected) ? 'Wait for disconnected players or remove their seats.' : room.players.some(item => !item.ready) ? `Waiting for ${room.players.filter(item => !item.ready).map(item => item.name).join(', ')} to tap Ready.` : '';
  const roster = room && <ul className="kp-roster">{room.players.map(item => <li key={item.id}><strong style={{ color: item.color }}>{item.name}</strong>{item.id === identity?.playerId && ' · You'}<div>{item.connected ? item.ready ? '✓ Ready' : 'Connected' : 'Disconnected'}</div>{isHost && !item.connected && ['picker','lobby','results'].includes(room.phase) && <ArcadeButton size="sm" tone="ghost" onClick={() => session.send('room.remove', { playerId: item.id })}>Remove {item.name}</ArcadeButton>}</li>)}</ul>;
  const renderFailure = (error?: unknown) => { session.releaseInput(); setLoadError(error instanceof Error ? error.message : 'The game could not render.'); if (room?.roundId && ['preparing','playing'].includes(room.phase)) session.send('round.failed', { roundId: room.roundId }); };
  const loadingNotice = loadError && <StatusNotice tone="error"><span>{loadError} If this page is out of date, refresh to reconnect to your seat.</span><span className="kp-row"><ArcadeButton size="sm" onClick={() => setRetryLoad(value => value + 1)}>Retry loading</ArcadeButton><ArcadeButton size="sm" tone="sky" onClick={() => location.reload()}>Refresh and reconnect</ArcadeButton></span></StatusNotice>;
  const deepJoin = query.current.has('join') || query.current.has('display');
  const inGame = room && ['playing', 'preparing', 'results'].includes(room.phase);
  const phone = !!identity?.playerId && !isHost;
  const joinForm = <form className="kp-join-form" onSubmit={event => { event.preventDefault(); session.join('room.join', { code: code.toUpperCase(), name: name.trim(), role: query.current.has('display') ? 'display' : 'controller' }); }}>
    <label>Room code<TextInput value={code} maxLength={6} autoCapitalize="characters" autoComplete="off" onChange={event => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} required /></label>
    {!query.current.has('display') && <label>Your name<TextInput value={name} maxLength={16} autoComplete="nickname" autoFocus={deepJoin} onChange={event => setName(event.target.value)} required /></label>}
    <ArcadeButton size="lg" tone="sky" disabled={!canJoin || code.length !== 6 || (!query.current.has('display') && !name.trim())}>{query.current.has('display') ? 'Join as display' : 'Join the room'}</ArcadeButton>
  </form>;
  const roomRail = room && !phone && <aside className="kp-room-rail"><Panel className="kp-join-rail"><Eyebrow>Phones, scan to join</Eyebrow>{qr && <img className="kp-qr" src={qr} alt="Scan to join this room" />}<div className="kp-code kp-numeral">{room.code}</div>{joinUrl ? <a className="kp-join-address" href={joinUrl}>{address.replace(/^https?:\/\//, '')}</a> : <StatusNotice tone="error">Invite address unavailable. Reload to try again.</StatusNotice>}<button className="kp-text-button" onClick={() => setHelpOpen(true)}>Connection help</button></Panel><Panel className="kp-seat-rail"><div className="kp-rail-heading"><h2>Your people</h2><span>{room.players.length}/10</span></div>{roster}{!room.players.length && <div className="kp-empty-seats"><span aria-hidden="true">＋ ＋ ＋</span><p>Your people go here.<br/>Scan to join, or choose a solo game.</p></div>}</Panel></aside>;
  const hostActions = isHost && <>{game && <ArcadeButton size="sm" tone="ghost" onClick={() => { setMenuOpen(false); setConfirm(inGame && room.phase !== 'results' ? 'abort' : 'picker'); }}>{inGame && room.phase !== 'results' ? 'End round' : 'Back to picker'}</ArcadeButton>}<ArcadeButton size="sm" tone="ghost" onClick={() => { setMenuOpen(false); setConfirm('close'); }}>Close room</ArcadeButton></>;
  return <main className={`kp-shell ${inGame ? 'kp-shell-playing' : ''} ${phone ? 'kp-shell-phone' : ''}`}><header className="kp-header">{room ? <div className="kp-header-brand"><span className="kp-brand-mark" aria-hidden="true">✦</span><span className="kp-display">{inGame && game ? game.title : 'PartyPlay'}</span></div> : <Link route={{ view: 'home' }} className="kp-header-brand kp-header-brand-link" aria-label="PartyPlay home" onClick={event => { if (deepJoin) { event.preventDefault(); location.assign('/'); } }}><span className="kp-brand-mark" aria-hidden="true">✦</span><span className="kp-display">PartyPlay</span></Link>}<div className="kp-header-actions">{room && <span className="kp-session-pill">{phone ? player?.name ?? name : isHost ? '' : 'Watching'} <b className="kp-numeral">{room.code}</b></span>}<ArcadeButton size="sm" tone="ghost" onClick={() => { if (muted) void music.enable().then(() => setMuted(false)).catch(() => setLoadError('Sound could not start. Tap Sound on again.')); else { music.setMuted(true); setMuted(true); } }}>{muted ? 'Sound off' : 'Sound on'}</ArcadeButton>{isHost && inGame && <ArcadeButton size="sm" tone="ghost" onClick={() => setMenuOpen(true)}>Room menu</ArcadeButton>}</div></header>
    {state.error && <StatusNotice tone="error">{state.error}</StatusNotice>}{room?.notice && <StatusNotice>{room.notice}</StatusNotice>}{room && !room.hostConnected && <StatusNotice>The host disconnected. This room stays open for two minutes while they reconnect.</StatusNotice>}
    {!room || !identity ? deepJoin ? <Panel className="kp-quick-join"><Eyebrow>Your phone is your controller</Eyebrow><h1>You're invited.</h1><p>Enter your name. The fun is on the big screen.</p>{joinForm}<button className="kp-text-button" onClick={() => setHelpOpen(true)}>Trouble joining?</button></Panel> : <><LibraryNavigation view={route.view}/>{route.view === 'game' ? <GamePage id={route.id} game={routeGame} loading={curated.loading} all={catalog} manifest={manifestFor(route.id)} onPlay={playFromLibrary} canPlay={canJoin && !pendingGame} onJoin={() => { setJoinOpen(true); }} origin={address || location.origin}/> : <GameDashboard key={route.view} view={route.view} games={catalog} sources={curated.sources} loading={curated.loading} onPlay={playFromLibrary} canPlay={canJoin && !pendingGame} actions={<><ArcadeButton size="sm" tone="ghost" onClick={() => setJoinOpen(true)}>Join with a code</ArcadeButton>{route.view === 'discover' && <button className="kp-text-button" onClick={() => void curated.refresh()}>Refresh sources</button>}</>}/>}{curated.error && <StatusNotice tone="error">{curated.error} <button className="kp-text-button" onClick={() => void curated.refresh()}>Retry</button></StatusNotice>}{pendingGame && <StatusNotice>Opening your game room…</StatusNotice>}<button className="kp-text-button" onClick={() => setHelpOpen(true)}>Setup & connection help</button></> : <>
      {!inGame ? <div className={`kp-room-layout ${phone ? 'kp-room-layout-phone' : ''}`}>{roomRail}<section className="kp-room-main">
        {room.phase === 'picker' && <>{phone && <p className="kp-waiting-copy">You're in, {player?.name ?? name}. The host picks the game. Keep this page open for your controls.</p>}<GameDashboard games={catalog} onPlay={playFromLibrary} onOpen={item => setDetailsGame(item.id)} canPlay={isHost && connected} inRoom/></>}
        {game && room.phase === 'lobby' && <GameBoundary key={`${game.id}:lobby`} onFailure={renderFailure}><div className="kp-lobby-title">{game.id === 'kart-party' ? <KartArt/> : <GameArt id={game.id}/>}<div><Eyebrow>{game.players.min}–{game.players.max} players · {game.orientation.controller} phones</Eyebrow><h1>{game.title}</h1><p>{gameLooks[game.id]?.verb ?? game.description}</p></div></div>{loadingNotice}{!module && !loadError && <StatusNotice>Loading {game.title}…</StatusNotice>}{module && <><div className="kp-lobby-launch">{player && !isHost && <><p>{player.ready ? 'You’re ready. Watch the shared screen.' : `Ready, ${player.name}?`}</p><ArcadeButton size="xl" tone={player.ready ? 'ghost' : 'lime'} disabled={!connected} onClick={() => session.send('room.ready', { ready: !player.ready })}>{player.ready ? 'Not ready' : 'Ready to play'}</ArcadeButton></>}{isHost && <>{game.supportsSolo && <ArcadeButton size="sm" tone="ghost" disabled={!connected} onClick={() => session.send('room.play', { play: !player })}>{player ? 'Watch only' : 'Play on this device'}</ArcadeButton>}<div><Eyebrow>{room.players.filter(item => item.ready).length}/{room.players.length} ready</Eyebrow><p>{readyReason || 'Everyone is ready. Let’s play.'}</p></div><ArcadeButton size="lg" disabled={!!readyReason || !connected} onClick={() => session.send('round.start')}>Start game</ArcadeButton><ArcadeButton size="sm" tone="ghost" onClick={() => setSettingsOpen(true)}>Settings</ArcadeButton></>}</div><Panel className="kp-instructions-panel"><module.InstructionsView role={role}/></Panel>{isHost && game.sessionControls?.includes('save') && <RecoveryControls key={game.id} session={session} gameId={game.id} connected={connected} canRestore={!readyReason}/> }{phone && <details className="kp-player-details"><summary>Who's here · {room.players.length} players</summary>{roster}</details>}</>}</GameBoundary>}
      </section></div> : game && <GameBoundary key={`${game.id}:${room.roundId}:${room.phase === 'results'}`} onFailure={renderFailure}>
        {loadingNotice}{!module && !loadError && <StatusNotice>Loading {game.title}…</StatusNotice>}
        {module && <RoundRuntime key={retryLoad} module={module} room={room} snapshot={snapshot} playerId={identity.playerId} isHost={isHost} connected={connected} game={game} session={session} onError={renderFailure} onDispose={() => music.stop()}/>}
      </GameBoundary>}
      {isHost && !inGame && <footer className="kp-room-footer"><span className="kp-muted">One room. Keep your seat between games.</span><div className="kp-row">{hostActions}</div></footer>}
    </>}
    {state.connection === 'closed' && <ArcadeButton tone="ghost" onClick={() => location.reload()}>Open a new session</ArcadeButton>}
    {detailsGame && room && catalog.some(item => item.id === detailsGame) && <Modal title="Game details" wide onClose={() => setDetailsGame(null)}><GameDetails game={catalog.find(item => item.id === detailsGame)!} all={catalog} manifest={manifestFor(detailsGame)} inRoom canPlay={isHost && connected} onPlay={playFromLibrary} onOpen={item => setDetailsGame(item.id)} origin={address || location.origin}/></Modal>}
    {joinOpen && <Modal title="Join your people" onClose={() => setJoinOpen(false)}>{joinForm}</Modal>}
    {helpOpen && <Modal title="Get everyone connected" onClose={() => setHelpOpen(false)}><p>Open PartyPlay on a laptop or TV everyone can see. Pick a game, then have players scan the room’s QR code or enter its code on their phones.</p>{addresses.length > 1 && <label>Choose network address<select value={address} onChange={event => setAddress(event.target.value)}>{addresses.map(url => <option key={url}>{url}</option>)}</select></label>}{joinUrl && <p><a href={joinUrl}>{joinUrl}</a></p>}<p>Use the same site address on every device. A local network address needs the same Wi-Fi; a public link works over the internet. Remote players still need to see the shared display, for example through a screen-sharing call.</p><p className="kp-muted">Kart Party, Blockwild and Kitchen Rush can also be played alone on this device.</p></Modal>}
    {settingsOpen && module && <Modal title={`${game?.title} settings`} wide={module.settingsWide} onClose={() => setSettingsOpen(false)}><module.SettingsView settings={draft} onChange={setDraft} disabled={!isHost || !connected}/><ArcadeButton tone="sky" onClick={() => { session.send('game.select', { gameId: game!.id, settings: draft }); setSettingsOpen(false); }}>Apply settings</ArcadeButton></Modal>}
    {menuOpen && <Modal title="Room controls" onClose={() => setMenuOpen(false)}><div className="kp-row">{hostActions}</div>{isHost && game && room && <WorldControls key={room.roundId} session={session} game={game} room={room} onFinish={() => setMenuOpen(false)} />}</Modal>}
    {confirm && <Modal title={confirm === 'close' ? 'Close this room?' : confirm === 'abort' ? 'End this round?' : 'Return to the game picker?'} onClose={() => setConfirm(null)}><p>{confirm === 'close' ? 'Everyone will be disconnected and will need to join a new room.' : 'Current round progress will end. Everyone keeps their seat and connection.'}</p><ArcadeButton tone="coral" onClick={() => { session.send(confirm === 'close' ? 'room.close' : confirm === 'abort' ? 'round.abort' : 'room.returnToPicker', confirm === 'abort' ? { roundId: room?.roundId } : {}); setConfirm(null); }}>Confirm</ArcadeButton></Modal>}
  </main>;

}
createRoot(document.getElementById('root')!).render(<App />);
window.addEventListener('pagehide', () => { session.dispose(); music.dispose(); });
