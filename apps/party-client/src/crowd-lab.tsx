import { Countdown, HoldButton, Panel, type GameClientModule } from '../../../packages/party-ui/src/index';
import type { CrowdInput, CrowdPrivate, CrowdSettings, CrowdView } from '../../party-server/src/crowd-lab';
/** Client half of the QA-only big-room fixture; see apps/party-server/src/crowd-lab.ts. It has no ResultsView, so the shell's own results list is exercised. */
export const client: GameClientModule<CrowdInput, null, CrowdSettings, CrowdView, CrowdPrivate> = {
  DisplayView: ({ publicView, serverNowMs }) => <Panel><h1>Crowd dash · <Countdown deadline={publicView.endsAt} serverNowMs={serverNowMs}/></h1><ol className="kp-roster kp-roster-wall">{[...publicView.racers].sort((a, b) => a.rank - b.rank).map(racer => <li key={racer.id}><strong style={{ color: racer.color }}>{racer.rank}. {racer.name}</strong><div>{racer.score} m</div></li>)}</ol></Panel>,
  ControllerView: ({ privateView, setInput, releaseInput }) => <Panel><h1>You are #{privateView?.rank}</h1><HoldButton label="Run" onChange={held => { if (held) setInput({ x: .7, y: 1 }); else releaseInput?.(); }}/></Panel>,
  SettingsView: ({ settings, onChange, disabled }) => <label>Round length <select value={settings.seconds ?? 30} disabled={disabled} onChange={event => onChange({ seconds: Number(event.target.value) })}>{[10, 30, 120, 600].map(seconds => <option key={seconds} value={seconds}>{seconds} seconds</option>)}</select></label>,
  InstructionsView: () => <><h2>Run the farthest.</h2><p>Hold Run on your phone. This fixture exists to fill a room to its ceiling.</p></>,
  prepare() {}, dispose() {},
};
