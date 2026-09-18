import { AppShell } from '@/components/app-shell/app-shell';
import { STUDENT_NAV } from '@/components/app-shell/nav-config';
import { requireStudent } from '@/lib/auth/session';
import { getBrand } from '@/lib/branding';

export default async function StudentLayout({ children }: LayoutProps<'/s'>) {
  const [session, brand] = await Promise.all([requireStudent(), getBrand()]);

  return (
    <AppShell
      brand={brand}
      nav={STUDENT_NAV}
      userName={session.student.preferred_name || session.student.full_name}
      userSubtitle={session.student.student_code}
      profileHref="/s/profile"
      homeHref="/s/dashboard"
    >
      {children}
    </AppShell>
  );
}
