'use client';

import React, { useState, useEffect } from 'react';
import { OnboardingWizard } from './OnboardingWizard';
import { getOnboardingStatus } from '@/app/actions/onboarding';
import { Loader2 } from 'lucide-react';

interface OnboardingGateProps {
  isComplete: boolean;
  interpreterName?: string;
}

/**
 * Client-side gate that shows the OnboardingWizard if the interpreter
 * hasn't completed onboarding yet. Once completed, it hides the wizard
 * and reveals the dashboard beneath.
 *
 * Re-validates on mount to catch stale `isComplete` props (e.g. after
 * admin reset). If the server says onboarding is incomplete, the wizard
 * is force-shown regardless of the prop.
 */
export function OnboardingGate({ isComplete, interpreterName }: OnboardingGateProps) {
  const [showWizard, setShowWizard] = useState(!isComplete);
  const [verifying, setVerifying] = useState(true);

  // ── Re-verify onboarding status on mount ──
  // This catches cases where the server-side prop is stale (e.g. admin reset
  // onboarding, but this page was cached with isComplete=true).
  useEffect(() => {
    async function verify() {
      try {
        const result = await getOnboardingStatus();
        if (result.success && result.data) {
          setShowWizard(!result.data.onboardingComplete);
        }
      } catch {
        // If verification fails, trust the prop
        setShowWizard(!isComplete);
      }
      setVerifying(false);
    }
    verify();
  }, [isComplete]);

  // ── Show loading while verifying ──
  if (verifying && !isComplete) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/90 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Loader2 size={24} className="animate-spin text-blue-400" />
          <span className="text-slate-400 font-medium">Verificando estado de onboarding...</span>
        </div>
      </div>
    );
  }

  if (!showWizard) return null;

  return (
    <OnboardingWizard
      onComplete={() => setShowWizard(false)}
      interpreterName={interpreterName}
    />
  );
}
