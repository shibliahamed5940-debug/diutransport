'use client';

import * as React from 'react';
import { Plus, Pencil, Trash2, Bus as BusIcon, Loader as Loader2 } from 'lucide-react';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { mockBuses, mockRoutes } from '@/lib/mock-data';
import type { Bus, Route, BusStatus } from '@/lib/types';

interface BusFormData {
  bus_number: string;
  route_id: string;
  capacity: string;
  status: BusStatus;
}

const emptyForm: BusFormData = {
  bus_number: '',
  route_id: '',
  capacity: '40',
  status: 'ACTIVE',
};

const statusConfig: Record<BusStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
  ACTIVE: { label: 'Active', variant: 'default' },
  MAINTENANCE: { label: 'Maintenance', variant: 'secondary' },
  OFFLINE: { label: 'Offline', variant: 'destructive' },
};

export function AdminBusesTab() {
  const [buses, setBuses] = React.useState<Bus[]>([]);
  const [routes, setRoutes] = React.useState<Route[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<BusFormData>(emptyForm);
  const [saving, setSaving] = React.useState(false);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);

  const fetchData = React.useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setBuses(mockBuses);
      setRoutes(mockRoutes);
      setLoading(false);
      return;
    }
    const [busRes, routeRes] = await Promise.all([
      supabase.from('buses').select('*').order('bus_number', { ascending: true }),
      supabase.from('routes').select('*').order('name', { ascending: true }),
    ]);
    setBuses(
      busRes.data && busRes.data.length > 0 ? (busRes.data as Bus[]) : mockBuses
    );
    setRoutes(
      routeRes.data && routeRes.data.length > 0
        ? (routeRes.data as Route[])
        : mockRoutes
    );
    setLoading(false);
  }, []);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const routeName = (routeId: string | null) =>
    routes.find((r) => r.id === routeId)?.name ?? 'Unassigned';

  const openAdd = () => {
    setForm(emptyForm);
    setEditingId(null);
    setDialogOpen(true);
  };

  const openEdit = (bus: Bus) => {
    setForm({
      bus_number: bus.bus_number,
      route_id: bus.route_id ?? '',
      capacity: String(bus.capacity),
      status: bus.status,
    });
    setEditingId(bus.id);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.bus_number.trim()) return;
    setSaving(true);

    const payload = {
      bus_number: form.bus_number.trim(),
      route_id: form.route_id || null,
      capacity: parseInt(form.capacity) || 40,
      status: form.status,
    };

    if (isSupabaseConfigured && supabase) {
      if (editingId) {
        const { error } = await supabase
          .from('buses')
          .update(payload)
          .eq('id', editingId);
        if (!error) {
          setBuses((prev) =>
            prev.map((b) => (b.id === editingId ? { ...b, ...payload } : b))
          );
        }
      } else {
        const { data, error } = await supabase
          .from('buses')
          .insert(payload)
          .select()
          .single();
        if (!error && data) {
          setBuses((prev) => [...prev, data as Bus]);
        }
      }
    } else {
      if (editingId) {
        setBuses((prev) =>
          prev.map((b) =>
            b.id === editingId
              ? { ...b, ...payload, updated_at: new Date().toISOString() }
              : b
          )
        );
      } else {
        const newBus: Bus = {
          id: `bus-${Date.now()}`,
          current_lat: null,
          current_lng: null,
          driver_id: null,
          helper_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...payload,
        };
        setBuses((prev) => [...prev, newBus]);
      }
    }

    setSaving(false);
    setDialogOpen(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    if (isSupabaseConfigured && supabase) {
      await supabase.from('buses').delete().eq('id', deleteId);
    }
    setBuses((prev) => prev.filter((b) => b.id !== deleteId));
    setDeleteId(null);
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Buses</h2>
          <p className="text-xs text-muted-foreground">
            {buses.length} buses in fleet
          </p>
        </div>
        <Button size="sm" onClick={openAdd} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Add Bus
        </Button>
      </div>

      <div className="space-y-3">
        {buses.map((bus, i) => {
          const sc = statusConfig[bus.status];
          return (
            <Card
              key={bus.id}
              className="border-border transition-all duration-300 hover:shadow-md"
              style={{ animation: `slide-up 0.3s ease-out ${i * 50}ms both` }}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                      <BusIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-foreground">
                          {bus.bus_number}
                        </h3>
                        <Badge variant={sc.variant} className="text-[10px]">
                          {sc.label}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {routeName(bus.route_id)} · {bus.capacity} seats
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEdit(bus)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteId(bus.id)}
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

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Edit Bus' : 'Add Bus'}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Update bus details and route assignment'
                : 'Register a new bus in the fleet'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-xs">Bus Number</Label>
              <Input
                value={form.bus_number}
                onChange={(e) =>
                  setForm({ ...form, bus_number: e.target.value })
                }
                placeholder="e.g. S-18"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Assigned Route</Label>
              <Select
                value={form.route_id}
                onValueChange={(v) =>
                  setForm({ ...form, route_id: v === '__none__' ? '' : v })
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select route (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Unassigned</SelectItem>
                  {routes.map((route) => (
                    <SelectItem key={route.id} value={route.id}>
                      {route.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Capacity</Label>
                <Input
                  type="number"
                  value={form.capacity}
                  onChange={(e) =>
                    setForm({ ...form, capacity: e.target.value })
                  }
                  placeholder="e.g. 45"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) =>
                    setForm({ ...form, status: v as BusStatus })
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                    <SelectItem value="OFFLINE">Offline</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.bus_number.trim()}
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {editingId ? 'Save Changes' : 'Add Bus'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Bus</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the bus from the fleet. Driver and
              helper assignments will be cleared. This action cannot be undone.
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
