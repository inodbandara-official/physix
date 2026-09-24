import type { Metadata } from 'next';
import Link from 'next/link';

import { AuthShell } from '@/components/auth-shell';
import { Button } from '@/components/ui/button';
import { getBrand } from '@/lib/branding';

import { ResetPasswordForm } from './reset-password-form';

export const metadata: Metadata = { title: 'Choose a new password' };

/**
 * Where the emailed recovery link lands.
 *
 * Supabase delivers the recovery token in the URL fragment, which never
 * reaches the server, so the exchange happens in the client component.
 */
export default async function ResetPasswordPage() {
  const brand = await getBrand();

  return (
    <AuthShell
      brand={brand}
      title="Choose a new password"
      footer={
        <Button asChild variant="link" className="text-sm">
          <Link href="/login">Back to sign in</Link>
        </Button>
      }
    >
      <ResetPasswordForm />
    </AuthShell>
  );
}
