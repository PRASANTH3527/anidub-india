import { UserAccount, DubLanguage } from '../types/database';
import { auth, googleProvider, db } from '../lib/firebase';
import { 
  signInWithPopup, 
  signOut as fbSignOut, 
  onAuthStateChanged, 
  User as FirebaseUser 
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const AUTH_USER_KEY = 'anidub_auth_current_user';
const LOCAL_WATCHLIST_KEY = 'anidub_local_watchlist';

export const DEMO_USERS: Record<string, UserAccount> = {
  user: {
    uid: 'google-user-1049281',
    email: 'prasanth01236@gmail.com',
    displayName: 'Prasanth K.',
    photoURL: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=150&auto=format&fit=crop&q=80',
    role: 'user',
    favoriteLanguage: 'Tamil',
    createdAt: '2026-08-10T10:00:00Z',
  },
  admin: {
    uid: 'google-admin-9018273',
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

      // Listen to Firebase Auth state
      try {
        onAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
          if (fbUser) {
            const user: UserAccount = {
              uid: fbUser.uid,
              email: fbUser.email || '',
              displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'Anime Fan',
              photoURL: fbUser.photoURL || 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=150&auto=format&fit=crop&q=80',
              role: (fbUser.email === 'admin@anidub.in' || fbUser.email === 'prasanth01236@gmail.com') ? 'admin' : 'user',
              favoriteLanguage: 'Tamil',
              createdAt: fbUser.metadata.creationTime || new Date().toISOString(),
            };
            this.currentUser = user;
            localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
            
            // Automatic Sync: Synchronize guest's local watchlist to Firestore user doc
            await this.syncLocalWatchlistToFirestore(fbUser.uid);
          } else {
            // Only clear if we were not using an explicit mock user
            if (this.currentUser && !this.currentUser.uid.startsWith('mock-')) {
              this.currentUser = null;
              localStorage.removeItem(AUTH_USER_KEY);
            }
          }
          this.isInitialized = true;
          this.notify();
        });
      } catch (err) {
        console.warn('[AuthService] Firebase Auth listener initialization warning:', err);
      }
    }
  }

  /**
   * Syncs existing guest local watchlist to Firestore user document
   * and merges any cloud items into local state.
   */
  public async syncLocalWatchlistToFirestore(uid: string): Promise<string[]> {
    if (typeof window === 'undefined' || !uid) return [];
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

      // 2. Fetch existing cloud user document from Firestore
      const userDocRef = doc(db, 'users', uid);
      let cloudIds: string[] = [];
      try {
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const data = userDocSnap.data();
          if (Array.isArray(data?.watchlist)) {
            cloudIds = data.watchlist;
          }
        }
      } catch (e) {
        console.warn('[AuthService] Could not fetch remote user doc for watchlist sync:', e);
      }

      // 3. Union local and cloud watchlists
      const mergedSet = new Set<string>([...cloudIds, ...localIds]);
      const mergedList = Array.from(mergedSet);

      // 4. Write back to local storage
      localStorage.setItem(LOCAL_WATCHLIST_KEY, JSON.stringify(mergedList));

      // 5. Update Firestore user document
      try {
        await setDoc(userDocRef, {
          uid,
          email: this.currentUser?.email || '',
          displayName: this.currentUser?.displayName || '',
          photoURL: this.currentUser?.photoURL || '',
          watchlist: mergedList,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
        console.log(`[AuthService] Watchlist synchronized with Cloud: ${mergedList.length} items`);
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
   * Optional Google Sign-In via Firebase Auth.
   * If popup is closed or blocked, falls back gracefully without interrupting guest use.
   */
  public async loginWithGoogle(asAdmin = false): Promise<UserAccount> {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const fbUser = result.user;
      const user: UserAccount = {
        uid: fbUser.uid,
        email: fbUser.email || '',
        displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'Anime Fan',
        photoURL: fbUser.photoURL || 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=150&auto=format&fit=crop&q=80',
        role: asAdmin || fbUser.email === 'admin@anidub.in' || fbUser.email === 'prasanth01236@gmail.com' ? 'admin' : 'user',
        favoriteLanguage: 'Tamil',
        createdAt: fbUser.metadata.creationTime || new Date().toISOString(),
      };

      this.currentUser = user;
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));

      // Sync guest watchlist to Firestore user doc
      await this.syncLocalWatchlistToFirestore(user.uid);

      this.notify();
      return user;
    } catch (error: any) {
      console.warn('[AuthService] Firebase popup signIn warning (falling back to demo):', error?.code || error?.message);
      // Seamless guest/demo fallback if popup is blocked in preview iFrame
      const fallbackUser = asAdmin ? DEMO_USERS.admin : DEMO_USERS.user;
      this.currentUser = fallbackUser;
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(fallbackUser));
      await this.syncLocalWatchlistToFirestore(fallbackUser.uid);
      this.notify();
      return fallbackUser;
    }
  }

  public async logout(): Promise<void> {
    try {
      await fbSignOut(auth);
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
