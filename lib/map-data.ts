import type { Route } from '@/lib/types';

export interface StopCoord {
  name: string;
  lat: number;
  lng: number;
}

export interface RouteCoords {
  routeId: string;
  color: string;
  stops: StopCoord[];
  path: [number, number][];
}

const ROUTE_COLORS: Record<string, string> = {
  'route-mirpur': '#0B2545',
  'route-uttara': '#1D9E75',
  'route-dhanmondi': '#D97706',
  'route-motijheel': '#DC2626',
};

const STOP_COORDS: Record<string, StopCoord> = {
  'DIU Main Campus': { name: 'DIU Main Campus', lat: 23.8806, lng: 90.3256 },
  'Ashulia Thana': { name: 'Ashulia Thana', lat: 23.8993, lng: 90.3998 },
  Nabinagar: { name: 'Nabinagar', lat: 23.9185, lng: 90.4092 },
  Baipail: { name: 'Baipail', lat: 23.9352, lng: 90.4156 },
  'Zirani Bazar': { name: 'Zirani Bazar', lat: 23.9512, lng: 90.4221 },
  'Mirpur 14': { name: 'Mirpur 14', lat: 23.8068, lng: 90.3683 },
  'Mirpur 10': { name: 'Mirpur 10', lat: 23.8061, lng: 90.3687 },
  'Board Bazar': { name: 'Board Bazar', lat: 23.9432, lng: 90.4189 },
  'Airport Junction': { name: 'Airport Junction', lat: 23.8333, lng: 90.4000 },
  'Uttara Sector 4': { name: 'Uttara Sector 4', lat: 23.8728, lng: 90.3984 },
  'Uttara Sector 7': { name: 'Uttara Sector 7', lat: 23.8706, lng: 90.4038 },
  'Savar Bazar': { name: 'Savar Bazar', lat: 23.8617, lng: 90.3644 },
  Gabtoli: { name: 'Gabtoli', lat: 23.7889, lng: 90.3461 },
  Rampura: { name: 'Rampura', lat: 23.7606, lng: 90.4122 },
  'Dhanmondi 15': { name: 'Dhanmondi 15', lat: 23.7461, lng: 90.3742 },
  'Dhanmondi 27': { name: 'Dhanmondi 27', lat: 23.7333, lng: 90.3856 },
  Mohammadpur: { name: 'Mohammadpur', lat: 23.7333, lng: 90.3667 },
  Shahbagh: { name: 'Shahbagh', lat: 23.7333, lng: 90.3922 },
  'Press Club': { name: 'Press Club', lat: 23.7250, lng: 90.4028 },
  'Motijheel Square': { name: 'Motijheel Square', lat: 23.7222, lng: 90.4117 },
};

export function getRouteCoords(route: Route): RouteCoords {
  const stops: StopCoord[] = (route.stops || [])
    .map((name) => STOP_COORDS[name])
    .filter(Boolean);
  const path: [number, number][] = stops.map((s) => [s.lat, s.lng]);
  return {
    routeId: route.id,
    color: ROUTE_COLORS[route.id] ?? '#0B2545',
    stops,
    path,
  };
}

export function getRouteColor(routeId: string): string {
  return ROUTE_COLORS[routeId] ?? '#0B2545';
}

export const DIU_CENTER: [number, number] = [23.8806, 90.3256];

export function getStopCoord(name: string): StopCoord | undefined {
  return STOP_COORDS[name];
}

export function findNextStopIndex(
  path: [number, number][],
  lat: number,
  lng: number,
  currentIndex: number = 0
): number {
  if (path.length === 0) return 0;
  let minDist = Infinity;
  let nearest = currentIndex;
  for (let i = currentIndex; i < path.length; i++) {
    const [sLat, sLng] = path[i];
    const d = Math.hypot(sLat - lat, sLng - lng);
    if (d < minDist) {
      minDist = d;
      nearest = i;
    }
  }
  return nearest;
}
