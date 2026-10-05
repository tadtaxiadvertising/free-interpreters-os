import prisma from '@/lib/prisma';

const db = prisma;

export const techSetupRepository = {
  async findByApplicationId(applicationId: string) {
    return db.recruitmentTechSetup.findUnique({
      where: { applicationId },
    });
  },

  async upsert(data: {
    applicationId: string;
    hardware?: any;
    connectionType?: string;
    ping?: number;
    download?: number;
    upload?: number;
    jitter?: number;
    packetLoss?: number;
    headset?: boolean;
    microphone?: boolean;
    browser?: string;
    softphone?: string;
    mockCallCompleted?: boolean;
  }) {
    return db.recruitmentTechSetup.upsert({
      where: { applicationId: data.applicationId },
      create: data,
      update: data,
    });
  },

  async complete(applicationId: string, completedBy: string) {
    return db.recruitmentTechSetup.update({
      where: { applicationId },
      data: {
        mockCallCompleted: true,
        completedAt: new Date(),
        completedBy,
      },
    });
  },

  async isComplete(applicationId: string) {
    const setup = await db.recruitmentTechSetup.findUnique({
      where: { applicationId },
    });
    return !!setup?.mockCallCompleted;
  },
};