import prisma from '@/lib/prisma';

const db = prisma;

export enum RecruitmentDocumentType {
  CV = 'CV',
  IDENTITY = 'IDENTITY',
  LANGUAGE_CERTIFICATE = 'LANGUAGE_CERTIFICATE',
  BACKGROUND_CHECK = 'BACKGROUND_CHECK',
  PHOTO = 'PHOTO',
  CONTRACT = 'CONTRACT',
  OTHER = 'OTHER',
}

export const documentRepository = {
  async findByApplicationId(applicationId: string) {
    return db.recruitmentDocument.findMany({
      where: { applicationId },
      orderBy: { createdAt: 'desc' },
    });
  },

  async findByApplicationIdAndType(applicationId: string, type: string) {
    return db.recruitmentDocument.findMany({
      where: { applicationId, type: type as any },
      orderBy: { createdAt: 'desc' },
    });
  },

  async create(data: {
    applicationId: string;
    type: string;
    storagePath: string;
    mimeType: string;
    size: number;
    status?: string;
  }) {
    return db.recruitmentDocument.create({
      data: {
        ...data,
        type: data.type as any,
        status: (data.status as any) || 'UPLOADED',
      },
    });
  },

  async updateStatus(id: string, status: string, reviewedBy?: string, rejectionReason?: string) {
    return db.recruitmentDocument.update({
      where: { id },
      data: {
        status: status as any,
        reviewedAt: new Date(),
        reviewedBy,
        rejectionReason,
      },
    });
  },

  async getRequiredDocuments(applicationId: string) {
    const docs = await db.recruitmentDocument.findMany({
      where: { applicationId },
    });

    const requiredTypes = ['CV', 'IDENTITY', 'LANGUAGE_CERTIFICATE'] as const;
    const requiredTypeSet = new Set(requiredTypes);
    const byType = new Map(
      docs.map(d => [d.type as string, d])
    );
    
    return requiredTypes.map(type => {
      const doc = byType.get(type);
      return {
        type,
        status: doc?.status || 'MISSING',
        document: doc,
      };
    });
  },

  async allApproved(applicationId: string) {
    const requiredTypes = ['CV', 'IDENTITY', 'LANGUAGE_CERTIFICATE'];
    const docs = await db.recruitmentDocument.findMany({
      where: { applicationId, type: { in: requiredTypes as any } },
    });

    return requiredTypes.every(type => {
      const doc = docs.find(d => d.type === type);
      return doc && doc.status === 'APPROVED';
    });
  },
};