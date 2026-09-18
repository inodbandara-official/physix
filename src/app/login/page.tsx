import type { Metadata } from 'next';

import { BrandMark } from '@/components/app-shell/brand-mark';
import { getBrand } from '@/lib/branding';

import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage(props: PageProps<'/login'>) {
  const [brand, searchParams] = await Promise.all([getBrand(), props.searchParams]);
  const next = typeof searchParams.next === 'string' ? searchParams.next : undefined;
  const notice = searchParams.error === 'no-student-record' ? 'This account is not linked to a student record. Contact your teacher.' : undefined;

  return (
    <main
      className="flex min-h-svh items-center justify-center bg-muted/40 p-4"
      style={
        {
          '--brand-primary': brand.primary_color,
          '--brand-secondary': brand.secondary_color,
        } as React.CSSProperties
      }
    >
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-4 text-center">
          <BrandMark brand={brand} className="justify-center" />
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
            <p className="text-sm text-pretty text-muted-foreground">
              Use your email address, or the username your teacher issued you.
            </p>
          </div>
        </div>

        <LoginForm next={next} notice={notice} />

        {brand.contact_email || brand.contact_phone ? (
          <p className="text-center text-xs text-muted-foreground">
            Trouble signing in? Contact {brand.contact_email ?? brand.contact_phone}.
          </p>
        ) : null}
      </div>
    </main>
  );
}
