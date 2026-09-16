import { SkyClashArt } from '../../../packages/games/sky-clash/src/art';
import type { CSSProperties } from 'react';
export const gameLooks: Record<string, { tone: 'sun' | 'coral' | 'sky' | 'lime' | 'grape'; verb: string }> = {
  'sky-clash': { tone: 'sun', verb: 'Build damage. Send rivals flying.' },
  'blockwild': { tone: 'lime', verb: 'Mine. Build. Make a world.' }, 'kitchen-rush': { tone: 'coral', verb: 'A little heat. A lot of teamwork.' },
  'quip-clash': { tone: 'sun', verb: 'Write. Vote. Laugh.' }, 'sketch-bluff': { tone: 'sky', verb: 'Draw a little deception.' },
  'tall-tales': { tone: 'grape', verb: 'Make the unbelievable believable.' }, 'shirt-show': { tone: 'coral', verb: 'Wear your weirdest idea.' },
  'odd-one-in': { tone: 'lime', verb: 'Someone is winging it.' }, 'quiz-panic': { tone: 'coral', verb: 'Think fast. Stay in it.' },
};
export function GameArt({ id, className = '' }: { id: string; className?: string }) {
  if (id === 'sky-clash') return <SkyClashArt className={`kp-game-art ${className}`}/>;
  const tone = gameLooks[id]?.tone ?? 'sun';
  return <svg viewBox="0 0 300 130" aria-hidden="true" className={`kp-game-art ${className}`} style={{ '--art-accent': `var(--kp-${tone})` } as CSSProperties}>
    <ellipse cx="150" cy="121" rx="96" ry="7" fill="var(--kp-ink)" opacity=".3" />
    <g fill="var(--art-accent)" opacity=".22"><circle cx="150" cy="70" r="63"/><path d="m33 30 8 5-8 5-5 8-5-8-8-5 8-5 5-8Zm232 60 6 4-6 4-4 6-4-6-6-4 6-4 4-6Z"/><circle cx="249" cy="24" r="5"/><circle cx="56" cy="108" r="4"/></g>
    <g stroke="var(--kp-ink)" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round">
      {id === 'blockwild' && <><path d="m81 65 55-28 57 28v40l-57 25-55-25Z" fill="#a77549"/><path d="m81 65 55 25 57-25-57-28Z" fill="var(--kp-lime)"/><path d="M136 90v40" fill="none"/><path d="m173 57 31-16 32 16v25l-32 16-31-16Z" fill="#c79564"/><path d="m173 57 31 16 32-16-32-16Z" fill="var(--kp-lime)"/><path d="M205 73v25M108 13v34" fill="none" stroke="#825e3e" strokeWidth="12"/><path d="m81 11 27-10 27 10v21l-27 11-27-11Z" fill="#3f914c"/><path d="m81 11 27 11 27-11" fill="none" stroke="#78d955"/></>}
      {id === 'kitchen-rush' && <><path d="M86 65h115l-8 43H94Z" fill="var(--kp-coral)"/><ellipse cx="143" cy="65" rx="57" ry="12" fill="var(--kp-cream)"/><path d="m87 74-19-4m132 4 20-4M113 107h58" fill="none"/><path d="M127 34v-9c-19 1-19-22-3-22 7-16 31-14 38 0 22-3 25 21 6 23v13Z" fill="var(--kp-cream)"/><path d="m127 31 41 4m-53 14 7 6m42-8-6 8m-20-9 3 9" fill="none"/><path d="m107 120 8-8 9 8m26 0 8-8 9 8" fill="none" stroke="var(--kp-sun)"/><path d="m225 30-15 24m4-30 20 12" fill="none" stroke="var(--kp-lime)"/></>}
      {id === 'quip-clash'  && <><path d="M59 22h119a16 16 0 0 1 16 16v44a16 16 0 0 1-16 16h-62L88 116l4-18H59a16 16 0 0 1-16-16V38a16 16 0 0 1 16-16Z" fill="var(--kp-sun)"/><path d="M171 49h63a14 14 0 0 1 14 14v31a14 14 0 0 1-14 14h-5l7 14-29-14h-36a14 14 0 0 1-14-14V63a14 14 0 0 1 14-14Z" fill="var(--kp-coral)"/><path d="M73 51h22m24 0h22M80 68q27 30 55 0" fill="none"/><path d="m181 75 9-7m23 7 9-7m-32 21h24" fill="none"/></>}
      {id === 'sketch-bluff' && <><path d="m89 12 111 9-9 99-111-9Z" fill="var(--kp-cream)"/><path d="m111 89 7-31 22 15 11-31 15 38 17 18" fill="none" stroke="var(--kp-sky)"/><circle cx="127" cy="39" r="7" fill="var(--kp-sun)"/><path d="m211 12 19 14-56 78-28 15 5-31Z" fill="var(--kp-sky)"/><path d="m151 88 23 16-28 15Z" fill="var(--kp-sun)"/><path d="m211 12 19 14-10 14-19-14Z" fill="var(--kp-coral)"/></>}
      {id === 'tall-tales' && <><path d="M51 29q48-17 99 6 51-23 99-6v82q-48-17-99 5-51-22-99-5Z" fill="var(--kp-grape)"/><path d="M65 20q39-13 85 12 46-25 85-12v74q-39-13-85 12-46-25-85-12Z" fill="var(--kp-cream)"/><path d="M150 32v74m-66-61 45 8m-45 11 45 8m-45 11 31 6" fill="none"/><path d="m178 71 10-42 24 3-7 42-4 19-15-1Z" fill="var(--kp-grape)"/><path d="m183 87 17 1m-10-38h11" fill="none"/></>}
      {id === 'shirt-show' && <><path d="m107 18 25-9q18 20 36 0l25 9 41 33-26 29-20-15v53h-76V65L92 80 66 51Z" fill="var(--kp-coral)"/><path d="M132 9q18 39 36 0" fill="var(--kp-ink)"/><path d="m150 46 10 17 20 3-14 14 2 20-18-9-18 9 2-20-14-14 20-3Z" fill="var(--kp-sun)"/><path d="m143 70 3 2m10-2 3 2m-17 10q8 7 16 0" fill="none"/></>}
      {id === 'odd-one-in' && <><path d="M49 83q0-29 30-29t30 29v29H49Z" fill="var(--kp-sky)"/><circle cx="79" cy="44" r="22" fill="var(--kp-sky)"/><path d="M191 83q0-29 30-29t30 29v29h-60Z" fill="var(--kp-grape)"/><circle cx="221" cy="44" r="22" fill="var(--kp-grape)"/><path d="M115 81q0-32 35-32t35 32v36h-70Z" fill="var(--kp-lime)"/><circle cx="150" cy="37" r="27" fill="var(--kp-lime)"/><path d="M125 29h50l-5 17h-15l-5-8-5 8h-15Z" fill="var(--kp-ink)"/><path d="M144 57h12M72 43h1m13 0h1m128 0h1m13 0h1" fill="none"/></>}
      {id === 'quiz-panic' && <><path d="M83 108h134l-8-18H91Z" fill="var(--kp-cream)"/><path d="M98 91v-8a52 52 0 0 1 104 0v8Z" fill="var(--kp-coral)"/><path d="m125 47 14-8m-48-9-11-13m-1 39-19-5m151-20 11-13m1 40 19-5" fill="none" stroke="var(--kp-sun)"/><path d="m146 10-14 29h18l-8 22 27-31h-17l9-20Z" fill="var(--kp-sun)"/></>}
    </g>
  </svg>;
}
export function CollectionArt() {
  return <div className="kp-collection-art" aria-hidden="true"><div className="kp-art-orbit"/>{Object.keys(gameLooks).filter(id => !['blockwild', 'kitchen-rush'].includes(id)).map((id, index) => <div key={id} className={`kp-art-tile kp-art-tile-${index}`}><GameArt id={id}/></div>)}<span className="kp-art-stamp kp-display">{Object.keys(gameLooks).length} games<br/><small>one great night</small></span></div>;
}
