import React, { createContext, useContext, useEffect, useState } from 'react';
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
import { getCloudflareUrl } from '../config/cloudflare';

interface ClerkConfigState {
  configured: boolean;
  loading: boolean;
}

const ClerkConfigContext = createContext<ClerkConfigState>({ configured: false, loading: false });

export function isValidClerkPublishableKey(key: string): boolean {
  if (!key || (!key.startsWith('pk_test_') && !key.startsWith('pk_live_'))) {
    return false;
  }
  const encoded = key.split('_')[2] || '';
  if (!encoded) return false;
  try {
    const decoded = typeof atob === 'function' ? atob(encoded) : Buffer.from(encoded, 'base64').toString('utf8');
    return decoded.endsWith('$') && decoded.includes('.');
  } catch {
    return false;
  }
}

export function resolvePublishableKey(explicitKey?: string): string {
  let candidate = explicitKey && explicitKey.trim() ? explicitKey.trim() : '';

  if (!candidate) {
    const metaEnv = (import.meta as any).env;
    const rawMeta =
      metaEnv?.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
      metaEnv?.VITE_CLERK_PUBLISHABLE_KEY ||
      '';
    if (typeof rawMeta === 'string' && rawMeta.trim()) {
      candidate = rawMeta.trim();
    }
  }

  if (!candidate) {
    try {
      const nextPub = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
      const vitePub = process.env.VITE_CLERK_PUBLISHABLE_KEY;
      const rawProcess = nextPub || vitePub || '';
      if (typeof rawProcess === 'string' && rawProcess.trim()) {
        candidate = rawProcess.trim();
      }
    } catch {
      // process may not be defined in all browser runtimes
    }
  }

  return isValidClerkPublishableKey(candidate) ? candidate : '';
}

async function fetchRuntimeClerkPublishableKey(): Promise<string> {
  const endpoints = ['/api/config', '/api/auth-config'];
  for (const endpoint of endpoints) {
    try {
      const res = await fetch(getCloudflareUrl(endpoint), {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      if (!res.ok) continue;
      const ct = (res.headers.get('content-type') || '').toLowerCase();
      if (!ct.includes('application/json')) continue;
      const data: any = await res.json().catch(() => null);
      const rawKey = typeof data?.clerkPublishableKey === 'string' ? data.clerkPublishableKey.trim() : '';
      if (isValidClerkPublishableKey(rawKey)) {
        return rawKey;
      }
    } catch {
      // Continue trying fallback endpoint
    }
  }
  return '';
}

let registeredGetToken: (() => Promise<string | null>) | null = null;

const ClerkTokenSynchronizer: React.FC = () => {
  const { getToken, isSignedIn } = useOfficialAuth();
  if (isSignedIn && typeof getToken === 'function') {
    registeredGetToken = () => getToken();
  }
  useEffect(() => {
    if (isSignedIn && typeof getToken === 'function') {
      registeredGetToken = () => getToken();
    } else {
      registeredGetToken = null;
    }
    return () => {
      registeredGetToken = null;
    };
  }, [getToken, isSignedIn]);
  return null;
};

/**
 * Official ClerkProvider wrapper.
 * Resolves the publishable key from build-time env vars (VITE_ / NEXT_PUBLIC_) first,
 * and falls back to fetching `/api/config` from Cloudflare runtime bindings if absent.
 */
export const ClerkProvider: React.FC<{
  publishableKey?: string;
  afterSignOutUrl?: string;
  children: React.ReactNode;
}> = ({ publishableKey, afterSignOutUrl = '/', children }) => {
  const buildTimeKey = resolvePublishableKey(publishableKey);
  const [runtimeKey, setRuntimeKey] = useState<string>(buildTimeKey);
  const [isLoadingConfig, setIsLoadingConfig] = useState<boolean>(!buildTimeKey && typeof window !== 'undefined');

  useEffect(() => {
    if (buildTimeKey) {
      setRuntimeKey(buildTimeKey);
      setIsLoadingConfig(false);
      return;
    }
    if (typeof window === 'undefined') {
      setIsLoadingConfig(false);
      return;
    }

    let cancelled = false;
    setIsLoadingConfig(true);
    fetchRuntimeClerkPublishableKey()
      .then((key) => {
        if (!cancelled && key) {
          setRuntimeKey(key);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingConfig(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [buildTimeKey]);

  const activeKey = buildTimeKey || runtimeKey;

  if (!activeKey) {
    return (
      <ClerkConfigContext.Provider value={{ configured: false, loading: isLoadingConfig }}>
        {children}
      </ClerkConfigContext.Provider>
    );
  }

  return (
    <ClerkConfigContext.Provider value={{ configured: true, loading: false }}>
      <OfficialClerkProvider publishableKey={activeKey} afterSignOutUrl={afterSignOutUrl}>
        <ClerkTokenSynchronizer />
        {children}
      </OfficialClerkProvider>
    </ClerkConfigContext.Provider>
  );
};

export function useUser() {
  const { configured } = useContext(ClerkConfigContext);
  if (!configured) {
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
  const { configured } = useContext(ClerkConfigContext);
  if (!configured) {
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
  const authResult = useOfficialAuth();
  if (authResult.isSignedIn && typeof authResult.getToken === 'function') {
    registeredGetToken = () => authResult.getToken();
  }
  return authResult;
}

export function useClerk() {
  const { configured } = useContext(ClerkConfigContext);
  if (!configured) {
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
  const { configured } = useContext(ClerkConfigContext);
  if (!configured) return null;
  return <OfficialSignedIn>{children}</OfficialSignedIn>;
};

export const SignedOut: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { configured } = useContext(ClerkConfigContext);
  if (!configured) return <>{children}</>;
  return <OfficialSignedOut>{children}</OfficialSignedOut>;
};

export const SignIn: React.FC<any> = (props) => {
  const { configured, loading } = useContext(ClerkConfigContext);
  if (!configured) {
    if (loading) {
      return (
        <div className="w-full max-w-sm rounded-2xl bg-[#13151b] border border-purple-500/30 p-6 text-center space-y-2">
          <p className="text-xs font-bold text-purple-300">Loading Clerk Authentication...</p>
          <p className="text-[11px] text-neutral-400">Connecting to runtime configuration...</p>
        </div>
      );
    }
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
  const { configured } = useContext(ClerkConfigContext);
  if (!configured) return null;
  return <OfficialSignUp {...props} />;
};

export const SignInButton: React.FC<any> = ({ children, ...props }) => {
  const { configured } = useContext(ClerkConfigContext);
  if (!configured) {
    return <span className="inline-block opacity-60 cursor-not-allowed">{children || <button type="button" disabled>Sign In</button>}</span>;
  }
  return <OfficialSignInButton {...props}>{children}</OfficialSignInButton>;
};

export const SignOutButton: React.FC<any> = ({ children, ...props }) => {
  const { configured } = useContext(ClerkConfigContext);
  if (!configured) return null;
  return <OfficialSignOutButton {...props}>{children}</OfficialSignOutButton>;
};

export const UserButton: React.FC<any> = (props) => {
  const { configured } = useContext(ClerkConfigContext);
  if (!configured) return null;
  return <OfficialUserButton {...props} />;
};

export const UserProfile: React.FC<any> = (props) => {
  const { configured } = useContext(ClerkConfigContext);
  if (!configured) return null;
  return <OfficialUserProfile {...props} />;
};

function readSessionCookieFromDocument(): string | null {
  if (typeof document === 'undefined' || !document.cookie) return null;
  try {
    const parts = document.cookie.split(';');
    for (const part of parts) {
      const [rawName, ...rest] = part.trim().split('=');
      if (rawName === '__session' || (rawName && rawName.startsWith('__session_'))) {
        const val = decodeURIComponent(rest.join('=').trim());
        if (val && val.split('.').length === 3) return val;
      }
    }
  } catch {}
  return null;
}

async function resolveClerkTokenOnce(): Promise<string | null> {
  if (registeredGetToken) {
    try {
      const token = await registeredGetToken();
      if (token && token.split('.').length === 3) return token;
    } catch {}
  }

  try {
    const clerkInstance = (window as any).Clerk;
    if (clerkInstance?.session && typeof clerkInstance.session.getToken === 'function') {
      const token = await clerkInstance.session.getToken();
      if (token && token.split('.').length === 3) return token;
    }
    const activeSession = clerkInstance?.client?.activeSessions?.[0] || clerkInstance?.client?.sessions?.[0];
    if (activeSession && typeof activeSession.getToken === 'function') {
      const token = await activeSession.getToken();
      if (token && token.split('.').length === 3) return token;
    }
  } catch {}

  return readSessionCookieFromDocument();
}

/**
 * Retrieves the cryptographically signed Clerk JWT from the active Clerk browser SDK session.
 */
export async function getClerkSessionToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  const firstAttempt = await resolveClerkTokenOnce();
  if (firstAttempt) return firstAttempt;

  // If Clerk is signed in or initializing its session token right after sign-in, wait briefly and retry once
  if (registeredGetToken || (window as any).Clerk?.user || (window as any).Clerk?.session) {
    await new Promise((r) => setTimeout(r, 150));
    return resolveClerkTokenOnce();
  }

  return null;
}

