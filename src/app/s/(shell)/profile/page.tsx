import type { Metadata } from 'next';

import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChangePasswordForm } from '@/features/auth/components/change-password-form';
import { requireStudent } from '@/lib/auth/session';
import { formatDate } from '@/lib/format';

export const metadata: Metadata = { title: 'Profile' };

export default async function StudentProfilePage() {
  const session = await requireStudent();
  const student = session.student;

  const details = [
    { label: 'Student ID', value: student.student_code },
    { label: 'Username', value: student.username },
    { label: 'School', value: student.school ?? '—' },
    { label: 'District', value: student.district ?? '—' },
    { label: 'A/L year', value: student.al_year ? String(student.al_year) : '—' },
    { label: 'Joined', value: formatDate(student.joined_on) },
  ];

  return (
    <>
      <PageHeader title="Profile" description="Your details and password." />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{student.full_name}</CardTitle>
            <CardDescription>
              Contact details are managed by your teacher. Ask them if anything here is wrong.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              {details.map((item) => (
                <div key={item.label}>
                  <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {item.label}
                  </dt>
                  <dd className="mt-0.5 text-sm">{item.value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Password</CardTitle>
            <CardDescription>Change the password your teacher gave you.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
