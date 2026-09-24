import type { Metadata } from 'next';
import Link from 'next/link';

import { AuthShell } from '@/components/auth-shell';
import { Button } from '@/components/ui/button';
import { getBrand } from '@/lib/branding';

import { ForgotPasswordForm } from './forgot-password-form';

export const metadata: Metadata = { title: 'Reset your password' };

export default async function ForgotPasswordPage() {
  const brand = await getBrand();

  return (
    <AuthShell
      brand={brand}
      title="Reset your password"
      description="Enter the email address on your account and we will send you a link."
      footer={
        <>
          <Button asChild variant="link" className="text-sm">
            <Link href="/login">Back to sign in</Link>
          </Button>
          <p className="text-xs text-pretty text-muted-foreground">
            If you sign in with a username rather than an email address, your teacher has to reset your
            password for you
            {brand.contact_email ? ` — contact ${brand.contact_email}` : ''}.
          </p>
        </>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
