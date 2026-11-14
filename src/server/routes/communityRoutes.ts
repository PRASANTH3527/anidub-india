import { getAuth, validateAndRateLimitFeedback, extractClientIp } from '../../utils/auth';
import { buildVerifiedChatIdentity, validateChatSender } from '../../utils/chatIdentity';
import { getErrorMessage, sendTelegramAlert, type RouteContext } from './shared';

export async function handleCommunityRoutes(ctx: RouteContext): Promise<Response | null> {
  const { request, env, url, path, method, jsonResponse } = ctx;

  // 1. WebSocket Chat Handshake (/ws & /ws/api/chat/stream)
  if (path === '/ws' || path === '/ws/api/chat/stream') {
    const session = await getAuth(request, env);
    if (!session.userId) {
      return jsonResponse({ error: session.error || 'Unauthorized: Active Clerk user session required for chat stream' }, 401, request);
    }

    const identity = buildVerifiedChatIdentity({
      userId: session.userId,
      username: session.username,
      email: session.email,
      isAdmin: session.isAdmin,
      claims: session.claims,
      clerkUser: session.clerkUser,
    });
    const requestedUsername = url.searchParams.get('username') || url.searchParams.get('user');
    if (requestedUsername) {
      const handshakeCheck = validateChatSender({
        claimedUsername: requestedUsername,
        identity,
        env,
      });
      if (!handshakeCheck.ok) {
        return jsonResponse(
          { ok: false, code: handshakeCheck.code, error: handshakeCheck.error },
          handshakeCheck.status,
          request
        );
      }
    }

    if (
      env.CHAT_ROOM &&
      typeof env.CHAT_ROOM.idFromName === 'function' &&
      request.headers.get('Upgrade')?.toLowerCase() === 'websocket'
    ) {
      const roomId = env.CHAT_ROOM.idFromName('global-chat');
      const roomStub = env.CHAT_ROOM.get(roomId);
      return roomStub.fetch(request);
    }
    return jsonResponse({ ok: true, userId: session.userId, username: identity?.username || null }, 200, request);
  }

  // 2. Notifications Polling & SSE Stream
  if (path === '/api/notifications' && method === 'GET') {
    return jsonResponse({ success: true, notifications: [] }, 200, request, { 'Cache-Control': 'no-store' });
  }

  if (path === '/api/notifications/stream' && method === 'GET') {
    const ssePayload = `retry: 60000\ndata: ${JSON.stringify({ type: 'connected' })}\n\n`;
    return new Response(ssePayload, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
      },
    });
  }

  // 3. GET / POST /api/chat & /api/chat/messages
  if (path === '/api/chat' || path === '/api/chat/messages') {
    if (method === 'GET') {
      try {
        if (env.DB) {
          let list: Record<string, unknown>[] = [];
          try {
            const res = await env.DB.prepare(
              'SELECT id, user, text, timestamp, rating, language, isReview, clerk_user_id, created_at FROM chat_messages ORDER BY id ASC LIMIT 150'
            ).all();
            list = (res.results || []).map((m) => ({
              ...m,
              isReview: Boolean(m.isReview),
            }));
          } catch {
            const fallbackRes = await env.DB.prepare('SELECT * FROM chat_messages ORDER BY id ASC LIMIT 150')
              .all()
              .catch(() => ({ results: [] }));
            list = (fallbackRes.results || []).map((m) => ({
              id: m.id,
              user: m.user || m.username || 'Anonymous Fan',
              text: m.text || m.message || '',
              timestamp: m.timestamp || new Date().toISOString(),
              rating: m.rating !== undefined ? m.rating : null,
              language: m.language || m.dub_language || null,
              isReview: Boolean(m.isReview || m.is_review),
              clerk_user_id: m.clerk_user_id || null,
              created_at: m.created_at || null,
            }));
          }

          return jsonResponse({ success: true, count: list.length, messages: list, data: list });
        }
        return jsonResponse({ success: true, count: 0, messages: [], data: [] });
      } catch (err) {
        return jsonResponse({ error: getErrorMessage(err), messages: [] }, 500);
      }
    }

    if (method === 'POST') {
      try {
        const session = await getAuth(request, env);
        if (!session.userId) {
          return jsonResponse({ error: 'Unauthorized: Active Clerk user session required to post chat messages' }, 401, request);
        }

        const identity = buildVerifiedChatIdentity({
          userId: session.userId,
          username: session.username,
          email: session.email,
          isAdmin: session.isAdmin,
          claims: session.claims,
          clerkUser: session.clerkUser,
        });

        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
        const {
          user,
          username,
          user_name,
          text,
          message,
          comment,
          timestamp,
          rating,
          language,
          dub_language,
          dubLanguage,
          isReview,
          is_review,
          avatar,
          user_avatar,
          avatar_url,
        } = body;

        const rawText = text || message || comment;
        if (!rawText || !String(rawText).trim()) {
          return jsonResponse({ error: 'Missing message text' }, 400, request);
        }

        const claimedUsername = String(user ?? username ?? user_name ?? '');
        const senderCheck = validateChatSender({
          claimedUsername,
          identity,
          env,
        });
        if (!senderCheck.ok || !senderCheck.verifiedUsername) {
          return jsonResponse(
            {
              success: false,
              code: senderCheck.code,
              error: senderCheck.error || 'Username verification failed.',
            },
            senderCheck.status,
            request
          );
        }

        const cleanUser = senderCheck.verifiedUsername.slice(0, 50);
        const cleanClerkId = session.userId;
        const cleanText = String(rawText).slice(0, 1000);
        const cleanTimestamp = String(timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        const cleanRating = rating !== undefined && rating !== null && !isNaN(Number(rating)) ? Number(rating) : null;
        const cleanLanguage = language || dub_language || dubLanguage ? String(language || dub_language || dubLanguage).slice(0, 30) : null;
        const cleanIsReview = Boolean(isReview || is_review || cleanRating) ? 1 : 0;
        const cleanAvatar = avatar || user_avatar || avatar_url ? String(avatar || user_avatar || avatar_url).slice(0, 500) : null;

        if (env.DB) {
          try {
            const checkRes = await env.DB.prepare(
              "SELECT DISTINCT clerk_user_id FROM chat_messages WHERE LOWER(TRIM(user)) = LOWER(?) AND clerk_user_id IS NOT NULL AND clerk_user_id != ''"
            )
              .bind(cleanUser)
              .all();

            const existingOwners = checkRes.results || [];
            const claimedByOther = existingOwners.some(
              (row) => row.clerk_user_id && String(row.clerk_user_id).trim() !== cleanClerkId
            );

            if (claimedByOther) {
              return jsonResponse(
                {
                  success: false,
                  error: 'This username is already claimed by another user.',
                },
                400
              );
            }
          } catch {
            // Ignore if clerk_user_id check cannot run
          }

          let insertedId: number = Date.now();
          try {
            const insertRes = await env.DB.prepare(
              'INSERT INTO chat_messages (user, text, timestamp, rating, language, isReview, clerk_user_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
            )
              .bind(cleanUser, cleanText, cleanTimestamp, cleanRating, cleanLanguage, cleanIsReview, cleanClerkId)
              .run();
            insertedId = insertRes.meta?.last_row_id || Date.now();
          } catch {
            try {
              const fallbackInsert = await env.DB.prepare(
                'INSERT INTO chat_messages (user, text, timestamp) VALUES (?, ?, ?)'
              )
                .bind(cleanUser, cleanText, cleanTimestamp)
                .run();
              insertedId = fallbackInsert.meta?.last_row_id || Date.now();
            } catch (fbErr) {
              return jsonResponse({ error: getErrorMessage(fbErr) || 'Database insert failed' }, 500);
            }
          }

          return jsonResponse(
            {
              success: true,
              message: {
                id: insertedId,
                user: cleanUser,
                text: cleanText,
                timestamp: cleanTimestamp,
                rating: cleanRating,
                language: cleanLanguage,
                isReview: Boolean(cleanIsReview),
                clerk_user_id: cleanClerkId,
                avatar: cleanAvatar,
              },
            },
            201
          );
        }

        return jsonResponse({
          success: true,
          message: {
            id: Date.now(),
            user: cleanUser,
            text: cleanText,
            timestamp: cleanTimestamp,
            rating: cleanRating,
            language: cleanLanguage,
            isReview: Boolean(cleanIsReview),
            clerk_user_id: cleanClerkId,
          },
        });
      } catch (err) {
        return jsonResponse({ error: getErrorMessage(err) }, 500);
      }
    }
  }

  // 4. POST /api/feedback & /api/submit-feedback
  if ((path === '/api/feedback' || path === '/api/submit-feedback') && method === 'POST') {
    try {
      const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
      const clientIp = extractClientIp(request);
      const validation = validateAndRateLimitFeedback(body, clientIp);
      if (!validation.ok || !validation.sanitized) {
        return jsonResponse({ error: validation.error }, validation.status, request);
      }

      const { name: author, email, message } = validation.sanitized;

      if (env.DB) {
        await env.DB.prepare('INSERT INTO feedback (name_or_insta, email, feedback_text) VALUES (?, ?, ?)')
          .bind(author, email, message)
          .run();
      }

      const tgMsg =
        `💬 *NEW FEEDBACK / DUB SUBMISSION*\n\n` +
        `👤 *Name / Insta:* ${author}\n` +
        `📧 *Email:* ${email || 'N/A'}\n` +
        `📝 *Feedback:* ${message}\n\n` +
        `_Received via Anidub India Edge_`;
      await sendTelegramAlert(env, tgMsg);

      return jsonResponse({ success: true }, 201, request);
    } catch (err) {
      return jsonResponse({ error: getErrorMessage(err) }, 500, request);
    }
  }

  // 5. GET /api/feedback (Admin only)
  if (path === '/api/feedback' && method === 'GET') {
    const session = await getAuth(request, env);
    if (!session.userId || !session.isAdmin) {
      return jsonResponse({ error: session.error || 'Unauthorized: Valid Clerk Admin session required' }, 401, request);
    }
    try {
      if (env.DB) {
        const res = await env.DB.prepare('SELECT * FROM feedback ORDER BY id DESC').all();
        return jsonResponse({ feedback: res.results || [] });
      }
      return jsonResponse({ feedback: [] });
    } catch (err) {
      return jsonResponse({ error: getErrorMessage(err) }, 500);
    }
  }

  return null;
}
