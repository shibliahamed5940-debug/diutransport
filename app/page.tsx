'use client';

import * as React from 'react';
import Link from 'next/link';
import { MapPin, Bell, Siren, Shield, ArrowRight, Bus, PackageSearch } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TransitSelector, type SelectorSelection } from '@/components/transit-selector';
import { ActiveBusCard } from '@/components/active-bus-card';
import {
  mockRoutes,
  mockBuses,
  mockStaff,
  mockSchedules,
  getMockBusesWithRelations,
  getMockSchedulesWithRelations,
} from '@/lib/mock-data';
import type { Route, BusWithRelations, ScheduleWithRelations, Staff } from '@/lib/types';

const features = [
  {
    href: '/live-map',
    icon: MapPin,
    title: 'Live Map',
    description: 'Track buses in real-time across all campus routes',
    badge: 'Active',
    badgeVariant: 'default' as const,
    accent: 'text-success',
    bg: 'bg-success/10',
    border: 'border-success/20',
  },
  {
    href: '/notices',
    icon: Bell,
    title: 'Notices',
    description: 'Stay updated with latest transit announcements',
    badge: '3 New',
    badgeVariant: 'secondary' as const,
    accent: 'text-primary',
    bg: 'bg-primary/10',
    border: 'border-primary/20',
  },
  {
    href: '/lost-and-found',
    icon: PackageSearch,
    title: 'Lost & Found',
    description: 'Report lost items or find belongings left on buses',
    badge: 'New',
    badgeVariant: 'secondary' as const,
    accent: 'text-amber-600',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
  },
  {
    href: '/sos',
    icon: Siren,
    title: 'SOS',
    description: 'Emergency assistance at your fingertips',
    badge: 'Emergency',
    badgeVariant: 'destructive' as const,
    accent: 'text-destructive',
    bg: 'bg-destructive/10',
    border: 'border-destructive/20',
  },
  {
    href: '/admin',
    icon: Shield,
    title: 'Admin',
    description: 'Manage routes, schedules, and system settings',
    badge: 'Secure',
    badgeVariant: 'outline' as const,
    accent: 'text-foreground',
    bg: 'bg-muted',
    border: 'border-border',
  },
];

const stats = [
  { label: 'Active Buses', value: '3', icon: Bus },
  { label: 'Routes', value: '3', icon: MapPin },
  { label: 'Open Notices', value: '5', icon: Bell },
  { label: 'Uptime', value: '99.9%', icon: Shield },
];

function findNearestSchedule(
  schedules: ScheduleWithRelations[]
): ScheduleWithRelations | null {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const upcoming = schedules
    .filter((s) => s.status !== 'CANCELLED' && s.status !== 'ARRIVED')
    .map((s) => {
      const [h, m] = s.departure_time.split(':').map(Number);
      const depMinutes = h * 60 + m;
      const diff = depMinutes - nowMinutes;
      return { schedule: s, diff };
    })
    .sort((a, b) => {
      const aDiff = a.diff >= 0 ? a.diff : a.diff + 1440;
      const bDiff = b.diff >= 0 ? b.diff : b.diff + 1440;
      return aDiff - bDiff;
    });

  return upcoming.length > 0 ? upcoming[0].schedule : schedules[0] ?? null;
}

export default function Home() {
  const [routes] = React.useState<Route[]>(mockRoutes);
  const [buses] = React.useState<BusWithRelations[]>(getMockBusesWithRelations());
  const [schedules] = React.useState<ScheduleWithRelations[]>(
    getMockSchedulesWithRelations()
  );
  const [staff] = React.useState<Staff[]>(mockStaff);
  const [loaded, setLoaded] = React.useState(false);
  const [selection, setSelection] = React.useState<SelectorSelection>({
    routeId: '',
    scheduleId: '',
    busId: '',
    driverId: '',
  });

  // Auto-select nearest upcoming schedule on first load
  React.useEffect(() => {
    const nearest = findNearestSchedule(schedules);
    if (nearest) {
      const bus = buses.find((b) => b.id === nearest.bus_id);
      setSelection({
        routeId: nearest.route_id,
        scheduleId: nearest.id,
        busId: nearest.bus_id,
        driverId: bus?.driver_id ?? '',
      });
    }
    setLoaded(true);
  }, [schedules, buses]);

  const selectedBus = buses.find((b) => b.id === selection.busId) ?? null;
  const selectedSchedule =
    schedules.find((s) => s.id === selection.scheduleId) ?? null;
  const selectedDriver =
    staff.find((s) => s.id === selection.driverId) ??
    (selectedBus?.driver_id
      ? staff.find((s) => s.id === selectedBus.driver_id) ?? null
      : null);
  const selectedHelper = selectedBus?.helper_id
    ? staff.find((s) => s.id === selectedBus.helper_id) ?? null
    : null;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
      {/* Hero */}
      <section className="mb-10 animate-fade-in">
        <div className="flex flex-col items-start gap-4">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
            DIU Smart Transit
          </h1>
          <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
            Real-time bus tracking, instant notifications, and emergency support
            for the Daffodil International University campus.
          </p>
        </div>
      </section>

      {/* Selector engine */}
      <section className="mb-6">
        <div className="mb-4 flex items-center gap-2">
          <Bus className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">
            Find Your Bus
          </h2>
          <span className="text-xs text-muted-foreground">
            Select route, time, bus, and driver
          </span>
        </div>
        {!loaded ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
          </div>
        ) : (
          <TransitSelector
            routes={routes}
            schedules={schedules}
            buses={buses}
            staff={staff}
            value={selection}
            onChange={setSelection}
          />
        )}
      </section>

      {/* Active bus card */}
      <section className="mb-12">
        {!loaded ? (
          <Skeleton className="h-64 rounded-lg" />
        ) : (
          <div className="animate-fade-in">
            <ActiveBusCard
              bus={selectedBus}
              schedule={selectedSchedule}
              driver={selectedDriver}
              helper={selectedHelper}
            />
          </div>
        )}
      </section>

      {/* Feature cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {features.map((feature, i) => {
          const Icon = feature.icon;
          return (
            <Link key={feature.href} href={feature.href} className="group">
              <Card
                className={`group h-full overflow-hidden border ${feature.border} transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-md`}
                style={{ animation: `slide-up 0.4s ease-out ${i * 80}ms both` }}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-lg ${feature.bg} ${feature.accent} transition-transform duration-300 ease-out group-hover:scale-110`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <Badge variant={feature.badgeVariant}>{feature.badge}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-foreground">
                        {feature.title}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {feature.description}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </section>

      {/* Stats */}
      <section className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <Card
              key={stat.label}
              className="border-border"
              style={{ animation: `slide-up 0.4s ease-out ${i * 80 + 200}ms both` }}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Icon className="h-4 w-4" />
                  <span className="text-xs font-medium">{stat.label}</span>
                </div>
                <p className="mt-2 text-2xl font-bold text-foreground">{stat.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </section>
    </main>
  );
}
