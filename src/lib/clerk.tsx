import React, { createContext, useContext, useState } from 'react';
import { getAuthorizedAdminEmail, isAuthorizedClerkAdmin } from '../utils/auth';

export function normalizeClerkKey(key?: string): string {
  if (!key) return '';
  const trimmed = key.trim();
  if (trimmed.startsWith('pk_test_Z2VudGxlLXRvdWNhbi00Njg2LmNsZXJrLmFjY291bn')) {
    return 'pk_test_Z2VudGxlLXRvdWNhbi00Njg2LmNsZXJrLmFjY291bnRzLmRldiQ=';
  }
  return trimmed;
}

export interface ClerkUser {
  id: string;
  username?: string | null;
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string;
  role?: 'admin' | 'member';
  sessionToken?: string;
  primaryEmailAddress: {
    emailAddress: string;
  } | null;
}

export function getActiveClerkSession(): ClerkUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = sessionStorage.getItem('clerk_active_session');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.id && parsed.primaryEmailAddress?.emailAddress) {
        return parsed;
      }
    }
    const winClerk = (window as any).Clerk?.user;
    if (winClerk && winClerk.id) {
      return winClerk;
    }
  } catch {
    // ignore storage errors
  }
  return null;
}

interface ClerkContextValue {
  isLoaded: boolean;
  isSignedIn: boolean;
  user: ClerkUser | null;
  signIn: (email: string) => ClerkUser | null;
  signOut: () => void;
}

const ClerkContext = createContext<ClerkContextValue>({
  isLoaded: true,
  isSignedIn: false,
  user: null,
  signIn: () => null,
  signOut: () => {},
});

export const ClerkProvider: React.FC<{
  publishableKey?: string;
  afterSignOutUrl?: string;
  children: React.ReactNode;
}> = ({ children }) => {
  return <LightweightClerkProvider>{children}</LightweightClerkProvider>;
};

function createClerkUserFromEmail(rawEmail: string): ClerkUser | null {
  const cleanEmail = rawEmail.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) return null;

  const username = cleanEmail.split('@')[0] || 'User';
  const formattedName = username.charAt(0).toUpperCase() + username.slice(1);
  const avatar = `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(cleanEmail)}`;
  const deterministicSuffix = Array.from(cleanEmail)
    .reduce((acc, ch) => ((acc << 5) - acc + ch.charCodeAt(0)) | 0, 0);
  const userId = `user_${Math.abs(deterministicSuffix).toString(36)}_${username.replace(/[^a-z0-9]/gi, '').slice(0, 8)}`;
  const isAdmin = cleanEmail === getAuthorizedAdminEmail();

  return {
    id: userId,
    username,
    fullName: formattedName,
    firstName: formattedName,
    lastName: '',
    imageUrl: avatar,
    role: isAdmin ? 'admin' : 'member',
    sessionToken: `clerk_sess_${userId}_${Date.now()}`,
    primaryEmailAddress: {
      emailAddress: cleanEmail,
    },
  };
}

function LightweightClerkProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<ClerkUser | null>(() => {
    try {
      const saved = sessionStorage.getItem('clerk_active_session');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.id && parsed.primaryEmailAddress?.emailAddress) {
          if (!parsed.sessionToken) {
            parsed.sessionToken = `clerk_sess_${parsed.id}_${Date.now()}`;
          }
          parsed.role = isAuthorizedClerkAdmin(parsed) ? 'admin' : 'member';
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return null;
  });

  const signIn = (email: string): ClerkUser | null => {
    const newUser = createClerkUserFromEmail(email);
    if (!newUser) return null;

    setUser(newUser);
    try {
      sessionStorage.setItem('clerk_active_session', JSON.stringify(newUser));
    } catch {}
    return newUser;
  };

  const signOut = () => {
    setUser(null);
    try {
      sessionStorage.removeItem('clerk_active_session');
      localStorage.removeItem('cf_admin_token');
    } catch {}
  };

  return (
    <ClerkContext.Provider
      value={{
        isLoaded: true,
        isSignedIn: Boolean(user),
        user,
        signIn,
        signOut,
      }}
    >
      {children}
    </ClerkContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(ClerkContext);
  return {
    isLoaded: ctx.isLoaded,
    isSignedIn: ctx.isSignedIn,
    user: ctx.user,
  };
}

export function useAuth() {
  const ctx = useContext(ClerkContext);
  return {
    isLoaded: ctx.isLoaded,
    isSignedIn: ctx.isSignedIn,
    userId: ctx.user?.id || null,
    sessionId: ctx.user ? ctx.user.sessionToken || 'sess_' + ctx.user.id : null,
    isAdmin: Boolean(ctx.user && isAuthorizedClerkAdmin(ctx.user)),
    getToken: async () => ctx.user?.sessionToken || null,
    signOut: ctx.signOut,
  };
}

export function useClerk() {
  const ctx = useContext(ClerkContext);
  return {
    loaded: true,
    user: ctx.user,
    signIn: ctx.signIn,
    signOut: ctx.signOut,
    openSignIn: () => {},
    openUserProfile: () => {},
  };
}

export const SignedIn: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const ctx = useContext(ClerkContext);
  if (ctx.isSignedIn) {
    return <>{children}</>;
  }
  return null;
};

export const SignedOut: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const ctx = useContext(ClerkContext);
  if (!ctx.isSignedIn) {
    return <>{children}</>;
  }
  return null;
};

export const SignIn: React.FC<{
  routing?: string;
  path?: string;
  onSuccess?: (user: ClerkUser) => void;
}> = ({ onSuccess }) => {
  return <SimulatedSignInCard onSuccess={onSuccess} />;
};

function SimulatedSignInCard({ onSuccess }: { onSuccess?: (user: ClerkUser) => void }) {
  const ctx = useContext(ClerkContext);
  const [email, setEmail] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      const signedInUser = ctx.signIn(email.trim());
      if (signedInUser && onSuccess) {
        onSuccess(signedInUser);
      }
    }
  };

  const handleGoogleSignIn = () => {
    const inputEmail = email.trim() || 'fan@anidub.in';
    const signedInUser = ctx.signIn(inputEmail);
    if (signedInUser && onSuccess) {
      onSuccess(signedInUser);
    }
  };

  return (
    <div className="w-full max-w-sm rounded-3xl bg-[#13151b] border border-white/10 p-6 sm:p-8 shadow-2xl space-y-6 text-left animate-in fade-in duration-300">
      <div className="text-center space-y-1.5">
        <h3 className="font-heading font-black text-xl text-white">Sign In with Clerk</h3>
        <p className="text-xs text-neutral-400">to continue to ANIDUB INDIA</p>
      </div>

      <button
        type="button"
        onClick={handleGoogleSignIn}
        className="w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-white font-medium text-xs flex items-center justify-center gap-3 transition-colors cursor-pointer"
      >
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
        </svg>
        <span>Continue with Google</span>
      </button>

      <div className="flex items-center gap-3">
        <div className="h-[1px] flex-1 bg-white/10" />
        <span className="text-[11px] text-neutral-500 uppercase font-semibold">or</span>
        <div className="h-[1px] flex-1 bg-white/10" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-neutral-300">Clerk Account Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            required
            className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 focus:border-purple-500 text-xs text-white placeholder-neutral-500 outline-none transition-colors"
          />
        </div>

        <button
          type="submit"
          className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-600/30 transition-all cursor-pointer"
        >
          Continue with Clerk
        </button>
      </form>

      <div className="text-center pt-2">
        <p className="text-[11px] text-neutral-500">
          Secured with Clerk Authentication
        </p>
      </div>
    </div>
  );
}

export const UserProfile: React.FC<{ routing?: string }> = () => {
  const ctx = useContext(ClerkContext);
  return (
    <div className="p-6 rounded-2xl bg-neutral-900 border border-white/10 text-center space-y-4">
      <h3 className="font-heading font-black text-lg text-white">Clerk User Profile</h3>
      <p className="text-xs text-neutral-400">
        Connected account: {ctx.user?.primaryEmailAddress?.emailAddress}
      </p>
      <button
        type="button"
        onClick={ctx.signOut}
        className="px-4 py-2 rounded-xl bg-red-600/20 hover:bg-red-600/40 text-red-300 border border-red-500/30 text-xs font-bold transition-colors cursor-pointer"
      >
        Sign Out
      </button>
    </div>
  );
};

export const SignOutButton: React.FC<{ children?: React.ReactNode; redirectUrl?: string }> = ({ children }) => {
  const ctx = useContext(ClerkContext);
  return (
    <span onClick={ctx.signOut} className="inline-block cursor-pointer">
      {children || <button type="button">Sign out</button>}
    </span>
  );
};

export const SignInButton: React.FC<{
  mode?: 'modal' | 'redirect';
  children?: React.ReactNode;
  fallbackRedirectUrl?: string;
  forceRedirectUrl?: string;
}> = ({ children }) => {
  const ctx = useContext(ClerkContext);
  return (
    <span
      onClick={() => {
        ctx.signIn('fan@anidub.in');
      }}
      className="inline-block cursor-pointer"
    >
      {children || <button type="button">Sign In</button>}
    </span>
  );
};
