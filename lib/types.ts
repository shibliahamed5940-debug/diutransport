export type UserRole = 'STUDENT' | 'DRIVER' | 'HELPER' | 'ADMIN';

export type BusStatus = 'ACTIVE' | 'MAINTENANCE' | 'OFFLINE';

export type StaffRole = 'DRIVER' | 'HELPER';

export type ScheduleStatus = 'SCHEDULED' | 'DEPARTED' | 'ARRIVED' | 'CANCELLED';

export type NoticeType = 'INFO' | 'WARNING' | 'SUCCESS' | 'EMERGENCY';

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface Route {
  id: string;
  name: string;
  code: string;
  start_point: string;
  end_point: string;
  stops: string[];
  distance_km: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Bus {
  id: string;
  bus_number: string;
  route_id: string | null;
  capacity: number;
  current_lat: number | null;
  current_lng: number | null;
  status: BusStatus;
  driver_id: string | null;
  helper_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Staff {
  id: string;
  full_name: string;
  role: StaffRole;
  phone: string;
  license_number: string | null;
  is_verified: boolean;
  assigned_bus_id: string | null;
  created_at: string;
  updated_at: string;
}

export type LocationSource = 'driver' | 'crowd' | 'waiting';

export interface DailySchedule {
  id: string;
  bus_id: string;
  route_id: string;
  departure_time: string;
  arrival_time: string;
  schedule_date: string;
  status: ScheduleStatus;
  notes: string | null;
  live_lat: number | null;
  live_lng: number | null;
  location_source: LocationSource | null;
  last_ping: string | null;
  created_at: string;
  updated_at: string;
}

export interface Notice {
  id: string;
  title: string;
  message: string;
  type: NoticeType;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BusWithRelations extends Bus {
  route?: Route | null;
  driver?: Staff | null;
  helper?: Staff | null;
}

export interface ScheduleWithRelations extends DailySchedule {
  bus?: Bus | null;
  route?: Route | null;
}

export interface CrowdPing {
  id: string;
  bus_id: string | null;
  lat: number;
  lng: number;
  accuracy: number | null;
  speed: number | null;
  session_id: string;
  created_at: string;
}

export type LostFoundStatus = 'LOST' | 'FOUND';

export interface LostFoundItem {
  id: string;
  item_description: string;
  bus_id: string | null;
  seat_reference: string | null;
  contact_number: string;
  status: LostFoundStatus;
  created_at: string;
  updated_at: string;
}

export type SosStatus = 'PENDING_ASSISTANCE' | 'DISPATCHED' | 'RESOLVED' | 'CANCELLED';

export interface SosEvent {
  id: string;
  bus_id: string | null;
  lat: number | null;
  lng: number | null;
  message: string | null;
  status: SosStatus;
  session_id: string;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}
