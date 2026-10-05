import prisma from '@/lib/prisma';

const db = prisma;

export const contractRepository = {
  async findByApplicationId(applicationId: string) {
    return db.recruitmentContract.findUnique({
      where: { applicationId },
    });
  },

  async create(data: { applicationId: string; documentPath?: string }) {
    return db.recruitmentContract.create({
      data: {
        ...data,
        status: 'PENDING',
      },
    });
  },

  async getOrCreate(applicationId: string) {
    let contract = await db.recruitmentContract.findUnique({
      where: { applicationId },
    });

    if (!contract) {
      contract = await db.recruitmentContract.create({
        data: { applicationId, status: 'PENDING' },
      });
    }

    return contract;
  },

  async updateStatus(id: string, status: string, documentPath?: string) {
    return db.recruitmentContract.update({
      where: { id },
      data: {
        status: status as any,
        documentPath,
        signedAt: status === 'SIGNED' ? new Date() : undefined,
      },
    });
  },
};