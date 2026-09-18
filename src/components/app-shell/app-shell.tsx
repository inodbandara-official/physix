import Link from 'next/link';
import type { ReactNode } from 'react';

import { ThemeToggle } from '@/components/theme-toggle';
import type { AppSettingsRow } from '@/types/database';

import { BrandMark } from './brand-mark';
import { MobileNav } from './mobile-nav';
import { SidebarNav } from './sidebar-nav';
import { UserMenu } from './user-menu';
import type { NavItem } from './nav-config';

interface AppShellProps {
  brand: AppSettingsRow;
  nav: NavItem[];
  userName: string;
  userSubtitle: string;
  profileHref: string;
  homeHref: string;
  children: ReactNode;
}

/**
 * Shared chrome for both roles: a fixed sidebar on desktop, a sheet on mobile.
 * Brand colours are injected as CSS custom properties so a rebrand is a data
 * change, not a code change.
 */
export function AppShell({
  brand,
  nav,
  userName,
  userSubtitle,
  profileHref,
  homeHref,
  children,
}: AppShellProps) {
  const brandStyle = {
    '--brand-primary': brand.primary_color,
    '--brand-secondary': brand.secondary_color,
  } as React.CSSProperties;

  return (
    <div className="flex min-h-svh flex-col bg-muted/30" style={brandStyle}>
      <div className="flex flex-1">
        <aside className="sticky top-0 hidden h-svh w-64 shrink-0 flex-col border-r bg-background lg:flex">
          <div className="border-b p-4">
            <Link href={homeHref} className="block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <BrandMark brand={brand} />
            </Link>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <SidebarNav items={nav} />
          </div>
          {brand.teacher_name ? (
            <p className="border-t px-4 py-3 text-xs text-muted-foreground">{brand.teacher_name}</p>
          ) : null}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur sm:px-6">
            <MobileNav items={nav} brand={brand} />
            <Link href={homeHref} className="lg:hidden">
              <BrandMark brand={brand} compact />
            </Link>
            <div className="ml-auto flex items-center gap-1">
              <ThemeToggle />
              <UserMenu name={userName} subtitle={userSubtitle} profileHref={profileHref} />
            </div>
          </header>

          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
            <div className="space-y-6">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
