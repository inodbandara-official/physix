'use client';

import { useState } from 'react';
import { KeyRound } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { CredentialsDialog } from './credentials-dialog';

interface Props {
  student: {
    id: string;
    full_name: string;
    username: string;
    email: string | null;
    loginEmail: string | null;
    hasAccount: boolean;
  };
}

export function StudentCredentialsCard({ student }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Login account</CardTitle>
        <CardDescription>
          {student.hasAccount
            ? student.email
              ? 'They sign in with their own email address, so they can reset a forgotten password themselves.'
              : 'They sign in by username. With no email on file, only you can reset their password — add one to change that.'
            : 'No login yet. Create one and hand the password over in person.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 text-sm">
          <span className="text-muted-foreground">Signs in as </span>
          <span className="font-mono font-medium break-all">
            {student.loginEmail ?? student.email ?? student.username}
          </span>
        </p>
        <Button variant={student.hasAccount ? 'outline' : 'default'} onClick={() => setOpen(true)}>
          <KeyRound className="size-4" aria-hidden />
          {student.hasAccount ? 'Reset password' : 'Create login'}
        </Button>
      </CardContent>

      <CredentialsDialog student={open ? student : null} onOpenChange={setOpen} />
    </Card>
  );
}
