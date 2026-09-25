/*
# Create DIU Smart Transit Database Schema

Creates 6 tables, an admin-check helper function, and RLS policies.

## Tables
1. profiles — Maps to auth.users. Role: STUDENT, DRIVER, HELPER, ADMIN.
2. routes — Bus routes with stops, distance, active flag.
3. buses — Fleet buses with GPS coords, status, assigned driver/helper.
4. staffs — Drivers and helpers with verification status.
5. daily_schedules — Per-day schedule entries linking buses to routes.
6. notices — Transit announcements with type and active flag.

Note: buses and staffs have a circular FK (buses.driver_id -> staffs, staffs.assigned_bus_id -> buses).
buses is created first without staff FKs, then staffs is created, then buses FKs to staffs are added via ALTER TABLE.

## Security
- is_admin() function: SECURITY DEFINER, checks profiles.role = 'ADMIN'.
- RLS on all tables.
- Public reads: anon + authenticated can SELECT all tables.
- Admin writes: Only role = 'ADMIN' can INSERT/UPDATE/DELETE.
- Self-service: Users can INSERT/UPDATE their own profile row.
*/

-- =========================================================
-- 1. profiles
-- =========================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'STUDENT' CHECK (role IN ('STUDENT', 'DRIVER', 'HELPER', 'ADMIN')),
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- 2. routes
-- =========================================================
CREATE TABLE IF NOT EXISTS public.routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  start_point text NOT NULL,
  end_point text NOT NULL,
  stops text[] NOT NULL DEFAULT '{}',
  distance_km numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- 3. buses (without staff FKs — added later via ALTER)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.buses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bus_number text UNIQUE NOT NULL,
  route_id uuid REFERENCES public.routes(id) ON DELETE SET NULL,
  capacity integer NOT NULL DEFAULT 40,
  current_lat numeric,
  current_lng numeric,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'MAINTENANCE', 'OFFLINE')),
  driver_id uuid,
  helper_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- 4. staffs (FK to buses works — buses already exists)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.staffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('DRIVER', 'HELPER')),
  phone text NOT NULL DEFAULT '',
  license_number text,
  is_verified boolean NOT NULL DEFAULT false,
  assigned_bus_id uuid REFERENCES public.buses(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Now add the buses -> staffs FK constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'buses_driver_id_fkey' AND table_name = 'buses'
  ) THEN
    ALTER TABLE public.buses
      ADD CONSTRAINT buses_driver_id_fkey
      FOREIGN KEY (driver_id) REFERENCES public.staffs(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'buses_helper_id_fkey' AND table_name = 'buses'
  ) THEN
    ALTER TABLE public.buses
      ADD CONSTRAINT buses_helper_id_fkey
      FOREIGN KEY (helper_id) REFERENCES public.staffs(id) ON DELETE SET NULL;
  END IF;
END $$;

-- =========================================================
-- 5. daily_schedules
-- =========================================================
CREATE TABLE IF NOT EXISTS public.daily_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bus_id uuid NOT NULL REFERENCES public.buses(id) ON DELETE CASCADE,
  route_id uuid NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  departure_time time NOT NULL,
  arrival_time time NOT NULL,
  schedule_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'DEPARTED', 'ARRIVED', 'CANCELLED')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- 6. notices
-- =========================================================
CREATE TABLE IF NOT EXISTS public.notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'INFO' CHECK (type IN ('INFO', 'WARNING', 'SUCCESS', 'EMERGENCY')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- Helper function: is_admin()
-- =========================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'ADMIN'
  );
$$;

-- =========================================================
-- Enable RLS on all tables
-- =========================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- profiles policies
-- =========================================================
DROP POLICY IF EXISTS "public_select_profiles" ON public.profiles;
CREATE POLICY "public_select_profiles" ON public.profiles
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "self_insert_profile" ON public.profiles;
CREATE POLICY "self_insert_profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "self_update_profile" ON public.profiles;
CREATE POLICY "self_update_profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "admin_update_profile" ON public.profiles;
CREATE POLICY "admin_update_profile" ON public.profiles
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_delete_profile" ON public.profiles;
CREATE POLICY "admin_delete_profile" ON public.profiles
  FOR DELETE TO authenticated USING (public.is_admin());

-- =========================================================
-- routes policies
-- =========================================================
DROP POLICY IF EXISTS "public_select_routes" ON public.routes;
CREATE POLICY "public_select_routes" ON public.routes
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "admin_insert_routes" ON public.routes;
CREATE POLICY "admin_insert_routes" ON public.routes
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_update_routes" ON public.routes;
CREATE POLICY "admin_update_routes" ON public.routes
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_delete_routes" ON public.routes;
CREATE POLICY "admin_delete_routes" ON public.routes
  FOR DELETE TO authenticated USING (public.is_admin());

-- =========================================================
-- staffs policies
-- =========================================================
DROP POLICY IF EXISTS "public_select_staffs" ON public.staffs;
CREATE POLICY "public_select_staffs" ON public.staffs
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "admin_insert_staffs" ON public.staffs;
CREATE POLICY "admin_insert_staffs" ON public.staffs
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_update_staffs" ON public.staffs;
CREATE POLICY "admin_update_staffs" ON public.staffs
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_delete_staffs" ON public.staffs;
CREATE POLICY "admin_delete_staffs" ON public.staffs
  FOR DELETE TO authenticated USING (public.is_admin());

-- =========================================================
-- buses policies
-- =========================================================
DROP POLICY IF EXISTS "public_select_buses" ON public.buses;
CREATE POLICY "public_select_buses" ON public.buses
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "admin_insert_buses" ON public.buses;
CREATE POLICY "admin_insert_buses" ON public.buses
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_update_buses" ON public.buses;
CREATE POLICY "admin_update_buses" ON public.buses
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_delete_buses" ON public.buses;
CREATE POLICY "admin_delete_buses" ON public.buses
  FOR DELETE TO authenticated USING (public.is_admin());

-- =========================================================
-- daily_schedules policies
-- =========================================================
DROP POLICY IF EXISTS "public_select_schedules" ON public.daily_schedules;
CREATE POLICY "public_select_schedules" ON public.daily_schedules
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "admin_insert_schedules" ON public.daily_schedules;
CREATE POLICY "admin_insert_schedules" ON public.daily_schedules
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_update_schedules" ON public.daily_schedules;
CREATE POLICY "admin_update_schedules" ON public.daily_schedules
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_delete_schedules" ON public.daily_schedules;
CREATE POLICY "admin_delete_schedules" ON public.daily_schedules
  FOR DELETE TO authenticated USING (public.is_admin());

-- =========================================================
-- notices policies
-- =========================================================
DROP POLICY IF EXISTS "public_select_notices" ON public.notices;
CREATE POLICY "public_select_notices" ON public.notices
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "admin_insert_notices" ON public.notices;
CREATE POLICY "admin_insert_notices" ON public.notices
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_update_notices" ON public.notices;
CREATE POLICY "admin_update_notices" ON public.notices
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_delete_notices" ON public.notices;
CREATE POLICY "admin_delete_notices" ON public.notices
  FOR DELETE TO authenticated USING (public.is_admin());

-- =========================================================
-- Indexes
-- =========================================================
CREATE INDEX IF NOT EXISTS idx_buses_route_id ON public.buses(route_id);
CREATE INDEX IF NOT EXISTS idx_buses_status ON public.buses(status);
CREATE INDEX IF NOT EXISTS idx_schedules_bus_id ON public.daily_schedules(bus_id);
CREATE INDEX IF NOT EXISTS idx_schedules_route_id ON public.daily_schedules(route_id);
CREATE INDEX IF NOT EXISTS idx_schedules_date ON public.daily_schedules(schedule_date);
CREATE INDEX IF NOT EXISTS idx_notices_active ON public.notices(is_active);
CREATE INDEX IF NOT EXISTS idx_routes_active ON public.routes(is_active);
CREATE INDEX IF NOT EXISTS idx_staffs_assigned_bus ON public.staffs(assigned_bus_id);

-- =========================================================
-- updated_at trigger
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY['profiles', 'routes', 'buses', 'staffs', 'daily_schedules', 'notices'])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON public.%I', tbl);
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at()', tbl);
  END LOOP;
END;
$$;
