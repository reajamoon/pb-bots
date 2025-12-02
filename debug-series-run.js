// Debug runner for processing an AO3 series URL
import 'dotenv/config';
import batchSeriesRecommendationJob from './src/shared/recUtils/batchSeriesRecommendationJob.js';
import { sequelize, ParseQueue } from './src/models/index.js';

async function waitForIdle(idleMs = 15000, pollMs = 1000) {
  const exitOnIdle = (process.env.DEBUG_EXIT_ON_IDLE || 'true').toLowerCase() === 'true';
  if (!exitOnIdle) return;
  let lastNonZeroAt = Date.now();
  let lastCount = -1;
  console.log(`[debug-series-run] Waiting for idle: idleMs=${idleMs} pollMs=${pollMs}`);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const pendingCount = await ParseQueue.count({ where: { status: 'pending' } });
      const processingCount = await ParseQueue.count({ where: { status: 'processing' } });
      const totalActive = pendingCount + processingCount;
      if (totalActive !== lastCount) {
        console.log(`[debug-series-run] Queue activity: pending=${pendingCount} processing=${processingCount}`);
        lastCount = totalActive;
      }
      if (totalActive > 0) {
        lastNonZeroAt = Date.now();
      }
      const idleFor = Date.now() - lastNonZeroAt;
      if (idleFor >= idleMs) {
        console.log('[debug-series-run] Idle threshold reached. Exiting.');
        return;
      }
    } catch (e) {
      console.warn('[debug-series-run] Idle wait error:', e?.message || e);
      return; // Do not block exit on errors
    }
    await new Promise(r => setTimeout(r, pollMs));
  }
}

async function main() {
  const url = process.argv[2] || 'https://archiveofourown.org/series/174695';
  const user = { id: 'debug-user-1', username: 'debugger' };
  try {
    const result = await batchSeriesRecommendationJob({ url, user, isUpdate: true });
    console.log('Series processing result:', JSON.stringify({
      type: result.type,
      id: result.id,
      seriesId: result.seriesId,
      seriesRecord: {
        id: result.seriesRecord?.id,
        name: result.seriesRecord?.name,
        workCount: result.seriesRecord?.workCount,
        ao3SeriesId: result.seriesRecord?.ao3SeriesId
      },
      processedWorksCount: result.processedWorks?.length,
      totalWorks: result.totalWorks,
      errors: result.error || null
    }, null, 2));
    // Allow queue to finish any follow-up AO3 fetches, then exit on idle
    await waitForIdle(Number(process.env.DEBUG_IDLE_MS || 15000), Number(process.env.DEBUG_POLL_MS || 1000));
    await sequelize.close();
    process.exit(0);
  } catch (e) {
    console.error('Error running series debug:', e);
    try { await sequelize.close(); } catch {}
    process.exit(1);
  }
}

main();
