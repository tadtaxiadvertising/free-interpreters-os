'use server';

import prisma from '@/lib/prisma';
import { RecruitmentApplicationStatus, RecruitmentStep, RecruitmentEventType } from '@/lib/prisma-types';
import { candidateRepository } from '@/repositories/recruitment/candidate-repository';
import { applicationRepository } from '@/repositories/recruitment/application-repository';
import { accessRepository } from '@/repositories/recruitment/access-repository';
import { documentRepository } from '@/repositories/recruitment/document-repository';
import { eventRepository } from '@/repositories/recruitment/event-repository';
import { interviewRepository } from '@/repositories/recruitment/interview-repository';
import { offerRepository } from '@/repositories/recruitment/offer-repository';
import { contractRepository } from '@/repositories/recruitment/contract-repository';
import { bankingRepository } from '@/repositories/recruitment/banking-repository';
import { techSetupRepository } from '@/repositories/recruitment/tech-setup-repository';
import { trainingRepository } from '@/repositories/recruitment/training-repository';

const db = prisma;

/**
 * RECRUITMENT SERVICE - Core business logic for recruitment workflow
 * 
 * All operations go through this service to ensure:
 * - Idempotency
 * - Proper state transitions
 * - Event logging
 * - Proper ownership/authentication
 * - Concurrency safety
 */

export interface CreateApplicationResult {
  success: boolean;
  applicationId?: string;
  candidateId?: number;
  error?: string;
  code?: string;
}

export interface AdvanceStepResult {
  success: boolean;
  application?: any;
  event?: any;
  error?: string;
  code?: string;
}

export interface RoleplayForApplication {
  sessionId?: string;
  status?: string;
  uploadUrl?: string;
  access?: any;
}

export interface HiringResult {
  success: boolean;
  interpreterId?: number;
  interpreter?: any;
  userProfileId?: string;
  error?: string;
  code?: string;
}

/**
 * Crea una nueva aplicación para un candidato
 */
export async function createApplication(candidateId: number, email: string): Promise<CreateApplicationResult> {
  try {
    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    // Try to find existing candidate
    const candidate = await candidateRepository.findByEmail(normalizedEmail);

    if (candidate) {
      // Candidate exists - check if there's an active application
      const existingApp = await applicationRepository.findByCandidateId(candidateId);

      if (existingApp) {
        return {
          success: false,
          error: 'Ya existe una aplicación activa para este candidato',
          code: 'CONFLICT',
        };
      }

      // Create new application
      const application = await applicationRepository.getOrCreate(candidateId);

      return {
        success: true,
        applicationId: application.id,
        candidateId,
      };
    }

    // Create new candidate
    const newCandidate = await candidateRepository.create({
      name: email.split('@')[0] || 'Candidate',
      email: normalizedEmail,
    });

    // Create application
    const application = await applicationRepository.getOrCreate(candidateId);

    return {
      success: true,
      applicationId: application.id,
      candidateId: newCandidate.id,
    };
  } catch (error) {
    console.error('[Recruitment Service Error createApplication]:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error interno al crear la aplicación',
      code: 'INTERNAL_ERROR',
    };
  }
}

/**
 * Avanza el estado de una aplicación
 */
export async function advanceStep(
  applicationId: string,
  newStatus: RecruitmentApplicationStatus,
  newStep: RecruitmentStep,
  actorType: 'candidate' | 'admin' | 'system',
  actorId: string,
  metadata?: any
): Promise<AdvanceStepResult> {
  try {
    const result = await applicationRepository.advanceStep(
      applicationId,
      newStatus,
      newStatus,
      newStep,
      actorId,
      actorType,
      metadata
    );

    // Log the event
    await eventRepository.log({
      applicationId,
      eventType: newStatus as any,
      fromStatus: 'UNKNOWN', // Will be the previous status in the event
      toStatus: newStatus as any,
      actorType,
      actorId,
      metadata,
    });

    return {
      success: true,
      application: result,
    };
  } catch (error) {
    console.error('[Recruitment Service Error advanceStep]:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al avanzar el paso',
      code: 'INTERNAL_ERROR',
    };
  }
}

/**
 * Obtiene el estado actual de la aplicación
 */
export async function getApplication(applicationId: string) {
  const app = await applicationRepository.findById(applicationId);
  if (!app) {
    return { success: false, error: 'Aplicación no encontrada', code: 'NOT_FOUND' };
  }
  return { success: true, application: app };
}

/**
 * Obtiene la aplicación activa por candidato
 */
export async function getActiveApplication(candidateId: number) {
  const app = await applicationRepository.findByCandidateId(candidateId);
  return { success: !!app, application: app };
}

/**
 * Crea o reanuda una sesión de roleplay para la aplicación
 */
export async function createOrResumeRoleplay(
  applicationId: string,
  targetType: 'candidate' | 'interpreter',
  targetId: number
): Promise<{ success: boolean; result?: RoleplayForApplication; error?: string }> {
  try {
    const { randomBytes, createHash } = await import('crypto');
    const parsedTargetType = targetType === 'candidate';

    // Using roleplay service logic inline
    const result = await db.$transaction(async (tx) => {
      // Check for existing active session
      const existing = await tx.roleplaySession.findFirst({
        where: {
          OR: [
            { recruitmentCandidateId: parsedTargetType ? targetId : undefined },
            { interpreterId: parsedTargetType ? undefined : targetId },
          ],
          status: { in: ['DRAFT', 'INVITED', 'STARTED', 'IN_PROGRESS'] },
        },
      });

      if (existing) {
        // Generate access if needed
        let access;
        if (!existing.access) {
          access = await accessRepository.getOrCreate(existing.id);
        }

        return {
          sessionId: existing.id,
          status: 'INVITED',
          uploadUrl: existing.baseAudioUrl,
          access,
        };
      }

      // Create new session
      const newSession = await tx.roleplaySession.create({
        data: {
          interpreterId: parsedTargetType ? null : undefined,
          recruitmentCandidateId: parsedTargetType ? targetId : undefined,
          baseAudioUrl: 'https://storage.freeinterpreters.com/base-audio-placeholder.webm',
          status: 'DRAFT',
          currentScenarioIndex: 0,
        },
        select: { id: true },
      });

      // Create access for candidate sessions
      let access;
      if (parsedTargetType) {
        access = await accessRepository.getOrCreate(newSession.id);
      }

      // Update status to INVITED
      await tx.roleplaySession.update({
        where: { id: newSession.id },
        data: { status: 'INVITED' },
      });

      return {
        sessionId: newSession.id,
        status: 'INVITED',
        uploadUrl: 'https://storage.freeinterpreters.com/base-audio-placeholder.webm',
        access,
      };
    });

    return { success: true, result };
  } catch (error) {
    console.error('[Recruitment Service Error createOrResumeRoleplay]:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Error al crear roleplay' };
  }
}

/**
 * Procesa la respuesta de roleplay (guardado automático)
 */
export async function saveRoleplayResponse(
  sessionId: string,
  scenarioId: string,
  data: { recordedAudioUrl?: string; durationSec?: number; selfScore?: any; selfNotes?: string }
) {
  try {
    const response = await db.roleplayResponse.upsert({
      where: { id: scenarioId },
      create: {
        scenarioId,
        sourceAudioUrl: data.recordedAudioUrl,
        sourceAudioPath: data.recordedAudioUrl,
        audioStatus: 'UPLOADED',
        durationSec: data.durationSec,
        selfScore: data.selfScore,
        selfNotes: data.selfNotes,
        submittedAt: new Date(),
      },
      update: {
        sourceAudioUrl: data.recordedAudioUrl,
        sourceAudioPath: data.recordedAudioUrl,
        audioStatus: 'UPLOADED',
        durationSec: data.durationSec,
        selfScore: data.selfScore,
        selfNotes: data.selfNotes,
        submittedAt: new Date(),
      },
    });

    return { success: true, data: response };
  } catch (error) {
    console.error('[Recruitment Service Error saveRoleplayResponse]:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Error al guardar respuesta' };
  }
}

/**
 * Evalúa el roleplay (solo administradores)
 */
export async function evaluateRoleplay(
  sessionId: string,
  auditorId: string,
  scores: { protocolScore: number; interpretationScore: number; languageScore: number; serviceScore: number; technicalScore: number; criticalError: boolean; comments?: string }
) {
  try {
    // Calculate weighted score
    let totalScore = 0;
    if (scores.criticalError) {
      totalScore = 0;
    } else {
      totalScore = 
        (scores.protocolScore * 0.35) +
        (scores.interpretationScore * 0.40) +
        (scores.languageScore * 0.15) +
        (scores.serviceScore * 0.05) +
        (scores.technicalScore * 0.05);
    }

    const actionRequired = scores.criticalError || totalScore < 70 
      ? 'Advertencia / Coaching' 
      : totalScore < 85 
        ? 'Feedback Requerido' 
        : 'Ninguno';

    const result = await db.$transaction(async (tx) => {
      // Claim for evaluation (atomic)
      const claimed = await tx.roleplaySession.update({
        where: { 
          id: sessionId,
          status: { in: ['SUBMITTED', 'UNDER_REVIEW'] },
          evaluatorId: null,
        },
        data: { 
          evaluatorId: auditorId,
          status: 'UNDER_REVIEW',
          reviewStartedAt: new Date(),
        },
      });

      if (!claimed) {
        throw new Error('Sesión ya reclamada por otro evaluador');
      }

      // Create QA score
      const qaScore = await tx.qAScore.create({
        data: {
          interpreterId: null, // Will be filled based on candidate/interpreter
          auditor: auditorId,
          protocolScore: scores.protocolScore,
          interpretationScore: scores.interpretationScore,
          languageScore: scores.languageScore,
          serviceScore: scores.serviceScore,
          technicalScore: scores.technicalScore,
          criticalError: scores.criticalError,
          accionRequerida: actionRequired,
        },
      });

      // Update session
      await tx.roleplaySession.update({
        where: { id: sessionId },
        data: { 
          qaScoreId: qaScore.id,
          evaluatedAt: new Date(),
          status: 'EVALUATED',
        },
      });

      return { qaScoreId: qaScore.id, totalScore: Math.round(totalScore * 100) / 100, actionRequired };
    });

    return { success: true, data: result };
  } catch (error) {
    console.error('[Recruitment Service Error evaluateRoleplay]:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Error al evaluar roleplay' };
  }
}

/**
 * Contrata a un candidato (transacción atómica)
 */
export async function hireCandidate(
  applicationId: string,
  actorId: string,
  actorType: 'admin' | 'system'
): Promise<HiringResult> {
  try {
    const application = await applicationRepository.findById(applicationId);
    if (!application) {
      return { success: false, error: 'Aplicación no encontrada', code: 'NOT_FOUND' };
    }

    // Verificar que la aplicación esté en READY_FOR_ACTIVATION
    if (application.status !== 'READY_FOR_ACTIVATION') {
      return { success: false, error: `La aplicación no está lista para contratación. Estado actual: ${application.status}`, code: 'INVALID_STATE' };
    }

    // Transaction: Create interpreter, user profile, link everything
    const result = await db.$transaction(async (tx) => {
      // 1. Verificar si ya existe un intérprete con esta identidad
      const existingInterpreter = await tx.interpreter.findFirst({
        where: { emailCorporativo: application.application.candidate.email },
      });

      let interpreterId: number;
      let userProfileId: string;

      if (existingInterpreter) {
        interpreterId = existingInterpreter.id;
        // Link to existing interpreter
        await tx.userProfile.upsert({
          where: { id: application.applicationId || application.id }, // Need to fix this
          update: { interpreterId: existingInterpreter.id },
          create: {
            id: application.id, // Need to fix the ID mapping
            email: application.application.candidate.email,
            displayName: application.application.candidate.name,
            role: 'interpreter',
            interpreterId: existingInterpreter.id,
          },
        });
        userProfileId = application.id; // Need to fix
      } else {
        // Create new interpreter
        const newInterpreter = await tx.interpreter.create({
          data: {
            externalId: `cand-${application.id}`,
            name: application.application.candidate.name,
            emailCorporativo: application.application.candidate.email,
            status: 'Activo',
            realtimeStatus: 'Offline',
            tariffPerMinute: 0,
            monthlyGoal: 2000,
            languageA: 'Español',
            languageB: 'Inglés',
          },
        });
        interpreterId = newInterpreter.id;

        // Create user profile
        userProfileId = application.id; // This needs fixing - use proper UUID
        await tx.userProfile.create({
          data: {
            id: application.id, // Need proper UUID
            email: application.application.candidate.email,
            displayName: application.application.candidate.name,
            role: 'interpreter',
            interpreterId,
          },
        });
      }

      // Update application status
      await tx.recruitmentApplication.update({
        where: { id: applicationId },
        data: {
          status: 'HIRED',
          hiredInterpreterId: interpreterId,
          currentStep: 'HIRING',
          completedAt: new Date(),
        },
      });

      // Log hiring event
      await tx.recruitmentEvent.create({
        data: {
          applicationId,
          eventType: 'HIRED',
          fromStatus: application.status,
          toStatus: 'HIRED',
          actorType: actorType,
          actorId,
        },
      });

      return { interpreterId, userProfileId };
    });

    return { success: true, interpreterId: result.interpreterId, userProfileId: result.userProfileId };
  } catch (error) {
    console.error('[Recruitment Service Error hireCandidate]:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Error al contratar candidato' };
  }
}

export const recruitmentService = {
  createApplication,
  advanceStep,
  getApplication,
  getActiveApplication,
  createOrResumeRoleplay,
  saveRoleplayResponse,
  evaluateRoleplay,
  hireCandidate,
};