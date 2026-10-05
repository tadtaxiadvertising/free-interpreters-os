import prisma from '@/lib/prisma';

const db = prisma;

export const eventRepository = {
  async log(data: {
    applicationId: string;
    eventType: string;
    fromStatus?: string | null;
    toStatus: string;
    actorType: 'candidate' | 'admin' | 'system';
    actorId: string;
    metadata?: any;
  }) {
    return db.recruitmentEvent.create({
      data: {
        ...data,
        eventType: data.eventType as any,
        fromStatus: data.fromStatus as any,
        toStatus: data.toStatus as any,
      },
    });
  },

  async findByApplicationId(applicationId: string, limit = 50) {
    return db.recruitmentEvent.findMany({
      where: { applicationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  },

  async getTimeline(applicationId: string) {
    const events = await this.findByApplicationId(applicationId, 100);
    return events.map(e => ({
      id: e.id,
      type: e.eventType,
      fromStatus: e.fromStatus,
      toStatus: e.toStatus,
      actor: e.actorType,
      actorId: e.actorId,
      metadata: e.metadata,
      createdAt: e.createdAt,
    }));
  },
};