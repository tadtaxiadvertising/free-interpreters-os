/**
 * Onboarding State Audit Script
 * 
 * Analyzes current onboarding state and maps to proposed state machine:
 * NOT_STARTED, IN_PROGRESS, COMPLETED, NEEDS_REVIEW
 * 
 * Run: npx tsx scripts/audit-onboarding.ts
 */

import prisma from '@/lib/prisma';

const db = prisma;

interface OnboardingAuditResult {
  userId: string;
  email: string;
  displayName: string | null;
  role: string | null;
  interpreterId: number | null;
  // Current state
  termsAcceptedAt: Date | null;
  bankName: string | null;
  bankAccount: string | null;
  bankCedula: string | null;
  bankAccountType: string | null;
  onboardingComplete: boolean;
  signatureDate: Date | null;
  // Computed state
  computedStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'NEEDS_REVIEW';
  computedStep: 'legal' | 'banking' | 'tutorial' | 'complete' | null;
  hasTerms: boolean;
  hasBanking: boolean;
  hasTutorial: boolean;
  mismatched: boolean; // onboardingComplete !== computedStatus
  interpreterDocCompleto: boolean | null;
  interpreterBankData: { banco: string | null; cuentaPago: string | null; cedulaRnc: string | null } | null;
}

async function main() {
  console.log(`🔍 [Onboarding Audit] ${new Date().toISOString()}`);
  console.log('='.repeat(60));

  // Fetch all user profiles with related interpreter data
  const profiles = await db.userProfile.findMany({
    include: {
      interpreter: {
        select: {
          id: true,
          documentosCompleto: true,
          banco: true,
          cuentaPago: true,
          cedulaRnc: true,
          notas: true,
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  console.log(`\n📋 Total UserProfiles: ${profiles.length}`);

  const results: OnboardingAuditResult[] = [];

  for (const profile of profiles) {
    const hasTerms = !!profile.termsAcceptedAt;
    const hasBanking = !!(profile.bankName && profile.bankAccount && profile.bankCedula);
    const hasTutorial = true; // Tutorial is auto-complete on final step

    // Compute step
    let computedStep: OnboardingAuditResult['computedStep'] = null;
    if (!hasTerms) computedStep = 'legal';
    else if (!hasBanking) computedStep = 'banking';
    else if (profile.onboardingComplete) computedStep = 'complete';
    else computedStep = 'tutorial';

    // Compute status
    let computedStatus: OnboardingAuditResult['computedStatus'] = 'NOT_STARTED';
    if (profile.onboardingComplete) {
      computedStatus = 'COMPLETED';
    } else if (hasTerms && hasBanking) {
      computedStatus = 'IN_PROGRESS'; // At tutorial step
    } else if (hasTerms) {
      computedStatus = 'IN_PROGRESS'; // At banking step
    } else {
      computedStatus = 'NOT_STARTED';
    }

    // Check for NEEDS_REVIEW - completed but missing data
    if (profile.onboardingComplete && (!hasTerms || !hasBanking)) {
      computedStatus = 'NEEDS_REVIEW';
    }

    // Check interpreter side for Auth.js users
    const interpreterDocCompleto = profile.interpreter?.documentosCompleto ?? null;
    const interpreterBankData = profile.interpreter ? {
      banco: profile.interpreter.banco,
      cuentaPago: profile.interpreter.cuentaPago,
      cedulaRnc: profile.interpreter.cedulaRnc,
    } : null;

    // Check mismatch
    const mismatched = profile.onboardingComplete !== (computedStatus === 'COMPLETED');

    results.push({
      userId: profile.id,
      email: profile.email,
      displayName: profile.displayName,
      role: profile.role,
      interpreterId: profile.interpreterId,
      termsAcceptedAt: profile.termsAcceptedAt,
      bankName: profile.bankName,
      bankAccount: profile.bankAccount,
      bankCedula: profile.bankCedula,
      bankAccountType: profile.bankAccountType,
      onboardingComplete: profile.onboardingComplete,
      signatureDate: profile.signatureDate,
      computedStatus,
      computedStep,
      hasTerms,
      hasBanking,
      hasTutorial,
      mismatched,
      interpreterDocCompleto,
      interpreterBankData,
    });
  }

  // ── Statistics ──
  const statusCounts = {
    NOT_STARTED: results.filter(r => r.computedStatus === 'NOT_STARTED').length,
    IN_PROGRESS: results.filter(r => r.computedStatus === 'IN_PROGRESS').length,
    COMPLETED: results.filter(r => r.computedStatus === 'COMPLETED').length,
    NEEDS_REVIEW: results.filter(r => r.computedStatus === 'NEEDS_REVIEW').length,
  };

  const stepCounts = {
    legal: results.filter(r => r.computedStep === 'legal').length,
    banking: results.filter(r => r.computedStep === 'banking').length,
    tutorial: results.filter(r => r.computedStep === 'tutorial').length,
    complete: results.filter(r => r.computedStep === 'complete').length,
    null: results.filter(r => r.computedStep === null).length,
  };

  const mismatchedCount = results.filter(r => r.mismatched).length;
  const authJsUsers = results.filter(r => r.role && r.interpreterId && !r.termsAcceptedAt).length; // Auth.js users use interpreter.documentosCompleto

  console.log('\n📊 Computed Status Distribution:');
  console.log(`  NOT_STARTED:     ${statusCounts.NOT_STARTED}`);
  console.log(`  IN_PROGRESS:     ${statusCounts.IN_PROGRESS}`);
  console.log(`  COMPLETED:       ${statusCounts.COMPLETED}`);
  console.log(`  NEEDS_REVIEW:    ${statusCounts.NEEDS_REVIEW}`);

  console.log('\n📊 Computed Step Distribution:');
  console.log(`  legal:       ${stepCounts.legal}`);
  console.log(`  banking:     ${stepCounts.banking}`);
  console.log(`  tutorial:    ${stepCounts.tutorial}`);
  console.log(`  complete:    ${stepCounts.complete}`);

  console.log(`\n⚠️  Mismatched (onboardingComplete !== computedStatus): ${mismatchedCount}`);
  console.log(`🔐 Auth.js users (use interpreter.documentosCompleto): ${authJsUsers}`);

  // ── Detailed mismatches ──
  const mismatched = results.filter(r => r.mismatched);
  if (mismatched.length > 0) {
    console.log('\n🔴 MISMATCHED RECORDS:');
    for (const r of mismatched) {
      console.log(`  ${r.email} (${r.userId})`);
      console.log(`    onboardingComplete: ${r.onboardingComplete}`);
      console.log(`    computedStatus: ${r.computedStatus} (step: ${r.computedStep})`);
      console.log(`    hasTerms: ${r.hasTerms}, hasBanking: ${r.hasBanking}`);
      console.log(`    interpreterDocCompleto: ${r.interpreterDocCompleto}`);
      console.log(`    interpreterBankData: banco=${r.interpreterBankData?.banco}, cuenta=${r.interpreterBankData?.cuentaPago}, cedula=${r.interpreterBankData?.cedulaRnc}`);
      console.log('');
    }
  }

  // ── Profiles with interpreter but no onboardingComplete ──
  const withInterpreterNoComplete = results.filter(r => r.interpreterId && !r.onboardingComplete && r.computedStatus === 'COMPLETED');
  if (withInterpreterNoComplete.length > 0) {
    console.log('\n🟡 Profiles with interpreterId, computed COMPLETED but onboardingComplete=false:');
    for (const r of withInterpreterNoComplete) {
      console.log(`  ${r.email} - interpreterId: ${r.interpreterId}, interpreterDocCompleto: ${r.interpreterDocCompleto}`);
    }
  }

  // ── Auth.js users analysis ──
  console.log('\n🔐 Auth.js Users (interpreter-based onboarding):');
  const authJsResults = results.filter(r => r.interpreterId && !r.termsAcceptedAt);
  for (const r of authJsResults) {
    const termsFromNotas = r.interpreterDocCompleto || r.interpreterBankData?.banco; // Check if terms accepted via notas
    console.log(`  ${r.email} (interpreterId: ${r.interpreterId})`);
    console.log(`    interpreter.documentosCompleto: ${r.interpreterDocCompleto}`);
    console.log(`    interpreter banco: ${r.interpreterBankData?.banco}, cuenta: ${r.interpreterBankData?.cuentaPago}, cedula: ${r.interpreterBankData?.cedulaRnc}`);
    console.log('');
  }

  // ── Export report ──
  const fs = await import('fs');
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: results.length,
      statusCounts,
      stepCounts,
      mismatchedCount,
      authJsUsers: authJsUsers.length,
    },
    results: results.map(r => ({
      userId: r.userId,
      email: r.email,
      displayName: r.displayName,
      role: r.role,
      interpreterId: r.interpreterId,
      onboardingComplete: r.onboardingComplete,
      computedStatus: r.computedStatus,
      computedStep: r.computedStep,
      hasTerms: r.hasTerms,
      hasBanking: r.hasBanking,
      mismatched: r.mismatched,
      interpreterDocCompleto: r.interpreterDocCompleto,
      interpreterHasBankData: !!(r.interpreterBankData?.banco && r.interpreterBankData?.cuentaPago && r.interpreterBankData?.cedulaRnc),
    })),
  };
  fs.writeFileSync('audit-onboarding-report.json', JSON.stringify(report, null, 2));
  console.log('\n📄 Full report saved to: audit-onboarding-report.json');
}

main()
  .catch((err) => {
    console.error('🔴 [Onboarding Audit] Fatal error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());