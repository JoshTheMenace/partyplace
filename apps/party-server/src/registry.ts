import { manifest as kartManifest } from '../../../packages/games/kart-party/src/manifest';
import { rules as kartRules } from '../../../packages/games/kart-party/src/server';
import { manifest as blockwildManifest } from '../../../packages/games/blockwild/src/manifest';
import { rules as blockwildRules } from '../../../packages/games/blockwild/src/server';
import { manifest as kitchenManifest } from '../../../packages/games/kitchen-rush/src/manifest';
import { rules as kitchenRules } from '../../../packages/games/kitchen-rush/src/server';
import { manifest as quipManifest } from '../../../packages/games/quip-clash/src/manifest';
import { manifest as sketchManifest } from '../../../packages/games/sketch-bluff/src/manifest';
import { manifest as talesManifest } from '../../../packages/games/tall-tales/src/manifest';
import { manifest as shirtManifest } from '../../../packages/games/shirt-show/src/manifest';
import { manifest as oddManifest } from '../../../packages/games/odd-one-in/src/manifest';
import { manifest as quizManifest } from '../../../packages/games/quiz-panic/src/manifest';
import { rules as quipRules } from '../../../packages/games/quip-clash/src/server';
import { rules as sketchRules } from '../../../packages/games/sketch-bluff/src/server';
import { rules as talesRules } from '../../../packages/games/tall-tales/src/server';
import { rules as shirtRules } from '../../../packages/games/shirt-show/src/server';
import { rules as oddRules } from '../../../packages/games/odd-one-in/src/server';
import { rules as quizRules } from '../../../packages/games/quiz-panic/src/server';
import type { RegisteredGame } from './room-server';
export const games: RegisteredGame[] = [
  { manifest: kartManifest, rules: kartRules },
  { manifest: blockwildManifest, rules: blockwildRules }, { manifest: kitchenManifest, rules: kitchenRules },
  { manifest: quipManifest, rules: quipRules }, { manifest: sketchManifest, rules: sketchRules },
  { manifest: talesManifest, rules: talesRules }, { manifest: shirtManifest, rules: shirtRules },
  { manifest: oddManifest, rules: oddRules }, { manifest: quizManifest, rules: quizRules },
];

if (process.env.PARTY_QA === '1') { const [{ manifest }, { rules }] = await Promise.all([import('../../../packages/games/scene-lab/src/manifest'), import('../../../packages/games/scene-lab/src/server')]); games.push({ manifest, rules }); }
