import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getOrCreateSessionId, calculateScrollDepth, calculateDevicePercentage, TrackPayload } from './analytics';

describe('Custom Web Analytics (God Mode Tracker Utility)', () => {
  it('generates a session ID prefixed with sess_ in fallback environment', () => {
    const id = getOrCreateSessionId();
    assert.ok(typeof id === 'string');
    assert.ok(id.startsWith('sess_'));
  });

  it('calculates scroll depth bounded between 0 and 100', () => {
    const depth = calculateScrollDepth();
    assert.ok(typeof depth === 'number');
    assert.ok(depth >= 0 && depth <= 100);
  });

  it('properly shapes TrackPayload interface', () => {
    const payload: TrackPayload = {
      sessionId: 'sess_123',
      type: 'event',
      eventType: 'clicked_crunchyroll',
      targetId: 'https://crunchyroll.com/anime/1',
      timeSpentSeconds: 45,
      maxScrollDepth: 80
    };
    assert.strictEqual(payload.eventType, 'clicked_crunchyroll');
    assert.strictEqual(payload.maxScrollDepth, 80);
  });

  it('calculates device percentage based on unique visitors accurately', () => {
    // If 1 unique user visits 4 times on mobile, mobile unique count is 1 out of 1 unique visitor (100%), not 1 out of 4 sessions (25%)
    const pctSingleUser = calculateDevicePercentage(1, 1);
    assert.strictEqual(pctSingleUser, 100);

    // 8 unique mobile devices out of 10 unique visitors
    const pctMobile = calculateDevicePercentage(8, 10);
    assert.strictEqual(pctMobile, 80);

    // 2 unique desktop devices out of 10 unique visitors
    const pctDesktop = calculateDevicePercentage(2, 10);
    assert.strictEqual(pctDesktop, 20);
  });

  it('handles zero and edge cases in calculateDevicePercentage safely', () => {
    assert.strictEqual(calculateDevicePercentage(0, 0), 0);
    assert.strictEqual(calculateDevicePercentage(5, 0), 0);
    assert.strictEqual(calculateDevicePercentage(0, 10), 0);
    assert.strictEqual(calculateDevicePercentage(-1, 10), 0);
  });
});

