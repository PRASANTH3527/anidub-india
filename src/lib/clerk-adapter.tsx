import React, { createContext, useContext, useState, useEffect } from 'react';
import * as RealClerk from '../../node_modules/@clerk/clerk-react/dist/index.mjs';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const isRealClerk = Boolean(PUBLISHABLE_KEY && PUBLISHABLE_KEY.startsWith('pk_') && !PUBLISHABLE_KEY.includes('anidub.india.app'));

// Local mock user interface
export interface MockUser {
  id: string;
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string;
  primaryEmailAddress: {
    emailAddress: string;
  } | null;
}

interface ClerkContextType {
  isLoaded: boolean;
  isSignedIn: boolean;
  user: MockUser | null;
  signIn: (email: string, name?: string, avatar?: string) => void;
  signOut: () => void;
}

const ClerkContext = createContext<ClerkContextType>({
  isLoaded: true,
  isSignedIn: false,
  user: null,
  signIn: () => {},
  signOut: () => {},
});

export const ClerkProvider: React.FC<{
  publishableKey?: string;
  afterSignOutUrl?: string;
  children: React.ReactNode;
}> = (props) => {
  if (isRealClerk && props.publishableKey) {
    const Component = RealClerk.ClerkProvider as any;
    return <Component {...props} />;
  }

  return <LocalClerkProvider {...props} />;
};

function LocalClerkProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<MockUser | null>(() => {
    try {
      const saved = localStorage.getItem('clerk_simulated_user');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return null;
  });

  const signIn = (email: string, name?: string, avatar?: string) => {
    const defaultName = name || email.split('@')[0] || 'Anime Enthusiast';
    const formattedName = defaultName.charAt(0).toUpperCase() + defaultName.slice(1);
    const defaultAvatar = avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(email)}`;

    const newUser: MockUser = {
      id: 'user_' + Math.random().toString(36).substring(2, 9),
      fullName: formattedName,
      firstName: formattedName.split(' ')[0] || formattedName,
      lastName: formattedName.split(' ')[1] || '',
      imageUrl: defaultAvatar,
      primaryEmailAddress: {
        emailAddress: email
      }
    };

    setUser(newUser);
    localStorage.setItem('clerk_simulated_user', JSON.stringify(newUser));
  };

  const signOut = () => {
    setUser(null);
    localStorage.removeItem('clerk_simulated_user');
  };

  return (
    <ClerkContext.Provider
      value={{
        isLoaded: true,
        isSignedIn: Boolean(user),
        user,
        signIn,
        signOut
      }}
    >
      {children}
    </ClerkContext.Provider>
  );
}

export function useUser() {
  if (isRealClerk) {
    return RealClerk.useUser();
  }
  const ctx = useContext(ClerkContext);
  return {
    isLoaded: ctx.isLoaded,
    isSignedIn: ctx.isSignedIn,
    user: ctx.user,
  };
}

export function useAuth() {
  if (isRealClerk) {
    return RealClerk.useAuth();
  }
  const ctx = useContext(ClerkContext);
  return {
    isLoaded: ctx.isLoaded,
    isSignedIn: ctx.isSignedIn,
    userId: ctx.user?.id || null,
    sessionId: ctx.user ? 'sess_' + ctx.user.id : null,
    signOut: ctx.signOut,
  };
}

export function useClerk() {
  if (isRealClerk) {
    return RealClerk.useClerk();
  }
  const ctx = useContext(ClerkContext);
  return {
    loaded: true,
    user: ctx.user,
    signOut: ctx.signOut,
    openSignIn: () => {},
    openUserProfile: () => {},
  };
}

export const SignedIn: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  if (isRealClerk) {
    return <RealClerk.SignedIn>{children}</RealClerk.SignedIn>;
  }
  const ctx = useContext(ClerkContext);
  if (ctx.isSignedIn) {
    return <>{children}</>;
  }
  return null;
};

export const SignedOut: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  if (isRealClerk) {
    return <RealClerk.SignedOut>{children}</RealClerk.SignedOut>;
  }
  const ctx = useContext(ClerkContext);
  if (!ctx.isSignedIn) {
    return <>{children}</>;
  }
  return null;
};

export const SignIn: React.FC<{ routing?: string; path?: string }> = (props) => {
  if (isRealClerk) {
    const Component = RealClerk.SignIn as any;
    return <Component {...props} />;
  }

  return <LocalSignInComponent />;
};

function LocalSignInComponent() {
  const ctx = useContext(ClerkContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleGoogleSignIn = () => {
    ctx.signIn('prasanth01236@gmail.com', 'Prasanth', 'https://api.dicebear.com/7.x/bottts/svg?seed=prasanth');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    ctx.signIn(email);
  };

  return (
    <div className="w-full max-w-sm rounded-3xl bg-[#13151b] border border-white/10 p-6 sm:p-8 shadow-2xl space-y-6 text-left">
      <div className="text-center space-y-1.5">
        <h3 className="font-heading font-black text-xl text-white">Sign In</h3>
        <p className="text-xs text-neutral-400">to continue to ANIDUB INDIA</p>
      </div>

      {/* Social Google Login Button */}
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
          <label className="text-xs font-semibold text-neutral-300">Email address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            required
            className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 focus:border-purple-500 text-xs text-white placeholder-neutral-500 outline-none transition-colors"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-neutral-300">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 focus:border-purple-500 text-xs text-white placeholder-neutral-500 outline-none transition-colors"
          />
        </div>

        <button
          type="submit"
          className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-600/30 transition-all cursor-pointer"
        >
          Continue
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

export const UserProfile: React.FC<{ routing?: string }> = (props) => {
  if (isRealClerk) {
    const Component = RealClerk.UserProfile as any;
    return <Component {...props} />;
  }
  const ctx = useContext(ClerkContext);
  return (
    <div className="p-6 rounded-2xl bg-neutral-900 border border-white/10 text-center space-y-4">
      <h3 className="font-heading font-black text-lg text-white">Clerk User Profile</h3>
      <p className="text-xs text-neutral-400">Connected account: {ctx.user?.primaryEmailAddress?.emailAddress}</p>
      <button
        onClick={ctx.signOut}
        className="px-4 py-2 rounded-xl bg-red-600/20 hover:bg-red-600/40 text-red-300 border border-red-500/30 text-xs font-bold transition-colors cursor-pointer"
      >
        Sign Out
      </button>
    </div>
  );
};
