import type { Metadata } from 'next';
import Link from 'next/link';

import { BrandMark } from '@/components/app-shell/brand-mark';
import { Button } from '@/components/ui/button';
import { getBrand } from '@/lib/branding';

import { ForgotPasswordForm } from './forgot-password-form';

export const metadata: Metadata = { title: 'Reset your password' };

export default async function ForgotPasswordPage() {
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
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight">Reset your password</h1>
            <p className="text-sm text-pretty text-muted-foreground">
              Enter the email address on your account and we will send you a link.
            </p>
          </div>
        </div>

        <ForgotPasswordForm />

        <div className="space-y-3 text-center">
          <Button asChild variant="link" className="text-sm">
            <Link href="/login">Back to sign in</Link>
          </Button>
          <p className="text-xs text-pretty text-muted-foreground">
            If you sign in with a username rather than an email address, your teacher has to reset your
            password for you
            {brand.contact_email ? ` — contact ${brand.contact_email}` : ''}.
          </p>
        </div>
      </div>
    </main>
  );
}
