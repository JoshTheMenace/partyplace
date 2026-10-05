import { useEffect, useState } from 'react';
import { ArcadeButton, Modal } from '../../../packages/party-ui/src/index';
/** Browser chrome and keyboards can shrink/pan the visual viewport without changing the layout viewport. */
export function usePhoneViewport(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const root = document.querySelector<HTMLElement>('.kp-shell'); if (!root) return;
    const viewport = window.visualViewport;
    const update = () => { root.style.setProperty('--phone-height', `${viewport?.height ?? innerHeight}px`); root.style.setProperty('--phone-top', `${viewport?.offsetTop ?? 0}px`); };
    update(); viewport?.addEventListener('resize', update); viewport?.addEventListener('scroll', update); window.addEventListener('resize', update);
    return () => { viewport?.removeEventListener('resize', update); viewport?.removeEventListener('scroll', update); window.removeEventListener('resize', update); root.style.removeProperty('--phone-height'); root.style.removeProperty('--phone-top'); };
  }, [active]);
}
/** Opened from a Home Screen icon: the browser's bars are already gone. */
const standalone = () => matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const iPhone = () => /iPhone|iPod/.test(navigator.userAgent);
export function PhoneScreenButton({ code }: { code?: string }) {
  const [full, setFull] = useState(!!document.fullscreenElement), [help, setHelp] = useState(false);
  useEffect(() => { const update = () => setFull(!!document.fullscreenElement); document.addEventListener('fullscreenchange', update); return () => document.removeEventListener('fullscreenchange', update); }, []);
  const supported = !!document.fullscreenEnabled && !!document.documentElement.requestFullscreen;
  if (!supported && standalone()) return null;
  const toggle = () => { if (full) void document.exitFullscreen().catch(() => setHelp(true)); else if (supported) void document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => setHelp(true)); else setHelp(true); };
  return <><ArcadeButton size="sm" tone="ghost" onClick={toggle}>{full ? 'Exit full screen' : supported ? 'Full screen' : 'Screen tips'}</ArcadeButton>{help && <Modal title="More room for your controls" onClose={() => setHelp(false)}>{iPhone() ? <>
    <p>Safari can’t go full screen on iPhone, but PartyPlay can run as an app without Safari’s bars:</p>
    <ol><li>Tap Safari’s <strong>Share</strong> button, then <strong>Add to Home Screen</strong>.</li><li>Open <strong>PartyPlay</strong> from your Home Screen.</li><li>Tap <strong>Join with a code</strong>{code ? <> and enter room code <strong className="kp-numeral">{code}</strong></> : ' and enter the room code'} with the same name to get your seat back.</li></ol>
    <p>Staying in Safari? Use the page menu in the address bar to hide the toolbar. The controls still fit the visible screen.</p>
  </> : <p>This browser can’t hide its address bar here. The controls still fit the visible screen; adding PartyPlay to your Home Screen opens it without browser bars.</p>}</Modal>}</>;
}
