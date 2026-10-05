import prisma from '@/lib/prisma';

const db = prisma;

export const trainingRepository = {
  async findByApplicationId(applicationId: string) {
    return db.recruitmentTraining.findUnique({
      where: { applicationId },
    });
  },

  async upsert(data: {
    applicationId: string;
    blocksCompleted?: any;
  }) {
    return db.recruitmentTraining.upsert({
      where: { applicationId: data.applicationId },
      create: data,
      update: data,
    });
  },

  async markBlockCompleted(applicationId: string, blockId: string, completedBy: string) {
    const training = await db.recruitmentTraining.findUnique({
      where: { applicationId },
    });

    const blocks = (training?.blocksCompleted as any) || {};
    blocks[blockId] = { completed: true, completedAt: new Date(), completedBy };

    return db.recruitmentTraining.upsert({
      where: { applicationId },
      create: { applicationId, blocksCompleted: blocks },
      update: { blocksCompleted: blocks },
    });
  },

  async complete(applicationId: string, completedBy: string) {
    return db.recruitmentTraining.update({
      where: { applicationId },
      data: {
        completedAt: new Date(),
        completedBy,
      },
    });
  },

  async isComplete(applicationId: string) {
    const training = await db.recruitmentTraining.findUnique({
      where: { applicationId },
    });
    return !!training?.completedAt;
  },
};