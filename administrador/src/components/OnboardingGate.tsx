'use client';

import React, { useState } from 'react';
import { OnboardingWizard } from './OnboardingWizard';

interface OnboardingGateProps {
  isComplete: boolean;
  interpreterName?: string;
}

/**
 * Client-side gate that shows the OnboardingWizard if the interpreter
 * hasn't completed onboarding yet. Once completed, it hides the wizard
 * and reveals the dashboard beneath.
 */
export function OnboardingGate({ isComplete, interpreterName }: OnboardingGateProps) {
  const [showWizard, setShowWizard] = useState(!isComplete);

  if (!showWizard) return null;

  return (
    <OnboardingWizard
      onComplete={() => setShowWizard(false)}
      interpreterName={interpreterName}
    />
  );
}
