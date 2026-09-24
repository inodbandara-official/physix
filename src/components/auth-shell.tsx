import type { ReactNode } from 'react';

import { BrandMark } from '@/components/app-shell/brand-mark';
import { ThemeToggle } from '@/components/theme-toggle';
import type { AppSettingsRow } from '@/types/database';

/**
 * Field styling for the auth surface.
 *
 * The input keeps its own border and focus ring — `.neu-inset` supplies
 * depth only. A field defined by shadow alone is the classic way soft UI
 * stops being usable, particularly on a phone in daylight.
 */
export const NEU_FIELD = 'neu-inset h-11 rounded-xl px-4';

interface AuthShellProps {
  brand: AppSettingsRow;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * Chrome for the signed-out pages: sign in, forgot password, reset
 * password.
 *
 * These three are the only place the app uses a soft, neumorphic surface
 * (`.neu`, defined in globals.css). It suits a page that does one thing
 * and asks for two fields; the teacher's dashboard, which is an analytics
 * console, keeps crisp edges and stays untouched.
 *
 * Existing in one place also keeps the three consistent — they were
 * drifting apart as copies.
 */
export function AuthShell({ brand, title, description, children, footer }: AuthShellProps) {
  return (
    <main
      className="neu relative flex min-h-svh items-center justify-center p-4"
      style={
        {
          '--brand-primary': brand.primary_color,
          '--brand-secondary': brand.secondary_color,
        } as React.CSSProperties
      }
    >
      {/* Sat in the corner rather than in the card: it is about the page,
          not about signing in. Students often arrive at this screen in a
          dark classroom or in daylight, so it is worth having here. */}
      <div className="absolute top-4 right-4">
        <ThemeToggle className="neu-raised size-10 rounded-xl" />
      </div>

      <div className="w-full max-w-sm space-y-7">
        <div className="space-y-5 text-center">
          {/* The lettermark sits on its own raised pad, which reads as the
              one object on the page before anything else is scanned. */}
          <div className="neu-raised mx-auto flex size-16 items-center justify-center rounded-2xl">
            <BrandMark brand={brand} compact />
          </div>

          <div className="space-y-1.5">
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            {description ? (
              <p className="text-sm text-pretty text-muted-foreground">{description}</p>
            ) : null}
          </div>
        </div>

        {children}

        {footer ? <div className="space-y-3 text-center">{footer}</div> : null}
      </div>
    </main>
  );
}
