/*
# Create lost_and_found table

Adds a new table to store Lost & Found item reports submitted by passengers.

## Tables
1. lost_and_found
   - id (uuid, primary key)
   - item_description (text, not null — name/description of the lost or found item)
   - bus_id (uuid, FK to buses, nullable — the bus the item was lost/found on)
   - seat_reference (text, nullable — seat number or location reference)
   - contact_number (text, not null — phone number to reach the reporter)
   - status (text, not null, default 'LOST' — CHECK constraint: 'LOST' or 'FOUND')
   - created_at (timestamptz, defaults to now())
   - updated_at (timestamptz, defaults to now())

## Security
- RLS enabled on lost_and_found.
- Public reads: anon + authenticated can SELECT (all users can browse lost & found items).
- Public inserts: anon + authenticated can INSERT (passengers can report items without sign-in).
- Public updates: anon + authenticated can UPDATE (to mark items as resolved/claimed).
- No DELETE policy — reports are retained for records.

## Notes
1. No user_id column — this app has no sign-in screen, so reports are anonymous.
2. contact_number is the only way to reach the reporter; it is intentionally public.
3. status values: LOST, FOUND.
*/

CREATE TABLE IF NOT EXISTS public.lost_and_found (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_description text NOT NULL,
  bus_id uuid REFERENCES public.buses(id) ON DELETE SET NULL,
  seat_reference text,
  contact_number text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'LOST' CHECK (status IN ('LOST', 'FOUND')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lost_and_found ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_select_lost_and_found" ON public.lost_and_found;
CREATE POLICY "public_select_lost_and_found" ON public.lost_and_found
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_insert_lost_and_found" ON public.lost_and_found;
CREATE POLICY "public_insert_lost_and_found" ON public.lost_and_found
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "public_update_lost_and_found" ON public.lost_and_found;
CREATE POLICY "public_update_lost_and_found" ON public.lost_and_found
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_lost_and_found_status ON public.lost_and_found(status);
CREATE INDEX IF NOT EXISTS idx_lost_and_found_bus_id ON public.lost_and_found(bus_id);
CREATE INDEX IF NOT EXISTS idx_lost_and_found_created_at ON public.lost_and_found(created_at);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_name = 'set_updated_at' AND event_object_table = 'lost_and_found'
  ) THEN
    CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.lost_and_found
      FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;
