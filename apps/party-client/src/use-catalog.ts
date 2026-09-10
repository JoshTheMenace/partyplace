import { useCallback, useEffect, useRef, useState } from 'react';
import { parseCatalog, type CatalogSource } from '../../../packages/party-catalog/src/index';
import type { GameManifest } from '../../../packages/party-contract/src/index';
export function useCatalog() {
  const [data, setData] = useState<{ sources: CatalogSource[]; games: GameManifest[] }>({ sources: [], games: [] });
  const [error, setError] = useState(''), [loading, setLoading] = useState(true);
  const active = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    if (active.current) return;
    const controller = new AbortController(); active.current = controller;
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch('/api/catalog', { signal: controller.signal, cache: 'no-store' });
      if (!response.ok) throw Error();
      const value = await response.json();
      setData({ sources: parseCatalog({ version: 1, sources: value.sources }), games: value.games }); setError('');
    } catch { if (active.current === controller) setError('Discover could not refresh. Your library is still here.'); }
    finally { clearTimeout(timeout); if (active.current === controller) { active.current = null; setLoading(false); } }
  }, []);
  useEffect(() => {
    void refresh();
    const visibleRefresh = () => { if (!document.hidden) void refresh(); };
    const timer = setInterval(visibleRefresh, 30000);
    window.addEventListener('focus', visibleRefresh); document.addEventListener('visibilitychange', visibleRefresh);
    return () => { clearInterval(timer); window.removeEventListener('focus', visibleRefresh); document.removeEventListener('visibilitychange', visibleRefresh); const controller = active.current; active.current = null; controller?.abort(); };
  }, [refresh]);
  return { ...data, error, loading, refresh };
}
