'use client';

import * as React from 'react';
import { Bell, TriangleAlert as AlertTriangle, Info, CircleCheck as CheckCircle2, ChevronRight, X, Megaphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Notice, NoticeType } from '@/lib/types';
import { mockNotices } from '@/lib/mock-data';

type FilterTag = 'all' | 'urgent' | 'general';

interface NoticeBoardStripProps {
  notices?: Notice[];
}

const typeConfig: Record<
  NoticeType,
  {
    icon: React.ElementType;
    color: string;
    bg: string;
    border: string;
    label: string;
  }
> = {
  INFO: {
    icon: Info,
    color: 'text-primary',
    bg: 'bg-primary/10',
    border: 'border-primary/20',
    label: 'Info',
  },
  WARNING: {
    icon: AlertTriangle,
    color: 'text-amber-600',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    label: 'Urgent',
  },
  SUCCESS: {
    icon: CheckCircle2,
    color: 'text-success',
    bg: 'bg-success/10',
    border: 'border-success/20',
    label: 'General',
  },
  EMERGENCY: {
    icon: AlertTriangle,
    color: 'text-destructive',
    bg: 'bg-destructive/10',
    border: 'border-destructive/20',
    label: 'Urgent',
  },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function classifyNotice(type: NoticeType): 'urgent' | 'general' {
  return type === 'WARNING' || type === 'EMERGENCY' ? 'urgent' : 'general';
}

export function NoticeBoardStrip({ notices }: NoticeBoardStripProps) {
  const [expanded, setExpanded] = React.useState(false);
  const [filter, setFilter] = React.useState<FilterTag>('all');
  const [dismissed, setDismissed] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  const allNotices = React.useMemo<Notice[]>(() => {
    return (notices ?? mockNotices).filter((n) => n.is_active);
  }, [notices]);

  const filtered = React.useMemo(() => {
    if (filter === 'all') return allNotices;
    return allNotices.filter((n) => classifyNotice(n.type) === filter);
  }, [allNotices, filter]);

  const latest = allNotices[0] ?? null;

  if (!mounted || dismissed || allNotices.length === 0) return null;

  const latestConfig = latest ? typeConfig[latest.type] : null;

  if (!expanded) {
    return (
      <div className="sticky top-14 z-30 border-b border-border bg-card/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 sm:px-6">
          {latestConfig && latest && (
            <>
              <div
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
                  latestConfig.bg,
                  latestConfig.color
                )}
              >
                <latestConfig.icon className="h-3.5 w-3.5" />
              </div>
              <p className="flex-1 truncate text-xs font-medium text-foreground sm:text-sm">
                {latest.title}
                <span className="ml-2 hidden text-muted-foreground sm:inline">
                  — {latest.message.slice(0, 60)}
                  {latest.message.length > 60 ? '…' : ''}
                </span>
              </p>
              <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
                {timeAgo(latest.created_at)}
              </span>
              <button
                onClick={() => setExpanded(true)}
                className="flex shrink-0 items-center gap-0.5 rounded-md px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-accent"
              >
                View all
                <ChevronRight className="h-3 w-3" />
              </button>
              <button
                onClick={() => setDismissed(true)}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="sticky top-14 z-30 border-b border-border bg-card/95 shadow-sm backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 py-1 sm:px-6">
        {/* Header row */}
        <div className="flex items-center justify-between gap-3 py-2.5">
          <div className="flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">
              Notice Board
            </h2>
            <Badge count={filtered.length} />
          </div>
          <div className="flex items-center gap-2">
            {/* Filter tabs */}
            <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/50 p-0.5">
              {(['all', 'urgent', 'general'] as FilterTag[]).map((tag) => (
                <button
                  key={tag}
                  onClick={() => setFilter(tag)}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-all',
                    filter === tag
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {tag}
                </button>
              ))}
            </div>
            <button
              onClick={() => setExpanded(false)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Collapse"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Notices list */}
        <div className="max-h-64 overflow-y-auto pb-3">
          <div className="space-y-2">
            {filtered.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">
                No {filter} notices at this time
              </p>
            ) : (
              filtered.map((notice) => {
                const config = typeConfig[notice.type];
                const Icon = config.icon;
                const tag = classifyNotice(notice.type);
                return (
                  <div
                    key={notice.id}
                    className={cn(
                      'flex items-start gap-3 rounded-lg border p-3 transition-all',
                      config.border,
                      config.bg
                    )}
                  >
                    <div
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                        config.bg,
                        config.color
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {notice.title}
                        </p>
                        <span
                          className={cn(
                            'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                            tag === 'urgent'
                              ? 'bg-destructive/10 text-destructive'
                              : 'bg-primary/10 text-primary'
                          )}
                        >
                          {tag}
                        </span>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {notice.message}
                      </p>
                      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
                        {timeAgo(notice.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Badge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
      {count}
    </span>
  );
}
