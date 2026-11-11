import React, { createContext, useContext } from 'react';
import {
  ClerkProvider as OfficialClerkProvider,
  useUser as useOfficialUser,
  useAuth as useOfficialAuth,
  useClerk as useOfficialClerk,
  SignedIn as OfficialSignedIn,
  SignedOut as OfficialSignedOut,
  SignIn as OfficialSignIn,
  SignUp as OfficialSignUp,
  SignInButton as OfficialSignInButton,
  SignOutButton as OfficialSignOutButton,
  UserButton as OfficialUserButton,
  UserProfile as OfficialUserProfile,
} from '@clerk/clerk-react';

const ClerkConfigContext = createContext<boolean>(false);

function isValidClerkPublishableKey(key: string): boolean {
  if (!key || (!key.startsWith('pk_test_') && !key.startsWith('pk_live_'))) {
    return false;
  }
  const encoded = key.split('_')[2] || '';
  if (!encoded) return false;
  try {
    const decoded = typeof atob === 'function' ? atob(encoded) : '';
    return decoded.endsWith('$') && decoded.includes('.');
  } catch {
    return false;
  }
}

function resolvePublishableKey(explicitKey?: string): string {
  const candidate =
    explicitKey && explicitKey.trim()
      ? explicitKey.trim()
      : (() => {
          const env = (import.meta as any).env;
          const raw =
            env?.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
            env?.VITE_CLERK_PUBLISHABLE_KEY ||
            '';
          return typeof raw === 'string' ? raw.trim() : '';
        })();

  return isValidClerkPublishableKey(candidate) ? candidate : '';
}

/**
 * Official ClerkProvider wrapper.
 * Mounts the real Clerk SDK provider when a publishableKey is configured in environment variables.
 */
export const ClerkProvider: React.FC<{
  publishableKey?: string;
  afterSignOutUrl?: string;
  children: React.ReactNode;
}> = ({ publishableKey, afterSignOutUrl = '/', children }) => {
  const resolvedKey = resolvePublishableKey(publishableKey);

  if (!resolvedKey) {
    return (
      <ClerkConfigContext.Provider value={false}>
        {children}
      </ClerkConfigContext.Provider>
    );
  }

  return (
    <ClerkConfigContext.Provider value={true}>
      <OfficialClerkProvider publishableKey={resolvedKey} afterSignOutUrl={afterSignOutUrl}>
        {children}
      </OfficialClerkProvider>
    </ClerkConfigContext.Provider>
  );
};

export function useUser() {
  const isConfigured = useContext(ClerkConfigContext);
  if (!isConfigured) {
    return {
      isLoaded: true,
      isSignedIn: false as const,
      user: null,
    };
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useOfficialUser();
}

export function useAuth() {
  const isConfigured = useContext(ClerkConfigContext);
  if (!isConfigured) {
    return {
      isLoaded: true,
      isSignedIn: false as const,
      userId: null,
      sessionId: null,
      getToken: async () => null,
      signOut: async () => {},
    };
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useOfficialAuth();
}

export function useClerk() {
  const isConfigured = useContext(ClerkConfigContext);
  if (!isConfigured) {
    return {
      loaded: true,
      user: null,
      session: null,
      signOut: async () => {},
      openSignIn: () => {},
      openUserProfile: () => {},
    };
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useOfficialClerk();
}

export const SignedIn: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isConfigured = useContext(ClerkConfigContext);
  if (!isConfigured) return null;
  return <OfficialSignedIn>{children}</OfficialSignedIn>;
};

export const SignedOut: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isConfigured = useContext(ClerkConfigContext);
  if (!isConfigured) return <>{children}</>;
  return <OfficialSignedOut>{children}</OfficialSignedOut>;
};

export const SignIn: React.FC<any> = (props) => {
  const isConfigured = useContext(ClerkConfigContext);
  if (!isConfigured) {
    return (
      <div className="w-full max-w-sm rounded-2xl bg-[#13151b] border border-rose-500/30 p-6 text-center space-y-2">
        <p className="text-xs font-bold text-rose-300">Clerk Authentication Required</p>
        <p className="text-[11px] text-neutral-400">
          Configure <code className="text-purple-400">NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> and <code className="text-purple-400">CLERK_SECRET_KEY</code> in your environment variables to sign in.
        </p>
      </div>
    );
  }
  return <OfficialSignIn {...props} />;
};

export const SignUp: React.FC<any> = (props) => {
  const isConfigured = useContext(ClerkConfigContext);
  if (!isConfigured) return null;
  return <OfficialSignUp {...props} />;
};

export const SignInButton: React.FC<any> = ({ children, ...props }) => {
  const isConfigured = useContext(ClerkConfigContext);
  if (!isConfigured) {
    return <span className="inline-block opacity-60 cursor-not-allowed">{children || <button type="button" disabled>Sign In</button>}</span>;
  }
  return <OfficialSignInButton {...props}>{children}</OfficialSignInButton>;
};

export const SignOutButton: React.FC<any> = ({ children, ...props }) => {
  const isConfigured = useContext(ClerkConfigContext);
  if (!isConfigured) return null;
  return <OfficialSignOutButton {...props}>{children}</OfficialSignOutButton>;
};

export const UserButton: React.FC<any> = (props) => {
  const isConfigured = useContext(ClerkConfigContext);
  if (!isConfigured) return null;
  return <OfficialUserButton {...props} />;
};

export const UserProfile: React.FC<any> = (props) => {
  const isConfigured = useContext(ClerkConfigContext);
  if (!isConfigured) return null;
  return <OfficialUserProfile {...props} />;
};

/**
 * Retrieves the cryptographically signed Clerk JWT from the active Clerk browser SDK session.
 */
export async function getClerkSessionToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  try {
    const clerkInstance = (window as any).Clerk;
    if (clerkInstance?.session && typeof clerkInstance.session.getToken === 'function') {
      const token = await clerkInstance.session.getToken();
      return token || null;
    }
  } catch {
    return null;
  }
  return null;
}
