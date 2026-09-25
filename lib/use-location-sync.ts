'use client';

import * as React from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import type { LocationSource } from '@/lib/types';

const FOREGROUND_INTERVAL_MS = 6000;
const BACKGROUND_INTERVAL_MS = 15000;

export interface LocationSyncOptions {
  scheduleId: string | null;
  busId: string | null;
  source: LocationSource;
  enabled: boolean;
}

export interface LocationSyncState {
  syncing: boolean;
  lastSyncAt: number | null;
  intervalMs: number;
}

function useVisibilityInterval(
  callback: () => void,
  active: boolean
): { intervalMs: number } {
  const [intervalMs, setIntervalMs] = React.useState(FOREGROUND_INTERVAL_MS);
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const callbackRef = React.useRef(callback);
  callbackRef.current = callback;

  React.useEffect(() => {
    if (!active) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const start = (ms: number) => {
      if (timerRef.current) clearInterval(timerRef.current);
      setIntervalMs(ms);
      timerRef.current = setInterval(() => callbackRef.current(), ms);
    };

    start(FOREGROUND_INTERVAL_MS);

    const onVisibility = () => {
      const bg = document.visibilityState === 'hidden';
      start(bg ? BACKGROUND_INTERVAL_MS : FOREGROUND_INTERVAL_MS);
    };

    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [active]);

  return { intervalMs };
}

export function useLocationSync({
  scheduleId,
  busId,
  source,
  enabled,
}: LocationSyncOptions): LocationSyncState & {
  report: (lat: number, lng: number) => Promise<void>;
} {
  const [syncing, setSyncing] = React.useState(false);
  const [lastSyncAt, setLastSyncAt] = React.useState<number | null>(null);
  const latestReadingRef = React.useRef<{ lat: number; lng: number } | null>(null);

  const report = React.useCallback(
    async (lat: number, lng: number) => {
      latestReadingRef.current = { lat, lng };
      if (!scheduleId) return;
      if (!isSupabaseConfigured || !supabase) return;
      setSyncing(true);
      try {
        await supabase
          .from('daily_schedules')
          .update({
            live_lat: lat,
            live_lng: lng,
            location_source: source,
            last_ping: new Date().toISOString(),
          })
          .eq('id', scheduleId);
        setLastSyncAt(Date.now());
      } finally {
        setSyncing(false);
      }
    },
    [scheduleId, source]
  );

  const flush = React.useCallback(async () => {
    const reading = latestReadingRef.current;
    if (reading) await report(reading.lat, reading.lng);
  }, [report]);

  const { intervalMs } = useVisibilityInterval(
    () => {
      void flush();
    },
    enabled && !!scheduleId
  );

  return { syncing, lastSyncAt, intervalMs, report };
}
