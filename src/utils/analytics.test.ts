import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getOrCreateSessionId, calculateScrollDepth, TrackPayload } from './analytics';

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
});
