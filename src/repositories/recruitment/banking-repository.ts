import prisma from '@/lib/prisma';

const db = prisma;

export const bankingRepository = {
  async findByApplicationId(applicationId: string) {
    return db.recruitmentBanking.findUnique({
      where: { applicationId },
    });
  },

  async upsert(data: {
    applicationId: string;
    bankName: string;
    bankAccount: string;
    bankAccountType: string;
    bankCedula: string;
  }) {
    return db.recruitmentBanking.upsert({
      where: { applicationId: data.applicationId },
      create: data,
      update: data,
    });
  },

  async markVerified(applicationId: string, verifiedBy: string) {
    return db.recruitmentBanking.update({
      where: { applicationId },
      data: {
        verifiedAt: new Date(),
        verifiedBy,
      },
    });
  },

  async isComplete(applicationId: string) {
    const banking = await db.recruitmentBanking.findUnique({
      where: { applicationId },
    });
    return !!banking;
  },
};