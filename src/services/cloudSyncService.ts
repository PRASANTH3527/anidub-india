// Frontend service for Hybrid Cloud Sync (Optional)
import { Anime, DubLanguage } from '../types/anime';
import { LocalUserProfile } from '../components/LocalProfileModal';

export interface CloudBackupPayload {
  nickname: string;
  avatar: string;
  favoriteLanguage: string;
  watchlist: string[]; // anime IDs
  upvotes: string[]; // anime IDs
  xp?: number;
  uiLanguage: string;
}

class CloudSyncService {
  /**
   * Packages current localStorage state for cloud backup
   */
  public getLocalState(): CloudBackupPayload {
    const profileStr = localStorage.getItem('anidub_local_user_profile');
    const profile: LocalUserProfile = profileStr ? JSON.parse(profileStr) : {
      nickname: 'Anime Fan',
      avatar: '',
      favoriteLanguage: 'Tamil'
    };

    return {
      nickname: profile.nickname,
      avatar: profile.avatar,
      favoriteLanguage: profile.favoriteLanguage || 'Tamil',
      watchlist: JSON.parse(localStorage.getItem('anidub_local_watchlist') || '[]'),
      upvotes: JSON.parse(localStorage.getItem('anidub_upvoted_anime_ids') || '[]'),
      xp: Number(localStorage.getItem('anidub_user_xp') || 0),
      uiLanguage: localStorage.getItem('anidub_ui_lang') || 'en'
    };
  }

  /**
   * Applies cloud data to localStorage and refreshes app
   */
  public applyState(data: CloudBackupPayload) {
    if (!data) return;

    if (data.nickname && data.avatar) {
      localStorage.setItem('anidub_local_user_profile', JSON.stringify({
        nickname: data.nickname,
        avatar: data.avatar,
        favoriteLanguage: data.favoriteLanguage,
      }));
    }
    if (data.watchlist) localStorage.setItem('anidub_local_watchlist', JSON.stringify(data.watchlist));
    if (data.upvotes) localStorage.setItem('anidub_upvoted_anime_ids', JSON.stringify(data.upvotes));
    if (data.xp !== undefined) localStorage.setItem('anidub_user_xp', data.xp.toString());
    if (data.uiLanguage) localStorage.setItem('anidub_ui_lang', data.uiLanguage);
    
    // Force reload to apply all changes globally
    window.location.reload();
  }

  /**
   * Saves current local state to cloud
   */
  public async backupToCloud(username: string, password: string): Promise<{ success: boolean; error?: string }> {
    try {
      const payload = this.getLocalState();
      const res = await fetch('/api/cloud-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'backup', username, password, payload })
      });

      if (!res.ok) {
        let errMessage = 'Backup failed';
        try {
          const err = await res.json();
          errMessage = err.error || errMessage;
        } catch {
          errMessage = `Server error (${res.status})`;
        }
        return { success: false, error: errMessage };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Restores data from cloud to local
   */
  public async restoreFromCloud(username: string, password: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch('/api/cloud-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore', username, password })
      });

      if (!res.ok) {
        let errMessage = 'Restore failed';
        try {
          const err = await res.json();
          errMessage = err.error || errMessage;
        } catch {
          errMessage = `Server error (${res.status})`;
        }
        return { success: false, error: errMessage };
      }

      try {
        const json = await res.json();
        if (json?.data) {
          this.applyState(json.data);
          return { success: true };
        }
        return { success: false, error: 'No data returned from backup' };
      } catch {
        return { success: false, error: 'Malformed cloud backup response' };
      }
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}

export const cloudSyncService = new CloudSyncService();
