import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchAllChannels, getChannelPage, clearMemCache,
  subscribeToChannelUpdates,
} from '@/lib/iptvApi';
import type { IPTVChannel } from '@/types';

export function useChannels(category: string, countryCode = '') {
  const [channels,    setChannels]    = useState<IPTVChannel[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [hasMore,     setHasMore]     = useState(true);
  const [total,       setTotal]       = useState(0);
  const [error,       setError]       = useState<string | null>(null);
  const [refreshKey,  setRefreshKey]  = useState(0);

  const pageRef        = useRef(1);
  const allChannelsRef = useRef<IPTVChannel[]>([]);
  const loadingMoreRef = useRef(false);
  const mountedRef     = useRef(true);

  // Page from currently loaded cache
  const applyPage = useCallback((all: IPTVChannel[], page: number, append: boolean) => {
    const pg = getChannelPage(all, category, page, countryCode);
    if (append) {
      setChannels(prev => [...prev, ...pg.items]);
    } else {
      setChannels(pg.items);
    }
    setHasMore(pg.hasMore);
    setTotal(pg.total);
  }, [category, countryCode]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Subscribe to background updates
  useEffect(() => {
    const unsub = subscribeToChannelUpdates(() => {
      if (!mountedRef.current) return;
      // Re-apply current page from updated cache
      if (allChannelsRef.current.length > 0) {
        // Refresh the page count but keep loaded pages
        const pg = getChannelPage(allChannelsRef.current, category, 1, countryCode);
        setTotal(pg.total);
        // If we have fewer channels than expected, refresh visible list
        if (pg.total > channels.length + 50) {
          // Re-apply all loaded pages
          const allLoaded = getChannelPage(allChannelsRef.current, category, pageRef.current, countryCode);
          // Accumulate all pages 1..currentPage
          let acc: IPTVChannel[] = [];
          for (let p = 1; p <= pageRef.current; p++) {
            acc = [...acc, ...getChannelPage(allChannelsRef.current, category, p, countryCode).items];
          }
          setChannels(acc);
          setHasMore(allLoaded.hasMore);
        }
      }
    });
    return unsub;
  }, [category, countryCode, channels.length]);

  useEffect(() => {
    if (!mountedRef.current) return;
    setLoading(true);
    setChannels([]);
    setError(null);
    setHasMore(true);
    pageRef.current = 1;

    fetchAllChannels()
      .then(all => {
        if (!mountedRef.current) return;
        allChannelsRef.current = all;
        applyPage(all, 1, false);
        setLoading(false);
        console.log(`[Channels] First page loaded for category="${category}", total=${all.length}`);
      })
      .catch(err => {
        if (!mountedRef.current) return;
        setError(String(err));
        setLoading(false);
      });
  }, [category, countryCode, refreshKey, applyPage]);

  const loadMore = useCallback(() => {
    if (loadingMoreRef.current || !hasMore) return;
    loadingMoreRef.current = true;

    const nextPage = pageRef.current + 1;
    applyPage(allChannelsRef.current, nextPage, true);
    pageRef.current = nextPage;

    setTimeout(() => { loadingMoreRef.current = false; }, 150);
  }, [hasMore, applyPage]);

  const refresh = useCallback(() => {
    clearMemCache();
    setRefreshKey(k => k + 1);
  }, []);

  return { channels, loading, hasMore, loadMore, total, error, refresh };
}
