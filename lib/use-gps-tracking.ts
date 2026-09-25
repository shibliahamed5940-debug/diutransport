'use client';

import * as React from 'react';

export interface GpsReading {
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null;
  accuracy: number | null;
  timestamp: number;
}

export interface GpsTrackingState {
  reading: GpsReading | null;
  error: 'denied' | 'unavailable' | 'timeout' | null;
  watching: boolean;
}

function smoothHeading(prev: number | null, next: number | null): number {
  if (next === null || Number.isNaN(next)) return prev ?? 0;
  if (prev === null) return next;
  const diff = ((next - prev + 540) % 360) - 180;
  return prev + diff;
}

export function useGpsTracking(active: boolean): GpsTrackingState & {
  start: () => void;
  stop: () => void;
} {
  const [reading, setReading] = React.useState<GpsReading | null>(null);
  const [error, setError] = React.useState<'denied' | 'unavailable' | 'timeout' | null>(null);
  const [watching, setWatching] = React.useState(false);
  const watchIdRef = React.useRef<number | null>(null);
  const headingRef = React.useRef<number | null>(null);

  const stop = React.useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setWatching(false);
  }, []);

  const start = React.useCallback(() => {
    if (!('geolocation' in navigator)) {
      setError('unavailable');
      return;
    }
    setError(null);
    setWatching(true);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const heading = pos.coords.heading;
        const newHeading = smoothHeading(
          headingRef.current,
          heading !== null && !Number.isNaN(heading) ? heading : null
        );
        headingRef.current = newHeading;

        setReading({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          heading: newHeading,
          speed: pos.coords.speed !== null && !Number.isNaN(pos.coords.speed)
            ? Math.round((pos.coords.speed * 3.6) * 10) / 10
            : null,
          accuracy: pos.coords.accuracy ?? null,
          timestamp: pos.timestamp,
        });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setError('denied');
        else if (err.code === err.POSITION_UNAVAILABLE) setError('unavailable');
        else if (err.code === err.TIMEOUT) setError('timeout');
        setWatching(false);
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 }
    );
  }, []);

  React.useEffect(() => {
    if (!active) {
      stop();
    }
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [active, stop]);

  return { reading, error, watching, start, stop };
}
