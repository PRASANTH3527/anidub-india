import {
  getAuth,
  verifyChatTokenDirect,
  extractExplicitChatToken,
  hasUrlQueryToken,
  validateAndRateLimitFeedback,
  extractClientIp,
} from '../../utils/auth';
import { buildVerifiedChatIdentity, validateChatSender } from '../../utils/chatIdentity';
import { buildRateLimitHeaders, checkChatRateLimit } from '../../utils/rateLimiter';
import { getErrorMessage, sendTelegramAlert, type RouteContext } from './shared';

export async function handleCommunityRoutes(ctx: RouteContext): Promise<Response | null> {
  const { request, env, url, path, method, jsonResponse } = ctx;

  // 1. WebSocket Chat Handshake (/ws & /ws/api/chat/stream)
  // Authentication is performed via initial post-connect WS `{ type: 'auth', token }` frame (never URL ?token=).
  if (path === '/ws' || path === '/ws/api/chat/stream') {
    if (hasUrlQueryToken(request)) {
      return jsonResponse(
        {
          ok: false,
          code: 'URL_TOKEN_FORBIDDEN',
          error: 'Unauthorized: WebSocket authentication tokens must not be passed in URL query strings.',
        },
        401,
        request
      );
    }

    const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
    const isWsUpgrade = request.headers.get('Upgrade')?.toLowerCase() === 'websocket';

    if (authHeader || !isWsUpgrade) {
      const explicitWsToken = extractExplicitChatToken(request);
      const session = await verifyChatTokenDirect(explicitWsToken, env);
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

      if (!isWsUpgrade) {
        return jsonResponse({ ok: true, userId: session.userId, username: identity?.username || null }, 200, request);
      }
    }

    if (env.CHAT_ROOM && typeof env.CHAT_ROOM.idFromName === 'function' && isWsUpgrade) {
      const roomId = env.CHAT_ROOM.idFromName('global-chat');
      const roomStub = env.CHAT_ROOM.get(roomId);
      return roomStub.fetch(request);
    }

    return jsonResponse(
      { ok: false, error: 'WebSocket Durable Object binding (CHAT_ROOM) unavailable.' },
      503,
      request
    );
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

  // 2b. GET /api/dub-updates (P2 #2 Recent Verified Dub Updates Feed)
  if (path === '/api/dub-updates' && method === 'GET') {
    const rawLimit = parseInt(url.searchParams.get('limit') || '15', 10);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 50) : 15;
    if (!env.DB) {
      return jsonResponse({ success: true, updates: [], data: [] }, 200, request);
    }
    try {
      const res = await env.DB.prepare(
        'SELECT id, anime_id, anime_title, update_type, summary, created_at FROM dub_updates ORDER BY id DESC LIMIT ?'
      )
        .bind(limit)
        .all();
      const updates = res.results || [];
      return jsonResponse({ success: true, count: updates.length, updates, data: updates }, 200, request, {
        'Cache-Control': 'public, max-age=30',
      });
    } catch (err) {
      const msg = getErrorMessage(err).toLowerCase();
      if (msg.includes('no such table')) {
        return jsonResponse({ success: true, count: 0, updates: [], data: [] }, 200, request);
      }
      return jsonResponse({ success: false, error: getErrorMessage(err), updates: [], data: [] }, 500, request);
    }
  }

  // 3. GET / POST /api/chat & /api/chat/messages
  if (path === '/api/chat' || path === '/api/chat/messages') {
    if (method === 'GET') {
      try {
        if (env.DB) {
          const rawLimit = parseInt(url.searchParams.get('limit') || '50', 10);
          const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 50;
          const rawBeforeId = url.searchParams.get('beforeId') ?? url.searchParams.get('before_id');
          const parsedBeforeId = rawBeforeId ? parseInt(rawBeforeId, 10) : NaN;
          const beforeId = Number.isInteger(parsedBeforeId) && parsedBeforeId > 0 ? parsedBeforeId : null;
          const fetchLimit = limit + 1;

          let list: Record<string, unknown>[] = [];
          try {
            const stmt = beforeId
              ? env.DB.prepare(
                  'SELECT id, user, text, timestamp, rating, language, isReview, clerk_user_id, avatar, created_at FROM chat_messages WHERE id < ? ORDER BY id DESC LIMIT ?'
                ).bind(beforeId, fetchLimit)
              : env.DB.prepare(
                  'SELECT id, user, text, timestamp, rating, language, isReview, clerk_user_id, avatar, created_at FROM chat_messages ORDER BY id DESC LIMIT ?'
                ).bind(fetchLimit);
            const res = await stmt.all();
            list = (res.results || []).map((m) => ({
              ...m,
              isReview: Boolean(m.isReview),
            }));
          } catch (projErr) {
            const errMsg = getErrorMessage(projErr).toLowerCase();
            if (!errMsg.includes('no such column')) {
              throw projErr;
            }
            const fallbackStmt = beforeId
              ? env.DB.prepare('SELECT * FROM chat_messages WHERE id < ? ORDER BY id DESC LIMIT ?').bind(
                  beforeId,
                  fetchLimit
                )
              : env.DB.prepare('SELECT * FROM chat_messages ORDER BY id DESC LIMIT ?').bind(fetchLimit);
            const fallbackRes = await fallbackStmt.all();
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

          const hasMore = list.length > limit;
          const pageDescending = hasMore ? list.slice(0, limit) : list;
          const chronological = [...pageDescending].reverse();
          const oldestId = chronological.length > 0 ? Number(chronological[0].id) : null;
          const nextBeforeId = hasMore && oldestId && Number.isFinite(oldestId) ? oldestId : null;

          return jsonResponse(
            {
              success: true,
              count: chronological.length,
              hasMore,
              nextBeforeId,
              messages: chronological,
              data: chronological,
            },
            200,
            request
          );
        }
        return jsonResponse(
          { success: true, count: 0, hasMore: false, nextBeforeId: null, messages: [], data: [] },
          200,
          request
        );
      } catch (err) {
        return jsonResponse(
          { success: false, error: getErrorMessage(err), hasMore: false, nextBeforeId: null, messages: [], data: [] },
          500,
          request
        );
      }
    }

    if (method === 'POST') {
      try {
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
        const explicitToken = extractExplicitChatToken(request, body);
        const session = await verifyChatTokenDirect(explicitToken, env);
        if (!session.userId) {
          return jsonResponse(
            { error: session.error || 'Unauthorized: Active Clerk user session required to post chat messages' },
            401,
            request
          );
        }

        const identity = buildVerifiedChatIdentity({
          userId: session.userId,
          username: session.username,
          email: session.email,
          isAdmin: session.isAdmin,
          claims: session.claims,
          clerkUser: session.clerkUser,
        });
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

        const chatRateLimit = await checkChatRateLimit({
          request,
          userId: session.userId,
          messageText: String(rawText),
          kv: env.RATE_LIMIT_KV ?? null,
        });
        const rlHeaders = buildRateLimitHeaders(chatRateLimit);
        if (!chatRateLimit.allowed) {
          return jsonResponse(
            {
              success: false,
              code: chatRateLimit.reason === 'duplicate_spam' ? 'DUPLICATE_MESSAGE' : 'RATE_LIMITED',
              error: chatRateLimit.error || 'Too many chat messages. Please slow down.',
            },
            429,
            request,
            rlHeaders
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
                400,
                request,
                rlHeaders
              );
            }
          } catch {
            // Ignore if clerk_user_id check cannot run
          }

          let insertedId: number = Date.now();
          try {
            const insertRes = await env.DB.prepare(
              'INSERT INTO chat_messages (user, text, timestamp, rating, language, isReview, clerk_user_id, avatar) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
            )
              .bind(cleanUser, cleanText, cleanTimestamp, cleanRating, cleanLanguage, cleanIsReview, cleanClerkId, cleanAvatar)
              .run();
            insertedId = insertRes.meta?.last_row_id || Date.now();
          } catch (insertErr) {
            const errMsg = getErrorMessage(insertErr).toLowerCase();
            if (!errMsg.includes('no such column')) {
              return jsonResponse({ success: false, error: getErrorMessage(insertErr) || 'Database insert failed' }, 500, request);
            }
            try {
              const fallbackInsert = await env.DB.prepare(
                'INSERT INTO chat_messages (user, text, timestamp) VALUES (?, ?, ?)'
              )
                .bind(cleanUser, cleanText, cleanTimestamp)
                .run();
              insertedId = fallbackInsert.meta?.last_row_id || Date.now();
            } catch (fbErr) {
              return jsonResponse({ success: false, error: getErrorMessage(fbErr) || 'Database insert failed' }, 500, request);
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
            201,
            request,
            rlHeaders
          );
        }

        return jsonResponse(
          {
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
          },
          200,
          request,
          rlHeaders
        );
      } catch (err) {
        return jsonResponse({ success: false, error: getErrorMessage(err) }, 500, request);
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
      return jsonResponse(
        { error: session.error || (!session.userId ? 'Unauthorized: Valid Clerk Admin session required' : 'Forbidden: Admin access required') },
        !session.userId ? 401 : 403,
        request
      );
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

  // 5b. DELETE /api/feedback/:id (Admin only)
  const deleteFeedbackMatch = path.match(/^\/api\/feedback\/([0-9]+)\/?$/);
  if (deleteFeedbackMatch && method === 'DELETE') {
    const session = await getAuth(request, env);
    if (!session.userId || !session.isAdmin) {
      return jsonResponse(
        { error: session.error || (!session.userId ? 'Unauthorized: Valid Clerk Admin session required' : 'Forbidden: Admin access required') },
        !session.userId ? 401 : 403,
        request
      );
    }
    try {
      const feedbackId = Number(deleteFeedbackMatch[1]);
      if (env.DB) {
        const delRes = await env.DB.prepare('DELETE FROM feedback WHERE id = ?').bind(feedbackId).run();
        if (delRes?.meta?.changes === 0) {
          return jsonResponse({ success: false, error: 'Feedback entry not found' }, 404, request);
        }
      }
      return jsonResponse({ success: true, id: feedbackId }, 200, request);
    } catch (err) {
      return jsonResponse({ success: false, error: getErrorMessage(err) }, 500, request);
    }
  }

  // 6. POST /api/report (Stores anime issue reports in D1 reports table + optional Telegram notification)
  if (path === '/api/report' && method === 'POST') {
    try {
      const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
      if (!body || typeof body !== 'object') {
        return jsonResponse({ success: false, error: 'Invalid JSON report payload' }, 400, request);
      }

      const animeTitle = String(body.animeTitle || body.anime_title || '').trim().slice(0, 200);
      const rawField = String(body.field || body.targetField || body.reportField || '').trim().slice(0, 60);
      const rawIssueType = String(body.issueType || body.issue_type || body.reason || '').trim().slice(0, 150);
      const issueType = rawField
        ? (rawIssueType && rawIssueType.toLowerCase() !== rawField.toLowerCase()
            ? `[${rawField}] ${rawIssueType}`
            : rawField
          ).slice(0, 150)
        : rawIssueType;
      const description = String(body.description || body.notes || body.details || '').trim().slice(0, 2000);
      const rawAnimeId = body.animeId ?? body.anime_id;
      const numericAnimeId =
        rawAnimeId !== undefined && rawAnimeId !== null && Number.isInteger(Number(rawAnimeId)) && Number(rawAnimeId) > 0
          ? Number(rawAnimeId)
          : null;

      if (!animeTitle) {
        return jsonResponse({ success: false, error: 'Anime title is required' }, 400, request);
      }
      if (!issueType) {
        return jsonResponse({ success: false, error: 'Please select which field needs correction' }, 400, request);
      }

      const session = await getAuth(request, env).catch(() => ({
        authenticated: false,
        userId: null,
        email: null,
        username: null,
        isAdmin: false,
      }));
      const reporterUserId = session.userId || null;

      let reportId: number | null = null;
      if (env.DB) {
        try {
          const insertRes = await env.DB.prepare(
            'INSERT INTO reports (anime_id, anime_title, issue_type, description, reporter_user_id, status) VALUES (?, ?, ?, ?, ?, ?)'
          )
            .bind(numericAnimeId, animeTitle, issueType, description, reporterUserId, 'open')
            .run();
          reportId = insertRes.meta?.last_row_id || null;
        } catch {
          // Fallback to feedback table if reports migration has not yet been applied remotely
          const fallbackText = `[REPORT: ${issueType}] ${animeTitle}${description ? ` — ${description}` : ''}`.slice(0, 2000);
          const fbRes = await env.DB.prepare('INSERT INTO feedback (name_or_insta, email, feedback_text) VALUES (?, ?, ?)')
            .bind(reporterUserId || 'Guest Reporter', session.email || null, fallbackText)
            .run();
          reportId = fbRes.meta?.last_row_id || null;
        }

        // Best-effort log write for Admin Terminal diagnostics
        try {
          await env.DB.prepare(
            'INSERT INTO cloudflare_logs (service, event_type, status_code, latency_ms, details) VALUES (?, ?, ?, ?, ?)'
          )
            .bind('REPORT', 'POST /api/report', 201, 1, `${animeTitle} — ${issueType}`.slice(0, 240))
            .run();
        } catch {
          // Ignore optional log table write failure
        }
      }

      const deliveredToTelegram = Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID);
      if (deliveredToTelegram) {
        const tgMsg =
          `🚩 *ANIME ISSUE REPORT*\n\n` +
          `🎬 *Title:* ${animeTitle}${numericAnimeId ? ` (#${numericAnimeId})` : ''}\n` +
          (rawField ? `🎯 *Field:* ${rawField}\n` : '') +
          `⚠️ *Issue:* ${issueType}\n` +
          `📝 *Note:* ${description || 'No additional notes provided.'}\n` +
          `👤 *Reporter:* ${session.email || reporterUserId || 'Guest'}\n`;
        await sendTelegramAlert(env, tgMsg);
      }

      return jsonResponse(
        {
          success: true,
          reportId,
          animeId: numericAnimeId,
          animeTitle,
          field: rawField || null,
          issueType,
          description,
          deliveredToTelegram,
          message: 'Report submitted successfully',
        },
        201,
        request
      );
    } catch (err) {
      return jsonResponse({ success: false, error: getErrorMessage(err) }, 500, request);
    }
  }

  // 7. GET /api/admin/reports (Admin only)
  if (path === '/api/admin/reports' && method === 'GET') {
    const session = await getAuth(request, env);
    if (!session.userId || !session.isAdmin) {
      return jsonResponse(
        { error: session.error || (!session.userId ? 'Unauthorized: Valid Clerk Admin session required' : 'Forbidden: Admin access required') },
        !session.userId ? 401 : 403,
        request
      );
    }
    try {
      if (env.DB) {
        try {
          const res = await env.DB.prepare('SELECT * FROM reports ORDER BY id DESC LIMIT 100').all();
          return jsonResponse({ success: true, reports: res.results || [] }, 200, request);
        } catch (repErr) {
          const msg = getErrorMessage(repErr).toLowerCase();
          if (msg.includes('no such table')) {
            return jsonResponse({ success: true, reports: [] }, 200, request);
          }
          throw repErr;
        }
      }
      return jsonResponse({ success: true, reports: [] }, 200, request);
    } catch (err) {
      return jsonResponse({ success: false, error: getErrorMessage(err), reports: [] }, 500, request);
    }
  }

  return null;
}
