import prisma from '@/lib/prisma';
import { RoleplayStatus } from '@prisma/client';

const db = prisma;

export interface CreateSessionInput {
  interpreterId?: number;
  recruitmentCandidateId?: number;
  baseAudioUrl: string;
  status?: RoleplayStatus;
}

export interface UpdateSessionInput {
  baseAudioUrl?: string;
  recordedAudioUrl?: string;
  status?: RoleplayStatus;
  evaluatorId?: string;
  qaScoreId?: number | null;
  submittedAt?: Date | null;
  evaluatedAt?: Date | null;
  currentScenarioIndex?: number;
  completedAt?: Date | null;
}

export class RoleplayRepository {
  /**
   * Find active session for a target (interpreter or candidate)
   * Active = PENDING, INVITED, STARTED, IN_PROGRESS, SUBMITTED, UNDER_REVIEW
   */
  async findActiveSession(target: { interpreterId?: number; recruitmentCandidateId?: number }) {
    if (!target.interpreterId && !target.recruitmentCandidateId) {
      return null;
    }

    return db.roleplaySession.findFirst({
      where: {
        ...(target.interpreterId ? { interpreterId: target.interpreterId } : {}),
        ...(target.recruitmentCandidateId ? { recruitmentCandidateId: target.recruitmentCandidateId } : {}),
        status: {
          in: ['DRAFT', 'INVITED', 'STARTED', 'IN_PROGRESS', 'SUBMITTED', 'UNDER_REVIEW'],
        },
      },
      include: {
        access: true,
        scenarios: {
          include: { responses: true },
          orderBy: { order: 'asc' },
        },
        qaScore: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Find session by ID with full relations
   */
  async findById(id: string) {
    return db.roleplaySession.findUnique({
      where: { id },
      include: {
        interpreter: { select: { id: true, name: true, emailCorporativo: true } },
        recruitmentCandidate: { select: { id: true, name: true, email: true } },
        access: true,
        scenarios: {
          include: { responses: true },
          orderBy: { order: 'asc' },
        },
        qaScore: true,
      },
    });
  }

  /**
   * Create new session
   */
  async create(input: CreateSessionInput) {
    return db.roleplaySession.create({
      data: {
        interpreterId: input.interpreterId ?? null,
        recruitmentCandidateId: input.recruitmentCandidateId ?? null,
        baseAudioUrl: input.baseAudioUrl,
        status: input.status ?? 'DRAFT',
        currentScenarioIndex: 0,
      },
      include: { access: true },
    });
  }

  /**
   * Update session with optimistic locking via status check
   */
  async update(id: string, input: UpdateSessionInput, expectedStatus?: RoleplayStatus) {
    const where: any = { id };
    if (expectedStatus) {
      where.status = expectedStatus;
    }

    return db.roleplaySession.update({
      where,
      data: input,
      include: { access: true },
    });
  }

  /**
   * Atomic status transition with validation
   * Returns null if transition failed (status didn't match)
   */
  async transitionStatus(
    id: string,
    fromStatus: RoleplayStatus | RoleplayStatus[],
    toStatus: RoleplayStatus,
    additionalData: Partial<UpdateSessionInput> = {}
  ) {
    const fromStatuses = Array.isArray(fromStatus) ? fromStatus : [fromStatus];

    return db.roleplaySession.update({
      where: {
        id,
        status: { in: fromStatuses },
      },
      data: {
        status: toStatus,
        ...additionalData,
      },
      include: { access: true },
    });
  }

  /**
   * Get sessions for admin queue with filters
   */
  async findForQueue(filters: {
    status?: RoleplayStatus[];
    interpreterId?: number;
    candidateId?: number;
    evaluatorId?: string;
    dateFrom?: Date;
    dateTo?: Date;
    take?: number;
    skip?: number;
  }) {
    const where: any = {};

    if (filters.status?.length) {
      where.status = { in: filters.status };
    }
    if (filters.interpreterId) {
      where.interpreterId = filters.interpreterId;
    }
    if (filters.candidateId) {
      where.recruitmentCandidateId = filters.candidateId;
    }
    if (filters.evaluatorId) {
      where.evaluatorId = filters.evaluatorId;
    }
    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = filters.dateFrom;
      if (filters.dateTo) where.createdAt.lte = filters.dateTo;
    }

    const [sessions, total] = await Promise.all([
      db.roleplaySession.findMany({
        where,
        include: {
          interpreter: { select: { id: true, name: true, emailCorporativo: true } },
          recruitmentCandidate: { select: { id: true, name: true, email: true } },
          access: true,
          qaScore: true,
        },
        orderBy: { createdAt: 'desc' },
        take: filters.take ?? 50,
        skip: filters.skip ?? 0,
      }),
      db.roleplaySession.count({ where }),
    ]);

    return { sessions, total };
  }

  /**
   * Atomic claim for evaluation - prevents race conditions
   * Returns session if claimed, null if already claimed or not available
   */
  async claimForEvaluation(sessionId: string, evaluatorId: string) {
    return db.roleplaySession.update({
      where: {
        id: sessionId,
        status: 'SUBMITTED',
        evaluatorId: null,
      },
      data: {
        status: 'UNDER_REVIEW',
        evaluatorId,
        reviewStartedAt: new Date(),
      },
      include: { access: true, qaScore: true },
    });
  }

  /**
   * Check if session exists for target (for idempotency)
   */
  async existsForTarget(target: { interpreterId?: number; recruitmentCandidateId?: number }) {
    const session = await this.findActiveSession(target);
    return !!session;
  }
}

export const roleplayRepository = new RoleplayRepository();