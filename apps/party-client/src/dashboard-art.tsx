import type { CSSProperties } from 'react';

/** A frontal kart with a fox-eared driver. Drawn in the shared 300×130 card-art space. */
function Kart({ suit = 'var(--kp-coral)', body = 'var(--kp-coral)' }: { suit?: string; body?: string }) {
  return <g stroke="var(--kp-ink)" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round">
    <rect x="50" y="72" width="36" height="44" rx="9" fill="var(--kp-ink)"/><rect x="214" y="72" width="36" height="44" rx="9" fill="var(--kp-ink)"/>
    <rect x="62" y="84" width="12" height="20" rx="4" fill="#3d4563" stroke="none"/><rect x="226" y="84" width="12" height="20" rx="4" fill="#3d4563" stroke="none"/>
    <path d="M118 80q0-26 32-26t32 26v14h-64Z" fill={suit}/>
    <path d="m130 24-14-20 26 10Zm40 0 14-20-26 10Z" fill="var(--kp-sun)"/>
    <circle cx="150" cy="38" r="24" fill="var(--kp-sun)"/>
    <path d="M129 27q21-15 42 0" fill="none" stroke={suit} strokeWidth="7"/>
    <rect x="127" y="33" width="46" height="14" rx="7" fill="var(--kp-ink)"/>
    <circle cx="139" cy="40" r="2.6" fill="var(--kp-cream)" stroke="none"/><circle cx="161" cy="40" r="2.6" fill="var(--kp-cream)" stroke="none"/>
    <path d="M78 70h144l14 28v12H64V98Z" fill={body}/>
    <ellipse cx="150" cy="70" rx="24" ry="9" fill="none" strokeWidth="6"/>
    <circle cx="124" cy="73" r="7" fill="var(--kp-sun)"/><circle cx="176" cy="73" r="7" fill="var(--kp-sun)"/>
    <path d="m150 78 4 9 10 1-7 7 2 10-9-5-9 5 2-10-7-7 10-1Z" fill="var(--kp-sun)"/>
    <rect x="66" y="100" width="168" height="12" rx="6" fill="var(--kp-cream)"/>
    <rect x="82" y="98" width="30" height="24" rx="7" fill="var(--kp-ink)"/><rect x="188" y="98" width="30" height="24" rx="7" fill="var(--kp-ink)"/>
  </g>;
}

/** Card illustration for Kart Party, framed like the shared GameArt so the two families sit together. */
export function KartArt({ className = '' }: { className?: string }) {
  return <svg viewBox="0 0 300 130" aria-hidden="true" className={`kp-game-art ${className}`} style={{ '--art-accent': 'var(--kp-sun)' } as CSSProperties}>
    <ellipse cx="150" cy="121" rx="96" ry="7" fill="var(--kp-ink)" opacity=".3"/>
    <g fill="var(--art-accent)" opacity=".22"><circle cx="150" cy="70" r="63"/><path d="m33 30 8 5-8 5-5 8-5-8-8-5 8-5 5-8Zm232 60 6 4-6 4-4 6-4-6-6-4 6-4 4-6Z"/><circle cx="249" cy="24" r="5"/><circle cx="56" cy="108" r="4"/></g>
    <path d="M12 62h36M4 80h30M252 62h36M266 80h30" stroke="var(--kp-cream)" strokeWidth="5" strokeLinecap="round" opacity=".55"/>
    <Kart/>
  </svg>;
}

/** A doorway into other worlds. Platform artwork, independent of the catalog. */
export function HeroArt({ className = '' }: { className?: string }) {
  return <svg viewBox="0 0 640 400" aria-hidden="true" preserveAspectRatio="xMidYMid slice" className={`kp-dashboard-hero-art ${className}`}>
    <defs>
      <radialGradient id="kp-portal-atmosphere"><stop stopColor="#303257"/><stop offset="1" stopColor="#080d1c"/></radialGradient>
      <linearGradient id="kp-portal-edge" x1="0" y1="0" x2="1" y2="1"><stop stopColor="var(--kp-sky)"/><stop offset=".5" stopColor="var(--kp-grape)"/><stop offset="1" stopColor="var(--kp-coral)"/></linearGradient>
      <linearGradient id="kp-portal-core" x1="0" y1="1" x2="1" y2="0"><stop stopColor="#141d3a"/><stop offset=".55" stopColor="#28375c"/><stop offset="1" stopColor="#576180"/></linearGradient>
      <linearGradient id="kp-portal-floor" x1="0" y1="0" x2="0" y2="1"><stop stopColor="var(--kp-grape)" stopOpacity=".22"/><stop offset="1" stopColor="var(--kp-grape)" stopOpacity="0"/></linearGradient>
      <filter id="kp-portal-glow" x="-70%" y="-70%" width="240%" height="240%"><feGaussianBlur stdDeviation="14"/></filter>
    </defs>
    <rect width="640" height="400" fill="url(#kp-portal-atmosphere)"/>
    <path d="M0 314h640" stroke="#fff6e5" strokeOpacity=".08"/>
    <path d="m239 306 164-16 161 110H116Z" fill="url(#kp-portal-floor)"/>
    <g fill="none" stroke="url(#kp-portal-edge)" strokeLinejoin="round">
      <path d="m158 128 116-47v194l-116 47Z" strokeOpacity=".14"/>
      <path d="m465 72 65 40v171l-65-40Z" strokeOpacity=".18"/>
      <path d="m216 99 190-29 31 221-190 29Z" strokeWidth="16" opacity=".6" filter="url(#kp-portal-glow)"/>
    </g>
    <path d="m221 86 185-28 43 236-185 28-25-16-43-236Z" fill="#080d1c" stroke="#fff6e5" strokeOpacity=".12" strokeLinejoin="round"/>
    <path d="m221 86 185-28 43 236-185 28Z" fill="url(#kp-portal-core)" stroke="url(#kp-portal-edge)" strokeWidth="2" strokeLinejoin="round"/>
    <path d="m235 98 160-24 38 208-159 24Z" fill="#080d1c" fillOpacity=".55" stroke="#fff6e5" strokeOpacity=".14"/>
    <path d="m288 145 12 81 60-49Z" fill="url(#kp-portal-edge)" opacity=".6" filter="url(#kp-portal-glow)"/>
    <path d="m298 145 12 81 57-49Z" fill="var(--kp-cream)" stroke="#fff" strokeLinejoin="round"/>
    <path d="m239 306 25 16 185-28" fill="none" stroke="url(#kp-portal-edge)" strokeWidth="2"/>
    <g fill="var(--kp-cream)" opacity=".4"><circle cx="142" cy="74" r="1"/><circle cx="474" cy="326" r="1.5"/><circle cx="510" cy="54" r="1"/><circle cx="102" cy="251" r="1"/></g>
  </svg>;
}
