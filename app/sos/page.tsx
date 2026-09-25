'use client';

import * as React from 'react';
import { Siren, Phone, MapPin, TriangleAlert as AlertTriangle, Send, X, CircleCheck as CheckCircle2, Navigation, Loader as Loader2 } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { getMockBusesWithRelations } from '@/lib/mock-data';

const HOTLINES = [
  { label: 'DIU Transport Control Room', phone: '+8809677444555' },
  { label: 'Campus Security', phone: '+8801712345678' },
  { label: 'Emergency Hotline', phone: '999' },
];

function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  const KEY = 'diu-transit-session-id';
  let id = window.localStorage.getItem(KEY);
  if (!id) {
    id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(KEY, id);
  }
  return id;
}

type AlertPhase = 'idle' | 'confirming' | 'sending' | 'active' | 'error';

export default function SOSPage() {
  const [phase, setPhase] = React.useState<AlertPhase>('idle');
  const [message, setMessage] = React.useState('');
  const [location, setLocation] = React.useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [locationStatus, setLocationStatus] = React.useState<
    'idle' | 'acquiring' | 'acquired' | 'denied'
  >('idle');
  const [selectedBusId, setSelectedBusId] = React.useState<string | null>(null);
  const [incidentMsg, setIncidentMsg] = React.useState('');
  const [reportSent, setReportSent] = React.useState(false);
  const [reportSending, setReportSending] = React.useState(false);

  const buses = React.useMemo(() => getMockBusesWithRelations(), []);

  // Acquire location on mount
  React.useEffect(() => {
    if (!('geolocation' in navigator)) return;
    setLocationStatus('acquiring');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationStatus('acquired');
      },
      () => {
        setLocationStatus('denied');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const handleSosClick = () => {
    setPhase('confirming');
  };

  const handleConfirmSos = async () => {
    setPhase('sending');

    // Try to get fresh location if we don't have it
    let coords = location;
    if (!coords && 'geolocation' in navigator) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 8000,
          });
        });
        coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setLocation(coords);
        setLocationStatus('acquired');
      } catch {
        setLocationStatus('denied');
      }
    }

    const sessionId = getSessionId();

    let insertError = false;
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('sos_events').insert({
        bus_id: selectedBusId,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        message: message || null,
        status: 'PENDING_ASSISTANCE',
        session_id: sessionId,
      });
      insertError = !!error;
    }

    if (insertError) {
      setPhase('error');
    } else {
      setPhase('active');
    }
  };

  const handleCancelSos = () => {
    setPhase('idle');
    setMessage('');
  };

  const handleCancelActive = () => {
    setPhase('idle');
    setMessage('');
  };

  const handleSendReport = async () => {
    if (!incidentMsg.trim()) return;
    setReportSending(true);

    const sessionId = getSessionId();

    if (isSupabaseConfigured && supabase) {
      await supabase.from('sos_events').insert({
        bus_id: selectedBusId,
        lat: location?.lat ?? null,
        lng: location?.lng ?? null,
        message: incidentMsg,
        status: 'PENDING_ASSISTANCE',
        session_id: sessionId,
      });
    }

    setReportSending(false);
    setReportSent(true);
    setIncidentMsg('');
    setTimeout(() => setReportSent(false), 5000);
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          SOS Emergency
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Send an emergency alert to the transit control center
        </p>
      </div>

      {/* Error banner */}
      {phase === 'error' && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 animate-fade-in">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-destructive">
              Failed to send alert
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Could not reach the server. Please call a hotline directly.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPhase('idle')}
            className="shrink-0"
          >
            Retry
          </Button>
        </div>
      )}

      {/* Active pulsating alert banner */}
      {phase === 'active' && (
        <div className="mb-6 overflow-hidden rounded-lg border-2 border-destructive animate-fade-in">
          <div className="bg-destructive/10 p-4">
            <div className="flex items-center gap-3">
              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-destructive text-destructive-foreground">
                <span className="absolute inset-0 animate-pulse-ring rounded-full bg-destructive" />
                <Siren className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-destructive">
                  EMERGENCY ALERT ACTIVE
                </p>
                <p className="text-xs text-muted-foreground">
                  Status: Pending Assistance — Control room has been notified
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancelActive}
                className="shrink-0"
              >
                Cancel Alert
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Emergency alert button */}
      <Card
        className={cn(
          'mb-6 animate-fade-in transition-all',
          phase === 'active'
            ? 'border-destructive/40 bg-destructive/5'
            : 'border-destructive/30'
        )}
      >
        <CardContent className="p-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <button
              className="group relative flex h-32 w-32 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-lg transition-transform duration-300 hover:scale-105 active:scale-95"
              onClick={handleSosClick}
              disabled={phase === 'active' || phase === 'sending'}
            >
              <span className="absolute inset-0 animate-pulse-ring rounded-full bg-destructive" />
              <span className="relative flex flex-col items-center gap-1">
                {phase === 'sending' ? (
                  <Loader2 className="h-10 w-10 animate-spin" />
                ) : (
                  <Siren className="h-10 w-10" />
                )}
                <span className="text-sm font-bold uppercase tracking-wide">
                  SOS
                </span>
              </span>
            </button>
            <p className="text-sm text-muted-foreground">
              Tap to send an emergency alert with your current location
            </p>

            {/* Location status */}
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-1.5">
              {locationStatus === 'acquiring' && (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    Acquiring GPS location…
                  </span>
                </>
              )}
              {locationStatus === 'acquired' && location && (
                <>
                  <MapPin className="h-3.5 w-3.5 text-success" />
                  <span className="text-xs font-medium text-foreground tabular-nums">
                    {location.lat.toFixed(4)}°, {location.lng.toFixed(4)}°
                  </span>
                </>
              )}
              {locationStatus === 'denied' && (
                <>
                  <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                  <span className="text-xs text-muted-foreground">
                    Location access denied — alert will send without coordinates
                  </span>
                </>
              )}
              {locationStatus === 'idle' && (
                <>
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    Waiting for GPS…
                  </span>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Hotline numbers */}
      <div className="mb-6">
        <div className="mb-3 flex items-center gap-2">
          <Phone className="h-4 w-4 text-destructive" />
          <h2 className="text-sm font-semibold text-foreground">
            DIU Transport Control Room — Hotlines
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {HOTLINES.map((hotline) => (
            <a
              key={hotline.phone}
              href={`tel:${hotline.phone}`}
              className="group flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-all duration-200 hover:border-destructive/30 hover:shadow-md"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive transition-transform group-hover:scale-110">
                <Phone className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-foreground">
                  {hotline.label}
                </p>
                <p className="text-sm font-bold text-destructive tabular-nums">
                  {hotline.phone}
                </p>
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Bus selector + status */}
        <Card className="border-border transition-all duration-300 hover:shadow-md">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Navigation className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">Your Bus</CardTitle>
                <CardDescription className="text-xs">
                  Select which bus you&apos;re on
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {buses
                .filter((b) => b.status === 'ACTIVE')
                .map((bus) => (
                  <button
                    key={bus.id}
                    onClick={() =>
                      setSelectedBusId(
                        selectedBusId === bus.id ? null : bus.id
                      )
                    }
                    className={cn(
                      'rounded-lg border px-3 py-1.5 text-sm font-medium transition-all',
                      selectedBusId === bus.id
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-card text-foreground hover:border-primary/40'
                    )}
                  >
                    {bus.bus_number}
                  </button>
                ))}
            </div>
            {selectedBusId && (
              <p className="mt-2 text-xs text-muted-foreground">
                Bus{' '}
                {buses.find((b) => b.id === selectedBusId)?.bus_number} will be
                included in the alert
              </p>
            )}
          </CardContent>
        </Card>

        {/* Report Incident */}
        <Card className="border-border transition-all duration-300 hover:shadow-md">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">Report Incident</CardTitle>
                <CardDescription className="text-xs">
                  Send a detailed report
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Describe the incident..."
              value={incidentMsg}
              onChange={(e) => setIncidentMsg(e.target.value)}
              className="mb-3 resize-none"
              rows={3}
            />
            <Button
              className="w-full"
              variant="outline"
              onClick={handleSendReport}
              disabled={!incidentMsg.trim() || reportSending}
            >
              {reportSending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : reportSent ? (
                <CheckCircle2 className="mr-2 h-4 w-4 text-success" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              {reportSent ? 'Report Sent' : 'Send Report'}
            </Button>
            {reportSent && (
              <p className="mt-2 text-center text-xs font-medium text-success animate-fade-in">
                Incident report submitted. Control room notified.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Confirmation dialog */}
      <AlertDialog
        open={phase === 'confirming'}
        onOpenChange={(open) => {
          if (!open) handleCancelSos();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Siren className="h-5 w-5 text-destructive" />
              Confirm Emergency Alert
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will send an emergency alert to the DIU Transport Control
              Room with your current location
              {selectedBusId &&
                ` and bus ${
                  buses.find((b) => b.id === selectedBusId)?.bus_number
                }`}
              . Only use this in a real emergency.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {location && (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
              <MapPin className="h-4 w-4 text-success" />
              <span className="text-xs font-medium text-foreground tabular-nums">
                {location.lat.toFixed(4)}°, {location.lng.toFixed(4)}°
              </span>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmSos}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Siren className="mr-2 h-4 w-4" />
              Send Alert
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
