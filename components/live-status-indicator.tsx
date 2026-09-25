'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export function LiveStatusIndicator() {
  return (
    <div className="flex items-center gap-2">
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-success" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
      </span>
      <span className="text-xs font-medium text-muted-foreground">
        Live
      </span>
    </div>
  );
}
