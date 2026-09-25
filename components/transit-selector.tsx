'use client';

import * as React from 'react';
import { MapPin, Clock, Bus as BusIcon, User, ChevronRight } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { Route, BusWithRelations, ScheduleWithRelations, Staff } from '@/lib/types';

export interface SelectorSelection {
  routeId: string;
  scheduleId: string;
  busId: string;
  driverId: string;
}

interface TransitSelectorProps {
  routes: Route[];
  schedules: ScheduleWithRelations[];
  buses: BusWithRelations[];
  staff: Staff[];
  value: SelectorSelection;
  onChange: (value: SelectorSelection) => void;
}

function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(hour12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
}

export function TransitSelector({
  routes,
  schedules,
  buses,
  staff,
  value,
  onChange,
}: TransitSelectorProps) {
  const activeRoutes = routes.filter((r) => r.is_active);

  const routeSchedules = React.useMemo(
    () =>
      schedules.filter((s) => s.route_id === value.routeId && s.status !== 'CANCELLED'),
    [schedules, value.routeId]
  );

  const scheduleBuses = React.useMemo(() => {
    if (value.scheduleId) {
      const sched = routeSchedules.find((s) => s.id === value.scheduleId);
      if (sched) {
        return buses.filter((b) => b.id === sched.bus_id);
      }
    }
    const busIds = routeSchedules.map((s) => s.bus_id);
    return buses.filter((b) => busIds.includes(b.id));
  }, [routeSchedules, buses, value.scheduleId]);

  const availableDrivers = React.useMemo(() => {
    const selectedBus = buses.find((b) => b.id === value.busId);
    if (selectedBus?.driver_id) {
      const driver = staff.find((s) => s.id === selectedBus.driver_id);
      return driver ? [driver] : [];
    }
    return staff.filter((s) => s.role === 'DRIVER' && s.is_verified);
  }, [buses, staff, value.busId]);

  const stepComplete = (step: number) => {
    if (step === 1) return !!value.routeId;
    if (step === 2) return !!value.scheduleId;
    if (step === 3) return !!value.busId;
    if (step === 4) return !!value.driverId;
    return false;
  };

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {/* Step 1: Route */}
      <SelectorStep
        step={1}
        icon={MapPin}
        label="Road / Zone"
        placeholder="Select route"
        complete={stepComplete(1)}
      >
        <Select
          value={value.routeId}
          onValueChange={(v) =>
            onChange({ routeId: v, scheduleId: '', busId: '', driverId: '' })
          }
        >
          <SelectTrigger className="h-11 bg-card">
            <SelectValue placeholder="Select route" />
          </SelectTrigger>
          <SelectContent>
            {activeRoutes.map((route) => (
              <SelectItem key={route.id} value={route.id}>
                {route.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SelectorStep>

      {/* Step 2: Schedule */}
      <SelectorStep
        step={2}
        icon={Clock}
        label="Departure Time"
        placeholder="Select time slot"
        complete={stepComplete(2)}
        disabled={!value.routeId}
      >
        <Select
          value={value.scheduleId}
          onValueChange={(v) => {
            const sched = routeSchedules.find((s) => s.id === v);
            onChange({
              routeId: value.routeId,
              scheduleId: v,
              busId: sched?.bus_id ?? '',
              driverId: '',
            });
          }}
          disabled={!value.routeId}
        >
          <SelectTrigger className="h-11 bg-card" disabled={!value.routeId}>
            <SelectValue placeholder="Select time slot" />
          </SelectTrigger>
          <SelectContent>
            {routeSchedules.map((sched) => (
              <SelectItem key={sched.id} value={sched.id}>
                {formatTime(sched.departure_time)} — {formatTime(sched.arrival_time)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SelectorStep>

      {/* Step 3: Bus */}
      <SelectorStep
        step={3}
        icon={BusIcon}
        label="Bus Number"
        placeholder="Select bus"
        complete={stepComplete(3)}
        disabled={!value.scheduleId}
      >
        <Select
          value={value.busId}
          onValueChange={(v) => {
            const bus = buses.find((b) => b.id === v);
            onChange({
              routeId: value.routeId,
              scheduleId: value.scheduleId,
              busId: v,
              driverId: bus?.driver_id ?? '',
            });
          }}
          disabled={!value.scheduleId}
        >
          <SelectTrigger className="h-11 bg-card" disabled={!value.scheduleId}>
            <SelectValue placeholder="Select bus" />
          </SelectTrigger>
          <SelectContent>
            {scheduleBuses.map((bus) => (
              <SelectItem key={bus.id} value={bus.id}>
                {bus.bus_number}
                {bus.route ? ` — ${bus.route.name}` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SelectorStep>

      {/* Step 4: Driver */}
      <SelectorStep
        step={4}
        icon={User}
        label="Driver"
        placeholder="Select driver"
        complete={stepComplete(4)}
        disabled={!value.busId}
      >
        <Select
          value={value.driverId}
          onValueChange={(v) =>
            onChange({ ...value, driverId: v })
          }
          disabled={!value.busId}
        >
          <SelectTrigger className="h-11 bg-card" disabled={!value.busId}>
            <SelectValue placeholder="Select driver" />
          </SelectTrigger>
          <SelectContent>
            {availableDrivers.map((driver) => (
              <SelectItem key={driver.id} value={driver.id}>
                {driver.full_name}
                {driver.is_verified ? ' (Verified)' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SelectorStep>
    </div>
  );
}

function SelectorStep({
  step,
  icon: Icon,
  label,
  placeholder,
  complete,
  disabled,
  children,
}: {
  step: number;
  icon: React.ElementType;
  label: string;
  placeholder: string;
  complete: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'group relative rounded-lg border bg-card p-3 transition-all duration-200',
        complete
          ? 'border-primary/30'
          : 'border-border',
        disabled && 'opacity-50',
        !disabled && 'hover:border-primary/40'
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <div
          className={cn(
            'flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold transition-colors',
            complete
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground'
          )}
        >
          {complete ? (
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            step
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
        </div>
      </div>
      {children}
    </div>
  );
}
