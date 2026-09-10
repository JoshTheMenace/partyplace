import { useState } from 'react';
import type { CatalogGame } from './catalog';
import { KartArt } from './dashboard-art';
import { GameArt, gameLooks } from './art';
/** Creator artwork wins; built-in art and a neutral mark cover absent/broken images. */
export function CatalogArt({ game }: { game: CatalogGame }) {
  const [failed, setFailed] = useState<string>();
  if (game.artwork && failed !== game.artwork) return <img className="kp-game-art kp-catalog-cover" src={game.artwork} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(game.artwork)}/>;
  if (game.id === 'kart-party') return <KartArt/>;
  if (gameLooks[game.id]) return <GameArt id={game.id}/>;
  return <svg className="kp-game-art" viewBox="0 0 300 130" aria-hidden="true"><rect x="98" y="13" width="104" height="104" rx="22" fill="var(--kp-navy)" stroke="var(--kp-grape)" strokeWidth="2"/><path d="m137 42 40 23-40 23Z" fill="var(--kp-cream)"/></svg>;
}
