import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildVerifiedChatIdentity,
  getVerifiedClerkUsername,
  isReservedChatName,
  validateChatSender,
} from '../src/utils/chatIdentity';
import { ChatRoom } from '../src/chat-room';
import { onRequest } from '../functions/api/[[route]]';

function createMockWebSocket() {
  const sent: string[] = [];
  let attachment: any = null;
  return {
    sent,
    send(payload: string) {
      sent.push(payload);
    },
    serializeAttachment(data: any) {
      attachment = data;
    },
    deserializeAttachment() {
      return attachment;
    },
    close() {},
  };
}

function createSignedJwt(payload: Record<string, any>, privateKeyPem: string): string {
  const header = Buffer.from(
    JSON.stringify({ alg: 'RS256', typ: 'JWT', cat: 'cl_B7d4PD111AAA' })
  ).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = Buffer.from(
    JSON.stringify({
      iat: now - 5,
      nbf: now - 5,
      exp: now + 300,
      ...payload,
    })
  ).toString('base64url');
  const unsigned = `${header}.${fullPayload}`;
  const sig = crypto.sign('RSA-SHA256', Buffer.from(unsigned), privateKeyPem).toString('base64url');
  return `${unsigned}.${sig}`;
}

test('Reserved names protection blocks Admin, System, Moderator, obfuscations, and configured ADMIN_EMAIL', () => {
  const env = { ADMIN_EMAIL: 'chief.curator@anidub.in' };

  assert.equal(isReservedChatName('Admin', env), true);
  assert.equal(isReservedChatName('ADMIN', env), true);
  assert.equal(isReservedChatName('A_d.m-i n', env), true);
  assert.equal(isReservedChatName('System', env), true);
  assert.equal(isReservedChatName('Moderator', env), true);
  assert.equal(isReservedChatName('mod', env), true);
  assert.equal(isReservedChatName('Staff', env), true);
  assert.equal(isReservedChatName('AniDub Bot', env), true);
  assert.equal(isReservedChatName('chief.curator@anidub.in', env), true);
  assert.equal(isReservedChatName('chief.curator', env), true);

  assert.equal(isReservedChatName('Rohan_Dubs', env), false);
  assert.equal(isReservedChatName('ChennaiOtaku', env), false);
});

test('getVerifiedClerkUsername and validateChatSender enforce exact Clerk identity and reject spoofing', () => {
  const env = { ADMIN_EMAIL: 'boss@anidub.in' };
  const regularUser = {
    id: 'user_regular_123',
    username: 'otaku_rohan',
    firstName: 'Rohan',
    lastName: 'K',
    primaryEmailAddress: { emailAddress: 'rohan@example.com' },
  };

  const clientUsername = getVerifiedClerkUsername(regularUser);
  assert.equal(clientUsername, 'otaku_rohan');

  const identity = buildVerifiedChatIdentity({
    userId: regularUser.id,
    email: 'rohan@example.com',
    isAdmin: false,
    clerkUser: regularUser,
  });
  assert.ok(identity);

  // Matching verified username is allowed
  const validResult = validateChatSender({
    claimedUsername: 'otaku_rohan',
    identity,
    env,
  });
  assert.equal(validResult.ok, true);
  assert.equal(validResult.verifiedUsername, 'otaku_rohan');

  // Impersonating another user is rejected with 403 USERNAME_MISMATCH
  const spoofOther = validateChatSender({
    claimedUsername: 'another_user',
    identity,
    env,
  });
  assert.equal(spoofOther.ok, false);
  assert.equal(spoofOther.status, 403);
  assert.equal(spoofOther.code, 'USERNAME_MISMATCH');

  // Claiming reserved names as regular user is rejected with 403 RESERVED_USERNAME
  for (const reserved of ['Admin', 'System', 'Moderator', 'boss@anidub.in', 'boss']) {
    const res = validateChatSender({
      claimedUsername: reserved,
      identity,
      env,
    });
    assert.equal(res.ok, false);
    assert.equal(res.status, 403);
    assert.equal(res.code, 'RESERVED_USERNAME');
  }

  // Missing username is rejected with 400
  const missingResult = validateChatSender({
    claimedUsername: '',
    identity,
    env,
  });
  assert.equal(missingResult.ok, false);
  assert.equal(missingResult.status, 400);
  assert.equal(missingResult.code, 'MISSING_USERNAME');

  // Even if a regular user somehow set their Clerk profile name to "Admin", non-admins get safe fallback & cannot broadcast "Admin"
  const cheekyUserIdentity = buildVerifiedChatIdentity({
    userId: 'user_998877',
    username: 'Admin',
    email: 'cheeky@example.com',
    isAdmin: false,
  });
  const cheekyAttempt = validateChatSender({
    claimedUsername: 'Admin',
    identity: cheekyUserIdentity,
    env,
  });
  assert.equal(cheekyAttempt.ok, false);
  assert.equal(cheekyAttempt.code, 'RESERVED_USERNAME');

  // Actual Admin can send with their verified admin profile
  const adminIdentity = buildVerifiedChatIdentity({
    userId: 'user_admin_1',
    username: 'Admin',
    email: 'boss@anidub.in',
    isAdmin: true,
  });
  const adminCheck = validateChatSender({
    claimedUsername: 'Admin',
    identity: adminIdentity,
    env,
  });
  assert.equal(adminCheck.ok, true);
  assert.equal(adminCheck.verifiedUsername, 'Admin');
});

test('ChatRoom Durable Object rejects unauthenticated upgrades, rejects spoofed WS messages, and emits error frame only to sender', async () => {
  const env = {
    ADMIN_EMAIL: 'admin@anidub.in',
    CLERK_SECRET_KEY: 'sk_test_example',
  };

  const connectedSockets: any[] = [];
  const fakeState = {
    getWebSockets: () => connectedSockets,
  };
  const room = new ChatRoom(fakeState, env);

  // Unauthenticated WebSocket upgrade must be rejected with 401
  const unauthUpgradeReq = new Request('https://anidub.in/ws', {
    headers: { Upgrade: 'websocket' },
  });
  const unauthRes = await room.fetch(unauthUpgradeReq);
  assert.equal(unauthRes.status, 401);

  const senderWs = createMockWebSocket();
  const bystanderWs = createMockWebSocket();
  connectedSockets.push(senderWs, bystanderWs);

  const verifiedIdentity = buildVerifiedChatIdentity({
    userId: 'user_clerk_42',
    username: 'tamil_otaku',
    email: 'tamil_otaku@example.com',
    isAdmin: false,
  });
  assert.ok(verifiedIdentity);
  room.attachVerifiedIdentity(senderWs, verifiedIdentity);

  // Spoofed username payload -> rejected, error event sent to senderWs, nothing broadcast to bystanderWs
  const spoofedRes = room.processMessageForSocket(
    senderWs,
    JSON.stringify({
      id: 'msg_spoof_1',
      user: 'Admin',
      text: 'I am pretending to be Admin!',
    })
  );
  assert.equal(spoofedRes.accepted, false);
  assert.equal(spoofedRes.code, 'RESERVED_USERNAME');
  assert.equal(bystanderWs.sent.length, 0);
  assert.equal(senderWs.sent.length, 1);

  const errFrame = JSON.parse(senderWs.sent[0]);
  assert.equal(errFrame.type, 'error');
  assert.equal(errFrame.code, 'RESERVED_USERNAME');
  assert.equal(errFrame.messageId, 'msg_spoof_1');
  assert.ok(errFrame.error.includes('reserved'));

  // Mismatched non-reserved username -> rejected with USERNAME_MISMATCH
  const mismatchRes = room.processMessageForSocket(
    senderWs,
    JSON.stringify({
      id: 'msg_spoof_2',
      user: 'SomeOtherUser',
      text: 'Trying another name',
    })
  );
  assert.equal(mismatchRes.accepted, false);
  assert.equal(mismatchRes.code, 'USERNAME_MISMATCH');
  assert.equal(bystanderWs.sent.length, 0);
  assert.equal(senderWs.sent.length, 2);

  // Valid verified username -> accepted and broadcasted to all connected sockets with server-stamped clerk_user_id
  const validRes = room.processMessageForSocket(
    senderWs,
    JSON.stringify({
      id: 'msg_valid_1',
      user: 'tamil_otaku',
      text: 'Hello everyone!',
    })
  );
  assert.equal(validRes.accepted, true);
  assert.equal(bystanderWs.sent.length, 1);
  const broadcastFrame = JSON.parse(bystanderWs.sent[0]);
  assert.equal(broadcastFrame.user, 'tamil_otaku');
  assert.equal(broadcastFrame.clerk_user_id, 'user_clerk_42');
  assert.equal(broadcastFrame.text, 'Hello everyone!');
});

test('/api/chat POST and /ws enforce Clerk JWT auth and reject impersonation with cryptographic tokens', async () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const env = {
    ADMIN_EMAIL: 'admin@anidub.in',
    CLERK_JWT_KEY: publicKey,
    DB: null,
  };

  // 1. Unauthenticated /api/chat POST -> 401
  const unauthChatRes = await onRequest({
    request: new Request('https://anidub.in/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: 'Admin', text: 'Spoof attempt' }),
    }),
    env,
  });
  assert.equal(unauthChatRes.status, 401);

  // 2. Forged token on /ws -> 401
  const forgedWsRes = await onRequest({
    request: new Request('https://anidub.in/ws?token=invalid.jwt.token&username=Admin', {
      headers: { Upgrade: 'websocket' },
    }),
    env,
  });
  assert.equal(forgedWsRes.status, 401);

  // 3. Valid signed Clerk user JWT attempting to impersonate "Admin" on POST /api/chat -> 403
  const regularJwt = createSignedJwt(
    {
      sub: 'user_signed_101',
      sid: 'sess_101',
      username: 'verified_listener',
      email: 'listener@example.com',
    },
    privateKey
  );

  const spoofPostRes = await onRequest({
    request: new Request('https://anidub.in/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${regularJwt}`,
      },
      body: JSON.stringify({ user: 'Admin', text: 'Trying to impersonate admin' }),
    }),
    env,
  });
  assert.equal(spoofPostRes.status, 403);
  const spoofPostJson: any = await spoofPostRes.json();
  assert.equal(spoofPostJson.code, 'RESERVED_USERNAME');

  // 4. Valid signed Clerk user JWT attempting to claim another user's username on /ws handshake -> 403
  const spoofWsHandshake = await onRequest({
    request: new Request(`https://anidub.in/ws?token=${encodeURIComponent(regularJwt)}&username=System`, {
      headers: { Upgrade: 'websocket' },
    }),
    env,
  });
  assert.equal(spoofWsHandshake.status, 403);

  // 5. Valid signed Clerk user JWT posting with their exact verified username -> 200 & stamped username
  const validPostRes = await onRequest({
    request: new Request('https://anidub.in/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${regularJwt}`,
      },
      body: JSON.stringify({ user: 'verified_listener', text: 'Great Tamil dub!' }),
    }),
    env,
  });
  assert.equal(validPostRes.status, 200);
  const validPostJson: any = await validPostRes.json();
  assert.equal(validPostJson.success, true);
  assert.equal(validPostJson.message.user, 'verified_listener');
  assert.equal(validPostJson.message.clerk_user_id, 'user_signed_101');
});

test('LiveChat.tsx and AnimeDetailPage.tsx enforce Clerk verified username and handle WebSocket error events', () => {
  const liveChatCode = fs.readFileSync(path.join(process.cwd(), 'src/components/LiveChat.tsx'), 'utf-8');
  assert.ok(liveChatCode.includes('getVerifiedClerkUsername(user)'));
  assert.ok(liveChatCode.includes("data.type === 'error'"));
  assert.ok(liveChatCode.includes('setChatError(errorText)'));
  assert.ok(liveChatCode.includes('username: verifiedUsername'));

  const detailPageCode = fs.readFileSync(path.join(process.cwd(), 'src/components/AnimeDetailPage.tsx'), 'utf-8');
  assert.ok(detailPageCode.includes('getVerifiedClerkUsername(user)'));
  assert.ok(detailPageCode.includes("errData?.type === 'error'"));
});
