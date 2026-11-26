import React, { createContext, useContext, useEffect } from 'react';
import {
  ClerkProvider as OfficialClerkProvider,
  useUser as useOfficialUser,
  useAuth as useOfficialAuth,
  useClerk as useOfficialClerk,
  useSignIn as useOfficialSignIn,
  useSignUp as useOfficialSignUp,
  SignedIn as OfficialSignedIn,
  SignedOut as OfficialSignedOut,
  SignIn as OfficialSignIn,
  SignUp as OfficialSignUp,
  SignInButton as OfficialSignInButton,
  SignOutButton as OfficialSignOutButton,
  UserButton as OfficialUserButton,
  UserProfile as OfficialUserProfile,
} from '@clerk/clerk-react';

interface ClerkConfigState {
  configured: boolean;
  loading: boolean;
}

const ClerkConfigContext = createContext<ClerkConfigState>({ configured: true, loading: false });

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
 * Official ClerkProvider wrapper with hardcoded Clerk test publishableKey.
 */
export const ECLIPSE_CLERK_APPEARANCE = {
  variables: {
    colorPrimary: '#B49AF8',
    colorBackground: '#12141E',
    colorInputBackground: '#191C29',
    colorInputText: '#F4F3FA',
    colorText: '#F4F3FA',
    colorTextSecondary: '#A1A5B5',
    borderRadius: '12px',
  },
};

export const ClerkProvider: React.FC<{
  publishableKey?: string;
  afterSignOutUrl?: string;
  children: React.ReactNode;
}> = ({
  publishableKey = "pk_test_Z2VudGxlLXRvdWNhbi00Njg2LmNsZXJrLmFjY291bnRzLmRldiQ",
  afterSignOutUrl = '/',
  children,
}) => {
  return (
    <ClerkConfigContext.Provider value={{ configured: true, loading: false }}>
      <OfficialClerkProvider
        publishableKey={publishableKey}
        afterSignOutUrl={afterSignOutUrl}
        appearance={ECLIPSE_CLERK_APPEARANCE}
        clerkJSUrl="https://cdn.jsdelivr.net/npm/@clerk/clerk-js@5/dist/clerk.browser.js"
      >
        <ClerkTokenSynchronizer />
        {children}
      </OfficialClerkProvider>
    </ClerkConfigContext.Provider>
  );
};

export function useUser() {
  return useOfficialUser();
}

export function useAuth() {
  const authResult = useOfficialAuth();
  if (authResult.isSignedIn && typeof authResult.getToken === 'function') {
    registeredGetToken = () => authResult.getToken();
  }
  return authResult;
}

export function useClerk() {
  return useOfficialClerk();
}

export function useSignIn() {
  return useOfficialSignIn();
}

export function useSignUp() {
  return useOfficialSignUp();
}

export const SignedIn: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <OfficialSignedIn>{children}</OfficialSignedIn>;
};

export const SignedOut: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <OfficialSignedOut>{children}</OfficialSignedOut>;
};

export const SignIn: React.FC<any> = (props) => {
  return <OfficialSignIn {...props} />;
};

export const SignUp: React.FC<any> = (props) => {
  return <OfficialSignUp {...props} />;
};

export const SignInButton: React.FC<any> = ({ children, ...props }) => {
  return <OfficialSignInButton {...props}>{children}</OfficialSignInButton>;
};

export const SignOutButton: React.FC<any> = ({ children, ...props }) => {
  return <OfficialSignOutButton {...props}>{children}</OfficialSignOutButton>;
};

export const UserButton: React.FC<any> = (props) => {
  return <OfficialUserButton {...props} />;
};

export const UserProfile: React.FC<any> = (props) => {
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

  if (registeredGetToken || (window as any).Clerk?.user || (window as any).Clerk?.session) {
    await new Promise((r) => setTimeout(r, 150));
    return resolveClerkTokenOnce();
  }

  return null;
}
