import { SkyClashArt } from '../../../packages/games/sky-clash/src/art';
import { StarshipArt } from '../../../packages/games/starship-scramble/src/art';
import type { CSSProperties } from 'react';
export const gameLooks: Record<string, { tone: 'sun' | 'coral' | 'sky' | 'lime' | 'grape'; verb: string }> = {
  'ichi': { tone: 'coral', verb: 'One card. So many possibilities.' },
  'island-settlers': { tone: 'lime', verb: 'Trade. Build. Settle the island.' },
  'night-job': { tone: 'sky', verb: 'Slip in. Stick together. Get out.' },
  'sky-clash': { tone: 'sun', verb: 'Build damage. Send rivals flying.' },
  'starship-scramble': { tone: 'coral', verb: 'Fly together. Fire together. Break the Armada.' },
  'blockwild': { tone: 'lime', verb: 'Mine. Build. Make a world.' }, 'kitchen-rush': { tone: 'coral', verb: 'A little heat. A lot of teamwork.' },
  'hijinks': { tone: 'grape', verb: 'Scribble. Fib. Steal the show.' },
  'trolley-court': { tone: 'sky', verb: 'Stack the tracks. Plead your case. Pull the lever?' },
};
export function GameArt({ id, className = '' }: { id: string; className?: string }) {
  if (id === 'night-job') return <img src="/games/night-job/cover.png" alt="" className={`kp-game-art kp-catalog-cover ${className}`}/>;
  if (id === 'sky-clash') return <SkyClashArt className={`kp-game-art ${className}`}/>;
  if (id === 'starship-scramble') return <StarshipArt className={className}/>;
  const tone = gameLooks[id]?.tone ?? 'sun';
  return <svg viewBox="0 0 300 130" aria-hidden="true" className={`kp-game-art ${className}`} style={{ '--art-accent': `var(--kp-${tone})` } as CSSProperties}>
    <ellipse cx="150" cy="121" rx="96" ry="7" fill="var(--kp-ink)" opacity=".3" />
    <g fill="var(--art-accent)" opacity=".22"><circle cx="150" cy="70" r="63"/><path d="m33 30 8 5-8 5-5 8-5-8-8-5 8-5 5-8Zm232 60 6 4-6 4-4 6-4-6-6-4 6-4 4-6Z"/><circle cx="249" cy="24" r="5"/><circle cx="56" cy="108" r="4"/></g>
    <g stroke="var(--kp-ink)" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round">
      {id === 'ichi' && <><rect x="67" y="18" width="70" height="96" rx="12" fill="var(--kp-sky)" transform="rotate(-18 102 66)"/><rect x="121" y="9" width="70" height="106" rx="12" fill="var(--kp-sun)"/><rect x="170" y="23" width="70" height="96" rx="12" fill="var(--kp-coral)" transform="rotate(18 205 71)"/><path d="M145 62h23" strokeWidth="9"/></>}
      {id === 'island-settlers' && <>{([[127.5, 50, 'lime'], [172.5, 50, 'sun'], [150, 89, 'sky']] as const).map(([x, y, c]) => <path key={c} d={`M${x} ${y - 26}l22.5 13v26L${x} ${y + 26}l-22.5-13v-26Z`} fill={`var(--kp-${c})`}/>)}<path d="M118 58V47l9.5-8 9.5 8v11Z" fill="var(--kp-cream)"/></>}
      {id === 'blockwild' && <><path d="m81 65 55-28 57 28v40l-57 25-55-25Z" fill="#a77549"/><path d="m81 65 55 25 57-25-57-28Z" fill="var(--kp-lime)"/><path d="M136 90v40" fill="none"/><path d="m173 57 31-16 32 16v25l-32 16-31-16Z" fill="#c79564"/><path d="m173 57 31 16 32-16-32-16Z" fill="var(--kp-lime)"/><path d="M205 73v25M108 13v34" fill="none" stroke="#825e3e" strokeWidth="12"/><path d="m81 11 27-10 27 10v21l-27 11-27-11Z" fill="#3f914c"/><path d="m81 11 27 11 27-11" fill="none" stroke="#78d955"/></>}
      {id === 'hijinks' && <><g fill="var(--kp-grape)" opacity=".55" stroke="none">{Array.from({ length: 12 }, (_, i) => <path key={i} d="M150 60 143-8h14Z" transform={`rotate(${i * 30} 150 60)`}/>)}</g>
        <path d="M24 12h50a10 10 0 0 1 10 10v18a10 10 0 0 1-10 10H50l-14 12 3-12H24a10 10 0 0 1-10-10V22a10 10 0 0 1 10-10Z" fill="var(--kp-sky)" transform="rotate(-8 49 36)"/><path d="M36 33h26M38 42h14" fill="none" transform="rotate(-8 49 36)"/>
        <rect x="60" y="30" width="180" height="64" rx="16" fill="var(--kp-coral)" transform="rotate(-4 150 62)"/>
        <g transform="rotate(-4 150 62)"><rect x="72" y="41" width="156" height="42" rx="9" fill="var(--kp-ink)"/><g fill="var(--kp-cream)" stroke="none">{Array.from({ length: 20 }, (_, i) => <circle key={i} cx={69 + i % 10 * 18} cy={i < 10 ? 35.5 : 88.5} r="3"/>)}</g>
          <text x="150" y="75" textAnchor="middle" className="kp-display" fontSize="32" fill="var(--kp-sun)" stroke="none">Hijinks</text></g>
        <g transform="translate(266 56) rotate(28)"><path d="M-8-34h16v52H-8Z" fill="var(--kp-lime)"/><path d="M-8 18h16L0 38Z" fill="var(--kp-cream)"/><path d="M-8-46h16v12H-8Z" fill="var(--kp-coral)"/></g>
        <path d="M54 128q0-24 20-24t20 24Z" fill="var(--kp-sun)"/><path d="M68 115h1m10 0h1" fill="none"/><path d="M206 128q0-26 22-26t22 26Z" fill="var(--kp-sky)"/><path d="M220 114h1m14 0h1m-12 6q4 3 8 0" fill="none"/>
        <path d="M134 100h32v5q0 15-16 15t-16-15Z" fill="var(--kp-sun)"/><path d="M134 104h-8q0 9 10 10m30-10h8q0 9-10 10M144 128h12l-2-8h-8Z" fill="none"/></>}
      {id === 'trolley-court' && <><path d="M8 104h284M128 104q40 0 62-34t48-12h54" fill="none" strokeWidth="7"/>
        <path d="M226 58q0-18 12-18t12 18Zm32 0q0-18 12-18t12 18Z" fill="var(--kp-sky)"/><circle cx="238" cy="30" r="8" fill="var(--kp-sky)"/><circle cx="270" cy="30" r="8" fill="var(--kp-sky)"/><circle cx="238" cy="76" r="8" fill="var(--kp-coral)"/><path d="M226 104q0-18 12-18t12 18Z" fill="var(--kp-coral)"/>
        <path d="M22 52h82a8 8 0 0 1 8 8v32H14V60a8 8 0 0 1 8-8Z" fill="var(--kp-coral)"/><path d="M26 61h18v14H26Zm28 0h18v14H54Zm28 0h18v14H82Z" fill="var(--kp-cream)"/><path d="M64 52 48 30" fill="none"/><circle cx="34" cy="97" r="8" fill="var(--kp-ink)"/><circle cx="92" cy="97" r="8" fill="var(--kp-ink)"/>
        <path d="M146 126h26" fill="none"/><path d="m159 124 12-36" fill="none" strokeWidth="6"/><circle cx="172" cy="84" r="8" fill="var(--kp-sun)"/></>}
      {id === 'kitchen-rush' && <><path d="M86 65h115l-8 43H94Z" fill="var(--kp-coral)"/><ellipse cx="143" cy="65" rx="57" ry="12" fill="var(--kp-cream)"/><path d="m87 74-19-4m132 4 20-4M113 107h58" fill="none"/><path d="M127 34v-9c-19 1-19-22-3-22 7-16 31-14 38 0 22-3 25 21 6 23v13Z" fill="var(--kp-cream)"/><path d="m127 31 41 4m-53 14 7 6m42-8-6 8m-20-9 3 9" fill="none"/><path d="m107 120 8-8 9 8m26 0 8-8 9 8" fill="none" stroke="var(--kp-sun)"/><path d="m225 30-15 24m4-30 20 12" fill="none" stroke="var(--kp-lime)"/></>}
    </g>
  </svg>;
}
export function CollectionArt() {
  return <div className="kp-collection-art" aria-hidden="true"><div className="kp-art-orbit"/>{Object.keys(gameLooks).filter(id => !['blockwild', 'kitchen-rush', 'island-settlers'].includes(id)).map((id, index) => <div key={id} className={`kp-art-tile kp-art-tile-${index}`}><GameArt id={id}/></div>)}<span className="kp-art-stamp kp-display">{Object.keys(gameLooks).length} games<br/><small>one great night</small></span></div>;
}
