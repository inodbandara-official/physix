'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ClipboardList, FileStack, LayoutDashboard, TrendingUp, Trophy, type LucideIcon } from 'lucide-react';

import { t, type LabelKey } from '@/features/language/labels';
import { cn } from '@/lib/utils';
import type { ContentLanguage } from '@/types/database';

const TABS: { href: string; label: LabelKey; icon: LucideIcon; also?: string[] }[] = [
  { href: '/s/dashboard', label: 'navHome', icon: LayoutDashboard },
  { href: '/s/assessments', label: 'navTests', icon: ClipboardList, also: ['/s/results'] },
  { href: '/s/past-papers', label: 'navPapers', icon: FileStack },
  { href: '/s/progress', label: 'navProgress', icon: TrendingUp },
  { href: '/s/rankings', label: 'navRank', icon: Trophy },
];

/**
 * The student's main navigation on a phone: the five places they go
 * most, one thumb-tap away (§44). Syllabus and profile stay in the menu.
 * Hidden from large screens, where the sidebar does the same job.
 */
export function StudentTabBar({ language }: { language: ContentLanguage }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {TABS.map((tab) => {
          const active = [tab.href, ...(tab.also ?? [])].some(
            (href) => pathname === href || pathname.startsWith(`${href}/`),
          );
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-2 text-[0.7rem] leading-tight font-medium transition-colors',
                  'focus-visible:bg-muted focus-visible:outline-none',
                  active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <tab.icon className={cn('size-5', active && 'stroke-[2.5]')} aria-hidden />
                <span className="max-w-full truncate">{t(tab.label, language)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
