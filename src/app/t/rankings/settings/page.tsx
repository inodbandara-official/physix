import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { RankingSettingsForm } from '@/features/rankings/components/ranking-settings-form';
import { DEFAULT_WEIGHTS } from '@/features/rankings/engine';
import { getRankingSettings } from '@/features/rankings/queries';
import { requireTeacher } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Ranking settings' };

export default async function RankingSettingsPage() {
  await requireTeacher();
  const settings = await getRankingSettings();

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link href="/t/rankings">
          <ArrowLeft className="size-4" aria-hidden />
          Rankings
        </Link>
      </Button>
      <PageHeader title="Ranking settings" description="How students are ranked, and how much of it they see." />
      <RankingSettingsForm
        basis={settings.basis}
        recentCount={settings.recent_count}
        weights={{ ...DEFAULT_WEIGHTS, ...settings.config.weights }}
        missedCountsZero={settings.missed_counts_zero}
        visibility={settings.student_visibility}
      />
    </>
  );
}
