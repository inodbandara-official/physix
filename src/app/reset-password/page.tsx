import type { Metadata } from 'next';
import Link from 'next/link';

import { BrandMark } from '@/components/app-shell/brand-mark';
import { Button } from '@/components/ui/button';
import { getBrand } from '@/lib/branding';

import { ResetPasswordForm } from './reset-password-form';

export const metadata: Metadata = { title: 'Choose a new password' };

/**
 * Where the emailed recovery link lands.
 *
 * Supabase delivers the recovery token in the URL fragment, which never
 * reaches the server, so the exchange happens in the client component below.
 */
export default async function ResetPasswordPage() {
  const brand = await getBrand();

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
          <h1 className="text-xl font-semibold tracking-tight">Choose a new password</h1>
        </div>

        <ResetPasswordForm />

        <div className="text-center">
          <Button asChild variant="link" className="text-sm">
            <Link href="/login">Back to sign in</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
