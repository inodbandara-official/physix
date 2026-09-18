import { AppShell } from '@/components/app-shell/app-shell';
import { requireTeacher } from '@/lib/auth/session';
import { getBrand } from '@/lib/branding';

export default async function TeacherLayout({ children }: LayoutProps<'/t'>) {
  const [session, brand] = await Promise.all([requireTeacher(), getBrand()]);

  return (
    <AppShell
      brand={brand}
      role="teacher"
      userName={session.profile.preferred_name || session.profile.full_name || 'Teacher'}
      userSubtitle={session.email}
      profileHref="/t/settings"
      homeHref="/t/dashboard"
    >
      {children}
    </AppShell>
  );
}
