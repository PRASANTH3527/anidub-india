import { UserAccount, DubLanguage } from '../types/database';

const AUTH_USER_KEY = 'anidub_auth_current_user';

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

  constructor() {
    try {
      const saved = localStorage.getItem(AUTH_USER_KEY);
      if (saved) {
        this.currentUser = JSON.parse(saved);
      } else {
        // Default logged in as demo user for great immediate out-of-the-box experience
        this.currentUser = DEMO_USERS.user;
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(this.currentUser));
      }
    } catch {
      this.currentUser = DEMO_USERS.user;
    }
  }

  public getCurrentUser(): UserAccount | null {
    return this.currentUser;
  }

  public isAuthenticated(): boolean {
    return this.currentUser !== null;
  }

  public isAdmin(): boolean {
    return this.currentUser?.role === 'admin' || this.currentUser?.email === 'admin@anidub.in';
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
   * Simulates real Google OAuth sign-in flow
   */
  public async loginWithGoogle(asAdmin = false): Promise<UserAccount> {
    // Artificial small latency to simulate OAuth popup exchange
    await new Promise((resolve) => setTimeout(resolve, 350));
    const user = asAdmin ? DEMO_USERS.admin : DEMO_USERS.user;
    this.currentUser = user;
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    this.notify();
    return user;
  }

  public logout(): void {
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
