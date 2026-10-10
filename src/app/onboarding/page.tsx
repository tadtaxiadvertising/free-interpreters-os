'use client';

import React, { useEffect, useState } from 'react';
import { OnboardingWizard } from '@/components/OnboardingWizard';
import { getOnboardingStatus } from '@/app/actions/onboarding';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function OnboardingPage() {
  const [userId, setUserId] = useState<number | null>(null);
  const [user, setUser] = useState<any>(null);
  const [interpreterName, setInterpreterName] = useState<string>('Intérprete');
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
  const [didAuthCheck, setDidAuthCheck] = useState(false);

  // Auth check on mount
  useEffect(() => {
    async function checkAuth() {
      const authResult = await auth();
      if (authResult.userId && authResult.user) {
        setUserId(authResult.userId);
        setUser(authResult.user);
        setInterpreterName(authResult.user.name || 'Intérprete');
      }
      setDidAuthCheck(true);
    }
    checkAuth();
  }, []);

  // Load onboarding status after auth check
  useEffect(() => {
    if (didAuthCheck) {
      async function loadOnboardingStatus() {
        const result = await getOnboardingStatus();
        if (result.success && result.data) {
          setOnboardingComplete(result.data.onboardingComplete);
        }
      }
      loadOnboardingStatus();
    }
  }, [didAuthCheck]);

  // If onboarding already complete, redirect to dashboard
  if (didAuthCheck && onboardingComplete === true) {
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