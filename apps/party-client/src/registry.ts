import type { GameClientModule } from '../../../packages/party-ui/src/index';
export type LoadedClient = GameClientModule<any, any, any, any, any>;
export const clients: Record<string, () => Promise<LoadedClient>> = {
  'ichi': () => import('../../../packages/games/ichi/src/client').then(module => module.client),
  'night-job': () => import('../../../packages/games/night-job/src/client').then(module => module.client),
  'phonedig': () => import('../../../packages/games/phonedig/src/client').then(module => module.client),
  'hotpot': () => import('../../../packages/games/hotpot/src/client').then(module => module.client),

  'starship-scramble': () => import('../../../packages/games/starship-scramble/src/client').then(module => module.client),
  'island-settlers': () => import('../../../packages/games/island-settlers/src/client').then(module => module.client),
  'sky-clash': () => import('../../../packages/games/sky-clash/src/client').then(module => module.client),
  'kart-party': () => import('../../../packages/games/kart-party/src/client').then(module => module.client),
  'blockwild': () => import('../../../packages/games/blockwild/src/client').then(module => module.client),
  'kitchen-rush': () => import('../../../packages/games/kitchen-rush/src/client').then(module => module.client),
  'quip-clash': () => import('../../../packages/games/quip-clash/src/client').then(module => module.client),
  'sketch-bluff': () => import('../../../packages/games/sketch-bluff/src/client').then(module => module.client),
  'tall-tales': () => import('../../../packages/games/tall-tales/src/client').then(module => module.client),
  'shirt-show': () => import('../../../packages/games/shirt-show/src/client').then(module => module.client),
  'odd-one-in': () => import('../../../packages/games/odd-one-in/src/client').then(module => module.client),
  'quiz-panic': () => import('../../../packages/games/quiz-panic/src/client').then(module => module.client),
};

if (import.meta.env.VITE_PARTY_QA === '1') clients['scene-lab'] = () => import('../../../packages/games/scene-lab/src/client').then(module => module.client);
