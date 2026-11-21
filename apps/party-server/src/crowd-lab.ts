/**
 * Crowd Lab: the platform's own big-room fixture. Registered only in QA builds (PARTY_QA=1) and driven by
 * scripts/qa/room-scale.ts. A 64-seat, 20 Hz dash whose public state is racer-sized: about 270 bytes per player
 * (Kart Party sends about 430 per racer, Kitchen Rush about 475). It exercises the shell, the transport and the bot
 * harness at the room ceiling; it is not a catalog game.
 */
import { MAX_ROOM_PLAYERS, type GameManifest, type GameRules } from '../../../packages/party-contract/src/index';
export type CrowdInput = { x: number; y: number };
export type CrowdSettings = { seconds: number };
type Racer = { id: string; name: string; color: string; character: string; x: number; z: number; vx: number; vz: number; yaw: number; lap: number; progress: number; rank: number; item: string | null; boost: number; drift: number; score: number; connected: boolean };
type State = { time: number; seconds: number; endsAt: number; racers: Racer[] };
export type CrowdView = { phase: string; time: number; endsAt: number; racers: Racer[] };
export type CrowdPrivate = { item: string | null; boost: number; rank: number };
export const manifest = {
  contractVersion: '1.0', id: 'crowd-lab', title: 'Crowd Lab', description: 'Development fixture: hold Run with up to 64 people and test a full room.',
  assetBase: '/games/crowd-lab/', modes: ['shared-display'], players: { min: 1, max: MAX_ROOM_PLAYERS },
  orientation: { controller: 'any', personalView: 'any' }, timing: 'realtime', input: ['state'],
  simulation: { stepHz: 60, snapshotHz: 20, maxCatchUpSteps: 6 }, privatePlayerViews: true, supportsSolo: false,
} as const satisfies GameManifest;
const round2 = (value: number) => Math.round(value * 100) / 100, neutral = { x: 0, y: 0 };
export const rules: GameRules<State, CrowdInput, null, CrowdSettings, CrowdView, CrowdPrivate> = {
  validateSettings(raw) { const seconds = (raw as Partial<CrowdSettings> | null)?.seconds ?? 30; if (!Number.isInteger(seconds) || seconds < 5 || seconds > 3600) throw new Error('Choose 5 to 3600 seconds.'); return { seconds }; },
  parseInput(raw) { const input = raw as CrowdInput; if (!Number.isFinite(input?.x) || !Number.isFinite(input?.y)) throw new Error('Invalid input.'); return { x: Math.max(-1, Math.min(1, input.x)), y: Math.max(-1, Math.min(1, input.y)) }; },
  parseAction: () => null, applyAction() {}, neutralInput: () => neutral, dispose() {},
  onPresenceChange(state, id, connected) { state.racers.find(racer => racer.id === id)!.connected = connected; },
  create: (ctx, settings) => ({ time: 0, seconds: settings.seconds, endsAt: ctx.nowMs + settings.seconds * 1000, racers: ctx.players.map((player, i) => ({ id: player.id, name: player.name, color: player.color, character: 'runner', x: i * 2, z: 0, vx: 0, vz: 0, yaw: 0, lap: 1, progress: 0, rank: i + 1, item: i % 3 ? 'comet' : null, boost: 0, drift: 0, score: 0, connected: true })) }),
  tick(state, inputs, dt) {
    state.time += dt;
    for (const racer of state.racers) { const input = inputs.get(racer.id) ?? neutral; racer.vx = input.x * 14.37; racer.vz = input.y * 14.37; racer.x += racer.vx * dt; racer.z += racer.vz * dt; racer.yaw = Math.atan2(racer.vx, racer.vz); racer.score += Math.hypot(racer.vx, racer.vz) * dt; racer.progress = racer.score % 100 / 100; racer.boost = (racer.boost + dt) % 1; }
    [...state.racers].sort((a, b) => b.score - a.score).forEach((racer, i) => { racer.rank = i + 1; });
  },
  publicView: state => ({ phase: 'racing', time: round2(state.time), endsAt: state.endsAt, racers: state.racers.map(racer => ({ ...racer, x: round2(racer.x), z: round2(racer.z), vx: round2(racer.vx), vz: round2(racer.vz), yaw: round2(racer.yaw), progress: Math.round(racer.progress * 1e4) / 1e4, boost: round2(racer.boost), score: Math.round(racer.score) })) }),
  playerView(state, id) { const racer = state.racers.find(item => item.id === id)!; return { item: racer.item, boost: round2(racer.boost), rank: racer.rank }; },
  outcome: state => ({ complete: state.time >= state.seconds, winners: state.racers.filter(racer => racer.rank === 1).map(racer => racer.id), rows: [...state.racers].sort((a, b) => a.rank - b.rank).map(racer => ({ playerId: racer.id, rank: racer.rank, score: Math.round(racer.score) })) }),
};
