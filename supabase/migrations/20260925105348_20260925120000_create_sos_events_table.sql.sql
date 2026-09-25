/*
# Create sos_events table for Emergency SOS Alert System

Stores emergency alerts triggered by passengers via the SOS button.

## Tables
1. sos_events
   - id (uuid, primary key)
   - bus_id (uuid, FK to buses, nullable — the bus the passenger was on)
   - lat (numeric, nullable — passenger's latitude at time of alert)
   - lng (numeric, nullable — passenger's longitude at time of alert)
   - message (text, nullable — optional incident description)
   - status (text, not null, default 'PENDING_ASSISTANCE' — CHECK constraint for valid statuses)
   - session_id (text, not null — anonymous browser session identifier)
   - resolved_at (timestamptz, nullable — when the alert was resolved)
   - created_at (timestamptz, defaults to now())
   - updated_at (timestamptz, defaults to now())

## Security
- RLS enabled on sos_events.
- Public reads: anon + authenticated can SELECT (so control room can see all alerts).
- Public inserts: anon + authenticated can INSERT (passengers can send SOS without sign-in).
- No UPDATE or DELETE policies — alerts are append-only from the client; resolution is server-side.

## Notes
1. No user_id column — this app has no sign-in screen, so alerts are anonymous.
2. session_id is a client-generated random ID used only to associate alerts from the same browser session. It contains no personal information.
3. status values: PENDING_ASSISTANCE, DISPATCHED, RESOLVED, CANCELLED.
*/

CREATE TABLE IF NOT EXISTS public.sos_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bus_id uuid REFERENCES public.buses(id) ON DELETE SET NULL,
  lat numeric,
  lng numeric,
  message text,
  status text NOT NULL DEFAULT 'PENDING_ASSISTANCE' CHECK (status IN ('PENDING_ASSISTANCE', 'DISPATCHED', 'RESOLVED', 'CANCELLED')),
  session_id text NOT NULL DEFAULT '',
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sos_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_select_sos_events" ON public.sos_events;
CREATE POLICY "public_select_sos_events" ON public.sos_events
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_insert_sos_events" ON public.sos_events;
CREATE POLICY "public_insert_sos_events" ON public.sos_events
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_sos_events_status ON public.sos_events(status);
CREATE INDEX IF NOT EXISTS idx_sos_events_created_at ON public.sos_events(created_at);
CREATE INDEX IF NOT EXISTS idx_sos_events_bus_id ON public.sos_events(bus_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_name = 'set_updated_at' AND event_object_table = 'sos_events'
  ) THEN
    CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.sos_events
      FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;
