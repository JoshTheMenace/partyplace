import { useId, useState, type ReactNode } from 'react';
import { ArcadeButton, Eyebrow, TextInput } from '../../../packages/party-ui/src/index';
import { gameLooks } from './art';
import { CatalogArt } from './catalog-art';
import { filterCatalog, type CatalogFilter, type CatalogGame, type CatalogSource } from './catalog';
import { useLibrary } from './library-store';
import { Link } from './routes';
import './dashboard.css';

const filters: { id: CatalogFilter; label: string; hint: string }[] = [
  { id: 'all', label: 'All games', hint: '' },
  { id: 'solo', label: 'Solo playable', hint: 'Play on your own.' },
  { id: 'shared-screen', label: 'Shared screen', hint: 'Everyone watches one laptop or TV and plays from their phones.' },
  { id: 'no-tv', label: 'No TV needed', hint: 'Plays right on this device. No second screen required.' },
  { id: 'party', label: 'Party games', hint: 'Write, draw, bluff, and vote with your people.' },
  { id: 'co-op', label: 'Co-op', hint: 'Build or cook together. Everyone is on one team.' },
  { id: 'in-progress', label: 'In progress', hint: 'In development. Play the latest build.' },
];
type Tone = 'sun' | 'coral' | 'sky' | 'lime' | 'grape';
const toneOf = (game: CatalogGame): Tone => game.id === 'kart-party' ? 'sun' : gameLooks[game.id]?.tone ?? 'sky';
export const playersLabel = (game: CatalogGame) => game.players.min === game.players.max ? String(game.players.min) : `${game.players.min}–${game.players.max}`;

export function FavoriteButton({ title, active, onToggle, large = false }: { title: string; active: boolean; onToggle(): void; large?: boolean }) {
  return <button type="button" className={`kp-fav ${large ? 'kp-fav-large' : ''}`} aria-pressed={active} aria-label={active ? `Remove ${title} from favorites` : `Add ${title} to favorites`} title={active ? 'In your favorites' : 'Add to favorites'} onClick={onToggle}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5 4.6 13.3A4.6 4.6 0 0 1 11 6.7l1 1 1-1a4.6 4.6 0 0 1 6.4 6.6Z" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round"/></svg>
  </button>;
}

export type GameCardProps = { game: CatalogGame; inRoom: boolean; spectator: boolean; canPlay: boolean; onPlay(game: CatalogGame): void; onOpen?(game: CatalogGame): void; favorite: boolean; onToggleFavorite(): void; compact?: boolean; discover?: boolean };
/** One library card. Outside a room the title links to the shareable detail page; inside a room it opens the details modal. */
export function GameCard({ game, inRoom, spectator, canPlay, onPlay, onOpen, favorite, onToggleFavorite, compact = false, discover = false }: GameCardProps) {
  const library = useLibrary();
  const tone = toneOf(game), wipGame = game.status === 'in-progress';
  const title = !inRoom ? <Link route={{ view: 'game', id: game.id }} className="kp-library-title-link">{game.title}</Link> : onOpen ? <button type="button" className="kp-library-title-button" onClick={() => onOpen(game)}>{game.title}</button> : game.title;
  return <li className={`kp-library-card kp-library-tone-${tone} ${wipGame ? 'kp-library-card-wip' : ''} ${compact ? 'kp-library-card-compact' : ''}`}>
    <div className="kp-library-card-art"><CatalogArt game={game}/>
      <span className={`kp-library-status ${wipGame ? 'kp-library-status-wip' : 'kp-library-status-ready'}`}>{game.launch === 'unavailable' ? 'Listing only' : wipGame ? 'In progress' : 'Ready to play'}</span>
      {!discover && <FavoriteButton title={game.title} active={favorite} onToggle={onToggleFavorite}/>}
    </div>
    <div className="kp-library-card-body">
      <span className="kp-library-category">{game.category}</span>
      <h3>{title}</h3>
      <p className="kp-library-copy">{game.description}</p>
      {wipGame && !compact && <p className="kp-library-wip-note">In development. Play the latest build.</p>}
      <ul className="kp-library-facts">
        <li>{playersLabel(game)} players</li>
        <li>{game.playTime}</li>
        {game.supportsSolo && <li>Solo OK</li>}
        {game.cooperative && <li>Co-op</li>}
        {!compact && <li>{game.requiresSharedDisplay ? 'Shared screen + phones' : 'Any screen'}</li>}
      </ul>
      {!inRoom && !compact && <p className="kp-library-controls">{game.controls.join(' · ')}</p>}
      <div className="kp-library-card-actions">
        {!inRoom && (discover || !library.has(game.id)) ? <ArcadeButton tone={library.has(game.id) ? 'ghost' : tone} size="sm" disabled={library.has(game.id)} onClick={() => library.add(game)} aria-label={library.has(game.id) ? `${game.title} is in your library` : `Add ${game.title} to library`}>{library.has(game.id) ? 'In library' : 'Add to library'}</ArcadeButton> : !spectator && <ArcadeButton tone={wipGame ? 'ghost' : tone} size="sm" disabled={!canPlay || game.launch === 'unavailable'} onClick={() => onPlay(game)}>{game.launch === 'external' ? `Open ${game.title} ↗` : game.launch === 'unavailable' ? 'Unavailable' : `Play ${game.title}`}</ArcadeButton>}
        {!inRoom ? <Link route={{ view: 'game', id: game.id }} className="kp-text-button kp-library-details">Details</Link> : onOpen && <button type="button" className="kp-text-button kp-library-details" onClick={() => onOpen(game)}>Details</button>}
      </div>
      {!inRoom && !discover && library.has(game.id) && <button className="kp-text-button kp-library-remove" onClick={() => library.remove(game.id)} aria-label={`Remove ${game.title} from library`}>Remove from library</button>}
    </div>
  </li>;
}

export function LibraryNavigation({ view }: { view: 'home' | 'discover' | 'game' }) {
  const library = useLibrary();
  return <nav className="kp-library-nav" aria-label="Library navigation"><Link route={{ view: 'home' }} aria-current={view === 'home' ? 'page' : undefined}>My Library <span>{library.games.length}</span></Link><Link route={{ view: 'discover' }} aria-current={view === 'discover' ? 'page' : undefined}>Discover</Link></nav>;
}
export type GameDashboardProps = { games: CatalogGame[]; sources?: CatalogSource[]; view?: 'home' | 'discover'; loading?: boolean; onPlay(game: CatalogGame): void; onOpen?(game: CatalogGame): void; canPlay: boolean; inRoom?: boolean; actions?: ReactNode };
export function GameDashboard({ games, sources = [], view = 'home', loading = false, onPlay, onOpen, canPlay, inRoom = false, actions }: GameDashboardProps) {
  const [query, setQuery] = useState(''), [filter, setFilter] = useState<CatalogFilter>('all'), [sourceId, setSourceId] = useState('');
  const library = useLibrary(), searchId = useId(), sourceSelectId = useId();
  const discover = !inRoom && view === 'discover';
  const byId = new Map(games.map(game => [game.id, game]));
  const owned = library.games.map(game => byId.get(game.id) ?? { ...game, launch: 'unavailable' as const });
  const source = sources.find(s => s.id === sourceId);
  const available = inRoom ? games : discover ? source?.games ?? games : owned;
  const shown = filterCatalog(available, query, filter), spectator = inRoom && !canPlay;
  const reset = () => { setQuery(''); setFilter('all'); setSourceId(''); };
  const filtered = query.trim() !== '' || filter !== 'all' || !!source;
  return <section className={`kp-dashboard ${inRoom ? 'kp-dashboard-room' : 'kp-dashboard-home'}`}>
    <header className="kp-library-heading"><div><Eyebrow>{inRoom ? 'Your room' : discover ? 'Curated sources' : 'Your collection'}</Eyebrow><h1 className="kp-title">{inRoom ? spectator ? 'Host picks. You play.' : 'What are we playing?' : discover ? 'Discover' : 'My Library'}</h1><p>{inRoom ? 'Keep your room. Pick your next game.' : discover ? 'Find something worth playing.' : 'Your games, ready when you are.'}</p></div>{actions && <div className="kp-library-heading-actions">{actions}</div>}</header>
    {!inRoom && !discover && !owned.length ? <div className="kp-library-empty kp-library-welcome"><span className="kp-library-empty-mark" aria-hidden="true">＋</span><h2>Your next favorite is out there.</h2><p>Add games from Discover to make this space yours.</p><Link route={{ view: 'discover' }} className="kp-btn kp-btn-sun kp-btn-lg"><span>Discover games</span></Link><small>Saved in this browser. No downloads needed.</small></div> : <div className={discover ? 'kp-discover-layout' : ''}>
      {discover && <aside className="kp-source-list" aria-label="Curated sources"><h2>Sources <span>{sources.length}</span></h2><div className="kp-source-buttons"><button aria-pressed={!source} onClick={() => setSourceId('')}>All sources <span>{games.length}</span></button>{sources.map(item => <button key={item.id} aria-pressed={source?.id === item.id} onClick={() => setSourceId(item.id)}><span>{item.name}</span><span>{item.games.length}</span></button>)}</div><label className="kp-source-select" htmlFor={sourceSelectId}>Browse a source<select id={sourceSelectId} value={source?.id ?? ''} onChange={event => setSourceId(event.target.value)}><option value="">All sources ({games.length})</option>{sources.map(item => <option key={item.id} value={item.id}>{item.name} ({item.games.length})</option>)}</select></label></aside>}
      <div className="kp-discover-games">
        {source && <div className="kp-source-description"><h2>{source.name}</h2>{source.description && <p>{source.description}</p>}</div>}
        <div className="kp-library-toolbar" role="search"><div className="kp-library-search"><label htmlFor={searchId}>Search games</label><div className="kp-library-search-field"><svg viewBox="0 0 24 24" aria-hidden="true" className="kp-library-search-icon"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="2.6"/><path d="m15.5 15.5 5 5" stroke="currentColor" strokeWidth="2.6"/></svg><TextInput id={searchId} type="search" value={query} placeholder="Search your next game…" onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') setQuery(''); }}/>{query && <button className="kp-library-clear" aria-label="Clear search" onClick={() => setQuery('')}>×</button>}</div></div><div className="kp-library-filters" role="group" aria-label="Filter games">{filters.map(item => <button key={item.id} className="kp-library-filter" aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{item.label}<span className="kp-library-filter-count">{filterCatalog(available, query, item.id).length}</span></button>)}</div><p className="kp-library-summary" role="status">{loading && discover ? 'Loading sources…' : `${shown.length} ${shown.length === 1 ? 'game' : 'games'}`}</p></div>
        {shown.length ? <ul className="kp-library-grid">{shown.map(game => <GameCard key={game.id} game={game} inRoom={inRoom} spectator={spectator} canPlay={canPlay} onPlay={onPlay} onOpen={onOpen} favorite={library.isFavorite(game.id)} onToggleFavorite={() => library.toggleFavorite(game.id)} discover={discover}/>)}</ul> : !loading && <div className="kp-library-empty"><h2>{filtered ? 'No games match.' : 'More games are on the way.'}</h2>{filtered && <ArcadeButton size="sm" tone="ghost" onClick={reset}>Clear filters</ArcadeButton>}</div>}
        {filtered && shown.length > 0 && <button className="kp-library-reset" onClick={reset}>Clear search and filters</button>}
      </div>
    </div>}
  </section>;
}
