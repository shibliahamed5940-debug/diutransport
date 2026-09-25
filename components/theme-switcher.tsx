'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  const options = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ] as const;

  if (!mounted) {
    return (
      <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
        {options.map((opt) => (
          <div
            key={opt.value}
            className="flex h-7 w-7 items-center justify-center"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
      {options.map((opt) => {
        const Icon = opt.icon;
        const isActive = theme === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => setTheme(opt.value)}
            aria-label={`${opt.label} theme`}
            title={`${opt.label} theme`}
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-md transition-all',
              isActive
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent'
            )}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}
