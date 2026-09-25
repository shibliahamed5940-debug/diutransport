'use client';

import * as React from 'react';
import { Bus as BusIcon, Route as RouteIcon, Users, CalendarClock, Megaphone, Activity } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { AdminAccessProvider, AdminShell, useAdminShell } from './_admin-shell';
import { AdminRoutesTab } from './_routes-tab';
import { AdminBusesTab } from './_buses-tab';
import { AdminStaffsTab } from './_staffs-tab';
import { AdminRosterTab } from './_roster-tab';
import { AdminNoticesTab } from './_notices-tab';

function AdminContent() {
  const { activeTab } = useAdminShell();

  if (activeTab === 'routes') return <AdminRoutesTab />;
  if (activeTab === 'buses') return <AdminBusesTab />;
  if (activeTab === 'staffs') return <AdminStaffsTab />;
  if (activeTab === 'roster') return <AdminRosterTab />;
  if (activeTab === 'notices') return <AdminNoticesTab />;
  return <AdminOverview />;
}

function AdminOverview() {
  const { setActiveTab } = useAdminShell();

  const stats = [
    { label: 'Total Buses', value: '4', icon: BusIcon, tab: 'buses' as const },
    { label: 'Active Routes', value: '3', icon: RouteIcon, tab: 'routes' as const },
    { label: 'Staff Members', value: '8', icon: Users, tab: 'staffs' as const },
    { label: 'System Status', value: 'Online', icon: Activity, tab: null },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage the DIU Smart Transit fleet system
        </p>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <Card
              key={stat.label}
              className="border-border"
              style={{
                animation: `slide-up 0.4s ease-out ${i * 60}ms both`,
              }}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Icon className="h-4 w-4" />
                  <span className="text-xs font-medium">{stat.label}</span>
                </div>
                <p className="mt-2 text-2xl font-bold text-foreground">
                  {stat.value}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {[
          {
            icon: RouteIcon,
            title: 'Route Configuration',
            description: 'Create and edit bus routes with stoppage points',
            tab: 'routes' as const,
          },
          {
            icon: BusIcon,
            title: 'Fleet Management',
            description: 'Manage buses, assignments, and maintenance status',
            tab: 'buses' as const,
          },
          {
            icon: Users,
            title: 'Staff Management',
            description: 'Manage drivers and helpers with contact details',
            tab: 'staffs' as const,
          },
          {
            icon: CalendarClock,
            title: 'Daily Roster',
            description: 'Assign buses, drivers, and helpers to time slots',
            tab: 'roster' as const,
          },
          {
            icon: Megaphone,
            title: 'Notice Publisher',
            description: 'Publish announcements tagged to routes and buses',
            tab: 'notices' as const,
          },
        ].map((section, i) => {
          const Icon = section.icon;
          return (
            <Card
              key={section.title}
              className="group cursor-pointer border-border transition-all duration-300 hover:shadow-md"
              style={{
                animation: `slide-up 0.4s ease-out ${i * 80}ms both`,
              }}
              onClick={() => setActiveTab(section.tab)}
            >
              <CardContent className="p-5">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-110">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-foreground">
                  {section.title}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {section.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <AdminAccessProvider>
      <AdminShell>
        <AdminContent />
      </AdminShell>
    </AdminAccessProvider>
  );
}
