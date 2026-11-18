import React, { useState } from 'react';
import { X, Mail, Lock, ShieldCheck, ArrowRight, AlertCircle, KeyRound } from 'lucide-react';
import { useSignIn, useSignUp, useClerk } from '../lib/clerk';
import { AniDubLogo } from './AniDubLogo';

export interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess?: (user: { email: string; name: string }) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess
}) => {
  const { signIn, isLoaded: isSignInLoaded, setActive: setSignInActive } = useSignIn();
  const { signUp, isLoaded: isSignUpLoaded, setActive: setSignUpActive } = useSignUp();
  const clerk = useClerk();

  const [mode, setMode] = useState<'signin' | 'signup' | 'verify'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const extractClerkError = (err: any, fallback: string): string => {
    const clerkFirst = err?.errors?.[0];
    return (
      clerkFirst?.longMessage ||
      clerkFirst?.message ||
      err?.message ||
      fallback
    );
  };

  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    if (!isSignInLoaded || !signIn) {
      if (clerk && typeof clerk.openSignIn === 'function') {
        clerk.openSignIn();
        onClose();
        return;
      }
      setErrorMsg('Clerk authentication is still loading. Please try again.');
      return;
    }

    setIsLoading(true);
    try {
      await signIn.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: window.location.origin,
        redirectUrlComplete: window.location.href,
      });
    } catch (err: any) {
      setErrorMsg(extractClerkError(err, 'Google sign-in could not be initiated.'));
      setIsLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const cleanEmail = email.trim();
    if (!cleanEmail || !password.trim()) return;

    if (mode === 'verify') {
      if (!isSignUpLoaded || !signUp) return;
      setIsLoading(true);
      try {
        const verificationResult = await signUp.attemptEmailAddressVerification({
          code: verificationCode.trim(),
        });
        if (verificationResult.status === 'complete' && verificationResult.createdSessionId) {
          await setSignUpActive({ session: verificationResult.createdSessionId });
          onLoginSuccess?.({ email: cleanEmail, name: cleanEmail.split('@')[0] });
          onClose();
        } else {
          setErrorMsg('Verification incomplete. Please double-check your code.');
        }
      } catch (err: any) {
        setErrorMsg(extractClerkError(err, 'Verification code invalid or expired.'));
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (mode === 'signup') {
      if (!isSignUpLoaded || !signUp) {
        setErrorMsg('Clerk sign-up is still initializing. Please wait a moment.');
        return;
      }
      setIsLoading(true);
      try {
        const result = await signUp.create({
          emailAddress: cleanEmail,
          password,
        });
        if (result.status === 'complete' && result.createdSessionId) {
          await setSignUpActive({ session: result.createdSessionId });
          onLoginSuccess?.({ email: cleanEmail, name: cleanEmail.split('@')[0] });
          onClose();
        } else {
          await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
          setMode('verify');
        }
      } catch (err: any) {
        setErrorMsg(extractClerkError(err, 'Unable to register with that email and password.'));
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (!isSignInLoaded || !signIn) {
      setErrorMsg('Clerk sign-in is still initializing. Please wait a moment.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await signIn.create({
        identifier: cleanEmail,
        password,
      });
      if (result.status === 'complete' && result.createdSessionId) {
        await setSignInActive({ session: result.createdSessionId });
        onLoginSuccess?.({ email: cleanEmail, name: cleanEmail.split('@')[0] });
        onClose();
      } else {
        setErrorMsg('Additional verification is required to complete sign in.');
      }
    } catch (err: any) {
      setErrorMsg(extractClerkError(err, 'Invalid email or password.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      
      {/* MODAL CONTAINER */}
      <div className="relative w-full max-w-md bg-[#111726]/95 border border-primary-theme/30 rounded-3xl p-6 sm:p-7 shadow-2xl z-10 space-y-6 text-neutral-100 backdrop-blur-xl font-sans">
        
        {/* HEADER */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <AniDubLogo variant="horizontal" size="sm" />
            <div>
              <h2 className="font-heading font-black text-lg text-white tracking-tight">
                {mode === 'signup'
                  ? 'Create Anidub Account'
                  : mode === 'verify'
                    ? 'Verify Email Code'
                    : 'Sign in to Anidub India'}
              </h2>
              <p className="text-neutral-400 text-xs mt-0.5">
                Sync watchlist, custom collections & reviews across devices.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ERROR BANNER */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* GOOGLE AUTH BUTTON */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={isLoading}
          className="w-full py-3 px-4 rounded-2xl bg-white hover:bg-neutral-100 text-neutral-900 font-bold text-xs flex items-center justify-center gap-3 transition-all cursor-pointer shadow-lg hover:shadow-xl group disabled:opacity-50"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.13 0-5.78-2.11-6.73-4.96H1.2v3.15C3.18 21.31 7.26 24 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.27 14.24c-.25-.72-.38-1.49-.38-2.24s.13-1.52.38-2.24V6.61H1.2C.43 8.15 0 9.89 0 12s.43 3.85 1.2 5.39l4.07-3.15z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.26 0 3.18 2.69 1.2 6.61l4.07 3.15c.95-2.85 3.6-4.96 6.73-4.96z"
            />
          </svg>
          <span>Continue with Google</span>
        </button>

        {/* DIVIDER */}
        <div className="flex items-center gap-3 text-xs text-neutral-500">
          <div className="h-px bg-neutral-800 flex-grow" />
          <span>or sign in with email</span>
          <div className="h-px bg-neutral-800 flex-grow" />
        </div>

        {/* CLERK EMAIL / PASSWORD FORM */}
        <form onSubmit={handleEmailSubmit} className="space-y-3">
          {mode === 'verify' ? (
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Verification Code</label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                <input
                  type="text"
                  required
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  placeholder="Enter 6-digit email code"
                  className="w-full bg-[#182032] border border-neutral-700 rounded-xl py-2 pl-9 pr-3 text-xs text-white outline-none focus:border-accent-theme"
                />
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full bg-[#182032] border border-neutral-700 rounded-xl py-2 pl-9 pr-3 text-xs text-white outline-none focus:border-accent-theme"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#182032] border border-neutral-700 rounded-xl py-2 pl-9 pr-3 text-xs text-white outline-none focus:border-accent-theme"
                  />
                </div>
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-2.5 rounded-xl btn-primary-theme text-white font-bold text-xs transition-colors cursor-pointer shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <span>
              {isLoading
                ? 'Authenticating...'
                : mode === 'verify'
                  ? 'Verify Email'
                  : mode === 'signup'
                    ? 'Create Account'
                    : 'Sign In with Email'}
            </span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        <div className="flex items-center justify-between text-[11px] text-neutral-400">
          <button
            type="button"
            onClick={() => {
              setErrorMsg(null);
              setMode(mode === 'signin' ? 'signup' : 'signin');
            }}
            className="text-purple-400 hover:text-purple-300 font-semibold cursor-pointer"
          >
            {mode === 'signin' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
          </button>
          <span className="text-[10px] text-neutral-500">Powered by Clerk</span>
        </div>

        <div className="text-center pt-2 border-t border-neutral-800 text-[10px] text-neutral-500 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Secure OAuth 2.0 & JWT Session Token</span>
        </div>

      </div>
    </div>
  );
};
