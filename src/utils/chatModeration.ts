import { containsSpoilerContent } from './watchProgress';

export const BLOCKED_CHAT_USERS_STORAGE_KEY = 'anidub_blocked_chat_users_v1';
export const CHAT_SPOILER_PREFIX = '[SPOILER]';

export function normalizeChatUsername(username: unknown): string {
  return String(username ?? '')
    .trim()
    .replace(/^@+/, '')
    .replace(/\s+/g, ' ');
}

export function getBlockedChatUsers(storage?: Storage | null): string[] {
  const targetStorage = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!targetStorage) return [];
  try {
    const raw = targetStorage.getItem(BLOCKED_CHAT_USERS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    const list: string[] = [];
    for (const item of parsed) {
      const clean = normalizeChatUsername(item);
      if (!clean) continue;
      const key = clean.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        list.push(clean);
      }
    }
    return list;
  } catch {
    return [];
  }
}

export function blockChatUser(username: string, storage?: Storage | null): string[] {
  const clean = normalizeChatUsername(username);
  const existing = getBlockedChatUsers(storage);
  if (!clean) return existing;

  const lower = clean.toLowerCase();
  const next = existing.some((u) => u.toLowerCase() === lower) ? existing : [...existing, clean];

  const targetStorage = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  if (targetStorage) {
    try {
      targetStorage.setItem(BLOCKED_CHAT_USERS_STORAGE_KEY, JSON.stringify(next));
    } catch {}
  }
  return next;
}

export function unblockChatUser(username: string, storage?: Storage | null): string[] {
  const lower = normalizeChatUsername(username).toLowerCase();
  const existing = getBlockedChatUsers(storage);
  const next = existing.filter((u) => u.toLowerCase() !== lower);

  const targetStorage = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  if (targetStorage) {
    try {
      targetStorage.setItem(BLOCKED_CHAT_USERS_STORAGE_KEY, JSON.stringify(next));
    } catch {}
  }
  return next;
}

export function isChatUserBlocked(username: string, blockedUsers: string[]): boolean {
  if (!Array.isArray(blockedUsers) || blockedUsers.length === 0) return false;
  const lower = normalizeChatUsername(username).toLowerCase();
  if (!lower) return false;
  return blockedUsers.some((b) => normalizeChatUsername(b).toLowerCase() === lower);
}

export function filterVisibleChatMessages<T extends { user: string }>(
  messages: T[],
  blockedUsers: string[]
): T[] {
  if (!Array.isArray(messages)) return [];
  if (!Array.isArray(blockedUsers) || blockedUsers.length === 0) return messages;
  return messages.filter((msg) => !isChatUserBlocked(msg.user, blockedUsers));
}

export function formatSpoilerChatMessage(text: string, isSpoiler: boolean): string {
  const trimmed = String(text || '').trim();
  if (!trimmed) return '';
  if (!isSpoiler) return trimmed;
  if (/^\[spoiler\]/i.test(trimmed)) return trimmed;
  return `${CHAT_SPOILER_PREFIX} ${trimmed}`;
}

export function stripSpoilerMarker(text: string): string {
  return String(text || '').replace(/^\[spoiler\]\s*/i, '').trim();
}

export function isChatMessageSpoiler(msg: { text?: string; isSpoiler?: boolean }): boolean {
  return containsSpoilerContent(String(msg?.text || ''), Boolean(msg?.isSpoiler));
}
