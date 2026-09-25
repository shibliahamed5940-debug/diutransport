'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Bus as BusIcon,
  MapPin,
  Phone,
  BadgeCheck,
  Navigation,
  Clock,
  CircleDot,
  ArrowRight,
  Play,
  Square,
  Satellite,
  Gauge,
  Crosshair,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PassengerLocationSharing } from '@/components/passenger-location-sharing';
import type { BusWithRelations, ScheduleWithRelations, Staff } from '@/lib/types';

type TripStatus = 'SCHEDULED' | 'LIVE_ON_WAY' | 'REACHED';

export type TripMode = 'idle' | 'live' | 'reached';

interface ActiveBusCardProps {
  bus: BusWithRelations | null;
  schedule: ScheduleWithRelations | null;
  driver: Staff | null;
  helper: Staff | null;
  tripMode?: TripMode;
  onStartTrip?: () => void;
  onEndTrip?: () => void;
  gpsSpeed?: number | null;
  gpsAccuracy?: number | null;
}

function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(hour12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
}

function getTripStatus(schedule: ScheduleWithRelations | null): TripStatus {
  if (!schedule) return 'SCHEDULED';
  if (schedule.status === 'ARRIVED') return 'REACHED';
  if (schedule.status === 'DEPARTED') return 'LIVE_ON_WAY';
  return 'SCHEDULED';
}

const statusConfig: Record<
  TripStatus,
  { label: string; badgeClass: string; dotClass: string }
> = {
  SCHEDULED: {
    label: 'Scheduled',
    badgeClass: 'bg-primary/10 text-primary border-primary/20',
    dotClass: 'bg-primary',
  },
  LIVE_ON_WAY: {
    label: 'Live On Way',
    badgeClass: 'bg-success/10 text-success border-success/30',
    dotClass: 'bg-success',
  },
  REACHED: {
    label: 'Reached',
    badgeClass: 'bg-muted text-muted-foreground border-border',
    dotClass: 'bg-muted-foreground',
  },
};

export function ActiveBusCard({
  bus,
  schedule,
  driver,
  helper,
  tripMode = 'idle',
  onStartTrip,
  onEndTrip,
  gpsSpeed = null,
  gpsAccuracy = null,
}: ActiveBusCardProps) {
  if (!bus) {
    return (
      <Card className="border-dashed border-border">
        <CardContent className="flex flex-col items-center justify-center gap-3 p-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <BusIcon className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">No bus selected</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Complete the selector above to view live bus details
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isTripActive = tripMode === 'live';
  const tripStatus: TripStatus =
    tripMode === 'live' ? 'LIVE_ON_WAY' : tripMode === 'reached' ? 'REACHED' : getTripStatus(schedule);
  const status = statusConfig[tripStatus];
  const routeName = bus.route?.name ?? 'Unassigned';
  const stops = bus.route?.stops ?? [];
  const nextStopIndex = React.useMemo(() => {
    if (tripStatus === 'REACHED') return stops.length - 1;
    if (tripStatus === 'SCHEDULED') return 0;
    return Math.min(1, stops.length - 1);
  }, [tripStatus, stops.length]);

  const nextStop = stops[nextStopIndex] ?? 'N/A';
  const eta = schedule ? formatTime(schedule.arrival_time) : '—';

  return (
    <Card className="overflow-hidden border-border">
      {/* Header strip */}
      <div className="flex flex-col gap-4 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <BusIcon className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-primary px-2.5 py-0.5 text-sm font-bold text-primary-foreground">
                {bus.bus_number}
              </span>
              <span className="text-sm font-semibold text-foreground">
                {routeName}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {bus.route
                ? `${bus.route.start_point} → ${bus.route.end_point}`
                : 'Route unassigned'}
              {' · '}
              Capacity {bus.capacity}
            </p>
          </div>
        </div>

        <div
          className={cn(
            'inline-flex items-center gap-2 self-start rounded-full border px-3 py-1.5 text-xs font-semibold',
            status.badgeClass
          )}
        >
          {tripStatus === 'LIVE_ON_WAY' && (
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-success" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
          )}
          {tripStatus !== 'LIVE_ON_WAY' && (
            <span className={cn('h-2 w-2 rounded-full', status.dotClass)} />
          )}
          {status.label}
        </div>
      </div>

      {/* Body */}
      <div className="grid grid-cols-1 lg:grid-cols-2">
        {/* Stoppage timeline */}
        <div className="border-b border-border p-4 sm:p-5 lg:border-b-0 lg:border-r">
          <div className="mb-3 flex items-center gap-2">
            <Navigation className="h-4 w-4 text-muted-foreground" />
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Stoppage Timeline
            </h4>
          </div>

          {stops.length > 0 ? (
            <div className="relative space-y-0">
              {stops.map((stop, i) => {
                const isPast = i < nextStopIndex;
                const isNext = i === nextStopIndex;
                const isFuture = i > nextStopIndex;
                return (
                  <div key={i} className="flex items-start gap-3 pb-4 last:pb-0">
                    {/* Timeline line + dot */}
                    <div className="relative flex flex-col items-center">
                      <div
                        className={cn(
                          'z-10 flex h-4 w-4 items-center justify-center rounded-full border-2 transition-colors',
                          isPast && 'border-success bg-success',
                          isNext && 'border-primary bg-primary',
                          isFuture && 'border-border bg-card'
                        )}
                      >
                        {isPast && (
                          <svg className="h-2 w-2 text-primary-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
                            <path d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                        {isNext && <CircleDot className="h-2 w-2 text-primary-foreground" />}
                      </div>
                      {i < stops.length - 1 && (
                        <div
                          className={cn(
                            'absolute top-4 h-full w-0.5',
                            isPast ? 'bg-success' : 'bg-border'
                          )}
                        />
                      )}
                    </div>
                    {/* Stop label */}
                    <div className="flex-1 pt-0.5">
                      <p
                        className={cn(
                          'text-sm',
                          isNext && 'font-semibold text-foreground',
                          isPast && 'text-muted-foreground line-through',
                          isFuture && 'text-muted-foreground'
                        )}
                      >
                        {stop}
                      </p>
                      {isNext && (
                        <div className="mt-1 flex items-center gap-1.5">
                          <Clock className="h-3 w-3 text-primary" />
                          <span className="text-xs font-medium text-primary">
                            ETA {eta}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No stops defined</p>
          )}
        </div>

        {/* Right column: staff + action */}
        <div className="flex flex-col p-4 sm:p-5">
          {/* Staff contact strip */}
          <div className="mb-4">
            <div className="mb-3 flex items-center gap-2">
              <BadgeCheck className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Verified Staff
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

          {/* Schedule info */}
          {schedule && (
            <div className="mb-4 flex items-center gap-4 rounded-lg border border-border bg-muted/30 p-3">
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

          {/* GPS Live info */}
          {isTripActive && (
            <div className="mb-4 flex items-center gap-4 rounded-lg border border-success/30 bg-success/5 p-3">
              <div className="flex items-center gap-1.5">
                <Satellite className="h-3.5 w-3.5 text-success" />
                <span className="text-xs text-muted-foreground">GPS</span>
                <span className="text-sm font-semibold text-success">Live</span>
              </div>
              {gpsAccuracy !== null && (
                <div className="flex items-center gap-1.5">
                  <Crosshair className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Accuracy</span>
                  <span className="text-sm font-semibold text-foreground">±{Math.round(gpsAccuracy)}m</span>
                </div>
              )}
              {gpsSpeed !== null && (
                <div className="flex items-center gap-1.5">
                  <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm font-semibold text-foreground">{gpsSpeed} km/h</span>
                </div>
              )}
            </div>
          )}

          {/* Passenger location sharing */}
          <div className="mb-4">
            <PassengerLocationSharing
              busId={bus.id}
              active={tripMode !== 'reached'}
              scheduleId={schedule?.id ?? null}
            />
          </div>

          {/* Trip controls + quick action */}
          <div className="mt-auto space-y-2">
            {onStartTrip && onEndTrip && (
              <div className="flex gap-2">
                {tripMode === 'reached' ? (
                  <Button variant="outline" className="flex-1" disabled>
                    Trip Completed
                  </Button>
                ) : isTripActive ? (
                  <Button variant="destructive" className="flex-1 gap-2" onClick={onEndTrip}>
                    <Square className="h-4 w-4" />
                    End Trip
                  </Button>
                ) : (
                  <Button variant="default" className="flex-1 gap-2" onClick={onStartTrip}>
                    <Play className="h-4 w-4" />
                    Start Trip
                  </Button>
                )}
              </div>
            )}
            <Link href={`/live-map?bus=${bus.id}`}>
              <Button className="w-full gap-2" size="lg" variant="outline">
                <MapPin className="h-4 w-4" />
                View on Live Map
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </Card>
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
            {verified && (
              <BadgeCheck className="h-3.5 w-3.5 text-success" />
            )}
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
