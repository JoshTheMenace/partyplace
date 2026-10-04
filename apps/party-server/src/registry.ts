import { manifest as ichiManifest } from '../../../packages/games/ichi/src/manifest';
import { rules as ichiRules } from '../../../packages/games/ichi/src/server';
import { manifest as nightJobManifest } from '../../../packages/games/night-job/src/manifest';
import { rules as nightJobRules } from '../../../packages/games/night-job/src/server';
import { manifest as phonedigManifest } from '../../../packages/games/phonedig/src/manifest';
import { rules as phonedigRules } from '../../../packages/games/phonedig/src/server';
import { manifest as hotpotManifest } from '../../../packages/games/hotpot/src/manifest';
import { rules as hotpotRules } from '../../../packages/games/hotpot/src/server';
import { manifest as starshipManifest } from '../../../packages/games/starship-scramble/src/manifest';
import { rules as starshipRules } from '../../../packages/games/starship-scramble/src/server';
import { manifest as kartManifest } from '../../../packages/games/kart-party/src/manifest';
import { rules as kartRules } from '../../../packages/games/kart-party/src/server';
import { manifest as blockwildManifest } from '../../../packages/games/blockwild/src/manifest';
import { rules as blockwildRules } from '../../../packages/games/blockwild/src/server';
import { manifest as kitchenManifest } from '../../../packages/games/kitchen-rush/src/manifest';
import { rules as kitchenRules } from '../../../packages/games/kitchen-rush/src/server';
import { manifest as hijinksManifest } from '../../../packages/games/hijinks/src/manifest';
import { rules as hijinksRules } from '../../../packages/games/hijinks/src/server';
import { manifest as trolleyManifest } from '../../../packages/games/trolley-court/src/manifest';
import { rules as trolleyRules } from '../../../packages/games/trolley-court/src/server';
import type { RegisteredGame } from './room-server';
import { manifest as settlersManifest } from '../../../packages/games/island-settlers/src/manifest';
import { rules as settlersRules } from '../../../packages/games/island-settlers/src/server';
import { manifest as skyManifest } from '../../../packages/games/sky-clash/src/manifest';
import { rules as skyRules } from '../../../packages/games/sky-clash/src/server';
export const games: RegisteredGame[] = [
  { manifest: ichiManifest, rules: ichiRules, actionLimits: { perPlayer: 512, maxBytes: 1024, history: 'window' } },
  { manifest: nightJobManifest, rules: nightJobRules },
  { manifest: phonedigManifest, rules: phonedigRules, actionLimits: { perPlayer: 256, maxBytes: 1024, history: 'window' } },
  { manifest: hotpotManifest, rules: hotpotRules, actionLimits: { perPlayer: 256, maxBytes: 1024, history: 'window' } },
  { manifest: starshipManifest, rules: starshipRules, actionLimits: { perPlayer: 256, maxBytes: 1024, history: 'window' } },
  { manifest: settlersManifest, rules: settlersRules, actionLimits: { perPlayer: 4096, maxBytes: 1024 } },
  { manifest: skyManifest, rules: skyRules },
  { manifest: kartManifest, rules: kartRules },
  { manifest: blockwildManifest, rules: blockwildRules }, { manifest: kitchenManifest, rules: kitchenRules },
  { manifest: hijinksManifest, rules: hijinksRules, actionLimits: { perPlayer: 256, maxBytes: 32768, history: 'window' } },
  { manifest: trolleyManifest, rules: trolleyRules, actionLimits: { perPlayer: 1024, maxBytes: 1024, history: 'window' } },
];

if (process.env.PARTY_QA === '1') { const [{ manifest }, { rules }] = await Promise.all([import('../../../packages/games/scene-lab/src/manifest'), import('../../../packages/games/scene-lab/src/server')]); games.push({ manifest, rules }); }
