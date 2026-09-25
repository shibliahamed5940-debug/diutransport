'use client';

import * as React from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

export interface CrowdPing {
  bus_id: string | null;
  lat: number;
  lng: number;
  created_at: string;
  session_id: string;
}

export interface ConsensusResult {
  lat: number;
  lng: number;
  contributorCount: number;
  source: 'driver' | 'crowd' | 'waiting';
}

const STALE_THRESHOLD_MS = 2 * 60 * 1000;
const RECENT_WINDOW_MS = 30 * 1000;
const POLL_INTERVAL_MS = 15 * 1000;

function computeCentroid(pings: CrowdPing[]): { lat: number; lng: number } {
  if (pings.length === 0) return { lat: 0, lng: 0 };
  const uniqueSessions = new Map<string, CrowdPing>();
  for (const ping of pings) {
    const existing = uniqueSessions.get(ping.session_id);
    if (!existing || ping.created_at > existing.created_at) {
      uniqueSessions.set(ping.session_id, ping);
    }
  }
  const unique = Array.from(uniqueSessions.values());
  const sumLat = unique.reduce((s, p) => s + p.lat, 0);
  const sumLng = unique.reduce((s, p) => s + p.lng, 0);
  return {
    lat: sumLat / unique.length,
    lng: sumLng / unique.length,
  };
}

export function useCrowdPings(busIds: string[], active: boolean) {
  const [pingsByBus, setPingsByBus] = React.useState<Record<string, CrowdPing[]>>({});

  React.useEffect(() => {
    if (!active || busIds.length === 0) {
      setPingsByBus({});
      return;
    }
    if (!isSupabaseConfigured || !supabase) return;
    const client = supabase;

    let cancelled = false;

    const fetchPings = async () => {
      const thirtySecondsAgo = new Date(Date.now() - RECENT_WINDOW_MS).toISOString();
      const { data, error } = await client
        .from('crowd_pings')
        .select('bus_id, lat, lng, created_at, session_id')
        .in('bus_id', busIds)
        .gte('created_at', thirtySecondsAgo)
        .order('created_at', { ascending: false });

      if (cancelled || error || !data) return;

      const grouped: Record<string, CrowdPing[]> = {};
      for (const row of data as CrowdPing[]) {
        const key = row.bus_id ?? '';
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(row);
      }
      setPingsByBus(grouped);
    };

    fetchPings();
    const interval = setInterval(fetchPings, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [busIds, active]);

  return pingsByBus;
}

export interface ScheduleLocation {
  bus_id: string;
  live_lat: number | null;
  live_lng: number | null;
  location_source: 'driver' | 'crowd' | 'waiting' | null;
  last_ping: string | null;
}

const SCHEDULE_POLL_INTERVAL_MS = 15 * 1000;

export function useScheduleLocations(busIds: string[], active: boolean) {
  const [locations, setLocations] = React.useState<Record<string, ScheduleLocation>>({});

  React.useEffect(() => {
    if (!active || busIds.length === 0) {
      setLocations({});
      return;
    }
    if (!isSupabaseConfigured || !supabase) return;
    const client = supabase;

    let cancelled = false;

    const fetchLocations = async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await client
        .from('daily_schedules')
        .select('bus_id, live_lat, live_lng, location_source, last_ping')
        .in('bus_id', busIds)
        .eq('schedule_date', today)
        .not('live_lat', 'is', null);

      if (cancelled || error || !data) return;

      const map: Record<string, ScheduleLocation> = {};
      for (const row of data as ScheduleLocation[]) {
        if (row.bus_id) map[row.bus_id] = row;
      }
      setLocations(map);
    };

    fetchLocations();
    const interval = setInterval(fetchLocations, SCHEDULE_POLL_INTERVAL_MS);

    // Realtime subscription — only active while the Live Map is mounted
    const channel = client
      .channel('schedule-locations-realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'daily_schedules',
        },
        (payload: { new: Record<string, unknown> }) => {
          const row = payload.new as unknown as ScheduleLocation;
          if (
            row.bus_id &&
            busIds.includes(row.bus_id) &&
            row.live_lat !== null &&
            row.live_lng !== null
          ) {
            setLocations((prev) => ({ ...prev, [row.bus_id!]: row }));
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      clearInterval(interval);
      client.removeChannel(channel);
    };
  }, [busIds, active]);

  return locations;
}

export function computeConsensus(
  driverState: { lat: number; lng: number; updated_at?: string } | null,
  crowdPings: CrowdPing[]
): ConsensusResult {
  if (!crowdPings || crowdPings.length === 0) {
    return {
      lat: 0,
      lng: 0,
      contributorCount: 0,
      source: 'driver',
    };
  }

  const now = Date.now();
  const uniqueSessions = new Set(crowdPings.map((p) => p.session_id));

  // Driver ping is fresh → use it, but note contributors for the badge
  const driverFresh =
    driverState?.updated_at &&
    now - new Date(driverState.updated_at).getTime() < STALE_THRESHOLD_MS;

  if (driverFresh) {
    return {
      lat: driverState!.lat,
      lng: driverState!.lng,
      contributorCount: uniqueSessions.size,
      source: 'driver',
    };
  }

  // Driver stale or missing → need 2+ passengers for consensus
  if (uniqueSessions.size >= 2) {
    const centroid = computeCentroid(crowdPings);
    return {
      lat: centroid.lat,
      lng: centroid.lng,
      contributorCount: uniqueSessions.size,
      source: 'crowd',
    };
  }

  // Only 1 passenger → waiting for consensus
  return {
    lat: driverState?.lat ?? 0,
    lng: driverState?.lng ?? 0,
    contributorCount: uniqueSessions.size,
    source: 'waiting',
  };
}
