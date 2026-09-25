'use client';

import * as React from 'react';
import { Shield, Lock, ArrowRight, KeyRound } from 'lucide-react';
import { cn } from '@/lib/utils';

const ADMIN_PASSKEY = 'diu-admin';
const STORAGE_KEY = 'diu-admin-access';

interface AdminAccessContextValue {
  authorized: boolean;
  authorize: (key: string) => boolean;
  logout: () => void;
}

const AdminAccessContext = React.createContext<AdminAccessContextValue | null>(null);

export function useAdminAccess() {
  const ctx = React.useContext(AdminAccessContext);
  if (!ctx) throw new Error('useAdminAccess must be used within AdminAccessProvider');
  return ctx;
}

export function AdminAccessProvider({ children }: { children: React.ReactNode }) {
  const [authorized, setAuthorized] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    if (stored === 'true') setAuthorized(true);
  }, []);

  const authorize = React.useCallback((key: string) => {
    if (key.trim().toLowerCase() === ADMIN_PASSKEY) {
      setAuthorized(true);
      window.sessionStorage.setItem(STORAGE_KEY, 'true');
      return true;
    }
    return false;
  }, []);

  const logout = React.useCallback(() => {
    setAuthorized(false);
    window.sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  if (!mounted) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!authorized) {
    return <AdminGate onAuthorize={authorize} />;
  }

  return (
    <AdminAccessContext.Provider value={{ authorized, authorize, logout }}>
      {children}
    </AdminAccessContext.Provider>
  );
}

function AdminGate({ onAuthorize }: { onAuthorize: (key: string) => boolean }) {
  const [key, setKey] = React.useState('');
  const [error, setError] = React.useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onAuthorize(key)) {
      setError(true);
      setKey('');
    }
  };

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4">
      <div className="w-full animate-fade-in">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Shield className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Admin Access
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter the admin passkey to manage the transit system
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="password"
              value={key}
              onChange={(e) => {
                setKey(e.target.value);
                setError(false);
              }}
              placeholder="Enter passkey"
              autoFocus
              className={cn(
                'h-11 w-full rounded-lg border bg-card pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring',
                error ? 'border-destructive' : 'border-border'
              )}
            />
          </div>
          {error && (
            <p className="text-xs font-medium text-destructive animate-fade-in">
              Invalid passkey. Try again.
            </p>
          )}
          <button
            type="submit"
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Unlock Admin
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-3">
          <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            Demo passkey: <span className="font-mono font-semibold text-foreground">diu-admin</span>
          </p>
        </div>
      </div>
    </div>
  );
}
