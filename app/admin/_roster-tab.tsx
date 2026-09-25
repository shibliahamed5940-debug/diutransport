'use client';

import * as React from 'react';
import { CalendarClock, Plus, Trash2, Loader as Loader2, Bus as BusIcon, Users, Clock, Save } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import {
  mockSchedules,
  mockBuses,
  mockRoutes,
  mockStaff,
} from '@/lib/mock-data';
import type {
  DailySchedule,
  Bus,
  Route,
  Staff,
  ScheduleStatus,
} from '@/lib/types';

interface RosterRow extends DailySchedule {
  bus_number?: string;
  route_name?: string;
  driver_name?: string;
  helper_name?: string;
}

const statusConfig: Record<
  ScheduleStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' }
> = {
  SCHEDULED: { label: 'Scheduled', variant: 'default' },
  DEPARTED: { label: 'Departed', variant: 'secondary' },
  ARRIVED: { label: 'Arrived', variant: 'secondary' },
  CANCELLED: { label: 'Cancelled', variant: 'destructive' },
};

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(hour12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
}

export function AdminRosterTab() {
  const [schedules, setSchedules] = React.useState<RosterRow[]>([]);
  const [buses, setBuses] = React.useState<Bus[]>([]);
  const [routes, setRoutes] = React.useState<Route[]>([]);
  const [staff, setStaff] = React.useState<Staff[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [savingId, setSavingId] = React.useState<string | null>(null);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);

  // Add form
  const [addOpen, setAddOpen] = React.useState(false);
  const [newRoute, setNewRoute] = React.useState('');
  const [newBus, setNewBus] = React.useState('');
  const [newDepart, setNewDepart] = React.useState('07:00');
  const [newArrive, setNewArrive] = React.useState('08:30');
  const [adding, setAdding] = React.useState(false);

  const fetchData = React.useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      const enriched: RosterRow[] = mockSchedules.map((s) => ({
        ...s,
        bus_number: mockBuses.find((b) => b.id === s.bus_id)?.bus_number,
        route_name: mockRoutes.find((r) => r.id === s.route_id)?.name,
      }));
      setSchedules(enriched);
      setBuses(mockBuses);
      setRoutes(mockRoutes);
      setStaff(mockStaff);
      setLoading(false);
      return;
    }

    const [schedRes, busRes, routeRes, staffRes] = await Promise.all([
      supabase
        .from('daily_schedules')
        .select('*')
        .eq('schedule_date', todayStr())
        .order('departure_time', { ascending: true }),
      supabase.from('buses').select('*').order('bus_number', { ascending: true }),
      supabase.from('routes').select('*').order('name', { ascending: true }),
      supabase.from('staffs').select('*').order('full_name', { ascending: true }),
    ]);

    const schedData =
      schedRes.data && schedRes.data.length > 0
        ? (schedRes.data as DailySchedule[])
        : mockSchedules;

    const busData =
      busRes.data && busRes.data.length > 0
        ? (busRes.data as Bus[])
        : mockBuses;
    const routeData =
      routeRes.data && routeRes.data.length > 0
        ? (routeRes.data as Route[])
        : mockRoutes;
    const staffData =
      staffRes.data && staffRes.data.length > 0
        ? (staffRes.data as Staff[])
        : mockStaff;

    const enriched: RosterRow[] = schedData.map((s) => ({
      ...s,
      bus_number: busData.find((b) => b.id === s.bus_id)?.bus_number,
      route_name: routeData.find((r) => r.id === s.route_id)?.name,
    }));

    setSchedules(enriched);
    setBuses(busData);
    setRoutes(routeData);
    setStaff(staffData);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const activeBuses = buses.filter((b) => b.status === 'ACTIVE');
  const drivers = staff.filter((s) => s.role === 'DRIVER');
  const helpers = staff.filter((s) => s.role === 'HELPER');

  const handleFieldChange = async (
    id: string,
    field: 'bus_id' | 'route_id' | 'driver_id' | 'helper_id',
    value: string
  ) => {
    const realValue = value === '__none__' ? null : value;

    // Optimistic local update
    setSchedules((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const updated = { ...s, [field]: realValue };
        if (field === 'bus_id') {
          updated.bus_number = buses.find((b) => b.id === realValue)?.bus_number;
        }
        if (field === 'route_id') {
          updated.route_name = routes.find((r) => r.id === realValue)?.name;
        }
        return updated;
      })
    );

    // For driver/helper, we update the bus record, not the schedule
    setSavingId(id);
    if (isSupabaseConfigured && supabase) {
      if (field === 'driver_id' || field === 'helper_id') {
        const sched = schedules.find((s) => s.id === id);
        if (sched?.bus_id) {
          await supabase
            .from('buses')
            .update({ [field]: realValue })
            .eq('id', sched.bus_id);
        }
      } else {
        await supabase.from('daily_schedules').update({ [field]: realValue }).eq('id', id);
      }
    }
    setSavingId(null);
  };

  const handleAddSlot = async () => {
    if (!newRoute || !newBus) return;
    setAdding(true);

    const payload = {
      bus_id: newBus,
      route_id: newRoute,
      departure_time: newDepart,
      arrival_time: newArrive,
      schedule_date: todayStr(),
      status: 'SCHEDULED' as ScheduleStatus,
      notes: null,
    };

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('daily_schedules')
        .insert(payload)
        .select()
        .single();
      if (!error && data) {
        const newRow: RosterRow = {
          ...(data as DailySchedule),
          bus_number: buses.find((b) => b.id === data.bus_id)?.bus_number,
          route_name: routes.find((r) => r.id === data.route_id)?.name,
        };
        setSchedules((prev) =>
          [...prev, newRow].sort((a, b) =>
            a.departure_time.localeCompare(b.departure_time)
          )
        );
      }
    } else {
      const newRow: RosterRow = {
        id: `schedule-${Date.now()}`,
        ...payload,
        live_lat: null,
        live_lng: null,
        location_source: null,
        last_ping: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        bus_number: buses.find((b) => b.id === newBus)?.bus_number,
        route_name: routes.find((r) => r.id === newRoute)?.name,
      };
      setSchedules((prev) =>
        [...prev, newRow].sort((a, b) =>
          a.departure_time.localeCompare(b.departure_time)
        )
      );
    }

    setAdding(false);
    setAddOpen(false);
    setNewRoute('');
    setNewBus('');
    setNewDepart('07:00');
    setNewArrive('08:30');
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    if (isSupabaseConfigured && supabase) {
      await supabase.from('daily_schedules').delete().eq('id', deleteId);
    }
    setSchedules((prev) => prev.filter((s) => s.id !== deleteId));
    setDeleteId(null);
  };

  // Group by route
  const grouped = React.useMemo(() => {
    const map = new Map<string, RosterRow[]>();
    for (const s of schedules) {
      const key = s.route_id;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return map;
  }, [schedules]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Daily Roster</h2>
          <p className="text-xs text-muted-foreground">
            {schedules.length} slots scheduled for today
          </p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Add Slot
        </Button>
      </div>

      {/* Add slot inline form */}
      {addOpen && (
        <Card className="mb-4 border-primary/30 animate-fade-in">
          <CardContent className="space-y-3 p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div>
                <Label className="text-xs">Route</Label>
                <Select value={newRoute} onValueChange={setNewRoute}>
                  <SelectTrigger className="mt-1 h-9">
                    <SelectValue placeholder="Select route" />
                  </SelectTrigger>
                  <SelectContent>
                    {routes.filter((r) => r.is_active).map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Bus</Label>
                <Select value={newBus} onValueChange={setNewBus}>
                  <SelectTrigger className="mt-1 h-9">
                    <SelectValue placeholder="Select bus" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeBuses.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.bus_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Departure</Label>
                <Input
                  type="time"
                  value={newDepart}
                  onChange={(e) => setNewDepart(e.target.value)}
                  className="mt-1 h-9"
                />
              </div>
              <div>
                <Label className="text-xs">Arrival</Label>
                <Input
                  type="time"
                  value={newArrive}
                  onChange={(e) => setNewArrive(e.target.value)}
                  className="mt-1 h-9"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAddOpen(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleAddSlot}
                disabled={adding || !newRoute || !newBus}
              >
                {adding ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                )}
                Add
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Roster grouped by route */}
      <div className="space-y-6">
        {Array.from(grouped.entries()).map(([routeId, slots]) => {
          const route = routes.find((r) => r.id === routeId);
          return (
            <div key={routeId}>
              <div className="mb-2 flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">
                  {route?.name ?? 'Unknown Route'}
                </h3>
                <Badge variant="outline" className="text-[10px]">
                  {slots.length} slots
                </Badge>
              </div>
              <div className="space-y-2">
                {slots.map((slot, i) => {
                  const sc = statusConfig[slot.status];
                  const assignedBus = buses.find((b) => b.id === slot.bus_id);
                  return (
                    <Card
                      key={slot.id}
                      className="border-border transition-all duration-300 hover:shadow-sm"
                      style={{
                        animation: `slide-up 0.3s ease-out ${i * 40}ms both`,
                      }}
                    >
                      <CardContent className="p-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                          {/* Time */}
                          <div className="flex shrink-0 items-center gap-2 sm:w-32">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            <div>
                              <p className="text-xs font-semibold text-foreground">
                                {formatTime(slot.departure_time)}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                to {formatTime(slot.arrival_time)}
                              </p>
                            </div>
                            <Badge variant={sc.variant} className="ml-1 text-[10px]">
                              {sc.label}
                            </Badge>
                          </div>

                          {/* Bus selector */}
                          <div className="flex-1">
                            <Label className="mb-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                              <BusIcon className="h-2.5 w-2.5" />
                              Bus
                            </Label>
                            <Select
                              value={slot.bus_id ?? '__none__'}
                              onValueChange={(v) =>
                                handleFieldChange(slot.id, 'bus_id', v)
                              }
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">Unassigned</SelectItem>
                                {activeBuses.map((b) => (
                                  <SelectItem key={b.id} value={b.id}>
                                    {b.bus_number}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Driver selector */}
                          <div className="flex-1">
                            <Label className="mb-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                              <Users className="h-2.5 w-2.5" />
                              Driver
                            </Label>
                            <Select
                              value={assignedBus?.driver_id ?? '__none__'}
                              onValueChange={(v) =>
                                handleFieldChange(slot.id, 'driver_id', v)
                              }
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">Unassigned</SelectItem>
                                {drivers.map((d) => (
                                  <SelectItem key={d.id} value={d.id}>
                                    {d.full_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Helper selector */}
                          <div className="flex-1">
                            <Label className="mb-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                              <Users className="h-2.5 w-2.5" />
                              Helper
                            </Label>
                            <Select
                              value={assignedBus?.helper_id ?? '__none__'}
                              onValueChange={(v) =>
                                handleFieldChange(slot.id, 'helper_id', v)
                              }
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">Unassigned</SelectItem>
                                {helpers.map((h) => (
                                  <SelectItem key={h.id} value={h.id}>
                                    {h.full_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Saving indicator + delete */}
                          <div className="flex shrink-0 items-center gap-1">
                            {savingId === slot.id && (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                            )}
                            <button
                              onClick={() => setDeleteId(slot.id)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
        {schedules.length === 0 && (
          <Card className="border-dashed border-border">
            <CardContent className="flex flex-col items-center justify-center gap-3 p-12 text-center">
              <CalendarClock className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">
                No slots scheduled for today
              </p>
              <p className="text-xs text-muted-foreground">
                Click "Add Slot" to create the first departure
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Schedule Slot</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the departure slot from today's roster. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
