import { AnimeRecord } from '../types/database';
import { dbService } from './databaseService';

export interface TelegramConfig {
  botToken: string;
  adminChatId: string;
  publicChannelId: string;
  enabled: boolean;
}

export interface TelegramMessageLog {
  id: string;
  type: 'moderation_alert' | 'channel_broadcast';
  targetChatId: string;
  animeId: string;
  title: string;
  dubs: string[];
  posterUrl: string;
  status: 'pending' | 'approved' | 'rejected';
  sentAt: string;
  responsePayload?: any;
}

const TELEGRAM_CONFIG_KEY = 'anidub_telegram_config';
const TELEGRAM_LOGS_KEY = 'anidub_telegram_logs';

class TelegramService {
  private config: TelegramConfig;
  private logs: TelegramMessageLog[] = [];
  private listeners: (() => void)[] = [];

  constructor() {
    this.config = this.loadConfig();
    this.logs = this.loadLogs();
  }

  private loadConfig(): TelegramConfig {
    try {
      const saved = localStorage.getItem(TELEGRAM_CONFIG_KEY);
      return saved
        ? JSON.parse(saved)
        : {
            botToken: '8648317719:AAHZ7wxQefZT5QdKCpc61epWJ4mGAgJvgdc',
            adminChatId: '8769442354',
            publicChannelId: '@anidub_india',
            enabled: true,
          };
    } catch {
      return {
        botToken: '8648317719:AAHZ7wxQefZT5QdKCpc61epWJ4mGAgJvgdc',
        adminChatId: '8769442354',
        publicChannelId: '@anidub_india',
        enabled: true,
      };
    }
  }

  private loadLogs(): TelegramMessageLog[] {
    try {
      const saved = localStorage.getItem(TELEGRAM_LOGS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }

  public getConfig(): TelegramConfig {
    return this.config;
  }

  public saveConfig(newConfig: Partial<TelegramConfig>) {
    this.config = { ...this.config, ...newConfig };
    localStorage.setItem(TELEGRAM_CONFIG_KEY, JSON.stringify(this.config));
    this.notify();
  }

  public getLogs(): TelegramMessageLog[] {
    return this.logs;
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  private addLog(log: TelegramMessageLog) {
    this.logs = [log, ...this.logs.slice(0, 49)];
    localStorage.setItem(TELEGRAM_LOGS_KEY, JSON.stringify(this.logs));
    this.notify();
  }

  /**
   * 1. Sends an admin moderation alert to Telegram with inline buttons [✅ Approve] [❌ Reject]
   */
  public async sendTelegramModerationAlert(anime: AnimeRecord): Promise<{ success: boolean; simulated: boolean }> {
    const dubList = anime.dubs.join(', ');
    const platforms = anime.platforms.map((p) => p.name).join(', ') || 'Crunchyroll';
    const submitter = anime.submittedBy?.userName || 'Anonymous Contributor';

    const caption = 
      `🚨 *NEW ANIME DUB SUBMISSION*\n\n` +
      `🎬 *Title:* ${anime.title}\n` +
      `🌐 *Dub Languages:* ${dubList}\n` +
      `📺 *Platform:* ${platforms}\n` +
      `📅 *Release Year:* ${anime.releaseYear}\n` +
      `👤 *Submitted By:* ${submitter}\n\n` +
      `_Status: PENDING ADMIN APPROVAL_`;

    const logEntry: TelegramMessageLog = {
      id: 'tg-' + Date.now().toString(36),
      type: 'moderation_alert',
      targetChatId: this.config.adminChatId || 'Private Admin Telegram Chat',
      animeId: anime.id,
      title: anime.title,
      dubs: anime.dubs,
      posterUrl: anime.poster,
      status: 'pending',
      sentAt: new Date().toISOString(),
    };

    // If real bot token and admin chat ID are provided, execute live Telegram HTTP API call
    if (this.config.enabled && this.config.botToken && this.config.adminChatId) {
      try {
        const url = `https://api.telegram.org/bot${this.config.botToken}/sendPhoto`;
        const body = {
          chat_id: this.config.adminChatId,
          photo: anime.poster,
          caption,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '✅ Approve', callback_data: `approve:${anime.id}` },
                { text: '❌ Reject', callback_data: `reject:${anime.id}` },
              ],
              [
                { text: '🌐 View on AniDub', url: `${window.location.origin}/#anime/${anime.id}` },
              ],
            ],
          },
        };

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        const data = await res.json();
        logEntry.responsePayload = data;
        this.addLog(logEntry);
        return { success: data.ok, simulated: false };
      } catch (err) {
        console.error('Failed to dispatch to live Telegram API:', err);
      }
    }

    // Otherwise record in the simulator log so user can test inline callbacks in the preview
    this.addLog(logEntry);
    return { success: true, simulated: true };
  }

  /**
   * 2. Broadcasts newly approved anime to public Telegram Channel
   */
  public async broadcastApprovedAnimeToChannel(anime: AnimeRecord): Promise<{ success: boolean; simulated: boolean }> {
    const dubList = anime.dubs.map((d) => `#${d}`).join(' ');
    const platformNames = anime.platforms.map((p) => p.name).join(', ') || 'Crunchyroll';

    const caption = 
      `🎉 *NEW ANIME DUB ADDED TO ANIDUB INDIA!*\n\n` +
      `🔥 *${anime.title.toUpperCase()}*\n` +
      `🎙 *Audio:* ${anime.dubs.join(', ')} Dubs\n` +
      `📺 *Streaming on:* ${platformNames}\n` +
      `⭐ *Rating:* ${anime.rating.toFixed(1)} / 10\n\n` +
      `📖 *Story:* ${anime.synopsis.slice(0, 150)}...\n\n` +
      `👉 *Watch Now & Check Audio Details:*\n` +
      `${window.location.origin}/#anime/${anime.id}\n\n` +
      `${dubList} #AnimeIndia #AniDub`;

    const logEntry: TelegramMessageLog = {
      id: 'bc-' + Date.now().toString(36),
      type: 'channel_broadcast',
      targetChatId: this.config.publicChannelId || '@anidub_india',
      animeId: anime.id,
      title: anime.title,
      dubs: anime.dubs,
      posterUrl: anime.poster,
      status: 'approved',
      sentAt: new Date().toISOString(),
    };

    if (this.config.enabled && this.config.botToken && this.config.publicChannelId) {
      try {
        const url = `https://api.telegram.org/bot${this.config.botToken}/sendPhoto`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: this.config.publicChannelId,
            photo: anime.poster,
            caption,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '🎬 View on AniDub India', url: `${window.location.origin}/#anime/${anime.id}` },
                ],
              ],
            },
          }),
        });
        const data = await res.json();
        logEntry.responsePayload = data;
        this.addLog(logEntry);
        return { success: data.ok, simulated: false };
      } catch (err) {
        console.error('Failed to broadcast to public Telegram channel:', err);
      }
    }

    this.addLog(logEntry);
    return { success: true, simulated: true };
  }

  /**
   * 3. Handles Telegram inline callback (e.g. user clicked [✅ Approve] or [❌ Reject] on Telegram)
   */
  public handleTelegramCallback(action: 'approve' | 'reject', animeId: string, reviewerName = 'Telegram Admin Bot'): boolean {
    const anime = dbService.getAnimeById(animeId);
    if (!anime) return false;

    if (action === 'approve') {
      dbService.approveSubmission(animeId, undefined, reviewerName);
      // Automatically broadcast to Telegram channel
      this.broadcastApprovedAnimeToChannel(anime);

      // Update log entry status
      this.logs = this.logs.map((l) => (l.animeId === animeId ? { ...l, status: 'approved' } : l));
      localStorage.setItem(TELEGRAM_LOGS_KEY, JSON.stringify(this.logs));
      this.notify();
      return true;
    } else if (action === 'reject') {
      dbService.rejectSubmission(animeId, 'Rejected by Telegram Admin Bot', reviewerName);
      this.logs = this.logs.map((l) => (l.animeId === animeId ? { ...l, status: 'rejected' } : l));
      localStorage.setItem(TELEGRAM_LOGS_KEY, JSON.stringify(this.logs));
      this.notify();
      return true;
    }

    return false;
  }
}

export const telegramService = new TelegramService();
