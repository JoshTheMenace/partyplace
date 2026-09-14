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
export function PhoneScreenButton() {
  const [full, setFull] = useState(!!document.fullscreenElement), [help, setHelp] = useState(false);
  useEffect(() => { const update = () => setFull(!!document.fullscreenElement); document.addEventListener('fullscreenchange', update); return () => document.removeEventListener('fullscreenchange', update); }, []);
  const supported = !!document.fullscreenEnabled && !!document.documentElement.requestFullscreen;
  const toggle = () => { if (full) void document.exitFullscreen().catch(() => setHelp(true)); else if (supported) void document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => setHelp(true)); else setHelp(true); };
  return <><ArcadeButton size="sm" tone="ghost" onClick={toggle}>{full ? 'Exit full screen' : supported ? 'Full screen' : 'Screen tips'}</ArcadeButton>{help && <Modal title="More room for your controls" onClose={() => setHelp(false)}><p>This browser cannot hide its address bar here. The controls still fit the visible screen.</p><p>On iPhone, use Safari’s page menu to hide the toolbar if available. You can also add PartyPlay to your Home Screen and open it there, then join the room again.</p><p>Turn your phone sideways for the fight. Keep it upright for choosing a fighter and map.</p></Modal>}</>;
}
