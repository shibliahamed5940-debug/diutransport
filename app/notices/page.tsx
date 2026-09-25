'use client';

import * as React from 'react';
import { Clock, AlertCircle, Info, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { NoticeTagParser } from '@/components/notice-tag-parser';
import { BusDetailSheet } from '@/components/bus-detail-sheet';
import { getActiveNotices, getBuses, getStaff, getTodaySchedules } from '@/lib/data';
import { mockRoutes } from '@/lib/mock-data';
import type { Notice, BusWithRelations, ScheduleWithRelations, Staff, Route } from '@/lib/types';

const typeConfig = {
  INFO: { icon: Info, color: 'text-primary', bg: 'bg-primary/10', badge: 'Info', badgeVariant: 'secondary' as const, border: 'border-primary/20' },
  WARNING: { icon: AlertCircle, color: 'text-destructive', bg: 'bg-destructive/10', badge: 'Warning', badgeVariant: 'destructive' as const, border: 'border-destructive/20' },
  SUCCESS: { icon: CheckCircle2, color: 'text-success', bg: 'bg-success/10', badge: 'Success', badgeVariant: 'default' as const, border: 'border-success/20' },
  EMERGENCY: { icon: AlertCircle, color: 'text-destructive', bg: 'bg-destructive/10', badge: 'Emergency', badgeVariant: 'destructive' as const, border: 'border-destructive/20' },
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function NoticesPage() {
  const [notices, setNotices] = React.useState<Notice[]>([]);
  const [buses, setBuses] = React.useState<BusWithRelations[]>([]);
  const [schedules, setSchedules] = React.useState<ScheduleWithRelations[]>([]);
  const [staff, setStaff] = React.useState<Staff[]>([]);
  const [routes] = React.useState<Route[]>(mockRoutes);
  const [loading, setLoading] = React.useState(true);
  const [mounted, setMounted] = React.useState(false);

  const [sheetBus, setSheetBus] = React.useState<BusWithRelations | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);

  const fetchAll = React.useCallback(async () => {
    const [noticeData, busData, staffData, scheduleData] = await Promise.all([
      getActiveNotices(),
      getBuses(),
      getStaff(),
      getTodaySchedules(),
    ]);
    setNotices(noticeData);
    setBuses(busData);
    setStaff(staffData);
    setSchedules(scheduleData);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    setMounted(true);
    fetchAll();
    const interval = setInterval(fetchAll, 15_000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const handleBusClick = React.useCallback((bus: BusWithRelations) => {
    setSheetBus(bus);
    setSheetOpen(true);
  }, []);

  const sheetDriver = sheetBus?.driver_id
    ? staff.find((s) => s.id === sheetBus.driver_id) ??
      (sheetBus.driver ?? null)
    : null;
  const sheetHelper = sheetBus?.helper_id
    ? staff.find((s) => s.id === sheetBus.helper_id) ??
      (sheetBus.helper ?? null)
    : null;
  const sheetSchedule = sheetBus
    ? schedules.find(
        (s) => s.bus_id === sheetBus.id && s.status !== 'CANCELLED'
      ) ?? null
    : null;

  if (!mounted) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="h-8 w-32 animate-pulse rounded bg-muted" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Notices
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Latest transit announcements and updates
        </p>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
      ) : notices.length === 0 ? (
        <Card className="border-dashed border-border">
          <CardContent className="flex flex-col items-center justify-center gap-3 p-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Info className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">No active notices</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Check back later for transit updates
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {notices.map((notice, i) => {
            const config = typeConfig[notice.type] ?? typeConfig.INFO;
            const Icon = config.icon;
            return (
              <Card
                key={notice.id}
                className={`group border ${config.border} transition-all duration-300 hover:shadow-md`}
                style={{ animation: `slide-up 0.4s ease-out ${i * 60}ms both` }}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${config.bg} ${config.color} transition-transform duration-300 group-hover:scale-110`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-foreground">
                          {notice.title}
                        </h3>
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatDate(notice.created_at)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={config.badgeVariant}>{config.badge}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    <NoticeTagParser
                      text={notice.message}
                      buses={buses}
                      routes={routes}
                      onBusClick={handleBusClick}
                    />
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Bus detail sheet */}
      <BusDetailSheet
        bus={sheetBus}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        driver={sheetDriver}
        helper={sheetHelper}
        schedule={sheetSchedule}
      />
    </main>
  );
}
