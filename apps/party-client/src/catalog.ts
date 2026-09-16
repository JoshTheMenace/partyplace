import type { GameManifest } from '../../../packages/party-contract/src/index';

import type { CatalogGame, CatalogCapability } from '../../../packages/party-catalog/src/index';
export type { CatalogGame, CatalogCapability, CatalogSource } from '../../../packages/party-catalog/src/index';
export type CatalogFilter = 'all' | 'solo' | 'shared-screen' | 'no-tv' | 'party' | 'co-op' | 'in-progress';
const details: Record<string, Pick<CatalogGame, 'category' | 'status' | 'playTime' | 'searchTerms'>> = {
  'starship-scramble': { category: 'Co-op', status: 'ready', playTime: '30 beacons · save anytime', searchTerms: ['space', 'fleet', 'strategy', 'ships', 'expedition', 'cooperative'] },
  'island-settlers': { category: 'Party', status: 'in-progress', playTime: 'About 60 min · varies', searchTerms: ['catan', 'settlers', 'board game', 'seafarers', 'connect', 'strategy', 'trading'] },
  'sky-clash': { category: 'Party', status: 'in-progress', playTime: '15 min / match · unlimited option', searchTerms: ['melee', 'smash', 'mario', 'fox', 'falco', 'kirby', 'marth', 'bowser', '33 fighters', 'combat', '3d'] },
  'quip-clash': { category:'Party',status:'ready',playTime:'10–15 min',searchTerms:['jokes','writing','voting'] },
  'sketch-bluff': { category:'Party',status:'ready',playTime:'10–15 min',searchTerms:['drawing','bluffing','art'] },
  'tall-tales': { category:'Party',status:'ready',playTime:'8–12 min',searchTerms:['trivia','lies','bluffing'] },
  'shirt-show': { category:'Party',status:'ready',playTime:'15–20 min',searchTerms:['drawing','shirts','slogans'] },
  'odd-one-in': { category:'Party',status:'ready',playTime:'10–15 min',searchTerms:['hidden role','bluffing','deduction'] },
  'quiz-panic': { category:'Party',status:'ready',playTime:'10–15 min',searchTerms:['quiz','trivia'] },
  'blockwild': { category:'Sandbox',status:'ready',playTime:'Open-ended',searchTerms:['building','crafting','exploration','creative','survival','3d'] },
  'kitchen-rush': { category:'Co-op',status:'ready',playTime:'3–5 min / level',searchTerms:['cooking','teamwork','campaign','3d'] },
};
const descriptions: Record<string, string> = {
  'quip-clash': 'Write ridiculous answers. Vote for your favorites.',
  'sketch-bluff': 'Draw a prompt, bluff the room, and spot the truth.',
  'tall-tales': 'Invent a convincing lie. Find the real answer.',
  'shirt-show': 'Turn drawings and slogans into questionable fashion.',
  'odd-one-in': 'One player is missing the clue. Find them.',
  'quiz-panic': 'Fast trivia. Friendly rivalry.',
  'blockwild': 'Explore, craft, and build your own world.',
  'kitchen-rush': 'Cook orders and keep dinner moving, solo or together.',
};
export const kartParty: CatalogGame = { id:'kart-party',title:'Kart Party',description:'Four big courses. Ten tiny rivals. Drift, grab an item, and race for the finish.',category:'Racing',status:'ready',players:{min:1,max:10},supportsSolo:true,requiresSharedDisplay:false,cooperative:false,controls:['Keyboard','Touch','Phone controllers'],playTime:'5–15 min',launch:'room',searchTerms:['racing','driving','solo','cpu','3d'],tags:['racing','driving','solo','CPU rivals'],creator:{name:'PartyPlay'},detail:'Race solo against CPU drivers or bring friends into a room. Play on this screen with a keyboard or touch controls, or use phones as controllers.',capabilities:['browser-play','solo','keyboard','touch','phone-controllers'] };
export function gameCatalog(manifests: readonly GameManifest[]): CatalogGame[] {
  return [...(manifests.some(m=>m.id==='kart-party')?[kartParty]:[]),...manifests.filter(m=>!['scene-lab','kart-party'].includes(m.id)).map(m=>({id:m.id,title:m.title,description:descriptions[m.id]??m.description,players:m.players,supportsSolo:m.supportsSolo,requiresSharedDisplay:!m.supportsSolo && m.modes.every(mode=>mode==='shared-display'),cooperative:['blockwild','kitchen-rush','starship-scramble'].includes(m.id),controls:m.supportsSolo?['Keyboard','Touch','Phone controllers']:['Phone controllers'],launch:'room' as const,creator:{name:'PartyPlay'},detail:descriptions[m.id]??m.description,capabilities:['browser-play','shared-display','phone-controllers',...(m.supportsSolo?['solo','keyboard','touch']:[]),...(m.sessionControls?.includes('save')?['server-autosave']:[]),...(m.id==='kitchen-rush'?['host-browser-progress']:[])] as CatalogCapability[],...(details[m.id]??{category:'Party' as const,status:'in-progress' as const,playTime:'Varies',searchTerms:[]})}))];
}
export function filterCatalog(games: readonly CatalogGame[], query: string, filter: CatalogFilter): CatalogGame[] {
  const words=query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return games.filter(g=>words.every(word=>[g.title,g.description,g.category,...g.searchTerms].join(' ').toLocaleLowerCase().includes(word))&&(filter==='all'||filter==='solo'&&g.supportsSolo||filter==='shared-screen'&&g.requiresSharedDisplay||filter==='no-tv'&&!g.requiresSharedDisplay||filter==='party'&&g.category==='Party'||filter==='co-op'&&g.cooperative||filter==='in-progress'&&g.status==='in-progress'));
}
