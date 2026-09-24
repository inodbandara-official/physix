import type { Metadata } from 'next';

import { AuthShell } from '@/components/auth-shell';
import { getBrand } from '@/lib/branding';

import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage(props: PageProps<'/login'>) {
  const [brand, searchParams] = await Promise.all([getBrand(), props.searchParams]);

  const next = typeof searchParams.next === 'string' ? searchParams.next : undefined;
  const notice =
    searchParams.error === 'no-student-record'
      ? 'This account is not linked to a student record. Contact your teacher.'
      : undefined;

  return (
    <AuthShell
      brand={brand}
      title={`Sign in to ${brand.lms_name}`}
      description="Use your email address, or the username your teacher issued you."
      footer={
        brand.contact_email || brand.contact_phone ? (
          <p className="text-xs text-muted-foreground">
            Trouble signing in? Contact {brand.contact_email ?? brand.contact_phone}.
          </p>
        ) : null
      }
    >
      <LoginForm next={next} notice={notice} />
    </AuthShell>
  );
}
