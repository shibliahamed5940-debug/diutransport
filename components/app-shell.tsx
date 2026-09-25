'use client';

import * as React from 'react';
import { MobileNav } from '@/components/navigation';
import { NoticeBoardStrip } from '@/components/notice-board-strip';
import { FloatingSOSButton } from '@/components/floating-sos-button';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <NoticeBoardStrip />
      {children}
      <FloatingSOSButton />
      <MobileNav />
      <div className="h-16 md:hidden" />
    </div>
  );
}
