'use client';

import * as React from 'react';
import { Search, Package, Bus as BusIcon, Phone, MapPin, Plus, Loader as Loader2, CircleCheck as CheckCircle2, CircleAlert as AlertCircle, X } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { getMockBusesWithRelations } from '@/lib/mock-data';
import type { BusWithRelations, LostFoundStatus } from '@/lib/types';

interface LostFoundEntry {
  id: string;
  item_description: string;
  bus_id: string | null;
  seat_reference: string | null;
  contact_number: string;
  status: LostFoundStatus;
  created_at: string;
  bus_number?: string;
}

const mockEntries: LostFoundEntry[] = [
  {
    id: 'lf-001',
    item_description: 'Black wallet with student ID card inside',
    bus_id: 'bus-s18',
    seat_reference: 'Seat 12',
    contact_number: '+8801712345678',
    status: 'LOST',
    created_at: '2026-09-25T09:30:00Z',
    bus_number: 'S-18',
  },
  {
    id: 'lf-002',
    item_description: 'Blue water bottle left under seat',
    bus_id: 'bus-s05',
    seat_reference: 'Seat 7',
    contact_number: '+8801718765432',
    status: 'FOUND',
    created_at: '2026-09-24T14:00:00Z',
    bus_number: 'S-05',
  },
  {
    id: 'lf-003',
    item_description: 'Engineering textbook — Thermodynamics',
    bus_id: null,
    seat_reference: null,
    contact_number: '+8801912345678',
    status: 'LOST',
    created_at: '2026-09-23T08:00:00Z',
    bus_number: undefined,
  },
];

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

export default function LostAndFoundPage() {
  const [entries, setEntries] = React.useState<LostFoundEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [buses] = React.useState<BusWithRelations[]>(getMockBusesWithRelations());
  const [mounted, setMounted] = React.useState(false);

  const [itemDescription, setItemDescription] = React.useState('');
  const [selectedBusId, setSelectedBusId] = React.useState('');
  const [seatReference, setSeatReference] = React.useState('');
  const [contactNumber, setContactNumber] = React.useState('');
  const [status, setStatus] = React.useState<LostFoundStatus>('LOST');
  const [submitting, setSubmitting] = React.useState(false);
  const [submitSuccess, setSubmitSuccess] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const [filter, setFilter] = React.useState<'all' | 'LOST' | 'FOUND'>('all');
  const [searchQuery, setSearchQuery] = React.useState('');

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const fetchEntries = React.useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setEntries(mockEntries);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('lost_and_found')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) {
      setEntries(mockEntries);
    } else {
      const enriched = (
        data as Omit<LostFoundEntry, 'bus_number'>[]
      ).map((row) => {
        const bus = buses.find((b) => b.id === row.bus_id);
        return { ...row, bus_number: bus?.bus_number };
      });
      setEntries(enriched);
    }
    setLoading(false);
  }, [buses]);

  React.useEffect(() => {
    fetchEntries();
    const interval = setInterval(fetchEntries, 15_000);
    return () => clearInterval(interval);
  }, [fetchEntries]);

  const filtered = React.useMemo(() => {
    let result = entries;
    if (filter !== 'all') {
      result = result.filter((e) => e.status === filter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.item_description.toLowerCase().includes(q) ||
          (e.bus_number ?? '').toLowerCase().includes(q) ||
          (e.seat_reference ?? '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [entries, filter, searchQuery]);

  const handleSubmit = async () => {
    setFormError(null);

    if (!itemDescription.trim()) {
      setFormError('Please describe the item.');
      return;
    }
    if (!contactNumber.trim()) {
      setFormError('Please provide a contact number.');
      return;
    }

    setSubmitting(true);

    const payload = {
      item_description: itemDescription.trim(),
      bus_id: selectedBusId || null,
      seat_reference: seatReference.trim() || null,
      contact_number: contactNumber.trim(),
      status,
    };

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('lost_and_found')
        .insert(payload)
        .select()
        .single();

      if (!error && data) {
        const bus = buses.find((b) => b.id === data.bus_id);
        setEntries((prev) => [
          { ...data, bus_number: bus?.bus_number },
          ...prev,
        ]);
      }
    } else {
      const newEntry: LostFoundEntry = {
        id: `lf-${Date.now()}`,
        item_description: itemDescription.trim(),
        bus_id: selectedBusId || null,
        seat_reference: seatReference.trim() || null,
        contact_number: contactNumber.trim(),
        status,
        created_at: new Date().toISOString(),
        bus_number: buses.find((b) => b.id === selectedBusId)?.bus_number,
      };
      setEntries((prev) => [newEntry, ...prev]);
    }

    setSubmitting(false);
    setSubmitSuccess(true);
    setItemDescription('');
    setSelectedBusId('');
    setSeatReference('');
    setContactNumber('');
    setStatus('LOST');
    setTimeout(() => setSubmitSuccess(false), 4000);
  };

  const activeBuses = buses.filter((b) => b.status === 'ACTIVE');

  if (!mounted) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Lost &amp; Found
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Report lost items or announce found belongings
        </p>
      </div>

      {/* Report form */}
      <Card className="mb-8 border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Plus className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">Report an Item</CardTitle>
              <CardDescription className="text-xs">
                Fill in the details below to submit a report
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status toggle */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Status
            </label>
            <div className="flex gap-2">
              {(['LOST', 'FOUND'] as LostFoundStatus[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={cn(
                    'flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-all',
                    status === s
                      ? s === 'LOST'
                        ? 'border-destructive/40 bg-destructive/10 text-destructive'
                        : 'border-success/40 bg-success/10 text-success'
                      : 'border-border bg-card text-muted-foreground hover:border-primary/30'
                  )}
                >
                  {s === 'LOST' ? 'Lost' : 'Found'}
                </button>
              ))}
            </div>
          </div>

          {/* Item description */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Item Name / Description
            </label>
            <Textarea
              placeholder="e.g. Black leather wallet with student ID inside"
              value={itemDescription}
              onChange={(e) => setItemDescription(e.target.value)}
              className="resize-none"
              rows={2}
            />
          </div>

          {/* Bus selector + seat reference */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Bus Number
              </label>
              <Select
                value={selectedBusId}
                onValueChange={setSelectedBusId}
              >
                <SelectTrigger className="h-10 bg-card">
                  <SelectValue placeholder="Select bus (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {activeBuses.map((bus) => (
                    <SelectItem key={bus.id} value={bus.id}>
                      {bus.bus_number}
                      {bus.route ? ` — ${bus.route.name}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Seat Reference
              </label>
              <Input
                placeholder="e.g. Seat 12"
                value={seatReference}
                onChange={(e) => setSeatReference(e.target.value)}
                className="h-10 bg-card"
              />
            </div>
          </div>

          {/* Contact number */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Contact Number
            </label>
            <Input
              placeholder="e.g. +8801712345678"
              value={contactNumber}
              onChange={(e) => setContactNumber(e.target.value)}
              className="h-10 bg-card"
            />
          </div>

          {/* Error message */}
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

          {/* Success message */}
          {submitSuccess && (
            <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 p-3 animate-fade-in">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
              <p className="text-sm font-medium text-success">
                Report submitted successfully.
              </p>
            </div>
          )}

          {/* Submit button */}
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            {submitting ? 'Submitting...' : 'Submit Report'}
          </Button>
        </CardContent>
      </Card>

      {/* Filter + search bar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/50 p-0.5">
          {(['all', 'LOST', 'FOUND'] as const).map((tag) => (
            <button
              key={tag}
              onClick={() => setFilter(tag)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-all',
                filter === tag
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {tag === 'all' ? 'All' : tag === 'LOST' ? 'Lost' : 'Found'}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 pl-9 bg-card"
          />
        </div>
      </div>

      {/* Items list */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed border-border">
          <CardContent className="flex flex-col items-center justify-center gap-3 p-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Package className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                No items found
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {searchQuery
                  ? 'Try a different search term'
                  : 'Be the first to report a lost or found item'}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((entry, i) => (
            <Card
              key={entry.id}
              className="border-border transition-all duration-300 hover:shadow-md"
              style={{
                animation: `slide-up 0.4s ease-out ${i * 60}ms both`,
              }}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                      entry.status === 'LOST'
                        ? 'bg-destructive/10 text-destructive'
                        : 'bg-success/10 text-success'
                    )}
                  >
                    <Package className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          entry.status === 'LOST' ? 'destructive' : 'default'
                        }
                        className={cn(
                          entry.status === 'FOUND' &&
                            'bg-success text-success-foreground'
                        )}
                      >
                        {entry.status === 'LOST' ? 'Lost' : 'Found'}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {timeAgo(entry.created_at)}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm font-medium text-foreground">
                      {entry.item_description}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      {entry.bus_number && (
                        <span className="flex items-center gap-1">
                          <BusIcon className="h-3 w-3" />
                          {entry.bus_number}
                        </span>
                      )}
                      {entry.seat_reference && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {entry.seat_reference}
                        </span>
                      )}
                      <a
                        href={`tel:${entry.contact_number}`}
                        className="flex items-center gap-1 font-medium text-primary transition-colors hover:underline"
                      >
                        <Phone className="h-3 w-3" />
                        {entry.contact_number}
                      </a>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
