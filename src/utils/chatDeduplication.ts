export interface DeduplicationMessage {
  id: string | number;
  user: string;
  text: string;
  timestamp: string;
  isSelf?: boolean;
  isReview?: boolean;
  rating?: number | null;
  language?: string | null;
  clerk_user_id?: string;
}

/**
 * Synchronizes and strictly deduplicates chat messages between optimistic local UI state
 * and backend database polling responses.
 *
 * 1. Database is the absolute source of truth.
 * 2. Temporary optimistic messages (temp_*) are seamlessly replaced when confirmed by the database.
 * 3. Identical messages are strictly deduplicated by ID and (user + text) content.
 */
export function syncAndDeduplicateChatMessages(
  existing: DeduplicationMessage[],
  incoming: any[],
  currentUserName: string
): DeduplicationMessage[] {
  const normalize = (msg: any): DeduplicationMessage => ({
    id: msg.id ?? `msg_${msg.user}_${msg.timestamp}_${String(msg.text || '').slice(0, 10)}`,
    user: String(msg.user || 'Anonymous Fan').trim(),
    text: String(msg.text || msg.comment || '').trim(),
    timestamp: msg.timestamp || 'Just now',
    isSelf: msg.user === currentUserName || Boolean(msg.isSelf),
    isReview: Boolean(msg.isReview || msg.rating),
    rating: msg.rating !== undefined && msg.rating !== null ? Number(msg.rating) : null,
    language: msg.language || null,
    clerk_user_id: msg.clerk_user_id
  });

  const normalizedIncoming = (Array.isArray(incoming) ? incoming : []).map(normalize);
  const normalizedExisting = (Array.isArray(existing) ? existing : []).map(normalize);

  // If incoming contains a batch of database messages (from fetchMessages/polling):
  // The database acts as the absolute source of truth.
  const isFullBatch = normalizedIncoming.length > 1;

  if (isFullBatch) {
    const confirmedMap = new Map<string, DeduplicationMessage>();
    const confirmedUserText = new Set<string>();

    for (const msg of normalizedIncoming) {
      const idKey = String(msg.id);
      if (!confirmedMap.has(idKey)) {
        confirmedMap.set(idKey, msg);
        confirmedUserText.add(`${msg.user.toLowerCase()}:::${msg.text}`);
      }
    }

    // Keep only temporary in-flight optimistic messages from existing that have not yet appeared in DB
    const result: DeduplicationMessage[] = Array.from(confirmedMap.values());
    for (const msg of normalizedExisting) {
      const isTemp = typeof msg.id === 'string' && (msg.id.startsWith('temp_') || msg.id.startsWith('msg_'));
      if (isTemp) {
        const contentKey = `${msg.user.toLowerCase()}:::${msg.text}`;
        if (!confirmedUserText.has(contentKey) && !confirmedMap.has(String(msg.id))) {
          result.push(msg);
        }
      }
    }

    return result.slice(-150);
  }

  // Single message append (e.g. optimistic append during sendMessage, or single WS broadcast)
  const combined = [...normalizedExisting, ...normalizedIncoming];
  const finalResult: DeduplicationMessage[] = [];
  const seenIds = new Set<string>();
  const seenContent = new Set<string>();

  // Prioritize confirmed database messages
  const confirmedList = combined.filter(
    m => !(typeof m.id === 'string' && (m.id.startsWith('temp_') || m.id.startsWith('msg_')))
  );
  const tempList = combined.filter(
    m => typeof m.id === 'string' && (m.id.startsWith('temp_') || m.id.startsWith('msg_'))
  );

  for (const msg of confirmedList) {
    const idKey = String(msg.id);
    const contentKey = `${msg.user.toLowerCase()}:::${msg.text}`;
    if (!seenIds.has(idKey)) {
      seenIds.add(idKey);
      seenContent.add(contentKey);
      finalResult.push(msg);
    }
  }

  for (const msg of tempList) {
    const idKey = String(msg.id);
    const contentKey = `${msg.user.toLowerCase()}:::${msg.text}`;
    // Skip if this message is already represented by a confirmed DB message or another temp
    if (!seenIds.has(idKey) && !seenContent.has(contentKey)) {
      seenIds.add(idKey);
      seenContent.add(contentKey);
      finalResult.push(msg);
    }
  }

  return finalResult.slice(-150);
}
