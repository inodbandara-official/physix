'use client';

import { useState } from 'react';
import { Menu } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import type { UserRole } from '@/types/database';

import { BrandMark } from './brand-mark';
import { SidebarNav } from './sidebar-nav';

interface MobileNavProps {
  role: UserRole;
  brand: { lms_name: string; tagline: string; logo_url: string | null };
}

export function MobileNav({ role, brand }: MobileNavProps) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="border-b p-4">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <BrandMark brand={brand} />
        </SheetHeader>
        <div className="p-3">
          <SidebarNav role={role} onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
