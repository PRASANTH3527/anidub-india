import test from 'node:test';
import assert from 'node:assert/strict';
import { syncAndDeduplicateChatMessages, DeduplicationMessage } from './chatDeduplication';

test('replaces optimistic temp_ message when database polling returns confirmed message', () => {
  const currentUserName = 'Eren_444n';

  // 1. Existing local state has an initial DB message and a temporary optimistic message
  const existing: DeduplicationMessage[] = [
    { id: 1, user: 'Daida_d8ce', text: 'Hi', timestamp: '01:46 PM' },
    { id: 'temp_1731056789_abc', user: 'Eren_444n', text: 'Solo Leveling episode 12 was fire!', timestamp: '01:50 PM', isSelf: true }
  ];

  // 2. Incoming database polling returns full history including newly saved message with real DB id: 2
  const incoming = [
    { id: 1, user: 'Daida_d8ce', text: 'Hi', timestamp: '01:46 PM' },
    { id: 2, user: 'Eren_444n', text: 'Solo Leveling episode 12 was fire!', timestamp: '01:50 PM' }
  ];

  const result = syncAndDeduplicateChatMessages(existing, incoming, currentUserName);

  // Should have exactly 2 messages (no duplicates!)
  assert.equal(result.length, 2);
  assert.equal(result[0].id, 1);
  assert.equal(result[1].id, 2);
  assert.equal(result[1].text, 'Solo Leveling episode 12 was fire!');
  // Optimistic temp message must be filtered out
  assert.equal(result.some(m => String(m.id).startsWith('temp_')), false);
});

test('strictly deduplicates repeated messages with same ID', () => {
  const currentUserName = 'Eren_444n';
  const incoming = [
    { id: 1, user: 'UserA', text: 'Hello' },
    { id: 1, user: 'UserA', text: 'Hello' },
    { id: 2, user: 'UserB', text: 'World' }
  ];

  const result = syncAndDeduplicateChatMessages([], incoming, currentUserName);
  assert.equal(result.length, 2);
  assert.equal(result[0].id, 1);
  assert.equal(result[1].id, 2);
});

test('preserves pending in-flight temporary optimistic message if not yet in database batch', () => {
  const currentUserName = 'Eren_444n';

  const existing: DeduplicationMessage[] = [
    { id: 1, user: 'Daida_d8ce', text: 'Hi', timestamp: '01:46 PM' },
    { id: 'temp_new_inflight', user: 'Eren_444n', text: 'In flight message still sending', timestamp: '01:47 PM' }
  ];

  // Database hasn't recorded it yet
  const incoming = [
    { id: 1, user: 'Daida_d8ce', text: 'Hi' }
  ];

  const result = syncAndDeduplicateChatMessages(existing, incoming, currentUserName);
  assert.equal(result.length, 2);
  assert.equal(result[0].id, 1);
  assert.equal(result[1].id, 'temp_new_inflight');
  assert.equal(result[1].text, 'In flight message still sending');
});

test('correctly preserves two different messages sent by the same user', () => {
  const currentUserName = 'Eren_444n';

  const incoming = [
    { id: 1, user: 'Eren_444n', text: 'First comment' },
    { id: 2, user: 'Eren_444n', text: 'Second comment' }
  ];

  const result = syncAndDeduplicateChatMessages([], incoming, currentUserName);
  assert.equal(result.length, 2);
  assert.equal(result[0].text, 'First comment');
  assert.equal(result[1].text, 'Second comment');
});

test('deduplicates seamlessly when client-side unique ID is used for both optimistic UI and database message', () => {
  const currentUserName = 'Eren_444n';
  const clientUniqueId = 'cuid_1731056789_xyz99';

  // 1. Client creates optimistic message with unique client ID
  const existing: DeduplicationMessage[] = [
    { id: 'msg_1', user: 'Zoro_99', text: 'Hey there', timestamp: '01:00 PM' },
    { id: clientUniqueId, user: 'Eren_444n', text: 'Tatacaw!', timestamp: '01:05 PM', isSelf: true }
  ];

  // 2. Polling returns database list where backend saved the exact same client unique ID
  const incoming = [
    { id: 'msg_1', user: 'Zoro_99', text: 'Hey there', timestamp: '01:00 PM' },
    { id: clientUniqueId, user: 'Eren_444n', text: 'Tatacaw!', timestamp: '01:05 PM' }
  ];

  const result = syncAndDeduplicateChatMessages(existing, incoming, currentUserName);
  // Must have exactly 2 messages (no duplicates!)
  assert.equal(result.length, 2);
  assert.equal(result[0].id, 'msg_1');
  assert.equal(result[1].id, clientUniqueId);
  assert.equal(result[1].text, 'Tatacaw!');
});

test('handles UUID formatted client IDs without duplication', () => {
  const currentUserName = 'Mikasa_01';
  const uuid = '550e8400-e29b-41d4-a716-446655440000';

  const existing: DeduplicationMessage[] = [
    { id: uuid, user: 'Mikasa_01', text: 'Eren!', timestamp: '01:10 PM', isSelf: true }
  ];

  const incoming = [
    { id: uuid, user: 'Mikasa_01', text: 'Eren!', timestamp: '01:10 PM' }
  ];

  const result = syncAndDeduplicateChatMessages(existing, incoming, currentUserName);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, uuid);
});
