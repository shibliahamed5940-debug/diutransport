'use client';

import * as React from 'react';
import { Plus, Pencil, Trash2, Route as RouteIcon, MapPin, Loader as Loader2, X } from 'lucide-react';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { mockRoutes } from '@/lib/mock-data';
import type { Route } from '@/lib/types';

interface RouteFormData {
  name: string;
  code: string;
  start_point: string;
  end_point: string;
  stops: string;
  distance_km: string;
  is_active: boolean;
}

const emptyForm: RouteFormData = {
  name: '',
  code: '',
  start_point: '',
  end_point: '',
  stops: '',
  distance_km: '',
  is_active: true,
};

export function AdminRoutesTab() {
  const [routes, setRoutes] = React.useState<Route[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<RouteFormData>(emptyForm);
  const [saving, setSaving] = React.useState(false);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);

  const fetchRoutes = React.useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setRoutes(mockRoutes);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('routes')
      .select('*')
      .order('name', { ascending: true });
    if (error || !data || data.length === 0) {
      setRoutes(mockRoutes);
    } else {
      setRoutes(data as Route[]);
    }
    setLoading(false);
  }, []);

  React.useEffect(() => {
    fetchRoutes();
  }, [fetchRoutes]);

  const openAdd = () => {
    setForm(emptyForm);
    setEditingId(null);
    setDialogOpen(true);
  };

  const openEdit = (route: Route) => {
    setForm({
      name: route.name,
      code: route.code,
      start_point: route.start_point,
      end_point: route.end_point,
      stops: route.stops.join(', '),
      distance_km: String(route.distance_km),
      is_active: route.is_active,
    });
    setEditingId(route.id);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.code.trim()) return;
    setSaving(true);

    const payload = {
      name: form.name.trim(),
      code: form.code.trim(),
      start_point: form.start_point.trim(),
      end_point: form.end_point.trim(),
      stops: form.stops
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      distance_km: parseFloat(form.distance_km) || 0,
      is_active: form.is_active,
    };

    if (isSupabaseConfigured && supabase) {
      if (editingId) {
        const { error } = await supabase
          .from('routes')
          .update(payload)
          .eq('id', editingId);
        if (!error) {
          setRoutes((prev) =>
            prev.map((r) => (r.id === editingId ? { ...r, ...payload } : r))
          );
        }
      } else {
        const { data, error } = await supabase
          .from('routes')
          .insert(payload)
          .select()
          .single();
        if (!error && data) {
          setRoutes((prev) => [...prev, data as Route]);
        }
      }
    } else {
      if (editingId) {
        setRoutes((prev) =>
          prev.map((r) =>
            r.id === editingId
              ? { ...r, ...payload, updated_at: new Date().toISOString() }
              : r
          )
        );
      } else {
        const newRoute: Route = {
          id: `route-${Date.now()}`,
          ...payload,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setRoutes((prev) => [...prev, newRoute]);
      }
    }

    setSaving(false);
    setDialogOpen(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    if (isSupabaseConfigured && supabase) {
      await supabase.from('routes').delete().eq('id', deleteId);
    }
    setRoutes((prev) => prev.filter((r) => r.id !== deleteId));
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
          <h2 className="text-lg font-semibold text-foreground">Routes</h2>
          <p className="text-xs text-muted-foreground">
            {routes.length} routes configured
          </p>
        </div>
        <Button size="sm" onClick={openAdd} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Add Route
        </Button>
      </div>

      <div className="space-y-3">
        {routes.map((route, i) => (
          <Card
            key={route.id}
            className="border-border transition-all duration-300 hover:shadow-md"
            style={{ animation: `slide-up 0.3s ease-out ${i * 50}ms both` }}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <RouteIcon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-foreground">
                        {route.name}
                      </h3>
                      <Badge variant="outline" className="text-[10px]">
                        {route.code}
                      </Badge>
                      {!route.is_active && (
                        <Badge variant="secondary" className="text-[10px]">
                          Inactive
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {route.start_point} → {route.end_point}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {route.stops.slice(0, 4).map((stop, idx) => (
                        <span
                          key={idx}
                          className="flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                        >
                          <MapPin className="h-2.5 w-2.5" />
                          {stop}
                        </span>
                      ))}
                      {route.stops.length > 4 && (
                        <span className="text-[10px] text-muted-foreground">
                          +{route.stops.length - 4} more
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEdit(route)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteId(route.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Edit Route' : 'Add Route'}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Update route details and stoppage points'
                : 'Create a new bus route with stoppage points'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Route Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Mirpur Route"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Route Code</Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="e.g. R-MRP"
                  className="mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Start Point</Label>
                <Input
                  value={form.start_point}
                  onChange={(e) =>
                    setForm({ ...form, start_point: e.target.value })
                  }
                  placeholder="e.g. DIU Main Campus"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">End Point</Label>
                <Input
                  value={form.end_point}
                  onChange={(e) =>
                    setForm({ ...form, end_point: e.target.value })
                  }
                  placeholder="e.g. Mirpur 10"
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">
                Stops (comma-separated, in order)
              </Label>
              <Input
                value={form.stops}
                onChange={(e) => setForm({ ...form, stops: e.target.value })}
                placeholder="DIU Main Campus, Ashulia, Mirpur 10"
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Distance (km)</Label>
                <Input
                  type="number"
                  value={form.distance_km}
                  onChange={(e) =>
                    setForm({ ...form, distance_km: e.target.value })
                  }
                  placeholder="e.g. 22.5"
                  className="mt-1"
                />
              </div>
              <div className="flex items-end gap-2 pb-1">
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(checked) =>
                    setForm({ ...form, is_active: checked })
                  }
                />
                <Label className="text-xs">Active</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim() || !form.code.trim()}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {editingId ? 'Save Changes' : 'Add Route'}
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
            <AlertDialogTitle>Delete Route</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the route. Buses assigned to this
              route will be unassigned. This action cannot be undone.
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
