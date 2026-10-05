import prisma from '@/lib/prisma';

const db = prisma;

export const interviewRepository = {
  async findByApplicationId(applicationId: string) {
    return db.recruitmentInterview.findMany({
      where: { applicationId },
      orderBy: { createdAt: 'desc' },
    });
  },

  async findLatestByApplicationId(applicationId: string) {
    return db.recruitmentInterview.findFirst({
      where: { applicationId },
      orderBy: { createdAt: 'desc' },
    });
  },

  async create(data: {
    applicationId: string;
    scheduledAt?: Date;
    meetingUrl?: string;
    notes?: string;
    status?: string;
  }) {
    return db.recruitmentInterview.create({
      data: {
        ...data,
        status: (data.status as any) || 'PENDING',
      },
    });
  },

  async update(id: string, data: Partial<{
    scheduledAt: Date | null;
    meetingUrl: string | null;
    notes: string | null;
    status: string;
    completedAt: Date | null;
  }>) {
    return db.recruitmentInterview.update({
      where: { id },
      data: {
        ...data,
        status: data.status as any,
      },
    });
  },

  async schedule(id: string, scheduledAt: Date, meetingUrl: string) {
    return db.recruitmentInterview.update({
      where: { id },
      data: {
        scheduledAt,
        meetingUrl,
        status: 'SCHEDULED',
      },
    });
  },

  async complete(id: string, notes?: string, status: 'COMPLETED' | 'NO_SHOW' | 'CANCELLED' = 'COMPLETED') {
    return db.recruitmentInterview.update({
      where: { id },
      data: {
        status,
        notes,
        completedAt: new Date(),
      },
    });
  },
};