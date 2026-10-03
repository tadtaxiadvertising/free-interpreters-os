import { resolveCurrentIdentity } from '@/lib/identity/resolve-user';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function EntryRouter() {
  const identity = await resolveCurrentIdentity();

  if (!identity) {
    redirect('/login');
  }

  // Admin always goes to admin panel
  if (identity.role === 'admin') {
    redirect('/admin');
  }

  // Check onboarding state
  if (identity.onboardingStatus !== 'COMPLETED') {
    // User needs to complete or resume onboarding
    const resumeParam = identity.onboardingStatus === 'IN_PROGRESS' ? '?resume=true' : '';
    redirect(`/onboarding${resumeParam}`);
  }

  // Onboarding complete - check roleplay state
  switch (identity.roleplayState) {
    case 'INVITED':
    case 'STARTED':
    case 'IN_PROGRESS':
      // User has an active roleplay session - go to roleplay
      if (identity.roleplaySessionId) {
        redirect(`/roleplays/${identity.roleplaySessionId}`);
      }
      // Fallback if no session ID
      redirect('/dashboard/roleplays');
    
    case 'SUBMITTED':
    case 'UNDER_REVIEW':
    case 'EVALUATED':
      // Roleplay submitted or under review - show dashboard with status
      redirect('/dashboard');
    
    case 'PASSED':
    case 'FAILED':
      // Roleplay completed with result - show dashboard
      redirect('/dashboard');
    
    case 'EXPIRED':
    case 'CANCELLED':
      // Roleplay expired/cancelled - show dashboard
      redirect('/dashboard');
    
    case 'NO_ROLEPLAY':
    default:
      // No roleplay - go to dashboard
      redirect('/dashboard');
  }
}