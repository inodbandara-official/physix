import { requireStudent } from '@/lib/auth/session';
import { getBrand } from '@/lib/branding';

/**
 * Chrome for sitting an assessment: none. No sidebar, no navigation, no
 * links out — the brief asks for a test screen that is "extremely clean",
 * and every link on it is a way to lose a student mid-paper.
 */
export default async function FocusLayout({ children }: { children: React.ReactNode }) {
  const [, brand] = await Promise.all([requireStudent(), getBrand()]);

  return (
    <div
      className="min-h-svh bg-muted/30"
      style={
        {
          '--brand-primary': brand.primary_color,
          '--brand-secondary': brand.secondary_color,
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}
