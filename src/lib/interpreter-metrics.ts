/**
 * Production logs are the source of truth for payable/interpreted time.
 * Live/manual calls synchronize into productionLogs, so dashboards must not add
 * callSession duration on top of productionLogs or minutes will be double-counted.
 */
export function getEffectiveLogMinutes(log: {
  interpretedMinutes?: number | null;
  verifiedMinutes?: number | null;
}) {
  return Number(log.verifiedMinutes ?? log.interpretedMinutes ?? 0);
}

export function sumEffectiveLogMinutes(
  logs: Array<{ interpretedMinutes?: number | null; verifiedMinutes?: number | null }> | null | undefined
) {
  return (logs || []).reduce((sum, log) => sum + getEffectiveLogMinutes(log), 0);
}

export function getMonthBounds(now = new Date()) {
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  startOfMonth.setHours(0, 0, 0, 0);

  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  endOfMonth.setHours(23, 59, 59, 999);

  return { startOfMonth, endOfMonth };
}

export function getDayBounds(now = new Date()) {
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  return { startOfDay, endOfDay };
}
