import test from 'node:test';
import assert from 'node:assert';
import { archiveEntityToRecycleBin } from '../src/server/routes/adminPhase35Routes';
import { checkDailyAiUsageQuota } from '../src/utils/adminPhase35Polish';

test('Recycle Bin aborts when archiving fails', async () => {
  const mockDbFailing = {
    prepare: () => ({
      bind: () => ({
        run: async () => ({ meta: { last_row_id: 0 } }),
        first: async () => null,
        all: async () => ({ results: [] }),
      }),
    }),
  };

  const binId = await archiveEntityToRecycleBin(mockDbFailing as any, {
    entity_type: 'anime',
    entity_id: 123,
    title: 'Test Anime',
    payload: { id: 123 },
    deleted_by: 'admin',
  });

  assert.strictEqual(binId, null, 'Should return null if archiving fails');
});

test('AI Cost Guard enforces fail-closed cap limits correctly', () => {
  const quotaUnder = checkDailyAiUsageQuota(50, 100);
  assert.strictEqual(quotaUnder.allowed, true);
  assert.strictEqual(quotaUnder.remaining, 50);

  const quotaOver = checkDailyAiUsageQuota(100, 100);
  assert.strictEqual(quotaOver.allowed, false);
  assert.strictEqual(quotaOver.remaining, 0);
});
