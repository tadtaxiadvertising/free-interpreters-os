import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getOnboardingState, acceptTerms, saveBankingDetails, completeOnboarding } from '@/services/onboarding/onboarding-service';

vi.mock('@/lib/identity/resolve-user', () => ({
  resolveCurrentIdentity: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    userProfile: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    interpreter: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/lib/cache/revalidate-interpreter', () => ({
  revalidateInterpreterProfileRecords: vi.fn(),
}));

import { resolveCurrentIdentity } from '@/lib/identity/resolve-user';
import prisma from '@/lib/prisma';
import { revalidateInterpreterProfileRecords } from '@/lib/cache/revalidate-interpreter';

const mockResolveIdentity = resolveCurrentIdentity as any;
const mockPrisma = prisma as any;
const mockRevalidate = revalidateInterpreterProfileRecords as any;

type OnboardingStateResult = { success: true; data: any } | { success: false; error: string; code: string };

function isSuccess<T>(result: { success: true; data: T } | { success: false; error: string; code: string }): result is { success: true; data: T } {
  return result.success;
}

function isError(result: { success: true; data: any } | { success: false; error: string; code: string }): result is { success: false; error: string; code: string } {
  return !result.success;
}

describe('Onboarding Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    mockPrisma.userProfile.findUnique.mockResolvedValue(null);
    mockPrisma.userProfile.update.mockResolvedValue({});
    mockPrisma.interpreter.findUnique.mockResolvedValue(null);
    mockPrisma.interpreter.update.mockResolvedValue({});
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: any) => Promise<any>) => fn(mockPrisma));
    mockRevalidate.mockResolvedValue(undefined);
  });

  describe('getOnboardingState', () => {
    it('should return completed state for admin', async () => {
      mockResolveIdentity.mockResolvedValue({
        role: 'admin',
        provider: 'supabase',
        onboardingStatus: 'COMPLETED',
        onboardingCompletedAt: new Date(),
      });

      const result = await getOnboardingState();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('COMPLETED');
      }
    });

    it('should return onboarding state for Supabase user', async () => {
      mockResolveIdentity.mockResolvedValue({
        userId: 'user-1',
        role: 'interpreter',
        provider: 'supabase',
        interpreterId: 10,
        onboardingStatus: 'IN_PROGRESS',
        onboardingStep: 'banking',
        onboardingVersion: 1,
        onboardingCompletedAt: null,
      });

      const mockProfile = {
        id: 'user-1',
        email: 'test@example.com',
        termsAcceptedAt: new Date(),
        bankName: null,
        bankAccount: null,
        bankCedula: null,
        bankAccountType: null,
        onboardingComplete: false,
        interpreter: {
          id: 10,
          documentosCompleto: false,
          banco: null,
          cuentaPago: null,
          cedulaRnc: null,
          notas: null,
        },
      };
      mockPrisma.userProfile.findUnique.mockResolvedValue(mockProfile);

      const result = await getOnboardingState();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('IN_PROGRESS');
        expect(result.data.step).toBe('banking');
        expect(result.data.hasTerms).toBe(true);
        expect(result.data.hasBanking).toBe(false);
      }
    });

    it('should return not found for missing profile', async () => {
      mockResolveIdentity.mockResolvedValue({ userId: 'user-1', role: 'interpreter' });
      mockPrisma.userProfile.findUnique.mockResolvedValue(null);

      const result = await getOnboardingState();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('NOT_FOUND');
      }
    });
  });

  describe('acceptTerms', () => {
    it('should accept terms for Supabase user', async () => {
      mockResolveIdentity.mockResolvedValue({
        userId: 'user-1',
        role: 'interpreter',
        provider: 'supabase',
        interpreterId: 10,
        onboardingStatus: 'IN_PROGRESS',
      });

      mockPrisma.userProfile.update.mockResolvedValue({ id: 'user-1' });

      const result = await acceptTerms();

      expect(result.success).toBe(true);
      expect(mockPrisma.userProfile.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: expect.objectContaining({
          termsAcceptedAt: expect.any(Date),
          signatureDate: expect.any(Date),
        }),
      });
    });

    it('should accept terms for Auth.js user', async () => {
      mockResolveIdentity.mockResolvedValue({
        interpreterId: 10,
        role: 'interpreter',
        provider: 'authjs',
        onboardingStatus: 'IN_PROGRESS',
      });

      mockPrisma.interpreter.findUnique.mockResolvedValue({ id: 10, notas: '' });
      mockPrisma.interpreter.update.mockResolvedValue({ id: 10 });

      const result = await acceptTerms();

      expect(result.success).toBe(true);
      expect(mockPrisma.interpreter.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: expect.objectContaining({
          notas: expect.stringContaining('[TERMS_ACCEPTED]'),
        }),
      });
    });

    it('should reject if onboarding already completed', async () => {
      mockResolveIdentity.mockResolvedValue({
        role: 'interpreter',
        provider: 'supabase',
        onboardingStatus: 'COMPLETED',
      });

      const result = await acceptTerms();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('CONFLICT');
      }
    });
  });

  describe('saveBankingDetails', () => {
    it('should save banking details for Supabase user', async () => {
      mockResolveIdentity.mockResolvedValue({
        userId: 'user-1',
        role: 'interpreter',
        provider: 'supabase',
        interpreterId: 10,
        onboardingStatus: 'IN_PROGRESS',
      });

      const bankingData = {
        bankName: 'Banco Popular',
        bankAccount: '1234567890',
        bankAccountType: 'Ahorro',
        bankCedula: '123-4567890-1',
      };

      mockPrisma.$transaction.mockImplementation(async (fn: (tx: any) => Promise<any>) => {
        const tx = {
          userProfile: { update: vi.fn().mockResolvedValue({ interpreterId: 10 }) },
          interpreter: { update: vi.fn().mockResolvedValue({}) },
        };
        return fn(tx);
      });

      const result = await saveBankingDetails(bankingData);

      expect(result.success).toBe(true);
    });

    it('should reject invalid banking data', async () => {
      mockResolveIdentity.mockResolvedValue({
        userId: 'user-1',
        role: 'interpreter',
        provider: 'supabase',
        onboardingStatus: 'IN_PROGRESS',
      });

      const invalidData = {
        bankName: '',
        bankAccount: 'abc',
        bankAccountType: 'Invalid',
        bankCedula: '123',
      };

      const result = await saveBankingDetails(invalidData);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('VALIDATION_ERROR');
      }
    });
  });

  describe('completeOnboarding', () => {
    it('should complete onboarding for Supabase user', async () => {
      mockResolveIdentity.mockResolvedValue({
        userId: 'user-1',
        role: 'interpreter',
        provider: 'supabase',
        interpreterId: 10,
        onboardingStatus: 'IN_PROGRESS',
      });

      mockPrisma.$transaction.mockImplementation(async (fn: (tx: any) => Promise<any>) => {
        const tx = {
          userProfile: { update: vi.fn().mockResolvedValue({ interpreterId: 10 }) },
          interpreter: { update: vi.fn().mockResolvedValue({}) },
        };
        return fn(tx);
      });

      const result = await completeOnboarding();

      expect(result.success).toBe(true);
    });

    it('should allow idempotent completion (already completed)', async () => {
      mockResolveIdentity.mockClear();
      mockResolveIdentity.mockResolvedValue({
        role: 'interpreter',
        onboardingStatus: 'COMPLETED',
      });

      const result = await completeOnboarding();

      // Idempotent: returns success even if already completed
      expect(result.success).toBe(true);
    });

    it('should reject if needs review', async () => {
      mockResolveIdentity.mockClear();
      mockResolveIdentity.mockResolvedValue({
        role: 'interpreter',
        onboardingStatus: 'NEEDS_REVIEW',
      });

      const result = await completeOnboarding();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('CONFLICT');
      }
    });
  });
});