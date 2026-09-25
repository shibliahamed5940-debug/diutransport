'use client';

import * as React from 'react';
import { Plus, Pencil, Trash2, Users, Phone, BadgeCheck, Loader as Loader2 } from 'lucide-react';
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
import { Switch } from '@/components/ui/switch';
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
import { mockStaff, mockBuses } from '@/lib/mock-data';
import type { Staff, StaffRole, Bus } from '@/lib/types';

interface StaffFormData {
  full_name: string;
  role: StaffRole;
  phone: string;
  license_number: string;
  is_verified: boolean;
  assigned_bus_id: string;
}

const emptyForm: StaffFormData = {
  full_name: '',
  role: 'DRIVER',
  phone: '',
  license_number: '',
  is_verified: false,
  assigned_bus_id: '',
};

export function AdminStaffsTab() {
  const [staff, setStaff] = React.useState<Staff[]>([]);
  const [buses, setBuses] = React.useState<Bus[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<StaffFormData>(emptyForm);
  const [saving, setSaving] = React.useState(false);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);

  const fetchData = React.useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setStaff(mockStaff);
      setBuses(mockBuses);
      setLoading(false);
      return;
    }
    const [staffRes, busRes] = await Promise.all([
      supabase.from('staffs').select('*').order('full_name', { ascending: true }),
      supabase.from('buses').select('*').order('bus_number', { ascending: true }),
    ]);
    setStaff(
      staffRes.data && staffRes.data.length > 0
        ? (staffRes.data as Staff[])
        : mockStaff
    );
    setBuses(
      busRes.data && busRes.data.length > 0 ? (busRes.data as Bus[]) : mockBuses
    );
    setLoading(false);
  }, []);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const busNumber = (busId: string | null) =>
    buses.find((b) => b.id === busId)?.bus_number ?? 'Unassigned';

  const openAdd = () => {
    setForm(emptyForm);
    setEditingId(null);
    setDialogOpen(true);
  };

  const openEdit = (s: Staff) => {
    setForm({
      full_name: s.full_name,
      role: s.role,
      phone: s.phone,
      license_number: s.license_number ?? '',
      is_verified: s.is_verified,
      assigned_bus_id: s.assigned_bus_id ?? '',
    });
    setEditingId(s.id);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.full_name.trim() || !form.phone.trim()) return;
    setSaving(true);

    const payload = {
      full_name: form.full_name.trim(),
      role: form.role,
      phone: form.phone.trim(),
      license_number: form.license_number.trim() || null,
      is_verified: form.is_verified,
      assigned_bus_id: form.assigned_bus_id || null,
    };

    if (isSupabaseConfigured && supabase) {
      if (editingId) {
        const { error } = await supabase
          .from('staffs')
          .update(payload)
          .eq('id', editingId);
        if (!error) {
          setStaff((prev) =>
            prev.map((s) =>
              s.id === editingId ? { ...s, ...payload } : s
            )
          );
        }
      } else {
        const { data, error } = await supabase
          .from('staffs')
          .insert(payload)
          .select()
          .single();
        if (!error && data) {
          setStaff((prev) => [...prev, data as Staff]);
        }
      }
    } else {
      if (editingId) {
        setStaff((prev) =>
          prev.map((s) =>
            s.id === editingId
              ? { ...s, ...payload, updated_at: new Date().toISOString() }
              : s
          )
        );
      } else {
        const newStaff: Staff = {
          id: `staff-${Date.now()}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...payload,
        };
        setStaff((prev) => [...prev, newStaff]);
      }
    }

    setSaving(false);
    setDialogOpen(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    if (isSupabaseConfigured && supabase) {
      await supabase.from('staffs').delete().eq('id', deleteId);
    }
    setStaff((prev) => prev.filter((s) => s.id !== deleteId));
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
          <h2 className="text-lg font-semibold text-foreground">Staffs</h2>
          <p className="text-xs text-muted-foreground">
            {staff.length} drivers and helpers
          </p>
        </div>
        <Button size="sm" onClick={openAdd} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Add Staff
        </Button>
      </div>

      <div className="space-y-3">
        {staff.map((s, i) => (
          <Card
            key={s.id}
            className="border-border transition-all duration-300 hover:shadow-md"
            style={{ animation: `slide-up 0.3s ease-out ${i * 50}ms both` }}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                      s.role === 'DRIVER'
                        ? 'bg-primary/10 text-primary'
                        : 'bg-success/10 text-success'
                    )}
                  >
                    {s.full_name.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-foreground">
                        {s.full_name}
                      </h3>
                      {s.is_verified && (
                        <BadgeCheck className="h-3.5 w-3.5 text-success" />
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge
                        variant="outline"
                        className="text-[10px]"
                      >
                        {s.role}
                      </Badge>
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {s.phone}
                      </span>
                      <span>· {busNumber(s.assigned_bus_id)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEdit(s)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteId(s.id)}
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
              {editingId ? 'Edit Staff' : 'Add Staff'}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Update staff member details'
                : 'Register a new driver or helper'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Full Name</Label>
                <Input
                  value={form.full_name}
                  onChange={(e) =>
                    setForm({ ...form, full_name: e.target.value })
                  }
                  placeholder="e.g. Rahim Uddin"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Role</Label>
                <Select
                  value={form.role}
                  onValueChange={(v) =>
                    setForm({ ...form, role: v as StaffRole })
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRIVER">Driver</SelectItem>
                    <SelectItem value="HELPER">Helper</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Phone</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="e.g. +8801711000001"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">License Number</Label>
                <Input
                  value={form.license_number}
                  onChange={(e) =>
                    setForm({ ...form, license_number: e.target.value })
                  }
                  placeholder="e.g. DL-DHA-2019-0451"
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Assigned Bus</Label>
              <Select
                value={form.assigned_bus_id}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    assigned_bus_id: v === '__none__' ? '' : v,
                  })
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select bus (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Unassigned</SelectItem>
                  {buses.map((bus) => (
                    <SelectItem key={bus.id} value={bus.id}>
                      {bus.bus_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.is_verified}
                onCheckedChange={(checked) =>
                  setForm({ ...form, is_verified: checked })
                }
              />
              <Label className="text-xs">Verified</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.full_name.trim() || !form.phone.trim()}
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {editingId ? 'Save Changes' : 'Add Staff'}
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
            <AlertDialogTitle>Delete Staff</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the staff member. Bus assignments
              will be cleared. This action cannot be undone.
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
