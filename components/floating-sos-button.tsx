'use client';

import * as React from 'react';
import { Siren } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export function FloatingSOSButton() {
  const pathname = usePathname();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  if (!mounted || pathname === '/sos') return null;

  return (
    <Link
      href="/sos"
      className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-lg transition-transform duration-300 hover:scale-110 active:scale-95 md:bottom-6 md:right-6"
      aria-label="SOS Emergency"
    >
      <span className="absolute inset-0 animate-pulse-ring rounded-full bg-destructive" />
      <Siren className="relative h-6 w-6" />
    </Link>
  );
}
