'use client';

import * as React from 'react';
import { MapPinOff, Share2, Info, X, Satellite, Crosshair, Gauge } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { useLocationSync } from '@/lib/use-location-sync';

interface PassengerLocationSharingProps {
  busId: string | null;
  active: boolean;
  scheduleId?: string | null;
}

function generateSessionId(): string {
  if (typeof window === 'undefined') return '';
  const KEY = 'diu-transit-session-id';
  let id = window.localStorage.getItem(KEY);
  if (!id) {
    id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(KEY, id);
  }
  return id;
}

export function PassengerLocationSharing({
  busId,
  active,
  scheduleId = null,
}: PassengerLocationSharingProps) {
  const [sharing, setSharing] = React.useState(false);
  const [bannerVisible, setBannerVisible] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [lastPing, setLastPing] = React.useState<{
    lat: number;
    lng: number;
    accuracy: number | null;
    speed: number | null;
  } | null>(null);

  const watchIdRef = React.useRef<number | null>(null);
  const lastReadingRef = React.useRef<{
    lat: number;
    lng: number;
    accuracy: number | null;
    speed: number | null;
  } | null>(null);
  const sessionIdRef = React.useRef<string>('');

  React.useEffect(() => {
    sessionIdRef.current = generateSessionId();
  }, []);

  const locationSync = useLocationSync({
    scheduleId,
    busId,
    source: 'crowd',
    enabled: sharing,
  });

  const sendPing = React.useCallback(
    async (reading: {
      lat: number;
      lng: number;
      accuracy: number | null;
      speed: number | null;
    }) => {
      if (!busId) return;

      // Insert into crowd_pings for consensus aggregation
      if (isSupabaseConfigured && supabase) {
        await supabase.from('crowd_pings').insert({
          bus_id: busId,
          lat: reading.lat,
          lng: reading.lng,
          accuracy: reading.accuracy,
          speed: reading.speed,
          session_id: sessionIdRef.current,
        });
      }

      // Update daily_schedules as the single source of truth
      await locationSync.report(reading.lat, reading.lng);
    },
    [busId, locationSync]
  );

  const stopTracking = React.useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setSharing(false);
    setLastPing(null);
  }, []);

  const startTracking = React.useCallback(() => {
    if (!('geolocation' in navigator)) {
      setError('Your device does not support GPS.');
      return;
    }
    setError(null);
    setSharing(true);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const reading = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? null,
          speed:
            pos.coords.speed !== null && !Number.isNaN(pos.coords.speed)
              ? Math.round(pos.coords.speed * 3.6 * 10) / 10
              : null,
        };
        lastReadingRef.current = reading;
        setLastPing(reading);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setError('Location permission denied. Enable it in your browser settings.');
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setError('GPS signal unavailable. Try moving to an open area.');
        } else if (err.code === err.TIMEOUT) {
          setError('Could not get your location in time.');
        }
        stopTracking();
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
  }, [stopTracking]);

  const handleToggle = React.useCallback(
    (checked: boolean) => {
      if (checked) {
        startTracking();
      } else {
        stopTracking();
      }
    },
    [startTracking, stopTracking]
  );

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Auto-stop when trip ends or bus deselected
  React.useEffect(() => {
    if (!active || !busId) {
      if (sharing) {
        stopTracking();
      }
    }
  }, [active, busId, sharing, stopTracking]);

  const intervalLabel = locationSync.intervalMs >= 15000 ? '15s' : '6s';

  return (
    <div className="space-y-3">
      {/* Privacy info banner */}
      {bannerVisible && (
        <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3 animate-fade-in">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Info className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">
              Your privacy matters
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Location pings are anonymous and used only to estimate crowd
              density. No personal data is stored. You can stop sharing anytime.
            </p>
          </div>
          <button
            onClick={() => setBannerVisible(false)}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Toggle row */}
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/30">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
              sharing
                ? 'bg-success/10 text-success'
                : 'bg-muted text-muted-foreground'
            )}
          >
            {sharing ? <Share2 className="h-5 w-5" /> : <MapPinOff className="h-5 w-5" />}
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              I&apos;m on this bus
            </p>
            <p className="text-xs text-muted-foreground">
              {sharing ? `Sharing your location every ${intervalLabel}` : 'Share your location to help estimate crowd'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {sharing && (
            <Badge variant="default" className="gap-1.5 bg-success text-success-foreground">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-success-foreground" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success-foreground" />
              </span>
              Live
            </Badge>
          )}
          <Switch
            checked={sharing}
            onCheckedChange={handleToggle}
            aria-label="Share my location"
          />
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 animate-fade-in">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
            <Info className="h-4 w-4" />
          </div>
          <p className="flex-1 text-sm text-foreground">{error}</p>
          <button
            onClick={() => setError(null)}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Live GPS stats */}
      {sharing && lastPing && (
        <div className="flex items-center gap-4 rounded-lg border border-success/30 bg-success/5 p-3 animate-fade-in">
          <div className="flex items-center gap-1.5">
            <Satellite className="h-3.5 w-3.5 text-success" />
            <span className="text-xs text-muted-foreground">GPS</span>
            <span className="text-sm font-semibold text-success">Active</span>
          </div>
          {lastPing.accuracy !== null && (
            <div className="flex items-center gap-1.5">
              <Crosshair className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">±{Math.round(lastPing.accuracy)}m</span>
            </div>
          )}
          {lastPing.speed !== null && (
            <div className="flex items-center gap-1.5">
              <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">{lastPing.speed} km/h</span>
            </div>
          )}
          <div className="ml-auto text-xs text-muted-foreground tabular-nums">
            {lastPing.lat.toFixed(4)}°, {lastPing.lng.toFixed(4)}°
          </div>
        </div>
      )}
    </div>
  );
}
