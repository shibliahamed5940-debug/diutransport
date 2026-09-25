'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { MapPin, Navigation, RefreshCw, Bus as BusIcon, Gauge, Crosshair, X, Play, Square, TriangleAlert as AlertTriangle, Satellite, Wifi, WifiOff, Users, Clock3, Locate, Ruler, BellRing } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  getMockBusesWithRelations,
  getMockSchedulesWithRelations,
} from '@/lib/mock-data';
import { getRouteCoords, findNextStopIndex } from '@/lib/map-data';
import { useGpsTracking, type GpsReading } from '@/lib/use-gps-tracking';
import { useCrowdPings, useScheduleLocations, computeConsensus } from '@/lib/use-crowd-pings';
import { useLocationSync } from '@/lib/use-location-sync';
import { haversineDistance, estimateTravelMinutes, formatDistance } from '@/lib/geo-utils';
import type { BusWithRelations, ScheduleWithRelations } from '@/lib/types';
import type { BusLiveState } from '@/components/live-tracking-map';

const LiveTrackingMap = dynamic(
  () =>
    import('@/components/live-tracking-map').then((m) => m.LiveTrackingMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-muted">
        <Skeleton className="h-full w-full" />
      </div>
    ),
  }
);

function interpolateAlongPath(
  path: [number, number][],
  progress: number
): { lat: number; lng: number; heading: number } {
  if (path.length === 0) return { lat: 0, lng: 0, heading: 0 };
  if (path.length === 1) return { lat: path[0][0], lng: path[0][1], heading: 0 };

  const totalSegments = path.length - 1;
  const exact = progress * totalSegments;
  const segIndex = Math.min(Math.floor(exact), totalSegments - 1);
  const segProgress = exact - segIndex;

  const [lat1, lng1] = path[segIndex];
  const [lat2, lng2] = path[segIndex + 1];
  const lat = lat1 + (lat2 - lat1) * segProgress;
  const lng = lng1 + (lng2 - lng1) * segProgress;

  const dLng = lng2 - lng1;
  const dLat = lat2 - lat1;
  const heading = (Math.atan2(dLng, dLat) * 180) / Math.PI;

  return { lat, lng, heading };
}

function computeSimStates(
  buses: BusWithRelations[],
  schedules: ScheduleWithRelations[],
  tick: number
): Record<string, BusLiveState> {
  const states: Record<string, BusLiveState> = {};
  const today = new Date().toISOString().split('T')[0];

  buses
    .filter((b) => b.status === 'ACTIVE')
    .forEach((bus, idx) => {
      const route = bus.route;
      if (!route) return;
      const coords = getRouteCoords(route);
      if (coords.path.length < 2) return;

      const schedule = schedules.find(
        (s) =>
          s.bus_id === bus.id &&
          s.schedule_date === today &&
          s.status !== 'CANCELLED'
      );

      let progress: number;
      if (schedule && schedule.status === 'DEPARTED') {
        const dep = schedule.departure_time.split(':').map(Number);
        const arr = schedule.arrival_time.split(':').map(Number);
        const now = new Date();
        const nowMin = now.getHours() * 60 + now.getMinutes();
        const depMin = dep[0] * 60 + dep[1];
        const arrMin = arr[0] * 60 + arr[1];
        const total = arrMin - depMin || 1;
        progress = Math.min(Math.max((nowMin - depMin) / total, 0), 1);
      } else {
        progress = (tick * 0.0008 + idx * 0.25) % 1;
      }

      const { lat, lng, heading } = interpolateAlongPath(coords.path, progress);
      const nextStopIndex = Math.min(
        Math.floor(progress * coords.stops.length),
        coords.stops.length - 1
      );
      const speed = 25 + Math.round(Math.sin(tick / 1000 + idx) * 15 + 15);

      states[bus.id] = {
        busId: bus.id,
        lat,
        lng,
        heading,
        speed: Math.max(0, speed),
        nextStopIndex,
      };
    });

  return states;
}

function gpsReadingToState(
  busId: string,
  reading: GpsReading,
  path: [number, number][],
  prevIndex: number
): BusLiveState {
  const nextStopIndex = findNextStopIndex(path, reading.lat, reading.lng, prevIndex);
  return {
    busId,
    lat: reading.lat,
    lng: reading.lng,
    heading: reading.heading ?? 0,
    speed: reading.speed ?? 0,
    nextStopIndex,
  };
}

type TripMode = 'idle' | 'live' | 'simulating' | 'reached';

const errorMessages: Record<string, { title: string; message: string }> = {
  denied: {
    title: 'Location permission denied',
    message: 'Enable location access in your browser settings to use live GPS tracking.',
  },
  unavailable: {
    title: 'GPS unavailable',
    message: 'Your device does not support GPS or the signal is unavailable.',
  },
  timeout: {
    title: 'GPS timeout',
    message: 'Could not get your location in time. Try moving to an open area.',
  },
};

export default function LiveMapPage() {
  const [buses] = React.useState<BusWithRelations[]>(getMockBusesWithRelations());
  const [schedules] = React.useState<ScheduleWithRelations[]>(
    getMockSchedulesWithRelations()
  );
  const [selectedBusId, setSelectedBusId] = React.useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [tick, setTick] = React.useState(0);
  const [mounted, setMounted] = React.useState(false);
  const [tripMode, setTripMode] = React.useState<TripMode>('idle');
  const [simulating, setSimulating] = React.useState(false);
  const [errorVisible, setErrorVisible] = React.useState(true);
  const [userLocation, setUserLocation] = React.useState<{ lat: number; lng: number } | null>(null);
  const [sortByProximity, setSortByProximity] = React.useState(false);

  const gps = useGpsTracking(tripMode === 'live');

  // Auto-select first active bus
  React.useEffect(() => {
    setMounted(true);
    const firstActive = buses.find((b) => b.status === 'ACTIVE');
    if (firstActive) {
      setSelectedBusId(firstActive.id);
    }
  }, [buses]);

  // Acquire user location once for proximity calculations
  React.useEffect(() => {
    if (!('geolocation' in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  // Simulation tick
  React.useEffect(() => {
    if (!simulating) return;
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 1500);
    return () => clearInterval(interval);
  }, [simulating]);

  const activeBusIds = React.useMemo(
    () => buses.filter((b) => b.status === 'ACTIVE').map((b) => b.id),
    [buses]
  );
  const crowdPingsByBus = useCrowdPings(activeBusIds, mounted);
  const scheduleLocations = useScheduleLocations(activeBusIds, mounted);

  // Driver location sync — writes GPS position to daily_schedules as the
  // centralized single source of truth when a live trip is active
  const today = new Date().toISOString().split('T')[0];
  const selectedSchedule = React.useMemo(
    () =>
      schedules.find(
        (s) =>
          s.bus_id === selectedBusId &&
          s.schedule_date === today &&
          s.status !== 'CANCELLED'
      ) ?? null,
    [schedules, selectedBusId, today]
  );

  const driverLocationSync = useLocationSync({
    scheduleId: selectedSchedule?.id ?? null,
    busId: selectedBusId,
    source: 'driver',
    enabled: tripMode === 'live',
  });

  // Report GPS reading to daily_schedules whenever it changes during a live trip
  React.useEffect(() => {
    if (tripMode === 'live' && gps.reading && selectedSchedule) {
      void driverLocationSync.report(gps.reading.lat, gps.reading.lng);
    }
  }, [gps.reading, tripMode, selectedSchedule, driverLocationSync]);

  // Always compute base sim states (for non-selected buses display)
  const simStates = React.useMemo(
    () => computeSimStates(buses, schedules, tick),
    [buses, schedules, tick]
  );

  const selectedBus = buses.find((b) => b.id === selectedBusId) ?? null;
  const selectedRoute = selectedBus?.route ?? null;
  const routeCoords = selectedRoute ? getRouteCoords(selectedRoute) : null;

  // Build merged live states with consensus fallback
  const liveStates = React.useMemo(() => {
    const merged: Record<string, BusLiveState> = { ...simStates };

    if (tripMode === 'live' && gps.reading && selectedBusId && routeCoords) {
      const prevIdx = merged[selectedBusId]?.nextStopIndex ?? 0;
      merged[selectedBusId] = gpsReadingToState(
        selectedBusId,
        gps.reading,
        routeCoords.path,
        prevIdx
      );
    }

    // Apply consensus fallback for all active buses
    for (const bus of buses) {
      if (bus.status !== 'ACTIVE') continue;
      const baseState = merged[bus.id];
      if (!baseState) continue;

      // Use centralized daily_schedules location as the single source of truth
      const schedLoc = scheduleLocations[bus.id];
      if (schedLoc && schedLoc.live_lat !== null && schedLoc.live_lng !== null) {
        merged[bus.id] = {
          ...baseState,
          lat: schedLoc.live_lat,
          lng: schedLoc.live_lng,
          crowdSource: schedLoc.location_source ?? 'driver',
          contributorCount: baseState.contributorCount,
        };
        continue;
      }

      const crowdPings = crowdPingsByBus[bus.id] ?? [];
      const consensus = computeConsensus(
        { lat: baseState.lat, lng: baseState.lng, updated_at: bus.updated_at },
        crowdPings
      );

      if (consensus.source === 'crowd') {
        merged[bus.id] = {
          ...baseState,
          lat: consensus.lat,
          lng: consensus.lng,
          crowdSource: 'crowd',
          contributorCount: consensus.contributorCount,
        };
      } else if (consensus.source === 'waiting') {
        merged[bus.id] = {
          ...baseState,
          crowdSource: 'waiting',
          contributorCount: consensus.contributorCount,
        };
      } else {
        merged[bus.id] = {
          ...baseState,
          crowdSource: 'driver',
          contributorCount: consensus.contributorCount,
        };
      }
    }

    return merged;
  }, [simStates, tripMode, gps.reading, selectedBusId, routeCoords, buses, crowdPingsByBus, scheduleLocations]);

  const selectedLive = selectedBusId ? liveStates[selectedBusId] : null;
  const nextStop =
    routeCoords && selectedLive
      ? routeCoords.stops[selectedLive.nextStopIndex]
      : null;

  const activeBuses = buses.filter((b) => b.status === 'ACTIVE');

  // Compute proximity distances for each active bus
  const busDistances = React.useMemo(() => {
    if (!userLocation) return {};
    const distances: Record<string, { km: number; minutes: number }> = {};
    for (const bus of activeBuses) {
      const live = liveStates[bus.id];
      if (live) {
        const km = haversineDistance(
          userLocation.lat,
          userLocation.lng,
          live.lat,
          live.lng
        );
        distances[bus.id] = { km, minutes: estimateTravelMinutes(km) };
      }
    }
    return distances;
  }, [userLocation, activeBuses, liveStates]);

  // Buses sorted by proximity when the filter is active
  const sortedActiveBuses = React.useMemo(() => {
    if (!sortByProximity || !userLocation) return activeBuses;
    return [...activeBuses].sort((a, b) => {
      const da = busDistances[a.id]?.km ?? Infinity;
      const db = busDistances[b.id]?.km ?? Infinity;
      return da - db;
    });
  }, [activeBuses, sortByProximity, userLocation, busDistances]);

  // Show error banner when GPS error occurs
  React.useEffect(() => {
    if (gps.error) {
      setErrorVisible(true);
      if (tripMode === 'live') {
        setTripMode('idle');
      }
    }
  }, [gps.error, tripMode]);

  const handleSelectBus = React.useCallback((busId: string) => {
    setSelectedBusId(busId);
    setSheetOpen(true);
  }, []);

  const handleStartTrip = React.useCallback(() => {
    setErrorVisible(false);
    setSimulating(false);
    setTripMode('live');
    gps.start();
  }, [gps]);

  const handleEndTrip = React.useCallback(() => {
    gps.stop();
    setTripMode('reached');
    setSimulating(false);
  }, [gps]);

  const handleToggleSimulation = React.useCallback(() => {
    if (simulating) {
      setSimulating(false);
      if (tripMode === 'simulating') setTripMode('idle');
    } else {
      gps.stop();
      setErrorVisible(false);
      setSimulating(true);
      setTripMode('simulating');
    }
  }, [simulating, tripMode, gps]);

  const isTripActive = tripMode === 'live' || tripMode === 'simulating';
  const followSelected = isTripActive && !!selectedBusId;

  const nearestBus = React.useMemo(() => {
    if (!userLocation || !sortByProximity) return null;
    const sorted = [...activeBuses].sort((a, b) => {
      const da = busDistances[a.id]?.km ?? Infinity;
      const db = busDistances[b.id]?.km ?? Infinity;
      return da - db;
    });
    const nearest = sorted[0];
    if (!nearest) return null;
    const dist = busDistances[nearest.id];
    if (!dist) return null;
    return { bus: nearest, ...dist };
  }, [userLocation, sortByProximity, activeBuses, busDistances]);

  const proximityAlert = nearestBus && nearestBus.km <= 2;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Live Map
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Real-time tracking of all campus buses
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => setTick((t) => t + 1)}
        >
          <RefreshCw className="h-4 w-4" />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </div>

      {/* Proximity alert banner */}
      {proximityAlert && nearestBus && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-success/30 bg-success/5 p-4 animate-fade-in">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
            <BellRing className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">
              {nearestBus.bus.bus_number} is approaching your stop
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatDistance(nearestBus.km)} away · approx {nearestBus.minutes} min
            </p>
          </div>
        </div>
      )}

      {/* GPS Error banner */}
      {gps.error && errorVisible && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 animate-fade-in">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">
              {errorMessages[gps.error]?.title ?? 'GPS Error'}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {errorMessages[gps.error]?.message ?? 'An error occurred while tracking your location.'}
            </p>
          </div>
          <button
            onClick={() => setErrorVisible(false)}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Map */}
      <Card className="mb-6 overflow-hidden border-border">
        <div className="relative h-[400px] sm:h-[500px]">
          {mounted ? (
            <LiveTrackingMap
              buses={buses}
              schedules={schedules}
              selectedBusId={selectedBusId}
              onSelectBus={handleSelectBus}
              liveStates={liveStates}
              followSelected={followSelected}
            />
          ) : (
            <Skeleton className="h-full w-full" />
          )}

          {/* Map overlay legend */}
          <div className="pointer-events-none absolute left-3 top-3 z-[500] flex flex-col gap-1.5">
            {selectedRoute && (
              <div className="pointer-events-auto flex items-center gap-2 rounded-lg border border-border bg-card/90 px-3 py-1.5 shadow-sm backdrop-blur-sm">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: routeCoords?.color }}
                />
                <span className="text-xs font-medium text-foreground">
                  {selectedRoute.name}
                </span>
              </div>
            )}
          </div>

          {/* Live badge */}
          <div className="pointer-events-none absolute right-3 top-3 z-[500] flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-card/90 px-3 py-1.5 shadow-sm backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-success" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              <span className="text-xs font-medium text-foreground">
                {tripMode === 'live' ? 'GPS Live' : tripMode === 'simulating' ? 'Simulating' : 'Live'}
              </span>
            </div>
            {selectedLive && selectedLive.crowdSource === 'crowd' && (
              <div className="flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 shadow-sm backdrop-blur-sm animate-fade-in">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-amber-500" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                </span>
                <Users className="h-3 w-3 text-amber-600" />
                <span className="text-xs font-medium text-amber-700">
                  Crowdsourced · {selectedLive.contributorCount} sharing
                </span>
              </div>
            )}
            {selectedLive && selectedLive.crowdSource === 'waiting' && (
              <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card/90 px-3 py-1.5 shadow-sm backdrop-blur-sm animate-fade-in">
                <Clock3 className="h-3 w-3 text-muted-foreground animate-pulse" />
                <span className="text-xs font-medium text-muted-foreground">
                  Waiting for consensus…
                </span>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Trip controls */}
      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Start/End Trip */}
        <Card className={cn(
          'border transition-all',
          isTripActive ? 'border-success/30 bg-success/5' : 'border-border',
          tripMode === 'reached' && 'border-muted bg-muted/30'
        )}>
          <CardContent className="flex items-center gap-4 p-4">
            <div className={cn(
              'flex h-10 w-10 items-center justify-center rounded-lg',
              isTripActive ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'
            )}>
              {tripMode === 'live' ? <Satellite className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">
                {tripMode === 'live' ? 'Live GPS Trip Active' : tripMode === 'reached' ? 'Trip Ended' : 'Start Live Trip'}
              </p>
              <p className="text-xs text-muted-foreground">
                {tripMode === 'live'
                  ? 'Tracking your real-time location'
                  : tripMode === 'reached'
                  ? 'Bus has reached its destination'
                  : 'Use your phone GPS to track the bus'}
              </p>
            </div>
            {tripMode === 'reached' ? (
              <Button variant="outline" size="sm" onClick={() => setTripMode('idle')}>
                Reset
              </Button>
            ) : isTripActive ? (
              <Button variant="destructive" size="sm" onClick={handleEndTrip} className="gap-1.5">
                <Square className="h-3.5 w-3.5" />
                End Trip
              </Button>
            ) : (
              <Button size="sm" onClick={handleStartTrip} className="gap-1.5">
                <Play className="h-3.5 w-3.5" />
                Start Trip
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Simulation toggle */}
        <Card className={cn(
          'border transition-all',
          simulating ? 'border-primary/30 bg-primary/5' : 'border-border'
        )}>
          <CardContent className="flex items-center gap-4 p-4">
            <div className={cn(
              'flex h-10 w-10 items-center justify-center rounded-lg',
              simulating ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
            )}>
              {simulating ? <Wifi className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">
                {simulating ? 'Simulation Running' : 'Simulate Route Movement'}
              </p>
              <p className="text-xs text-muted-foreground">
                {simulating ? 'Bus moving along route path' : 'Test bus movement on desktop'}
              </p>
            </div>
            <Button
              variant={simulating ? 'default' : 'outline'}
              size="sm"
              onClick={handleToggleSimulation}
              className="gap-1.5"
            >
              {simulating ? (
                <>
                  <Square className="h-3.5 w-3.5" />
                  Stop
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" />
                  Simulate
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Proximity filter + Bus list - desktop */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">
          Active Buses
          {userLocation && sortByProximity && sortedActiveBuses[0] && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              Nearest: {sortedActiveBuses[0].bus_number}
              {busDistances[sortedActiveBuses[0].id] &&
                ` · ${formatDistance(busDistances[sortedActiveBuses[0].id].km)} away`}
            </span>
          )}
        </h2>
        <Button
          variant={sortByProximity ? 'default' : 'outline'}
          size="sm"
          className="gap-1.5"
          onClick={() => setSortByProximity((v) => !v)}
          disabled={!userLocation}
        >
          <Ruler className="h-3.5 w-3.5" />
          {userLocation ? 'Nearest Bus' : 'No GPS'}
        </Button>
      </div>
      <div className="hidden grid-cols-1 gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-4">
        {sortedActiveBuses.map((bus, i) => {
          const live = liveStates[bus.id];
          const isSelected = bus.id === selectedBusId;
          const routeColor = bus.route ? getRouteCoords(bus.route).color : '#0B2545';
          const dist = busDistances[bus.id];
          return (
            <Card
              key={bus.id}
              className={cn(
                'cursor-pointer border transition-all duration-300 hover:shadow-md',
                isSelected ? 'border-primary ring-1 ring-primary/30' : 'border-border'
              )}
              style={{ animation: `slide-up 0.4s ease-out ${i * 80}ms both` }}
              onClick={() => handleSelectBus(bus.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white"
                      style={{ backgroundColor: routeColor }}
                    >
                      <BusIcon className="h-4 w-4" />
                    </span>
                    <CardTitle className="text-base">{bus.bus_number}</CardTitle>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {live && live.crowdSource === 'crowd' && (
                      <Badge variant="outline" className="gap-1 border-amber-500/40 text-amber-600">
                        <Users className="h-3 w-3" />
                        {live.contributorCount}
                      </Badge>
                    )}
                    <Badge variant={live ? 'default' : 'secondary'}>
                      {live ? 'Active' : 'Idle'}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  <span className="truncate">{bus.route?.name ?? 'Unassigned'}</span>
                </div>
                {live && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Gauge className="h-3 w-3" />
                      {live.speed} km/h
                    </span>
                    <span className="font-medium text-foreground">
                      {routeCoords?.stops[live.nextStopIndex]?.name ?? '—'}
                    </span>
                  </div>
                )}
                {dist && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Navigation className="h-3 w-3" />
                    {formatDistance(dist.km)} · ~{dist.minutes} min away
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Mobile bus list (horizontal scroll) */}
      <div className="mb-2 flex gap-3 overflow-x-auto pb-2 scrollbar-hide lg:hidden">
        {activeBuses.map((bus) => {
          const live = liveStates[bus.id];
          const isSelected = bus.id === selectedBusId;
          const routeColor = bus.route ? getRouteCoords(bus.route).color : '#0B2545';
          return (
            <button
              key={bus.id}
              onClick={() => handleSelectBus(bus.id)}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-lg border bg-card px-3 py-2 transition-all',
                isSelected ? 'border-primary ring-1 ring-primary/30' : 'border-border'
              )}
            >
              <span
                className="flex h-7 w-7 items-center justify-center rounded-md text-white"
                style={{ backgroundColor: routeColor }}
              >
                <BusIcon className="h-3.5 w-3.5" />
              </span>
              <div className="text-left">
                <div className="text-xs font-semibold text-foreground">{bus.bus_number}</div>
                <div className="text-[10px] text-muted-foreground">
                  {live ? `${live.speed} km/h` : 'Idle'}
                  {busDistances[bus.id] && ` · ${formatDistance(busDistances[bus.id].km)}`}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Mobile bottom sheet */}
      {selectedBus && selectedLive && (
        <div
          className={cn(
            'fixed inset-x-0 bottom-0 z-[1000] transition-transform duration-300 ease-out lg:hidden',
            sheetOpen ? 'translate-y-0' : 'translate-y-[calc(100%-3.5rem)]'
          )}
        >
          <div className="rounded-t-2xl border-t border-border bg-card shadow-2xl">
            {/* Grab handle / collapsed bar */}
            <button
              className="flex w-full items-center justify-between px-4 py-2.5"
              onClick={() => setSheetOpen((v) => !v)}
            >
              <div className="flex items-center gap-2">
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-md text-white"
                  style={{
                    backgroundColor: routeCoords?.color ?? '#0B2545',
                  }}
                >
                  <BusIcon className="h-3.5 w-3.5" />
                </span>
                <span className="text-sm font-bold text-foreground">
                  {selectedBus.bus_number}
                </span>
                <Badge variant="default" className="text-[10px]">
                  {selectedRoute?.name ?? '—'}
                </Badge>
              </div>
              {sheetOpen ? (
                <X className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Navigation className="h-4 w-4 text-muted-foreground" />
              )}
            </button>

            {/* Sheet content */}
            <div className="px-4 pb-6 pt-1">
              {/* Drag indicator */}
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted" />

              {/* Trip controls inside sheet */}
              <div className="mb-3 flex gap-2">
                {tripMode === 'reached' ? (
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setTripMode('idle')}>
                    Reset Trip
                  </Button>
                ) : isTripActive ? (
                  <Button variant="destructive" size="sm" className="flex-1 gap-1.5" onClick={handleEndTrip}>
                    <Square className="h-3.5 w-3.5" />
                    End Trip
                  </Button>
                ) : (
                  <Button size="sm" className="flex-1 gap-1.5" onClick={handleStartTrip}>
                    <Play className="h-3.5 w-3.5" />
                    Start Trip
                  </Button>
                )}
                <Button
                  variant={simulating ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1 gap-1.5"
                  onClick={handleToggleSimulation}
                >
                  {simulating ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  {simulating ? 'Stop Sim' : 'Simulate'}
                </Button>
              </div>

              {/* Coordinates + speed */}
              <div className="mb-3 grid grid-cols-3 gap-2">
                <div className="rounded-lg border border-border bg-muted/30 p-2.5">
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Crosshair className="h-3 w-3" />
                    Latitude
                  </div>
                  <p className="mt-0.5 text-sm font-semibold text-foreground tabular-nums">
                    {selectedLive.lat.toFixed(4)}°
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-2.5">
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Crosshair className="h-3 w-3" />
                    Longitude
                  </div>
                  <p className="mt-0.5 text-sm font-semibold text-foreground tabular-nums">
                    {selectedLive.lng.toFixed(4)}°
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-2.5">
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Gauge className="h-3 w-3" />
                    Speed
                  </div>
                  <p className="mt-0.5 text-sm font-semibold text-foreground tabular-nums">
                    {selectedLive.speed} km/h
                  </p>
                </div>
              </div>

              {/* Next stop */}
              {nextStop && (
                <div className="mb-3 flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Next Stop
                    </p>
                    <p className="text-sm font-semibold text-foreground">
                      {nextStop.name}
                    </p>
                  </div>
                </div>
              )}

              {/* Route stops mini-timeline */}
              {routeCoords && routeCoords.stops.length > 0 && (
                <div className="max-h-32 overflow-y-auto">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Route Stops
                  </p>
                  <div className="space-y-1.5">
                    {routeCoords.stops.map((stop, i) => {
                      const isPassed = i < selectedLive.nextStopIndex;
                      const isNext = i === selectedLive.nextStopIndex;
                      return (
                        <div key={i} className="flex items-center gap-2">
                          <span
                            className={cn(
                              'h-2 w-2 shrink-0 rounded-full',
                              isPassed && 'bg-success',
                              isNext && 'bg-primary ring-2 ring-primary/30',
                              !isPassed && !isNext && 'bg-border'
                            )}
                          />
                          <span
                            className={cn(
                              'text-xs',
                              isPassed && 'text-muted-foreground line-through',
                              isNext && 'font-semibold text-foreground',
                              !isPassed && !isNext && 'text-muted-foreground'
                            )}
                          >
                            {stop.name}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
