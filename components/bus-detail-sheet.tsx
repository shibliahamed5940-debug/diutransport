'use client';

import * as React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Bus as BusIcon,
  MapPin,
  Phone,
  BadgeCheck,
  Navigation,
  Crosshair,
  Clock,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getRouteCoords, findNextStopIndex } from '@/lib/map-data';
import type { BusWithRelations, Staff, ScheduleWithRelations } from '@/lib/types';

export interface BusDetailSheetProps {
  bus: BusWithRelations | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  driver?: Staff | null;
  helper?: Staff | null;
  schedule?: ScheduleWithRelations | null;
}

function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(hour12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
}

export function BusDetailSheet({
  bus,
  open,
  onOpenChange,
  driver,
  helper,
  schedule,
}: BusDetailSheetProps) {
  if (!bus) return null;

  const route = bus.route ?? null;
  const routeCoords = route ? getRouteCoords(route) : null;
  const stops = route?.stops ?? [];

  const lat = bus.current_lat;
  const lng = bus.current_lng;

  let nextStopName: string | null = null;
  if (routeCoords && lat !== null && lng !== null) {
    const idx = findNextStopIndex(routeCoords.path, lat, lng, 0);
    nextStopName = routeCoords.stops[idx]?.name ?? null;
  } else if (stops.length > 0) {
    nextStopName = stops[0] ?? null;
  }

  const isActive = bus.status === 'ACTIVE';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
        <SheetHeader className="pb-2">
          <SheetTitle className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <BusIcon className="h-4 w-4" />
            </span>
            {bus.bus_number}
          </SheetTitle>
          <SheetDescription>
            {route
              ? `${route.name} — ${route.start_point} → ${route.end_point}`
              : 'Route unassigned'}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-6">
          {/* Status */}
          <div className="flex items-center gap-2">
            <Badge variant={isActive ? 'default' : 'secondary'}>
              {isActive
                ? 'Active'
                : bus.status === 'MAINTENANCE'
                  ? 'Maintenance'
                  : 'Offline'}
            </Badge>
            <span className="text-xs text-muted-foreground">
              Capacity: {bus.capacity} seats
            </span>
          </div>

          {/* Live coordinates */}
          {lat !== null && lng !== null && (
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <div className="mb-2 flex items-center gap-2">
                <Crosshair className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Live Coordinates
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] text-muted-foreground">Latitude</p>
                  <p className="text-sm font-semibold text-foreground tabular-nums">
                    {lat.toFixed(4)}°
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Longitude</p>
                  <p className="text-sm font-semibold text-foreground tabular-nums">
                    {lng.toFixed(4)}°
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Nearest stoppage */}
          {nextStopName && (
            <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <MapPin className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Nearest Stoppage
                </p>
                <p className="text-sm font-semibold text-foreground">
                  {nextStopName}
                </p>
              </div>
            </div>
          )}

          {/* Schedule info */}
          {schedule && (
            <div className="flex items-center gap-4 rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Departs</span>
                <span className="text-sm font-semibold text-foreground">
                  {formatTime(schedule.departure_time)}
                </span>
              </div>
              <div className="h-3 w-px bg-border" />
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Arrives</span>
                <span className="text-sm font-semibold text-foreground">
                  {formatTime(schedule.arrival_time)}
                </span>
              </div>
            </div>
          )}

          {/* Staff contacts */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <BadgeCheck className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Staff On Board
              </h4>
            </div>
            <div className="space-y-2">
              <StaffContactRow
                name={driver?.full_name ?? 'Unassigned'}
                role="Driver"
                phone={driver?.phone}
                verified={driver?.is_verified}
              />
              <StaffContactRow
                name={helper?.full_name ?? 'Unassigned'}
                role="Helper"
                phone={helper?.phone}
                verified={helper?.is_verified}
              />
            </div>
          </div>

          {/* Route stops timeline */}
          {stops.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Navigation className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Route Stops
                </h4>
              </div>
              <div className="max-h-40 space-y-1.5 overflow-y-auto">
                {stops.map((stop, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-border" />
                    <span className="text-xs text-muted-foreground">{stop}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function StaffContactRow({
  name,
  role,
  phone,
  verified,
}: {
  name: string;
  role: string;
  phone?: string | null;
  verified?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2.5 transition-colors hover:border-primary/30">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
          {name.charAt(0)}
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium text-foreground">{name}</span>
            {verified && <BadgeCheck className="h-3.5 w-3.5 text-success" />}
          </div>
          <span className="text-xs text-muted-foreground">{role}</span>
        </div>
      </div>
      {phone && (
        <a
          href={`tel:${phone}`}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          aria-label={`Call ${name}`}
        >
          <Phone className="h-3.5 w-3.5" />
        </a>
      )}
    </div>
  );
}
