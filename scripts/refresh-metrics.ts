#!/usr/bin/env tsx
/**
 * Metrics Refresh Cron Job
 * 
 * This script refreshes all interpreter monthly metrics and recalculates rankings.
 * Run via cron (e.g., every hour during business hours, or daily at midnight)
 * 
 * Usage: npx tsx scripts/refresh-metrics.ts
 */

import prisma from '@/lib/prisma';
import { refreshAllMetrics, getLeaderboard } from '@/services/metrics/metrics-service';

const db = prisma;

async function main() {
  console.log(`🔄 [Metrics Refresh] ${new Date().toISOString()}`);
  console.log('─'.repeat(50));

  try {
    const result = await refreshAllMetrics();
    
    console.log(`✅ Updated: ${result.updated} interpreters`);
    console.log(`❌ Errors: ${result.errors}`);
    
    // Show top 10 leaderboard
    const leaderboard = await getLeaderboard(undefined, 10);
    console.log('\n🏆 Top 10 Leaderboard:');
    leaderboard.forEach((entry, index) => {
      console.log(`  ${index + 1}. ${entry.name} - ${entry.interpretedMinutes} min (QA: ${entry.qaScore ?? 'N/A'})`);
    });
    
    console.log('\n✅ Metrics refresh complete');
  } catch (error) {
    console.error('🔴 [Metrics Refresh] Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();