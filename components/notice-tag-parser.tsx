'use client';

import * as React from 'react';
import { Bus as BusIcon, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BusWithRelations, Route } from '@/lib/types';

export interface NoticeTagParserProps {
  text: string;
  buses: BusWithRelations[];
  routes: Route[];
  onBusClick?: (bus: BusWithRelations) => void;
  className?: string;
}

interface ParsedTag {
  type: 'bus' | 'route' | 'plain';
  raw: string;
  label: string;
  busId?: string;
  routeId?: string;
}

function parseTags(
  text: string,
  buses: BusWithRelations[],
  routes: Route[]
): ParsedTag[] {
  const tags: ParsedTag[] = [];
  const regex = /\[([^\]]+)\]/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const raw = match[0];
    const inner = match[1].trim();

    const busMatch = buses.find(
      (b) =>
        b.bus_number.toLowerCase() === inner.toLowerCase() ||
        b.bus_number.toLowerCase() ===
          inner.toLowerCase().replace(/^bus[-\s]*/, '')
    );
    if (busMatch) {
      tags.push({
        type: 'bus',
        raw,
        label: busMatch.bus_number,
        busId: busMatch.id,
      });
      continue;
    }

    const routeMatch = routes.find(
      (r) =>
        r.name.toLowerCase().includes(inner.toLowerCase()) ||
        r.code.toLowerCase() === inner.toLowerCase()
    );
    if (routeMatch) {
      tags.push({
        type: 'route',
        raw,
        label: routeMatch.name,
        routeId: routeMatch.id,
      });
      continue;
    }

    tags.push({ type: 'plain', raw, label: inner });
  }

  return tags;
}

export function NoticeTagParser({
  text,
  buses,
  routes,
  onBusClick,
  className,
}: NoticeTagParserProps) {
  const tags = React.useMemo(
    () => parseTags(text, buses, routes),
    [text, buses, routes]
  );

  if (tags.length === 0) {
    return <span className={className}>{text}</span>;
  }

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  for (const tag of tags) {
    const tagIndex = text.indexOf(tag.raw, lastIndex);
    if (tagIndex > lastIndex) {
      parts.push(text.slice(lastIndex, tagIndex));
    }

    if (tag.type === 'bus' && tag.busId && onBusClick) {
      const bus = buses.find((b) => b.id === tag.busId);
      if (bus) {
        parts.push(
          <button
            key={`${tag.raw}-${tagIndex}`}
            onClick={() => onBusClick(bus)}
            className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary transition-all hover:bg-primary/20 hover:border-primary/50"
          >
            <BusIcon className="h-3 w-3" />
            {tag.label}
          </button>
        );
      } else {
        parts.push(
          <span
            key={`${tag.raw}-${tagIndex}`}
            className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary"
          >
            <BusIcon className="h-3 w-3" />
            {tag.label}
          </span>
        );
      }
    } else if (tag.type === 'route' && tag.routeId) {
      parts.push(
        <span
          key={`${tag.raw}-${tagIndex}`}
          className="inline-flex items-center gap-1 rounded-md border border-success/30 bg-success/10 px-1.5 py-0.5 text-xs font-semibold text-success"
        >
          <MapPin className="h-3 w-3" />
          {tag.label}
        </span>
      );
    } else {
      parts.push(
        <span
          key={`${tag.raw}-${tagIndex}`}
          className="inline-flex items-center rounded-md border border-border bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground"
        >
          {tag.label}
        </span>
      );
    }

    lastIndex = tagIndex + tag.raw.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return <span className={cn(className)}>{parts}</span>;
}
