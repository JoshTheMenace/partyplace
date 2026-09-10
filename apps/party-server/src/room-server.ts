import { assertSerializable } from '../../../packages/party-contract/src/serializable';
export { assertSerializable } from '../../../packages/party-contract/src/serializable';
import { SnapshotEncoder, snapshotForCursor, validateSnapshotCache, type SnapshotCursor } from '../../../packages/party-contract/src/snapshot-cache';
import { FixedStepClock } from '../../../packages/party-runtime/src/fixed-step';
import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocket, WebSocketServer } from 'ws';
import { CONTRACT_VERSION, MAX_MESSAGE_BYTES, MAX_SAVE_BYTES, type GameManifest, type GameRules, type ActionResult } from '../../../packages/party-contract/src/index';
import type { RoomPhase, RoomView, Wire } from '../../../packages/party-contract/src/protocol';
import type { RecoverySlot, RecoveryStore } from './recovery-store';
// Type erasure is confined to registry dispatch; games remain strictly typed at their exports.
export type RegisteredGame = { manifest: GameManifest; rules: GameRules<any, any, any, any, any, any> };
type Identity = { id: string; token: string; playerId: string | null; name: string; color: string; ready: boolean; socket: WebSocket | null; seq: number; disconnectedAt: number | null };
type PublicFrame = { revision: number; phase: RoomPhase; time: number; view: unknown; encoded: ReturnType<SnapshotEncoder['encode']> };
type Round = { encoder: SnapshotEncoder; publicFrame: PublicFrame | null; id: string; worldId: string; game: RegisteredGame; state: any; players: string[]; inputs: Map<string, unknown>; inputAt: Map<string, number>; required: Set<string>; loaded: Set<string>; deadline: number; startAt: number | null; acks: Map<string, { payload: string; result: ActionResult }>; actionCounts: Map<string, number>; clock: FixedStepClock | null; lastLegacyTick: number; lastLegacySchedule: number; lastSnapshot: number };
const COLORS = ['#ff5748','#28c6e7','#78d955','#b58aff','#ffd24a','#ff90ba','#56decd','#ffa260','#97aeff','#e2ef93'];
function record(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected an object.'); return value as Record<string, unknown>; }
function string(value: unknown, max = 80): string { if (typeof value !== 'string' || !value.length || value.length > max) throw new Error('Invalid text value.'); return value; }

function canonical(value: unknown): string { return JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a],[b]) => a.localeCompare(b))) : item); }
export function validateManifest(manifest: GameManifest): void {
  assertSerializable(manifest);
  if (manifest.snapshotCache) validateSnapshotCache(manifest.snapshotCache);
  if (manifest.sessionControls && (!Array.isArray(manifest.sessionControls) || manifest.sessionControls.some(control => !['save', 'finish'].includes(control)) || new Set(manifest.sessionControls).size !== manifest.sessionControls.length)) throw new Error('Invalid session controls.');
  const sim = manifest.simulation;
  if (sim && (manifest.timing !== 'realtime' || !Number.isInteger(sim.stepHz) || sim.stepHz < 15 || sim.stepHz > 120 || !Number.isInteger(sim.snapshotHz) || sim.snapshotHz < 1 || sim.snapshotHz > Math.min(30, sim.stepHz) || !Number.isInteger(sim.maxCatchUpSteps) || sim.maxCatchUpSteps < 1 || sim.maxCatchUpSteps > 12)) throw new Error('Invalid simulation profile.');
  if (manifest.contractVersion !== CONTRACT_VERSION || !/^[a-z]+(?:-[a-z]+)*$/.test(manifest.id) || !manifest.title || manifest.title.length > 80 || !manifest.description || manifest.description.length > 500 || manifest.assetBase !== `/games/${manifest.id}/` || !Array.isArray(manifest.modes) || manifest.modes.length !== 1 || manifest.modes[0] !== 'shared-display' || !Number.isInteger(manifest.players.min) || !Number.isInteger(manifest.players.max) || manifest.players.min < 1 || manifest.players.max > 10 || manifest.players.max < manifest.players.min || !['portrait','landscape','any'].includes(manifest.orientation.controller) || !['portrait','landscape','any'].includes(manifest.orientation.personalView) || !['turn-based','realtime'].includes(manifest.timing) || !Array.isArray(manifest.input) || !manifest.input.length || manifest.input.some(value => !['state','action'].includes(value)) || typeof manifest.privatePlayerViews !== 'boolean' || typeof manifest.supportsSolo !== 'boolean' || manifest.supportsSolo && manifest.players.min !== 1) throw new Error(`Invalid or unsupported manifest: ${manifest.id}`);
}
export function createRoomServer(server: Server, games: RegisteredGame[], options: { managed?: boolean; code?: string; now?: () => number; prepareTimeoutMs?: number; startDelayMs?: number; hostGraceMs?: number; heartbeatIntervalMs?: number; heartbeatTimeoutMs?: number; recoveryStore?: RecoveryStore; recoveryIntervalMs?: number; tickMs?: number; seed?: () => number } = {}) {
  for (const game of games) { validateManifest(game.manifest); if (game.manifest.sessionControls?.includes('save') && (!game.rules.exportSave || !game.rules.loadSave) || game.manifest.sessionControls?.includes('finish') && !game.rules.finish) throw new Error('Missing session control hooks.'); assertSerializable(game.rules.validateSettings({})); }
  if (new Set(games.map(game => game.manifest.id)).size !== games.length) throw new Error('Duplicate game IDs.');
  const registry = new Map(games.map(game => [game.manifest.id, game]));
  const now = options.now ?? Date.now;
  const identities = new Map<string, Identity>();
  const sockets = new Set<WebSocket>();
  const heartbeats = new WeakMap<WebSocket, { lastPing: number; waitingSince: number | null }>();
  const checkpointTimes = new WeakMap<Round, number>();
  let closing = false;
  const snapshotCursors = new WeakMap<WebSocket, SnapshotCursor>();
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES });
  const upgrade = (request: IncomingMessage, socket: Duplex, head: Buffer) => { if (request.url?.split('?')[0] === '/ws') wss.handleUpgrade(request, socket, head, peer => wss.emit('connection', peer, request)); };
  if (!options.managed) server.on('upgrade', upgrade);
  let roomId = '', code = '', hostId = '', phase: RoomPhase = 'picker', revision = 0, selected: RegisteredGame | null = null, settings: unknown = {}, round: Round | null = null, notice: string | null = null;
  const players = () => [...identities.values()].filter(identity => identity.playerId !== null);
  const view = (): RoomView => ({ id: roomId, code, revision, phase, hostId, hostConnected: !!identities.get(hostId)?.socket, players: players().map(identity => ({ id: identity.playerId!, name: identity.name, color: identity.color, connected: !!identity.socket, ready: identity.ready })), gameId: selected?.manifest.id ?? null, settings, roundId: round?.id ?? null, activePlayerIds: round?.players ?? [], startAt: round?.startAt ?? null, preparationDeadline: round?.deadline ?? null, notice });
  function send(socket: WebSocket | null, type: string, data: Record<string, unknown> = {}) {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    if (socket.bufferedAmount > 2 * 1024 * 1024) { socket.close(1013, 'Connection too slow. Reconnect.'); return; }
    const envelope = { v: CONTRACT_VERSION, type, ...data }; assertSerializable(envelope); socket.send(JSON.stringify(envelope));
  }
  function broadcastRoom() { revision++; for (const identity of identities.values()) send(identity.socket, 'room.state', { room: view() }); }
  function snapshot(identity: Identity) {
    if (!round || round.state === null || phase === 'preparing' || identity.socket?.readyState !== WebSocket.OPEN) return;
    const ctx = { nowMs: now(), phase: phase === 'results' ? 'results' as const : 'playing' as const };
    if (!round.publicFrame || round.publicFrame.revision !== revision || round.publicFrame.phase !== phase) {
      const projected = round.game.rules.publicView(round.state, ctx);
      round.publicFrame = { revision, phase, time: ctx.nowMs, view: projected, encoded: round.encoder.encode(round.id, projected, round.game.manifest.snapshotCache) };
    }
    const frame = round.publicFrame, encoded = snapshotForCursor(round.id, frame.view, frame.encoded, round.game.manifest.snapshotCache, snapshotCursors.get(identity.socket));
    send(identity.socket, phase === 'results' ? 'round.results' : 'game.snapshot', { roundId: round.id, revision, serverTime: frame.time, ...encoded, privateView: identity.playerId && round.players.includes(identity.playerId) ? round.game.rules.playerView(round.state, identity.playerId, { ...ctx, nowMs: frame.time }) : null, ...(phase === 'results' ? { outcome: round.game.rules.outcome(round.state) } : {}) });
    if (encoded.publicCache) snapshotCursors.set(identity.socket, { roundId: round.id, revision: encoded.publicCache.revision });
  }

  function serializeWorld(current: Round) {
    const save = current.game.rules.exportSave!(current.state); assertSerializable(save);
    const json = JSON.stringify(save); if (Buffer.byteLength(json) > MAX_SAVE_BYTES) throw new Error('World save exceeds 256 KiB.'); return json;
  }
  function checkpoint(current: Round | null = round) {
    if (!options.recoveryStore || !current || current.state === null || !current.game.manifest.sessionControls?.includes('save')) return;
    checkpointTimes.set(current, performance.now()); const owner = roomId;
    let save: string;
    try { validateViews(current.game, current.state, current.id, current.players, phase === 'results' ? 'results' : 'playing'); save = serializeWorld(current); }
    catch (error) { queueMicrotask(() => { if (!closing && round === current) failRound(error); }); return; }
    const failed = (error: unknown) => { if (closing) console.error('Automatic world save failed during shutdown', error); else if (roomId === owner && round === current) { notice = `Automatic world save failed: ${error instanceof Error ? error.message : 'Storage unavailable'}. Download a world save from the Room menu.`; broadcastRoom(); } };
    try { void options.recoveryStore.write(current.game.manifest.id, current.worldId, save, now()).catch(failed); } catch (error) { queueMicrotask(() => failed(error)); }
  }
  function disposeState(current: Round) { try { current.game.rules.dispose(current.state); } catch (error) { console.error('Game cleanup failed', error); } }
  function clearRound(persist = true) { const old = round; if (persist) checkpoint(old); round = null; if (old?.state !== null && old) disposeState(old); for (const identity of identities.values()) { identity.ready = identity.id === hostId && !!identity.playerId; identity.seq = -1; } }
  function failRound(error: unknown, preserveWorld = false) {
    const reason = error instanceof Error ? error.message : typeof error === 'string' ? error : 'Game error', current = round;
    if (preserveWorld && current?.state != null && current.game.manifest.sessionControls?.includes('save') && current.game.rules.finish) {
      try {
        current.game.rules.finish(current.state, now());
        const outcome = current.game.rules.outcome(current.state); assertSerializable(outcome); if (!outcome.complete) throw new Error('World did not pause.');
        validateViews(current.game, current.state, current.id, current.players, 'results'); serializeWorld(current);
        current.inputs.clear(); current.inputAt.clear(); current.lastSnapshot = -Infinity; phase = 'results';
        notice = `Round stopped: ${reason}. Your world is paused. Save or resume it from the Room menu.`;
        checkpoint(current); broadcastRoom(); return;
      } catch { /* Broken game hooks must not overwrite the last known good checkpoint. */ }
    }
    clearRound(false); phase = selected ? 'lobby' : 'picker'; notice = `Round stopped: ${reason}. ${options.recoveryStore && selected?.manifest.sessionControls?.includes('save') ? 'The host can restore an available autosave from the lobby.' : 'The host can retry.'}`; broadcastRoom();
  }
  function endRoom(message: string) { for (const identity of identities.values()) { send(identity.socket, 'room.closed', { reason: message }); identity.socket?.close(1000, 'Room closed'); } clearRound(); identities.clear(); roomId = ''; code = ''; hostId = ''; selected = null; settings = {}; phase = 'picker'; notice = null; }
  function beginIfReady() { if (!round || phase !== 'preparing' || round.startAt !== null || [...round.required].some(id => !round!.loaded.has(id) || !identities.get(id)?.socket)) return; round.startAt = now() + (options.startDelayMs ?? 1000); broadcastRoom(); for (const identity of identities.values()) send(identity.socket, 'round.begin', { roundId: round.id, startAt: round.startAt }); }
  function requireHost(identity: Identity) { if (identity.id !== hostId) throw new Error('Only the room host can do that.'); }
  function requireRound(message: Wire) { if (!round || message.roundId !== round.id) throw new Error('This action belongs to an old round.'); return round; }
  function welcome(identity: Identity) { send(identity.socket, 'room.welcome', { clientId: identity.id, playerId: identity.playerId, token: identity.token, room: view(), games: games.map(game => game.manifest) }); snapshot(identity); }
  function authorizeSave(token: string, roundId: string) {
    const identity = [...identities.values()].find(item => item.token === token);
    if (!identity) throw new Error('Host authentication required.');
    requireHost(identity);
    if (!round || round.id !== roundId || round.state === null || !['playing', 'results'].includes(phase)) throw new Error('This world is no longer available.');
    if (!round.game.manifest.sessionControls?.includes('save')) throw new Error('This game does not support world saves.');
    return round;
  }
  function exportSave(token: string, roundId: string) {
    return serializeWorld(authorizeSave(token, roundId));
  }
  function validateViews(game: RegisteredGame, state: unknown, id: string, roster: string[], viewPhase: 'playing' | 'results') {
    const ctx = { nowMs: now(), phase: viewPhase }, projection = game.rules.publicView(state, ctx); assertSerializable(projection);
    new SnapshotEncoder().encode(id, projection, game.manifest.snapshotCache);
    for (const player of roster) assertSerializable(game.rules.playerView(state, player, ctx));
    assertSerializable(game.rules.outcome(state));
  }
  function loadSave(token: string, roundId: string, raw: unknown) {
    const current = authorizeSave(token, roundId);
    return importWorld(current.game, raw, current);
  }
  function importWorld(game: RegisteredGame, raw: unknown, current: Round | null, worldId: string = randomUUID()) {
    assertSerializable(raw);
    if (Buffer.byteLength(JSON.stringify(raw)) > MAX_SAVE_BYTES) throw new Error('World save exceeds 256 KiB.');
    const roster = players(), id = randomUUID(), time = now();
    const { min, max } = game.manifest.players;
    if (roster.length < min || roster.length > max || roster.some(item => !item.socket)) throw new Error('Connect every player before loading a world.');
    let candidate: { state: any; settings: unknown } | undefined;
    try {
      candidate = game.rules.loadSave!({ roomId, roundId: id, players: roster.map(item => ({ id: item.playerId!, name: item.name, color: item.color })), seed: options.seed?.() ?? randomInt(0x7fffffff), nowMs: time }, raw, structuredClone(settings));
      if (candidate.state === null || candidate.state === undefined || candidate.state === current?.state) throw new Error('World import must return a fresh state.');
      candidate.settings = game.rules.validateSettings(candidate.settings); assertSerializable(candidate.settings);
      validateViews(game, candidate.state, id, roster.map(item => item.playerId!), 'playing');
    } catch (error) { if (candidate?.state != null && candidate.state !== current?.state) { try { game.rules.dispose(candidate.state); } catch { /* Preserve the import validation error. */ } } throw error; }
    checkpoint(current);
    round = { game, encoder: new SnapshotEncoder(), publicFrame: null, id, worldId, state: candidate.state, players: roster.map(item => item.playerId!), inputs: new Map(), inputAt: new Map(), required: new Set([...identities.values()].filter(item => item.socket).map(item => item.id)), loaded: new Set(), deadline: time + (options.prepareTimeoutMs ?? 20000), startAt: null, acks: new Map(), actionCounts: new Map(), clock: null, lastLegacyTick: time, lastLegacySchedule: -Infinity, lastSnapshot: -Infinity };
    settings = candidate.settings; phase = 'preparing'; notice = null;
    for (const identity of identities.values()) { identity.seq = -1; identity.ready = false; }
    if (current) disposeState(current);
    broadcastRoom();
    for (const identity of identities.values()) send(identity.socket, 'round.prepare', { roundId: id, gameId: game.manifest.id, deadline: round.deadline });
    return { roundId: id };
  }
  function authorizeRecovery(token: string, gameId: string) {
    const identity = [...identities.values()].find(item => item.token === token); if (!identity) throw new Error('Host authentication required.'); requireHost(identity);
    if (!options.recoveryStore) throw new Error('Automatic world recovery is not enabled on this server.');
    if (!selected || selected.manifest.id !== gameId || !selected.manifest.sessionControls?.includes('save')) throw new Error('Select a game with world saves first.');
    return selected;
  }
  async function recoveryMetadata(token: string, gameId: string) { authorizeRecovery(token, gameId); const checkpoints = await options.recoveryStore!.list(gameId); authorizeRecovery(token, gameId); return { checkpoints }; }
  async function exportRecovery(token: string, gameId: string, slot: RecoverySlot) { authorizeRecovery(token, gameId); const checkpoint = await options.recoveryStore!.read(gameId, slot); authorizeRecovery(token, gameId); return checkpoint.save; }
  async function restoreRecovery(token: string, gameId: string, slot: RecoverySlot) {
    authorizeRecovery(token, gameId); const checkpoint = await options.recoveryStore!.read(gameId, slot), game = authorizeRecovery(token, gameId);
    if (phase !== 'lobby' || players().some(player => !player.socket || !player.ready)) throw new Error('Return to the lobby and have every player connect and tap Ready before restoring.');
    return importWorld(game, JSON.parse(checkpoint.save), null, checkpoint.worldId);
  }
  wss.on('connection', (socket, request) => {
    // Same-origin LAN browsers only. Non-browser test clients may omit Origin.
    if (request.headers.origin) { try { if (new URL(request.headers.origin).host !== request.headers.host) { socket.close(1008, 'Use this server address.'); return; } } catch { socket.close(1008, 'Invalid origin'); return; } }
    if (sockets.size >= 32) { socket.close(1013, 'Server connection limit'); return; }
    sockets.add(socket);
    const heartbeat = { lastPing: performance.now(), waitingSince: null as number | null }; heartbeats.set(socket, heartbeat);
    socket.on('pong', () => { heartbeat.waitingSince = null; });
    let identity: Identity | null = null, windowAt = now(), messageCount = 0;
    const authenticationTimeout = setTimeout(() => { if (!identity) socket.close(1008, 'Join the room first'); }, 15000);
    socket.on('error', () => {});
    socket.on('message', (buffer, binary) => {
      let message: Wire | null = null;
      try {
        if (binary || (Array.isArray(buffer) ? buffer.reduce((sum, item) => sum + item.byteLength, 0) : buffer.byteLength) > MAX_MESSAGE_BYTES) throw new Error('Use JSON messages smaller than 32 KiB.');
        if (now() - windowAt >= 1000) { windowAt = now(); messageCount = 0; }
        if (++messageCount > 80) throw new Error('Too many messages. Wait a moment.');
        message = record(JSON.parse(buffer.toString())) as Wire; assertSerializable(message);
        if (message.v !== CONTRACT_VERSION) throw new Error('VERSION: Refresh this browser to use the current game collection.');
        string(message.type, 40);
        if (message.type === 'clock.ping') { if (!Number.isFinite(message.clientTime)) throw new Error('Invalid clock time.'); send(socket, 'clock.pong', { clientTime: message.clientTime, serverTime: now() }); return; }
        if (!identity) {
          if (message.type === 'room.rejoin') {
            const token = string(message.token, 128); const found = [...identities.values()].find(item => item.token === token);
            if (!found || message.code !== code) throw new Error('REJOIN: Saved seat expired. Join the room again.');
            const previous = found.socket; found.socket = socket; identity = found; if (identity.id === hostId && identity.playerId) identity.ready = true; identity.seq = -1; identity.disconnectedAt = null; previous?.close(4001, 'Seat resumed on another connection');
            if (round && phase === 'preparing' && round.required.has(identity.id)) { round.loaded.delete(identity.id); round.startAt = null; }
            if (round && identity.playerId && round.players.includes(identity.playerId)) { round.inputs.set(identity.playerId, round.game.rules.neutralInput()); round.inputAt.delete(identity.playerId); if (round.state !== null) round.game.rules.onPresenceChange(round.state, identity.playerId, true, now()); }
          } else if (message.type === 'room.create' || message.type === 'room.join') {
            if (message.type === 'room.create' && roomId) throw new Error('A room is already open. Use its join code.');
            if (message.type === 'room.join' && (!roomId || message.code !== code)) throw new Error('Room code not found. Check the six characters.');
            const display = message.type === 'room.create' || message.role === 'display';
            if (!display && players().length >= 10) throw new Error('All ten seats are occupied. Ask the host to remove a disconnected player.');
            if (display && [...identities.values()].filter(item => !item.playerId).length >= 12) throw new Error('Display limit reached.');
            const name = display ? 'Shared display' : string(message.name, 16).trim(); if (!name) throw new Error('Enter a player name.');
            const id = randomUUID(); identity = { id, token: randomBytes(32).toString('hex'), playerId: display ? null : id, name, color: display ? COLORS[0] : COLORS[players().length], ready: false, socket, seq: -1, disconnectedAt: null };
            identities.set(id, identity);
            if (message.type === 'room.create') { roomId = randomUUID(); code = options.code ?? Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[randomInt(31)]).join(''); hostId = id; }
          } else throw new Error('Join or resume the room first.');
          clearTimeout(authenticationTimeout); broadcastRoom(); welcome(identity); return;
        }
        if (identity.socket !== socket) throw new Error('This connection was replaced.');
        switch (message.type) {
          case 'room.play': {
            requireHost(identity);
            if (phase !== 'lobby' || !selected?.manifest.supportsSolo || typeof message.play !== 'boolean') throw Error('Choose a solo-capable game before joining on this screen.');
            if (message.play && !identity.playerId && players().length >= selected.manifest.players.max) throw Error('All player seats are occupied.');
            identity.color = COLORS.find(color => !players().some(player => player !== identity && player.color === color)) ?? COLORS[0];
            identity.playerId = message.play ? identity.id : null; identity.name = 'Host'; identity.ready = message.play;
            broadcastRoom(); welcome(identity); break;
          }
          case 'room.ready': if (phase !== 'lobby' || !identity.playerId || typeof message.ready !== 'boolean') throw new Error('Ready is only available in the lobby.'); identity.ready = message.ready; broadcastRoom(); break;
          case 'game.select': {
            requireHost(identity); if (phase !== 'picker' && phase !== 'lobby' && phase !== 'results') throw new Error('End the current round before selecting a game.');
            const game = registry.get(string(message.gameId)); if (!game) throw new Error('Unknown game.');
            const validated = game.rules.validateSettings(message.settings ?? {}); assertSerializable(validated);
            clearRound(); selected = game; settings = validated; phase = 'lobby'; notice = null;
            if (!game.manifest.supportsSolo) identity.playerId = null;
            else if (message.play === true && players().length === 0) { identity.playerId = identity.id; identity.name = 'Host'; }
            if (identity.playerId) identity.ready = true;
            broadcastRoom(); welcome(identity); break;
          }
          case 'round.start': {
            requireHost(identity); if (!selected || phase !== 'lobby') throw new Error('Select a game and wait in the lobby first.');
            const roster = players(); const { min, max } = selected.manifest.players;
            if (roster.length < min || roster.length > max) throw new Error(`This game needs ${min}–${max} players.`);
            if (roster.some(item => !item.socket || !item.ready)) throw new Error('Every player must be connected and Ready. Remove disconnected seats or wait for them.');
            settings = selected.rules.validateSettings(settings); assertSerializable(settings);
            round = { encoder: new SnapshotEncoder(), publicFrame: null, id: randomUUID(), worldId: randomUUID(), game: selected, state: null, players: roster.map(item => item.playerId!), inputs: new Map(), inputAt: new Map(), required: new Set([...identities.values()].filter(item => item.socket).map(item => item.id)), loaded: new Set(), deadline: now() + (options.prepareTimeoutMs ?? 20000), startAt: null, acks: new Map(), actionCounts: new Map(), clock: null, lastLegacyTick: now(), lastLegacySchedule: -Infinity, lastSnapshot: -Infinity };
            phase = 'preparing'; notice = null; broadcastRoom(); for (const item of identities.values()) send(item.socket, 'round.prepare', { roundId: round.id, gameId: selected.manifest.id, deadline: round.deadline }); break;
          }
          case 'round.ready': { const current = requireRound(message); if (phase !== 'preparing') throw new Error('Preparation has ended.'); current.loaded.add(identity.id); beginIfReady(); break; }
          case 'round.failed': { const current = requireRound(message); if (!['preparing','playing'].includes(phase) || !current.required.has(identity.id)) throw new Error('This screen cannot stop the round.'); failRound(`${identity.name} could not load or render the game`, true); break; }
          case 'game.action': {
            const current = requireRound(message); const actionId = string(message.actionId, 80);
            if (!identity.playerId || !current.players.includes(identity.playerId)) throw new Error('Spectators cannot submit game actions.');
            const key = `${identity.playerId}:${actionId}`, payload = canonical(message.payload ?? null), previous = current.acks.get(key);
            if (previous) { send(socket, 'action.ack', { roundId: current.id, actionId, ...(previous.payload === payload ? previous.result : { accepted: false, reason: 'Action ID reused with different payload.' }) }); break; }
            const count = current.actionCounts.get(identity.playerId) ?? 0;
            if (count >= 256) throw new Error('Round action limit reached.');
            let result: ActionResult;
            try { if (phase !== 'playing' || current.state === null) throw new Error('This round is not accepting actions.'); const action = current.game.rules.parseAction(message.payload); current.game.rules.applyAction(current.state, identity.playerId, action, now()); result = { accepted: true }; }
            catch (error) { result = { accepted: false, reason: error instanceof Error ? error.message : 'Invalid action.' }; }
            current.acks.set(key, { payload, result }); current.actionCounts.set(identity.playerId, count + 1);
            send(socket, 'action.ack', { roundId: current.id, actionId, ...result }); revision++; break;
          }
          case 'input.release':
          case 'input.state': { if (!round || message.roundId !== round.id || phase !== 'playing') break; const current = round; if (!identity.playerId || !current.players.includes(identity.playerId) || !Number.isSafeInteger(message.seq) || Number(message.seq) < 0) throw new Error('Invalid held input.'); if (Number(message.seq) <= identity.seq) break; const input = message.type === 'input.release' ? current.game.rules.neutralInput() : current.game.rules.parseInput(message.payload); identity.seq = Number(message.seq); current.inputs.set(identity.playerId, input); current.inputAt.set(identity.playerId, now()); break; }
          case 'snapshot.sync': requireRound(message); snapshotCursors.delete(socket); snapshot(identity); break;
          case 'round.resume': { requireHost(identity); const current = requireRound(message); if (phase !== 'results' || current.state === null || !current.game.manifest.sessionControls?.includes('save')) throw new Error('This world can only be resumed from results.'); validateViews(current.game, current.state, current.id, current.players, 'results'); importWorld(current.game, JSON.parse(serializeWorld(current)), current, current.worldId); break; }
          case 'round.finish': { requireHost(identity); const current = requireRound(message); if (phase !== 'playing' || current.state === null || !current.game.manifest.sessionControls?.includes('finish')) throw new Error('This session cannot be finished now.'); current.game.rules.finish!(current.state, now()); if (!current.game.rules.outcome(current.state).complete) throw new Error('The game did not finish.'); phase = 'results'; current.lastSnapshot = -Infinity; checkpoint(current); broadcastRoom(); break; }
          case 'round.abort': requireHost(identity); requireRound(message); clearRound(); phase = 'lobby'; notice = 'Round ended by the host.'; broadcastRoom(); break;
          case 'room.returnToPicker': requireHost(identity); clearRound(); selected = null; settings = {}; phase = 'picker'; notice = null; broadcastRoom(); break;
          case 'room.remove': { requireHost(identity); if (phase !== 'picker' && phase !== 'lobby' && phase !== 'results') throw new Error('Remove seats between rounds.'); const seat = identities.get(string(message.playerId)); if (!seat?.playerId || seat.socket) throw new Error('Only disconnected player seats can be removed.'); identities.delete(seat.id); broadcastRoom(); break; }
          case 'room.close': requireHost(identity); endRoom('The host closed the room.'); break;
          default: throw new Error('Unknown message type. Refresh the browser.');
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'Invalid request.';
        if (message?.type === 'game.action' && typeof message.actionId === 'string' && message.actionId.length <= 80 && typeof message.roundId === 'string' && message.roundId.length <= 80) send(socket, 'action.ack', { roundId: message.roundId, actionId: message.actionId, accepted: false, reason });
        else send(socket, 'error', { code: reason.startsWith('VERSION:') ? 'VERSION' : reason.startsWith('REJOIN:') ? 'REJOIN' : 'REQUEST', reason });
      }
    });
    socket.on('close', () => {
      clearTimeout(authenticationTimeout); sockets.delete(socket);
      if (!identity || identity.socket !== socket) return;
      identity.socket = null; identity.ready = false; identity.disconnectedAt = now();
      if (round && phase === 'preparing' && round.required.has(identity.id)) { round.loaded.delete(identity.id); round.startAt = null; }
      try { if (round && identity.playerId && round.players.includes(identity.playerId)) { round.inputs.set(identity.playerId, round.game.rules.neutralInput()); if (round.state !== null) round.game.rules.onPresenceChange(round.state, identity.playerId, false, now()); } broadcastRoom(); } catch (error) { failRound(error); }
    });
  });
  const timer = setInterval(() => {
    const time = now(), scheduleTime = performance.now();
    try {
      for (const socket of sockets) {
        const heartbeat = heartbeats.get(socket)!;
        if (heartbeat.waitingSince !== null) { if (scheduleTime - heartbeat.waitingSince >= (options.heartbeatTimeoutMs ?? 10000)) socket.terminate(); }
        else if (socket.readyState === WebSocket.OPEN && scheduleTime - heartbeat.lastPing >= (options.heartbeatIntervalMs ?? 5000)) { heartbeat.lastPing = heartbeat.waitingSince = scheduleTime; socket.ping(); }
      }
      const host = identities.get(hostId); if (host?.disconnectedAt !== null && host?.disconnectedAt !== undefined && time - host.disconnectedAt > (options.hostGraceMs ?? 120000)) { endRoom('Host did not reconnect within two minutes. Create a new room.'); return; }
      if (round && phase === 'preparing') {
        if (round.startAt !== null && time >= round.startAt) {
          if ([...round.required].some(id => !identities.get(id)?.socket)) { failRound('A required screen disconnected before the start'); return; }
          if (round.state === null) round.state = round.game.rules.create({ roomId, roundId: round.id, players: players().filter(item => round!.players.includes(item.playerId!)).map(item => ({ id: item.playerId!, name: item.name, color: item.color })), seed: options.seed?.() ?? randomInt(0x7fffffff), nowMs: round.startAt }, settings);
          if (round.game.manifest.simulation) round.clock = new FixedStepClock(round.startAt, round.game.manifest.simulation.stepHz, round.game.manifest.simulation.maxCatchUpSteps);
          round.lastLegacyTick = time;
          for (const id of round.players) round.inputs.set(id, round.game.rules.neutralInput()); phase = 'playing'; broadcastRoom();
          checkpoint(round);
        } else if (time >= round.deadline && round.startAt === null) { const missing = [...round.required].filter(id => !round!.loaded.has(id) || !identities.get(id)?.socket).map(id => identities.get(id)?.name ?? 'A screen'); failRound(`Loading timed out for ${missing.join(', ')}`); return; }
      }
      if (round?.state !== null && round && phase === 'playing') {
        const current = round;
        for (const [id, at] of current.inputAt) if (time - at > 1500) { current.inputs.set(id, current.game.rules.neutralInput()); current.inputAt.delete(id); }
        const tick = (dt: number, at: number) => { if (!current.game.rules.outcome(current.state).complete) current.game.rules.tick(current.state, current.inputs, dt, at); revision++; };
        if (current.clock) current.clock.advance(time, tick);
        else if (scheduleTime - current.lastLegacySchedule >= (options.tickMs ?? 100)) { tick(Math.min(.1, Math.max(0, (time - current.lastLegacyTick) / 1000)), time); current.lastLegacyTick = time; current.lastLegacySchedule = Number.isFinite(current.lastLegacySchedule) ? current.lastLegacySchedule + Math.floor((scheduleTime - current.lastLegacySchedule) / (options.tickMs ?? 100)) * (options.tickMs ?? 100) : scheduleTime; }
        if (current.game.rules.outcome(current.state).complete) { phase = 'results'; current.lastSnapshot = -Infinity; checkpoint(current); broadcastRoom(); }
        if (scheduleTime - (checkpointTimes.get(current) ?? -Infinity) >= (options.recoveryIntervalMs ?? 30000)) checkpoint(current);
      }
      if (round?.state !== null && round && (phase === 'playing' || phase === 'results') && scheduleTime - round.lastSnapshot >= (round.game.manifest.simulation ? 1000 / round.game.manifest.simulation.snapshotHz : options.tickMs ?? 100)) {
        const period = round.game.manifest.simulation ? 1000 / round.game.manifest.simulation.snapshotHz : options.tickMs ?? 100;
        round.lastSnapshot = Number.isFinite(round.lastSnapshot) ? round.lastSnapshot + Math.floor((scheduleTime - round.lastSnapshot) / period) * period : scheduleTime;
        for (const identity of identities.values()) if (identity.socket) snapshot(identity);
      }
    } catch (error) { failRound(error); }
  }, options.tickMs ?? (games.some(game => game.manifest.simulation) ? 8 : 100));
  return { wss, roomView: view, authorizeSave: (token: string, roundId: string) => { authorizeSave(token, roundId); }, exportSave, loadSave, authorizeRecovery: (token: string, gameId: string) => { authorizeRecovery(token, gameId); }, recoveryMetadata, exportRecovery, restoreRecovery, close: async () => { closing = true; server.off('upgrade', upgrade); clearInterval(timer); clearRound(); await options.recoveryStore?.flush(); for (const socket of sockets) socket.terminate(); await new Promise<void>(resolve => wss.close(() => resolve())); } };
}
