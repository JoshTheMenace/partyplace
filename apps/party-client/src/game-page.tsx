import { useEffect, useState } from 'react';
import { ArcadeButton, Eyebrow, Panel, StatusNotice } from '../../../packages/party-ui/src/index';
import type { GameManifest } from '../../../packages/party-contract/src/index';
import type { CatalogGame } from './catalog';
import { gameLooks } from './art';
import { CatalogArt } from './catalog-art';
import { capabilitiesOf, capabilityCopy, creatorOf, notInThisBuild, relatedGames, type DetailedGame } from './capabilities';
import { gameHref, Link } from './routes';
import { useLibrary } from './library-store';
import { FavoriteButton, GameCard, playersLabel } from './dashboard';

export type GameDetailsProps = { game: DetailedGame; all: CatalogGame[]; manifest?: GameManifest; onPlay(game: CatalogGame): void; canPlay: boolean; onJoin?(): void; inRoom?: boolean; origin?: string; onOpen?(game: CatalogGame): void };

/** Detail content shared by the standalone page and the in-room modal. Reads catalog data only. */
export function GameDetails({ game, all, manifest, onPlay, canPlay, onJoin, inRoom = false, origin = location.origin, onOpen }: GameDetailsProps) {
  const library = useLibrary();
  const [phoneLayout, setPhoneLayout] = useState(() => matchMedia('(max-width: 650px), (pointer: coarse)').matches);
  useEffect(() => { const media = matchMedia('(max-width: 650px), (pointer: coarse)'), update = () => setPhoneLayout(media.matches); media.addEventListener('change', update); return () => media.removeEventListener('change', update); }, []);
  const [copied, setCopied] = useState<'idle' | 'done' | 'manual'>('idle');
  const url = `${origin}${gameHref(game.id)}`;
  useEffect(() => { if (copied !== 'done') return; const timer = setTimeout(() => setCopied('idle'), 2500); return () => clearTimeout(timer); }, [copied]);
  const copy = async () => { try { await navigator.clipboard.writeText(url); setCopied('done'); } catch { setCopied('manual'); } };
  const creator = creatorOf(game), capabilities = capabilitiesOf(game, manifest), related = relatedGames(game, all);
  const tone = game.id === 'kart-party' ? 'sun' : gameLooks[game.id]?.tone ?? 'sky';
  const wip = game.status === 'in-progress';
  const joinFirst = game.launch === 'room' && !!onJoin && game.requiresSharedDisplay && phoneLayout;
  const joinAction = game.launch === 'room' && onJoin && <ArcadeButton size="lg" tone={joinFirst ? tone : 'ghost'} onClick={onJoin}>Join with a code</ArcadeButton>;
  const how = game.launch === 'external' ? 'Opens the creator’s site in a new tab.' : game.launch === 'unavailable' ? 'This is a listing. A playable release is not available here yet.' : !inRoom && !library.has(game.id) ? 'Add to your library to play. Nothing is downloaded.' : game.supportsSolo ? 'Play here on your own, or invite friends with your room code.' : joinFirst ? 'Join a room hosted on a laptop or TV.' : 'Open a room, then invite friends to scan the QR code and tap Ready.';
  return <article className={`kp-game-page kp-library-tone-${tone}`} aria-labelledby={`kp-game-title-${game.id}`}>
    <div className="kp-game-page-hero">
      <div className={`kp-game-page-art ${wip ? 'kp-library-card-wip' : ''}`}><CatalogArt game={game}/><span className={`kp-library-status ${wip ? 'kp-library-status-wip' : 'kp-library-status-ready'}`}>{game.launch === 'unavailable' ? 'Listing only' : wip ? 'In progress' : 'Ready to play'}</span></div>
      <div className="kp-game-page-copy">
        <Eyebrow>{game.category} · By {creator.url ? <a href={creator.url} rel="noreferrer">{creator.name}</a> : creator.name}{game.released && <> · Added {new Date(game.released).toLocaleDateString()}</>}</Eyebrow>
        <h1 tabIndex={-1} id={`kp-game-title-${game.id}`} className="kp-title kp-game-page-title">{game.title}</h1>
        <p className="kp-game-page-lede">{game.detail ?? game.description}</p>
        <ul className="kp-dashboard-facts"><li>{playersLabel(game)} players</li><li>{game.playTime}</li>{game.controls.map(control => <li key={control}>{control}</li>)}{(game.tags ?? game.searchTerms).slice(0, 4).map(tag => <li key={tag} className="kp-fact-tag">{tag}</li>)}</ul>
        <div className="kp-game-page-actions">
          {joinFirst && joinAction}
          {!inRoom && !library.has(game.id) ? <ArcadeButton size="lg" tone={tone} onClick={() => library.add(game)}>Add to library</ArcadeButton> : <ArcadeButton size="lg" tone={wip || joinFirst ? 'ghost' : tone} disabled={!canPlay || game.launch === 'unavailable'} onClick={() => onPlay(game)}>{game.launch === 'external' ? 'Open game ↗' : game.launch === 'unavailable' ? 'Unavailable' : inRoom ? 'Pick this game' : 'Play on this screen'}</ArcadeButton>}
          {!joinFirst && joinAction}
          {(inRoom || library.has(game.id)) && <FavoriteButton title={game.title} active={library.isFavorite(game.id)} onToggle={() => library.toggleFavorite(game.id)} large/>}
        </div>
        <p className="kp-game-page-how">{how}</p>{!inRoom && library.has(game.id) && <button className="kp-text-button" onClick={() => library.remove(game.id)}>Remove from library</button>}
        {game.sourceUrl && <a className="kp-text-button" href={game.sourceUrl} target="_blank" rel="noopener noreferrer">View source ↗</a>}
        {wip && <p className="kp-library-wip-note">In development. You are playing the latest build.</p>}
      </div>
    </div>
    <div className="kp-game-page-grid">
      <Panel className="kp-game-page-panel"><h2>What you need</h2><ul className="kp-capabilities">{capabilities.map(id => <li key={id}><strong>{capabilityCopy[id].label}</strong><span>{capabilityCopy[id].note}</span></li>)}</ul><p className="kp-muted kp-game-page-not">Not in this build: {notInThisBuild.join(' · ')}.</p></Panel>
      <Panel className="kp-game-page-panel"><h2>Share this game</h2><p>Send a friend the link.</p>
        <div className="kp-share-row"><input className="kp-input kp-share-url" readOnly value={url} aria-label="Shareable link" onFocus={event => event.currentTarget.select()}/><ArcadeButton size="sm" tone="sky" onClick={copy}>{copied === 'done' ? 'Copied' : 'Copy link'}</ArcadeButton></div>
        {copied === 'manual' && <StatusNotice>Select the address above and copy it. Some browsers only allow one-tap copying over HTTPS.</StatusNotice>}
        {copied === 'done' && <StatusNotice tone="success">Link copied.</StatusNotice>}
      </Panel>
    </div>
    {related.length > 0 && <section className="kp-shelf" aria-label="More like this"><div className="kp-shelf-head"><h2>More like this</h2></div><ul className="kp-shelf-row">{related.map(item => <GameCard key={item.id} game={item} inRoom={inRoom} spectator={inRoom && !canPlay} canPlay={canPlay} onPlay={onPlay} onOpen={onOpen} favorite={library.isFavorite(item.id)} onToggleFavorite={() => library.toggleFavorite(item.id)} compact discover={!inRoom}/>)}</ul></section>}
  </article>;
}

export type GamePageProps = Omit<GameDetailsProps, 'game'> & { id: string; game: DetailedGame | undefined; loading: boolean };
/** Standalone route view with a way back. Unknown ids get an explicit not-found state rather than a blank page. */
export function GamePage({ id, game, loading, ...props }: GamePageProps) {
  return <section className="kp-game-page-shell">
    <nav className="kp-game-page-nav"><Link route={{ view: 'discover' }} className="kp-text-button kp-game-page-back">← Discover</Link></nav>
    {game ? <GameDetails game={game} {...props}/> : <div className="kp-library-empty">{loading ? <p className="kp-display">Loading the library…</p> : <><p className="kp-display">Not in this library.</p><p>There is no game called “{id}” here. It may have been renamed or removed.</p><Link route={{ view: 'discover' }} className="kp-btn kp-btn-sm"><span>Discover games</span></Link></>}</div>}
  </section>;
}
