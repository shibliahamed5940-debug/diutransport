'use client';

import * as React from 'react';
import { Plus, Trash2, Loader as Loader2, Megaphone, CircleCheck as CheckCircle2, CircleAlert as AlertCircle, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { mockNotices, mockRoutes, mockBuses } from '@/lib/mock-data';
import type { Notice, NoticeType, Route, Bus } from '@/lib/types';

interface NoticeFormData {
  title: string;
  message: string;
  type: NoticeType;
  target_route: string;
  target_bus: string;
}

const emptyForm: NoticeFormData = {
  title: '',
  message: '',
  type: 'INFO',
  target_route: '',
  target_bus: '',
};

const typeConfig: Record<
  NoticeType,
  { label: string; variant: 'default' | 'secondary' | 'destructive' }
> = {
  INFO: { label: 'General', variant: 'secondary' },
  WARNING: { label: 'Urgent', variant: 'destructive' },
  SUCCESS: { label: 'Success', variant: 'default' },
  EMERGENCY: { label: 'Emergency', variant: 'destructive' },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function AdminNoticesTab() {
  const [notices, setNotices] = React.useState<Notice[]>([]);
  const [routes, setRoutes] = React.useState<Route[]>([]);
  const [buses, setBuses] = React.useState<Bus[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [form, setForm] = React.useState<NoticeFormData>(emptyForm);
  const [publishing, setPublishing] = React.useState(false);
  const [publishSuccess, setPublishSuccess] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);

  const fetchData = React.useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setNotices(mockNotices);
      setRoutes(mockRoutes);
      setBuses(mockBuses);
      setLoading(false);
      return;
    }

    const [noticeRes, routeRes, busRes] = await Promise.all([
      supabase
        .from('notices')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase.from('routes').select('*').order('name', { ascending: true }),
      supabase.from('buses').select('*').order('bus_number', { ascending: true }),
    ]);

    setNotices(
      noticeRes.data && noticeRes.data.length > 0
        ? (noticeRes.data as Notice[])
        : mockNotices
    );
    setRoutes(
      routeRes.data && routeRes.data.length > 0
        ? (routeRes.data as Route[])
        : mockRoutes
    );
    setBuses(
      busRes.data && busRes.data.length > 0 ? (busRes.data as Bus[]) : mockBuses
    );
    setLoading(false);
  }, []);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePublish = async () => {
    setFormError(null);

    if (!form.title.trim() || !form.message.trim()) {
      setFormError('Title and description are required.');
      return;
    }

    setPublishing(true);

    // Build message with optional tags
    let message = form.message.trim();
    if (form.target_route) {
      const route = routes.find((r) => r.id === form.target_route);
      if (route) message += ` [${route.name}]`;
    }
    if (form.target_bus) {
      const bus = buses.find((b) => b.id === form.target_bus);
      if (bus) message += ` [${bus.bus_number}]`;
    }

    const payload = {
      title: form.title.trim(),
      message,
      type: form.type,
      is_active: true,
    };

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('notices')
        .insert(payload)
        .select()
        .single();
      if (!error && data) {
        setNotices((prev) => [data as Notice, ...prev]);
      }
    } else {
      const newNotice: Notice = {
        id: `notice-${Date.now()}`,
        ...payload,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setNotices((prev) => [newNotice, ...prev]);
    }

    if (form.type === 'WARNING' || form.type === 'EMERGENCY') {
      try {
        const reg = await navigator.serviceWorker?.getRegistration();
        if (reg && 'showNotification' in reg) {
          reg.showNotification('DIU Smart Transit — Urgent Notice', {
            body: form.title.trim(),
            tag: 'diu-urgent-notice',
            data: { url: '/notices' },
          });
        }
      } catch {}
    }

    setPublishing(false);
    setPublishSuccess(true);
    setForm(emptyForm);
    setTimeout(() => setPublishSuccess(false), 4000);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    if (isSupabaseConfigured && supabase) {
      await supabase.from('notices').delete().eq('id', deleteId);
    }
    setNotices((prev) => prev.filter((n) => n.id !== deleteId));
    setDeleteId(null);
  };

  const activeRoutes = routes.filter((r) => r.is_active);
  const activeBuses = buses.filter((b) => b.status === 'ACTIVE');

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
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-foreground">
          Notice Publisher
        </h2>
        <p className="text-xs text-muted-foreground">
          Publish announcements and manage existing notices
        </p>
      </div>

      {/* Publish form */}
      <Card className="mb-6 border-border">
        <CardContent className="space-y-4 p-4">
          <div className="flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">
              New Announcement
            </h3>
          </div>

          {/* Title */}
          <div>
            <Label className="text-xs">Title</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Route 3 Schedule Update"
              className="mt-1"
            />
          </div>

          {/* Description */}
          <div>
            <Label className="text-xs">Description</Label>
            <Textarea
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              placeholder="Write the announcement message..."
              className="mt-1 resize-none"
              rows={3}
            />
          </div>

          {/* Type + tags */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <Label className="text-xs">Notice Type</Label>
              <Select
                value={form.type}
                onValueChange={(v) =>
                  setForm({ ...form, type: v as NoticeType })
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INFO">General</SelectItem>
                  <SelectItem value="WARNING">Urgent</SelectItem>
                  <SelectItem value="SUCCESS">Success</SelectItem>
                  <SelectItem value="EMERGENCY">Emergency</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Target Route (optional)</Label>
              <Select
                value={form.target_route}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    target_route: v === '__none__' ? '' : v,
                  })
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="No route" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No route</SelectItem>
                  {activeRoutes.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Target Bus (optional)</Label>
              <Select
                value={form.target_bus}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    target_bus: v === '__none__' ? '' : v,
                  })
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="No bus" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No bus</SelectItem>
                  {activeBuses.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.bus_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Error / success */}
          {formError && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 animate-fade-in">
              <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
              <p className="text-sm text-destructive">{formError}</p>
              <button
                onClick={() => setFormError(null)}
                className="ml-auto flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          {publishSuccess && (
            <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 p-3 animate-fade-in">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
              <p className="text-sm font-medium text-success">
                Notice published successfully.
              </p>
            </div>
          )}

          {/* Publish button */}
          <Button
            onClick={handlePublish}
            disabled={publishing || !form.title.trim() || !form.message.trim()}
            className="w-full sm:w-auto"
          >
            {publishing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Publish Notice
          </Button>
        </CardContent>
      </Card>

      {/* Existing notices */}
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          Published Notices
        </h3>
        <span className="text-xs text-muted-foreground">
          {notices.length} total
        </span>
      </div>

      <div className="space-y-2">
        {notices.map((notice, i) => {
          const tc = typeConfig[notice.type];
          return (
            <Card
              key={notice.id}
              className="border-border transition-all duration-300 hover:shadow-sm"
              style={{ animation: `slide-up 0.3s ease-out ${i * 40}ms both` }}
            >
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="truncate text-sm font-semibold text-foreground">
                        {notice.title}
                      </h4>
                      <Badge variant={tc.variant} className="shrink-0 text-[10px]">
                        {tc.label}
                      </Badge>
                      {!notice.is_active && (
                        <Badge variant="secondary" className="shrink-0 text-[10px]">
                          Inactive
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {notice.message}
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
                      {timeAgo(notice.created_at)}
                    </p>
                  </div>
                  <button
                    onClick={() => setDeleteId(notice.id)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {notices.length === 0 && (
          <Card className="border-dashed border-border">
            <CardContent className="flex flex-col items-center justify-center gap-3 p-12 text-center">
              <Megaphone className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">
                No notices published
              </p>
              <p className="text-xs text-muted-foreground">
                Use the form above to publish your first announcement
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
            <AlertDialogTitle>Delete Notice</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the announcement. This action
              cannot be undone.
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
