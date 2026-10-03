import { describe, it, expect, vi, beforeEach } from 'vitest';
import { roleplayService } from '@/services/roleplay/roleplay-service';
import { roleplayRepository } from '@/repositories/roleplay/roleplay-repository';
import { roleplayAccessRepository } from '@/repositories/roleplay/roleplay-access-repository';

vi.mock('@/lib/identity/resolve-user', () => ({
  resolveCurrentIdentity: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    roleplaySession: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    roleplayScenario: {
      createMany: vi.fn(),
    },
    roleplayResponse: {
      updateMany: vi.fn(),
    },
    qAScore: {
      create: vi.fn(),
    },
    recruitmentCandidate: {
      update: vi.fn(),
    },
    notification: {
      create: vi.fn(),
    },
    interpreter: {
      findUnique: vi.fn(),
    },
    userProfile: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/lib/roleplay', () => ({
  createSignedUploadUrl: vi.fn(),
  getBaseAudioPath: vi.fn(),
  validateAudioFile: vi.fn(),
}));

vi.mock('@/repositories/roleplay/roleplay-repository', () => ({
  roleplayRepository: {
    findActiveSession: vi.fn(),
    findById: vi.fn(),
    transitionStatus: vi.fn(),
    findForQueue: vi.fn(),
  },
}));

vi.mock('@/repositories/roleplay/roleplay-access-repository', () => ({
  roleplayAccessRepository: {
    getOrCreateAccess: vi.fn(),
    markStarted: vi.fn(),
  },
}));

// Mock revalidatePath to avoid "static generation store missing" error in tests
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

import { resolveCurrentIdentity } from '@/lib/identity/resolve-user';
import prisma from '@/lib/prisma';
import { createSignedUploadUrl, getBaseAudioPath, validateAudioFile } from '@/lib/roleplay';

const mockResolveIdentity = resolveCurrentIdentity as vi.Mock;
const mockPrisma = prisma as any;
const mockCreateSignedUploadUrl = createSignedUploadUrl as vi.Mock;
const mockGetBaseAudioPath = getBaseAudioPath as vi.Mock;
const mockValidateAudioFile = validateAudioFile as vi.Mock;
const mockRepository = roleplayRepository as any;
const mockAccessRepo = roleplayAccessRepository as any;

describe('Roleplay Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockResolveIdentity.mockResolvedValue({
      userId: 'user-1',
      role: 'admin',
      provider: 'supabase',
      interpreterId: null,
    });

    mockValidateAudioFile.mockReturnValue({ valid: true, extension: 'webm' });
    mockGetBaseAudioPath.mockReturnValue('base/session-123.webm');
    mockCreateSignedUploadUrl.mockResolvedValue({ uploadUrl: 'https://upload.url', path: 'base/session-123.webm' });
    mockPrisma.$transaction.mockImplementation(async (fn) => fn(mockPrisma));
    mockPrisma.roleplayScenario.createMany.mockResolvedValue({ count: 2 });
    mockPrisma.roleplaySession.create.mockResolvedValue({ id: 'session-123' });
    mockPrisma.roleplaySession.update.mockResolvedValue({ id: 'session-123' });
  });

  describe('createOrResumeAssessment', () => {
    it('should create new assessment for interpreter', async () => {
      mockRepository.findActiveSession.mockResolvedValue(null);
      mockPrisma.roleplaySession.create.mockResolvedValue({
        id: 'session-123',
        status: 'DRAFT',
        baseAudioUrl: 'base/session-123.webm',
      });
      mockAccessRepo.getOrCreateAccess.mockResolvedValue({ id: 'access-1', rawToken: undefined });

      const result = await roleplayService.createOrResumeAssessment({
        targetType: 'interpreter',
        targetId: 1,
        baseAudioMimeType: 'audio/webm',
        baseAudioSize: 1024 * 1024,
      });

      expect(result.sessionId).toBe('session-123');
      expect(result.status).toBe('INVITED');
      expect(mockPrisma.roleplaySession.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          interpreterId: 1,
          recruitmentCandidateId: null,
          status: 'DRAFT',
        }),
      }));
    });

    it('should resume existing active session', async () => {
      const existingSession = { id: 'existing-123', status: 'INVITED', baseAudioUrl: 'base/existing.webm', access: null };
      mockRepository.findActiveSession.mockResolvedValue(existingSession);

      const result = await roleplayService.createOrResumeAssessment({
        targetType: 'interpreter',
        targetId: 1,
        baseAudioMimeType: 'audio/webm',
        baseAudioSize: 1024,
      });

      expect(result.sessionId).toBe('existing-123');
      expect(result.status).toBe('INVITED');
      expect(mockPrisma.roleplaySession.create).not.toHaveBeenCalled();
    });

    it('should create access for candidate', async () => {
      mockRepository.findActiveSession.mockResolvedValue(null);
      mockPrisma.roleplaySession.create.mockResolvedValue({ id: 'session-456', status: 'DRAFT', baseAudioUrl: 'base/session-456.webm' });
      mockAccessRepo.getOrCreateAccess.mockResolvedValue({ id: 'access-1', rawToken: 'token-123' });

      const result = await roleplayService.createOrResumeAssessment({
        targetType: 'candidate',
        targetId: 1,
        baseAudioMimeType: 'audio/webm',
        baseAudioSize: 1024,
      });

      expect(result.inviteToken).toBeUndefined(); // Access repo returns without rawToken for existing
      expect(result.access).toBeDefined();
    });

    it('should reject invalid audio MIME type', async () => {
      mockValidateAudioFile.mockReturnValue({ valid: false, error: 'Invalid MIME type' });

      const result = await roleplayService.createOrResumeAssessment({
        targetType: 'interpreter',
        targetId: 1,
        baseAudioMimeType: 'video/mp4',
        baseAudioSize: 1024,
      });

      expect(result.success).toBeFalsy();
      expect(result.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('startAssessment', () => {
    it('should start assessment and update status', async () => {
      const mockAccess = {
        id: 'access-1',
        sessionId: 'session-123',
        tokenHash: 'hash123',
        usedAt: null,
        validatedAt: new Date(),
        startedAt: null,
        expiresAt: new Date(Date.now() + 86400000),
        session: { id: 'session-123', status: 'INVITED' },
      };
      mockAccessRepo.markStarted.mockResolvedValue(mockAccess);
      mockRepository.transitionStatus.mockResolvedValue({ id: 'session-123', status: 'STARTED' });

      const result = await roleplayService.startAssessment('valid-token');

      expect(result.sessionId).toBe('session-123');
      expect(result.status).toBe('STARTED');
      expect(mockAccessRepo.markStarted).toHaveBeenCalledWith('valid-token');
    });

    it('should reject invalid token', async () => {
      mockAccessRepo.markStarted.mockResolvedValue(null);

      const result = await roleplayService.startAssessment('invalid-token');

      expect(result.success).toBeFalsy();
      expect(result.code).toBe('INVALID_TOKEN');
    });
  });

  describe('submitAssessment', () => {
    it('should submit assessment with all scenarios completed', async () => {
      mockResolveIdentity.mockResolvedValue({ userId: 'user-1', role: 'interpreter', interpreterId: 1 });
      mockRepository.findById.mockResolvedValue({
        id: 'session-123',
        interpreterId: 1,
        recruitmentCandidateId: null,
        status: 'IN_PROGRESS',
        scenarios: [
          { id: 'scenario-1', responses: [{ id: 'resp-1' }] },
          { id: 'scenario-2', responses: [{ id: 'resp-2' }] },
        ],
        recordedAudioUrl: null,
        submittedAt: null,
      });
      mockPrisma.$transaction.mockImplementation(async (fn) => fn(mockPrisma));
      mockRepository.transitionStatus.mockResolvedValue({ id: 'session-123', status: 'SUBMITTED' });

      const result = await roleplayService.submitAssessment('session-123');

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('SUBMITTED');
    });

    it('should reject if scenarios incomplete', async () => {
      mockResolveIdentity.mockResolvedValue({ userId: 'user-1', role: 'interpreter', interpreterId: 1 });
      mockRepository.findById.mockResolvedValue({
        id: 'session-123',
        interpreterId: 1,
        recruitmentCandidateId: null,
        status: 'IN_PROGRESS',
        scenarios: [
          { id: 'scenario-1', responses: [{ id: 'resp-1' }] },
          { id: 'scenario-2', responses: [] }, // Incomplete
        ],
      });

      const result = await roleplayService.submitAssessment('session-123');

      expect(result.success).toBe(false);
      expect(result.code).toBe('INVALID_STATE');
    });

    it('should reject double submission', async () => {
      mockResolveIdentity.mockResolvedValue({ userId: 'user-1', role: 'interpreter', interpreterId: 1 });
      mockRepository.findById.mockResolvedValue({
        id: 'session-123',
        interpreterId: 1,
        recruitmentCandidateId: null,
        status: 'SUBMITTED', // Already submitted
        scenarios: [],
      });

      const result = await roleplayService.submitAssessment('session-123');

      expect(result.success).toBe(false);
      expect(result.code).toBe('INVALID_STATE');
    });
  });

  describe('evaluateAssessment', () => {
    it('should evaluate with weighted scoring', async () => {
      mockResolveIdentity.mockResolvedValue({ userId: 'eval-1', email: 'eval@example.com', role: 'admin' });
      mockRepository.findById.mockResolvedValue({
        id: 'session-123',
        interpreterId: 1,
        recruitmentCandidateId: null,
        status: 'SUBMITTED',
        recordedAudioUrl: 'https://audio.url',
        qaScoreId: null,
        evaluatorId: null,
      });
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        const tx = {
          roleplaySession: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'session-123',
              interpreterId: 1,
              recruitmentCandidateId: null,
              status: 'SUBMITTED',
              recordedAudioUrl: 'https://audio.url',
              qaScoreId: null,
              evaluatorId: null,
            }),
            update: vi.fn().mockResolvedValue({}),
          },
          qAScore: {
            create: vi.fn().mockResolvedValue({ id: 'qa-1', totalScore: 85.5 }),
          },
          recruitmentCandidate: { update: vi.fn().mockResolvedValue({}) },
        };
        return fn(tx);
      });
      mockPrisma.interpreter.findUnique.mockResolvedValue({ name: 'Test Interpreter', emailCorporativo: 'interp@example.com' });
      mockPrisma.userProfile.findUnique.mockResolvedValue({ id: 'profile-1' });
      mockPrisma.notification.create.mockResolvedValue({});
      mockRepository.findForQueue.mockResolvedValue({ sessions: [], total: 0 });

      const result = await roleplayService.evaluateAssessment('session-123', {
        protocolScore: 8,
        interpretationScore: 9,
        languageScore: 8,
        serviceScore: 7,
        technicalScore: 8,
        criticalError: false,
        comments: 'Good performance',
      });

      expect(result.success).toBe(true);
      expect(result.data?.totalScore).toBeGreaterThan(0);
    });

    it('should set score to 0 for critical error', async () => {
      mockResolveIdentity.mockResolvedValue({ userId: 'eval-1', email: 'eval@example.com', role: 'admin' });
      mockRepository.findById.mockResolvedValue({
        id: 'session-123',
        interpreterId: 1,
        recruitmentCandidateId: null,
        status: 'SUBMITTED',
        recordedAudioUrl: 'https://audio.url',
        qaScoreId: null,
        evaluatorId: null,
      });
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        const tx = {
          roleplaySession: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'session-123',
              interpreterId: 1,
              recruitmentCandidateId: null,
              status: 'SUBMITTED',
              recordedAudioUrl: 'https://audio.url',
              qaScoreId: null,
              evaluatorId: null,
            }),
            update: vi.fn().mockResolvedValue({}),
          },
          qAScore: {
            create: vi.fn().mockResolvedValue({ id: 'qa-1', totalScore: 0 }),
          },
          recruitmentCandidate: { update: vi.fn().mockResolvedValue({}) },
        };
        return fn(tx);
      });

      const result = await roleplayService.evaluateAssessment('session-123', {
        protocolScore: 10,
        interpretationScore: 10,
        languageScore: 10,
        serviceScore: 10,
        technicalScore: 10,
        criticalError: true,
        comments: 'Critical error',
      });

      expect(result.data?.totalScore).toBe(0);
    });
  });

  describe('cancelAssessment', () => {
    it('should cancel non-evaluated session', async () => {
      mockResolveIdentity.mockResolvedValue({ role: 'admin' });
      mockRepository.findById.mockResolvedValue({ id: 'session-123', status: 'IN_PROGRESS' });
      mockRepository.transitionStatus.mockResolvedValue({ id: 'session-123', status: 'CANCELLED' });

      const result = await roleplayService.cancelAssessment('session-123');

      expect(result.success).toBe(true);
    });

    it('should reject canceling evaluated session', async () => {
      mockResolveIdentity.mockResolvedValue({ role: 'admin' });
      mockRepository.findById.mockResolvedValue({ id: 'session-123', status: 'EVALUATED' });

      const result = await roleplayService.cancelAssessment('session-123');

      expect(result.success).toBe(false);
      expect(result.code).toBe('INVALID_STATE');
    });
  });
});