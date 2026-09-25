'use client';

import * as React from 'react';
import { Bus } from 'lucide-react';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { LiveStatusIndicator } from '@/components/live-status-indicator';
import { DesktopNav, InstallAppButton } from '@/components/navigation';

export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-card/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Bus className="h-4 w-4" />
          </div>
          <span className="whitespace-nowrap text-base font-medium tracking-tight text-foreground">
            DIU Smart Transit
          </span>
        </div>

        <div className="flex items-center gap-3">
          <DesktopNav />
          <div className="hidden sm:block">
            <LiveStatusIndicator />
          </div>
          <InstallAppButton />
          <ThemeSwitcher />
        </div>
      </div>
    </header>
  );
}
