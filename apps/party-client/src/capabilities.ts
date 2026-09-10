import type { CatalogGame, CatalogCapability } from './catalog';
import type { GameManifest } from '../../../packages/party-contract/src/index';
export type Capability = CatalogCapability;
export type DetailedGame = CatalogGame;
export const capabilityCopy: Record<Capability, { label: string; note: string }> = {
  'browser-play': { label: 'Plays in the browser', note: 'Nothing to install. Open the link and play.' },
  'shared-display': { label: 'One shared screen', note: 'For group play, share a laptop or TV.' },
  'phone-controllers': { label: 'Phones are the controllers', note: 'Players join with the QR code or six-letter room code.' },
  'solo': { label: 'Solo play', note: 'Play alone on this device.' },
  'keyboard': { label: 'Keyboard', note: 'Play with a keyboard.' },
  'touch': { label: 'Touch controls', note: 'On-screen controls when playing on a tablet or phone.' },
  'server-autosave': { label: 'World autosave', note: 'The server keeps two checkpoints for this room and saves every 30 seconds. Download a world file before closing the room to continue later.' },
  'host-browser-progress': { label: 'Progress stays on the host', note: 'Campaign stars are kept in the host browser. Clearing site data removes them.' },
  'lan-only': { label: 'Same Wi-Fi', note: 'Phones must reach the hosting laptop. This build has no remote hosting or accounts.' },
};
export const notInThisBuild = ['No offline game downloads', 'No cloud saves or accounts', 'No remixing or modding tools'];
export function capabilitiesOf(game: DetailedGame, manifest?: GameManifest): Capability[] {
  if (game.capabilities) return game.capabilities;
  const list: Capability[] = ['browser-play'];
  if (game.requiresSharedDisplay) list.push('shared-display', 'phone-controllers'); else if (game.controls.includes('Phone controllers')) list.push('phone-controllers');
  if (game.supportsSolo) list.push('solo');
  if (game.controls.includes('Keyboard')) list.push('keyboard');
  if (game.controls.includes('Touch')) list.push('touch');
  if (manifest?.sessionControls?.includes('save')) list.push('server-autosave');
  if (game.id === 'kitchen-rush') list.push('host-browser-progress');
  return list;
}
export const creatorOf = (game: DetailedGame) => game.creator ?? { name: 'PartyPlay team' };
/** Same category first, then games sharing search terms. */
export function relatedGames(game: CatalogGame, all: readonly CatalogGame[], limit = 3): CatalogGame[] {
  const score = (other: CatalogGame) => (other.category === game.category ? 2 : 0) + other.searchTerms.filter(term => game.searchTerms.includes(term)).length + (other.cooperative === game.cooperative ? 0.5 : 0);
  return all.filter(other => other.id !== game.id).sort((a, b) => score(b) - score(a)).slice(0, limit);
}
