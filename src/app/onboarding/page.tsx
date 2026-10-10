'use client';

import React, { useEffect, useState } from 'react';
import { OnboardingWizard } from '@/components/OnboardingWizard';
import { getOnboardingStatus } from '@/app/actions/onboarding';
import { getCurrentProfile } from '@/app/actions/auth';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  const { userId, user } = await auth();
  if (!userId || !user) {
    redirect('/login');
  }

  const profile = await getCurrentProfile();
  const interpreterName = user.name || 'Intérprete';

  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);

  useEffect(() => {
    async function verify() {
      try {
        const result = await getOnboardingStatus();
        if (result.success && result.data) {
          setOnboardingComplete(result.data.onboardingComplete);
        }
      } catch {
        // Fall back - keep current state
      }
    }
    verify();
  }, [interpreterName]);

  // If onboarding already complete, redirect to dashboard
  if (onboardingComplete === true) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <OnboardingWizard
        onComplete={() => setOnboardingComplete(true)}
        interpreterName={interpreterName}
      />
    </div>
  );
}