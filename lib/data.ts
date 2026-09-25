import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import {
  mockRoutes,
  mockBuses,
  mockStaff,
  mockNotices,
  getMockBusesWithRelations,
  getMockSchedulesWithRelations,
} from '@/lib/mock-data';
import type {
  Route,
  Bus,
  Staff,
  Notice,
  BusWithRelations,
  ScheduleWithRelations,
} from '@/lib/types';

export async function getRoutes(): Promise<Route[]> {
  if (!isSupabaseConfigured || !supabase) return mockRoutes;

  const { data, error } = await supabase
    .from('routes')
    .select('*')
    .order('name', { ascending: true });

  if (error || !data || data.length === 0) return mockRoutes;
  return data as Route[];
}

export async function getActiveRoutes(): Promise<Route[]> {
  if (!isSupabaseConfigured || !supabase) {
    return mockRoutes.filter((r) => r.is_active);
  }

  const { data, error } = await supabase
    .from('routes')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error || !data || data.length === 0) {
    return mockRoutes.filter((r) => r.is_active);
  }
  return data as Route[];
}

export async function getBuses(): Promise<BusWithRelations[]> {
  if (!isSupabaseConfigured || !supabase) return getMockBusesWithRelations();

  const { data, error } = await supabase
    .from('buses')
    .select(
      '*, route:routes(*), driver:staffs!buses_driver_id_fkey(*), helper:staffs!buses_helper_id_fkey(*)'
    )
    .order('bus_number', { ascending: true });

  if (error || !data || data.length === 0) return getMockBusesWithRelations();
  return data as BusWithRelations[];
}

export async function getActiveBuses(): Promise<BusWithRelations[]> {
  if (!isSupabaseConfigured || !supabase) {
    return getMockBusesWithRelations().filter((b) => b.status === 'ACTIVE');
  }

  const { data, error } = await supabase
    .from('buses')
    .select(
      '*, route:routes(*), driver:staffs!buses_driver_id_fkey(*), helper:staffs!buses_helper_id_fkey(*)'
    )
    .eq('status', 'ACTIVE')
    .order('bus_number', { ascending: true });

  if (error || !data || data.length === 0) {
    return getMockBusesWithRelations().filter((b) => b.status === 'ACTIVE');
  }
  return data as BusWithRelations[];
}

export async function getStaff(): Promise<Staff[]> {
  if (!isSupabaseConfigured || !supabase) return mockStaff;

  const { data, error } = await supabase
    .from('staffs')
    .select('*')
    .order('full_name', { ascending: true });

  if (error || !data || data.length === 0) return mockStaff;
  return data as Staff[];
}

export async function getVerifiedStaff(): Promise<Staff[]> {
  if (!isSupabaseConfigured || !supabase) {
    return mockStaff.filter((s) => s.is_verified);
  }

  const { data, error } = await supabase
    .from('staffs')
    .select('*')
    .eq('is_verified', true)
    .order('full_name', { ascending: true });

  if (error || !data || data.length === 0) {
    return mockStaff.filter((s) => s.is_verified);
  }
  return data as Staff[];
}

export async function getTodaySchedules(): Promise<ScheduleWithRelations[]> {
  if (!isSupabaseConfigured || !supabase) return getMockSchedulesWithRelations();

  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('daily_schedules')
    .select('*, bus:buses(*), route:routes(*)')
    .eq('schedule_date', today)
    .order('departure_time', { ascending: true });

  if (error || !data || data.length === 0) return getMockSchedulesWithRelations();
  return data as ScheduleWithRelations[];
}

export async function getActiveNotices(): Promise<Notice[]> {
  if (!isSupabaseConfigured || !supabase) {
    return mockNotices.filter((n) => n.is_active);
  }

  const { data, error } = await supabase
    .from('notices')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error || !data || data.length === 0) {
    return mockNotices.filter((n) => n.is_active);
  }
  return data as Notice[];
}

export async function getAllNotices(): Promise<Notice[]> {
  if (!isSupabaseConfigured || !supabase) return mockNotices;

  const { data, error } = await supabase
    .from('notices')
    .select('*')
    .order('created_at', { ascending: false });

  if (error || !data || data.length === 0) return mockNotices;
  return data as Notice[];
}

export { isSupabaseConfigured };
