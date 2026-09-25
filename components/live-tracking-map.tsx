'use client';

import * as React from 'react';
import L from 'leaflet';
import { getRouteCoords, DIU_CENTER, findNextStopIndex } from '@/lib/map-data';
import type { BusWithRelations, ScheduleWithRelations } from '@/lib/types';

export interface BusLiveState {
  busId: string;
  lat: number;
  lng: number;
  heading: number;
  speed: number;
  nextStopIndex: number;
  crowdSource?: 'driver' | 'crowd' | 'waiting';
  contributorCount?: number;
}

interface LiveTrackingMapProps {
  buses: BusWithRelations[];
  schedules: ScheduleWithRelations[];
  selectedBusId: string | null;
  onSelectBus: (busId: string) => void;
  liveStates: Record<string, BusLiveState>;
  followSelected?: boolean;
}

function createBusIcon(heading: number, color: string): L.DivIcon {
  const html = `
    <div class="bus-marker" style="--bus-color:${color}">
      <div class="bus-marker-inner">
        <svg class="bus-marker-svg" width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" style="transform: rotate(${heading}deg)">
          <circle cx="14" cy="14" r="13" fill="${color}" stroke="white" stroke-width="2.5"/>
          <path d="M14 5 L19 16 L14 13 L9 16 Z" fill="white"/>
        </svg>
      </div>
      <div class="bus-marker-pulse" style="background:${color}"></div>
    </div>`;
  return L.divIcon({
    html,
    className: 'bus-marker-wrapper',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function createStopIcon(name: string, isPassed: boolean): L.DivIcon {
  const bg = isPassed ? '#1D9E75' : '#0B2545';
  return L.divIcon({
    html: `<div class="stop-marker" style="background:${bg}"><span></span></div><div class="stop-label">${name}</div>`,
    className: 'stop-marker-wrapper',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

export function LiveTrackingMap({
  buses,
  schedules,
  selectedBusId,
  onSelectBus,
  liveStates,
  followSelected = false,
}: LiveTrackingMapProps) {
  const mapRef = React.useRef<L.Map | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const markersRef = React.useRef<Record<string, L.Marker>>({});
  const polylineRef = React.useRef<L.Polyline | null>(null);
  const stopMarkersRef = React.useRef<L.Marker[]>([]);
  const headingRef = React.useRef<Record<string, number>>({});

  const selectedBus = buses.find((b) => b.id === selectedBusId) ?? null;
  const route = selectedBus?.route ?? null;
  const routeCoords = route ? getRouteCoords(route) : null;

  // Init map once
  React.useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: DIU_CENTER,
      zoom: 13,
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    setTimeout(() => map.invalidateSize(), 100);

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = {};
      polylineRef.current = null;
      stopMarkersRef.current = [];
      headingRef.current = {};
    };
  }, []);

  // Draw route polyline + stop pins when route changes
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (polylineRef.current) {
      map.removeLayer(polylineRef.current);
      polylineRef.current = null;
    }
    stopMarkersRef.current.forEach((m) => map.removeLayer(m));
    stopMarkersRef.current = [];

    if (!routeCoords || routeCoords.path.length < 2) return;

    polylineRef.current = L.polyline(routeCoords.path, {
      color: routeCoords.color,
      weight: 4,
      opacity: 0.7,
      dashArray: '8 6',
    }).addTo(map);

    const liveState = selectedBusId ? liveStates[selectedBusId] : null;
    const nextIdx = liveState?.nextStopIndex ?? 0;

    routeCoords.stops.forEach((stop, i) => {
      const isPassed = i < nextIdx;
      const marker = L.marker([stop.lat, stop.lng], {
        icon: createStopIcon(stop.name, isPassed),
      }).addTo(map);
      stopMarkersRef.current.push(marker);
    });

    const bounds = L.latLngBounds(routeCoords.path);
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [routeCoords, selectedBusId, liveStates]);

  // Update / create bus markers
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const activeBuses = buses.filter(
      (b) => b.status === 'ACTIVE' && liveStates[b.id]
    );

    // Remove stale markers
    Object.keys(markersRef.current).forEach((id) => {
      if (!activeBuses.find((b) => b.id === id)) {
        map.removeLayer(markersRef.current[id]);
        delete markersRef.current[id];
        delete headingRef.current[id];
      }
    });

    activeBuses.forEach((bus) => {
      const state = liveStates[bus.id];
      if (!state) return;
      const color = route?.id === bus.route_id
        ? routeCoords?.color ?? '#0B2545'
        : '#0B2545';

      // Smooth heading interpolation (shortest angular path)
      const prevHeading = headingRef.current[bus.id] ?? state.heading;
      let diff = ((state.heading - prevHeading + 540) % 360) - 180;
      const smoothHeading = prevHeading + diff;
      headingRef.current[bus.id] = smoothHeading;

      const existing = markersRef.current[bus.id];
      if (existing) {
        existing.setLatLng([state.lat, state.lng]);
        existing.setIcon(createBusIcon(smoothHeading, color));
      } else {
        const marker = L.marker([state.lat, state.lng], {
          icon: createBusIcon(smoothHeading, color),
        }).addTo(map);
        marker.on('click', () => onSelectBus(bus.id));
        markersRef.current[bus.id] = marker;
      }
    });
  }, [buses, liveStates, route, routeCoords, onSelectBus]);

  // Follow selected bus
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !followSelected || !selectedBusId) return;
    const state = liveStates[selectedBusId];
    if (!state) return;
    map.panTo([state.lat, state.lng], { animate: true, duration: 0.6 });
  }, [followSelected, selectedBusId, liveStates]);

  return <div ref={containerRef} className="h-full w-full" />;
}
