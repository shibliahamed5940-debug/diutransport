/*
# Create crowd_pings table for Passenger Location Sharing

Adds a new table to store anonymized passenger location pings when riders opt in
to share their GPS position while on a bus.

## Tables
1. crowd_pings
   - id (uuid, primary key)
   - bus_id (uuid, FK to buses, nullable — links ping to a specific bus)
   - lat (numeric, not null — latitude)
   - lng (numeric, not null — longitude)
   - accuracy (numeric, nullable — GPS accuracy in meters)
   - speed (numeric, nullable — speed in km/h)
   - session_id (text, not null — anonymous browser session identifier, no personal data)
   - created_at (timestamptz, defaults to now())

## Security
- RLS enabled on crowd_pings.
- Public reads: anon + authenticated can SELECT (so the system can aggregate crowd density).
- Public inserts: anon + authenticated can INSERT (passengers share location without sign-in).
- No UPDATE or DELETE policies — pings are append-only by design.

## Notes
1. No user_id column — this app has no sign-in screen, so pings are anonymous.
2. session_id is a client-generated random ID used only to deduplicate pings from the same browser session. It contains no personal information.
3. Pings are append-only; no UPDATE or DELETE policies are created.
*/

CREATE TABLE IF NOT EXISTS public.crowd_pings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bus_id uuid REFERENCES public.buses(id) ON DELETE SET NULL,
  lat numeric NOT NULL,
  lng numeric NOT NULL,
  accuracy numeric,
  speed numeric,
  session_id text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.crowd_pings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_select_crowd_pings" ON public.crowd_pings;
CREATE POLICY "public_select_crowd_pings" ON public.crowd_pings
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_insert_crowd_pings" ON public.crowd_pings;
CREATE POLICY "public_insert_crowd_pings" ON public.crowd_pings
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_crowd_pings_bus_id ON public.crowd_pings(bus_id);
CREATE INDEX IF NOT EXISTS idx_crowd_pings_created_at ON public.crowd_pings(created_at);
