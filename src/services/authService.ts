// ==============================================================================
// AniDub India — Supabase Authentication & User Profile Service
// ==============================================================================
import { UserAccount } from '../types/database';
import { supabase } from '../lib/supabase';

const AUTH_USER_KEY = 'anidub_auth_current_user';
const LOCAL_WATCHLIST_KEY = 'anidub_local_watchlist';

export const DEMO_USERS: Record<string, UserAccount> = {
  user: {
    uid: 'demo-user-1049281',
    email: 'prasanth01236@gmail.com',
    displayName: 'Prasanth K.',
    photoURL: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=150&auto=format&fit=crop&q=80',
    role: 'user',
    favoriteLanguage: 'Tamil',
    createdAt: '2026-08-10T10:00:00Z',
  },
  admin: {
    uid: 'demo-admin-9018273',
    email: 'admin@anidub.in',
    displayName: 'AniDub Senior Admin',
    photoURL: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=150&auto=format&fit=crop&q=80',
    role: 'admin',
    favoriteLanguage: 'Tamil',
    createdAt: '2025-01-01T00:00:00Z',
  },
};

class AuthService {
  private currentUser: UserAccount | null = null;
  private listeners: ((user: UserAccount | null) => void)[] = [];
  private isInitialized = false;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(AUTH_USER_KEY);
        if (saved) {
          this.currentUser = JSON.parse(saved);
        }
      } catch {
        this.currentUser = null;
      }

      // Supabase Auth listener
      try {
        supabase.auth.onAuthStateChange(async (event, session) => {
          if (session?.user) {
            const sbUser = session.user;
            const meta = sbUser.user_metadata || {};
            const user: UserAccount = {
              uid: sbUser.id,
              email: sbUser.email || '',
              displayName: meta.full_name || meta.name || sbUser.email?.split('@')[0] || 'Anime Fan',
              photoURL: meta.avatar_url || meta.picture || 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=150&auto=format&fit=crop&q=80',
              role: (sbUser.email === 'admin@anidub.in' || sbUser.email === 'prasanth01236@gmail.com') ? 'admin' : 'user',
              favoriteLanguage: 'Tamil',
              createdAt: sbUser.created_at || new Date().toISOString(),
            };
            this.currentUser = user;
            localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
            
            // Automatic Sync: Synchronize guest's local watchlist to Supabase user row
            await this.syncLocalWatchlistToSupabase(sbUser.id);
          } else {
            // Only clear if not using a demo user
            if (this.currentUser && !this.currentUser.uid.startsWith('demo-')) {
              this.currentUser = null;
              localStorage.removeItem(AUTH_USER_KEY);
            }
          }
          this.isInitialized = true;
          this.notify();
        });
      } catch (err) {
        console.warn('[AuthService] Supabase Auth listener initialization warning:', err);
      }
    }
  }

  /**
   * Syncs existing guest local watchlist to Supabase user table
   * and merges any cloud items into local state.
   */
  public async syncLocalWatchlistToSupabase(uid: string): Promise<string[]> {
    if (typeof window !== 'undefined' && !uid) return [];
    try {
      // 1. Read local watchlist
      let localIds: string[] = [];
      const savedLocal = localStorage.getItem(LOCAL_WATCHLIST_KEY);
      if (savedLocal) {
        try {
          const parsed = JSON.parse(savedLocal);
          if (Array.isArray(parsed)) localIds = parsed;
        } catch {}
      }

      // 2. Fetch existing cloud user document from Supabase
      let cloudIds: string[] = [];
      try {
        const { data, error } = await supabase
          .from('users')
          .select('watchlist')
          .eq('id', uid)
          .maybeSingle();

        if (data && Array.isArray(data.watchlist)) {
          cloudIds = data.watchlist;
        }
      } catch (e) {
        console.warn('[AuthService] Could not fetch remote user doc for watchlist sync:', e);
      }

      // 3. Union local and cloud watchlists
      const mergedSet = new Set<string>([...cloudIds, ...localIds]);
      const mergedList = Array.from(mergedSet);

      // 4. Write back to local storage
      localStorage.setItem(LOCAL_WATCHLIST_KEY, JSON.stringify(mergedList));

      // 5. Update Supabase user row
      try {
        await supabase.from('users').upsert({
          id: uid,
          email: this.currentUser?.email || '',
          display_name: this.currentUser?.displayName || '',
          photo_url: this.currentUser?.photoURL || '',
          watchlist: mergedList,
          updated_at: new Date().toISOString(),
        });
        console.log(`[AuthService] Watchlist synchronized with Supabase: ${mergedList.length} items`);
      } catch (writeErr) {
        console.warn('[AuthService] Cloud watchlist update warning:', writeErr);
      }

      return mergedList;
    } catch (e) {
      console.warn('[AuthService] Watchlist sync error:', e);
      return [];
    }
  }

  public getCurrentUser(): UserAccount | null {
    return this.currentUser;
  }

  public isAuthenticated(): boolean {
    return this.currentUser !== null;
  }

  public isAdmin(): boolean {
    if (typeof window !== 'undefined') {
      try {
        if (
          sessionStorage.getItem('anidub_is_admin') === 'true' ||
          localStorage.getItem('anidub_is_admin') === 'true'
        ) {
          return true;
        }
      } catch {}
    }
    return (
      this.currentUser?.role === 'admin' ||
      this.currentUser?.email === 'admin@anidub.in' ||
      this.currentUser?.email === 'prasanth01236@gmail.com'
    );
  }

  public subscribe(listener: (user: UserAccount | null) => void): () => void {
    this.listeners.push(listener);
    listener(this.currentUser);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l(this.currentUser));
  }

  /**
   * Supabase Google Sign-In with graceful fallback for iframe / preview sandbox
   */
  public async loginWithGoogle(asAdmin = false): Promise<UserAccount> {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
        },
      });

      if (error) throw error;

      // Check current session
      const { data: sessionData } = await supabase.auth.getSession();
      const sbUser = sessionData?.session?.user;

      if (sbUser) {
        const meta = sbUser.user_metadata || {};
        const user: UserAccount = {
          uid: sbUser.id,
          email: sbUser.email || '',
          displayName: meta.full_name || meta.name || sbUser.email?.split('@')[0] || 'Anime Fan',
          photoURL: meta.avatar_url || meta.picture || 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=150&auto=format&fit=crop&q=80',
          role: asAdmin || sbUser.email === 'admin@anidub.in' || sbUser.email === 'prasanth01236@gmail.com' ? 'admin' : 'user',
          favoriteLanguage: 'Tamil',
          createdAt: sbUser.created_at || new Date().toISOString(),
        };

        this.currentUser = user;
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
        await this.syncLocalWatchlistToSupabase(user.uid);
        this.notify();
        return user;
      }

      // If redirected or pending, fallback to demo user in iframe
      const fallbackUser = asAdmin ? DEMO_USERS.admin : DEMO_USERS.user;
      this.currentUser = fallbackUser;
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(fallbackUser));
      await this.syncLocalWatchlistToSupabase(fallbackUser.uid);
      this.notify();
      return fallbackUser;
    } catch (error: any) {
      console.warn('[AuthService] Supabase OAuth notice (falling back to demo):', error?.message || error);
      const fallbackUser = asAdmin ? DEMO_USERS.admin : DEMO_USERS.user;
      this.currentUser = fallbackUser;
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(fallbackUser));
      await this.syncLocalWatchlistToSupabase(fallbackUser.uid);
      this.notify();
      return fallbackUser;
    }
  }

  public async logout(): Promise<void> {
    try {
      await supabase.auth.signOut();
    } catch {}
    this.currentUser = null;
    localStorage.removeItem(AUTH_USER_KEY);
    this.notify();
  }

  public updateUserProfile(updates: Partial<UserAccount>): UserAccount | null {
    if (!this.currentUser) return null;
    this.currentUser = {
      ...this.currentUser,
      ...updates,
    };
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(this.currentUser));
    this.notify();
    return this.currentUser;
  }
}

export const authService = new AuthService();
export default authService;
