import type { Metadata } from 'next';

import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChangePasswordForm } from '@/features/auth/components/change-password-form';
import { BrandForm } from '@/features/settings/components/brand-form';
import { requireTeacher } from '@/lib/auth/session';
import { getBrand } from '@/lib/branding';
import { formatDateTime } from '@/lib/format';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const [session, brand] = await Promise.all([requireTeacher(), getBrand()]);
  const supabase = await createSupabaseServerClient();
  const { data: auditLogs } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  return (
    <>
      <PageHeader title="Settings" description="Branding, your account and the activity log." />

      <Tabs defaultValue="brand">
        <TabsList>
          <TabsTrigger value="brand">Branding</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="audit">Activity log</TabsTrigger>
        </TabsList>

        <TabsContent value="brand" className="pt-6">
          <BrandForm brand={brand} />
        </TabsContent>

        <TabsContent value="account" className="pt-6">
          <Card>
            <CardHeader>
              <CardTitle>Your account</CardTitle>
              <CardDescription>Signed in as {session.email}.</CardDescription>
            </CardHeader>
            <CardContent>
              <ChangePasswordForm />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="pt-6">
          <Card>
            <CardHeader>
              <CardTitle>Activity log</CardTitle>
              <CardDescription>
                The last 50 recorded actions. Entries cannot be edited or deleted.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="divide-y text-sm">
                {(auditLogs ?? []).map((entry) => (
                  <li key={entry.id} className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-baseline sm:justify-between">
                    <span>{entry.summary}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDateTime(entry.created_at)}
                    </span>
                  </li>
                ))}
                {(auditLogs ?? []).length === 0 ? (
                  <li className="py-6 text-center text-muted-foreground">Nothing recorded yet.</li>
                ) : null}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
