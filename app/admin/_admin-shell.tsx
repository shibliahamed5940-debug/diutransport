'use client';

import * as React from 'react';
import {
  Shield,
  LayoutDashboard,
  Route as RouteIcon,
  Bus as BusIcon,
  Users,
  CalendarClock,
  Megaphone,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AdminAccessProvider, useAdminAccess } from './_admin-access';

type AdminTab = 'overview' | 'routes' | 'buses' | 'staffs' | 'roster' | 'notices';

const navItems: { id: AdminTab; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'routes', label: 'Routes', icon: RouteIcon },
  { id: 'buses', label: 'Buses', icon: BusIcon },
  { id: 'staffs', label: 'Staffs', icon: Users },
  { id: 'roster', label: 'Daily Roster', icon: CalendarClock },
  { id: 'notices', label: 'Notices', icon: Megaphone },
];

interface AdminShellContextValue {
  activeTab: AdminTab;
  setActiveTab: (tab: AdminTab) => void;
}

const AdminShellContext = React.createContext<AdminShellContextValue | null>(null);

export function useAdminShell() {
  const ctx = React.useContext(AdminShellContext);
  if (!ctx) throw new Error('useAdminShell must be used within AdminShell');
  return ctx;
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [activeTab, setActiveTab] = React.useState<AdminTab>('overview');
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  const { logout } = useAdminAccess();

  return (
    <AdminShellContext.Provider value={{ activeTab, setActiveTab }}>
      <div className="flex min-h-[calc(100vh-3.5rem)]">
        {/* Desktop sidebar */}
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 border-r border-border bg-card md:block">
          <div className="flex h-full flex-col">
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Shield className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-bold leading-tight text-foreground">
                  Admin Panel
                </p>
                <p className="text-[10px] leading-tight text-muted-foreground">
                  Fleet Management
                </p>
              </div>
            </div>

            <nav className="flex-1 space-y-1 p-3">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </button>
                );
              })}
            </nav>

            <div className="border-t border-border p-3">
              <button
                onClick={logout}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut className="h-4 w-4" />
                Exit Admin
              </button>
            </div>
          </div>
        </aside>

        {/* Mobile header + nav */}
        <div className="flex-1 md:hidden">
          <div className="sticky top-14 z-30 border-b border-border bg-card/95 backdrop-blur-md">
            <div className="flex items-center justify-between px-4 py-2.5">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">
                  Admin Panel
                </span>
              </div>
              <button
                onClick={() => setMobileNavOpen((v) => !v)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground"
              >
                {mobileNavOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </button>
            </div>
            {mobileNavOpen && (
              <nav className="space-y-1 border-t border-border p-3 animate-fade-in">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id);
                        setMobileNavOpen(false);
                      }}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </button>
                  );
                })}
                <button
                  onClick={logout}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
                >
                  <LogOut className="h-4 w-4" />
                  Exit Admin
                </button>
              </nav>
            )}
          </div>
        </div>

        {/* Main content */}
        <main className="flex-1 overflow-x-hidden p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </AdminShellContext.Provider>
  );
}

export { AdminAccessProvider };
