import prisma from '@/lib/prisma';

const db = prisma;

export const accessRepository = {
  async findByTokenHash(tokenHash: string) {
    return db.recruitmentAccess.findUnique({
      where: { tokenHash },
      include: { application: { include: { candidate: true } } },
    });
  },

  async findByInviteCode(inviteCode: string) {
    return db.recruitmentAccess.findUnique({
      where: { inviteCode: inviteCode.toUpperCase() },
      include: { application: { include: { candidate: true } } },
    });
  },

  async findByApplicationId(applicationId: string) {
    return db.recruitmentAccess.findUnique({
      where: { applicationId },
    });
  },

  async getOrCreate(applicationId: string) {
    let access = await db.recruitmentAccess.findUnique({
      where: { applicationId },
    });

    if (access) {
      return access;
    }

    const { randomBytes, createHash } = await import('crypto');
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const inviteCode = randomBytes(4).toString('base64url').slice(0, 8).toUpperCase();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    access = await db.recruitmentAccess.create({
      data: {
        applicationId,
        tokenHash,
        inviteCode,
        expiresAt,
      },
    });

    return access;
  },

  async markLastUsed(applicationId: string) {
    return db.recruitmentAccess.update({
      where: { applicationId },
      data: { lastUsedAt: new Date() },
    });
  },

  async markValidated(applicationId: string) {
    return db.recruitmentAccess.update({
      where: { applicationId },
      data: { lastUsedAt: new Date() },
    });
  },

  async revoke(applicationId: string) {
    return db.recruitmentAccess.update({
      where: { applicationId },
      data: { revokedAt: new Date() },
    });
  },

  async isValid(applicationId: string) {
    const access = await db.recruitmentAccess.findUnique({
      where: { applicationId },
    });

    if (!access) return { valid: false, reason: 'NOT_FOUND' };
    if (access.revokedAt) return { valid: false, reason: 'REVOKED' };
    if (access.lastUsedAt) return { valid: false, reason: 'ALREADY_USED' };
    if (access.expiresAt < new Date()) return { valid: false, reason: 'EXPIRED' };

    return { valid: true, access };
  },
};