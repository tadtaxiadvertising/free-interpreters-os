'use client';

import { useEffect } from 'react';

/**
 * VersionGuard — auto-reloads the page when a new deployment is detected.
 * 
 * How it works:
 *   1. Saves `BUILD_ID` from the HTML at first load (__NEXT_DATA__.buildId).
 *   2. On every navigation / re-render, pings /api/version for the current BUILD_ID.
 *   3. If they differ → new deployment → hard reload.
 *   
 * The /api/version endpoint is intentionally cache-busted with a nonce.
 */

const STORAGE_KEY = '__fi_build_ts';
const BUILD_ID = (typeof window !== 'undefined' && (window as any).__NEXT_DATA__?.buildId) || '';

function getStoredBuildTs(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeBuildTs(ts: string) {
  try {
    localStorage.setItem(STORAGE_KEY, ts);
  } catch {/* noop */}
}

export default function VersionGuard() {
  useEffect(() => {
    if (!BUILD_ID) return;

    // If we already stored this build's timestamp, skip the fetch
    const stored = getStoredBuildTs();

    const check = async () => {
      try {
        const res = await fetch('/api/version?_t=' + Date.now(), {
          method: 'GET',
          headers: { 'Cache-Control': 'no-cache' },
        });
        if (!res.ok) return;

        const data = await res.json();
        const serverBuildTs = data?.buildTimestamp;
        if (!serverBuildTs) return;

        // First visit — store and return
        if (!stored) {
          storeBuildTs(serverBuildTs);
          return;
        }

        // New deployment detected — hard reload
        if (stored !== serverBuildTs) {
          console.log('🔄 [VersionGuard] New build detected, reloading...');
          window.location.reload();
        }
      } catch {
        // Silently fail — don't break the UI on network errors
      }
    };

    check();

    // Also check on visibility change (user returns to tab after deploy)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  return null;
}