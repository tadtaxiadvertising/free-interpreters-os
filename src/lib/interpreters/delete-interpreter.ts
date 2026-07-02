/**
 * Deletes every database row that can keep interpreter profile data visible.
 *
 * We intentionally delete related rows explicitly instead of relying only on
 * database-level cascades because production schemas can drift from the Prisma
 * relation metadata. Keeping this cleanup in one place makes server actions and
 * API routes behave identically.
 */
export async function deleteInterpreterDatabaseRecords(tx: any, interpreterId: number) {
  const interpreter = await tx.interpreter.findUnique({
    where: { id: interpreterId },
    select: {
      id: true,
      userProfile: { select: { id: true } },
    },
  });

  if (!interpreter) {
    throw new Error('Intérprete no encontrado');
  }

  await tx.userProfile.deleteMany({ where: { interpreterId } });
  await tx.interpreterAccountRate.deleteMany({ where: { interpreterId } });
  await tx.payrateAuditLog.deleteMany({ where: { interpreterId } });
  await tx.qAScore.deleteMany({ where: { interpreterId } });
  await tx.productionLog.deleteMany({ where: { interpreterId } });
  await tx.callSession.deleteMany({ where: { interpreterId } });
  await tx.payrollRecord.deleteMany({ where: { interpreterId } });

  await tx.interpreter.delete({ where: { id: interpreterId } });

  return {
    authUserId: interpreter.userProfile?.id ?? null,
  };
}
