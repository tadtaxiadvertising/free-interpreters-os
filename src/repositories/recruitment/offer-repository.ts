import prisma from '@/lib/prisma';

const db = prisma;

export const offerRepository = {
  async findByApplicationId(applicationId: string) {
    return db.recruitmentOffer.findMany({
      where: { applicationId },
      orderBy: { createdAt: 'desc' },
    });
  },

  async findLatestByApplicationId(applicationId: string) {
    return db.recruitmentOffer.findFirst({
      where: { applicationId },
      orderBy: { createdAt: 'desc' },
    });
  },

  async create(data: {
    applicationId: string;
    status?: string;
    expiresAt?: Date;
    termsVersion?: string;
    documentPath?: string;
  }) {
    return db.recruitmentOffer.create({
      data: {
        ...data,
        status: (data.status as any) || 'DRAFT',
      },
    });
  },

  async update(id: string, data: Partial<{
    status: string;
    sentAt: Date | null;
    acceptedAt: Date | null;
    rejectedAt: Date | null;
    expiresAt: Date | null;
    documentPath: string | null;
  }>) {
    return db.recruitmentOffer.update({
      where: { id },
      data: {
        ...data,
        status: data.status as any,
      },
    });
  },

  async send(id: string, expiresAt: Date, documentPath: string) {
    return db.recruitmentOffer.update({
      where: { id },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        expiresAt,
        documentPath,
      },
    });
  },

  async accept(id: string) {
    return db.recruitmentOffer.update({
      where: { id },
      data: {
        status: 'ACCEPTED',
        acceptedAt: new Date(),
      },
    });
  },

  async reject(id: string) {
    return db.recruitmentOffer.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectedAt: new Date(),
      },
    });
  },
};