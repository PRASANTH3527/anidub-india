import React, { useState } from 'react';
import { X, ShieldCheck, CheckCircle2, User, LogIn, Lock } from 'lucide-react';
import { authService, DEMO_USERS } from '../services/authService';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onLoginSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [customEmail, setCustomEmail] = useState('');
  const [customName, setCustomName] = useState('');

  if (!isOpen) return null;

  const handleGoogleSignIn = async (asAdmin: boolean) => {
    setLoading(true);
    await authService.loginWithGoogle(asAdmin);
    setLoading(false);
    onLoginSuccess?.();
    onClose();
  };

  const handleCustomLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customEmail.trim()) return;

    setLoading(true);
    const isAdmin = customEmail.toLowerCase().includes('admin');
    authService.updateUserProfile({
      email: customEmail.trim(),
      displayName: customName.trim() || customEmail.split('@')[0],
      role: isAdmin ? 'admin' : 'user',
    });
    setLoading(false);
    onLoginSuccess?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div onClick={onClose} className="fixed inset-0 bg-black/80 backdrop-blur-md" />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-md bg-[#111726]/95 border border-primary-theme/30 rounded-3xl p-6 sm:p-7 shadow-2xl z-10 space-y-6 text-neutral-100 backdrop-blur-xl">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary-theme/30 border border-primary-theme/40 flex items-center justify-center text-primary-theme">
              <LogIn className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-heading font-black text-lg text-white">
                Sign in to AniDub
              </h3>
              <p className="text-[11px] text-neutral-400">
                Unlock your personal cloud Watchlist & Dub Reviews
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Google One-Click Auth Buttons */}
        <div className="space-y-3">
          <button
            onClick={() => handleGoogleSignIn(false)}
            disabled={loading}
            className="w-full py-3 px-4 rounded-2xl bg-white hover:bg-neutral-100 text-neutral-900 font-bold text-xs flex items-center justify-center gap-3 transition-all cursor-pointer shadow-lg hover:shadow-xl group"
          >
            {/* Google SVG Icon */}
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Continue with Google</span>
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 text-xs text-neutral-500">
          <div className="h-px bg-neutral-800 flex-grow" />
          <span>or sign in with custom email</span>
          <div className="h-px bg-neutral-800 flex-grow" />
        </div>

        {/* Custom Email Form */}
        <form onSubmit={handleCustomLogin} className="space-y-3">
          <div>
            <label className="block text-[11px] font-bold text-neutral-400 mb-1">
              Google / Email Address
            </label>
            <input
              type="email"
              required
              value={customEmail}
              onChange={(e) => setCustomEmail(e.target.value)}
              placeholder="e.g. prasanth@gmail.com"
              className="w-full bg-[#182032] border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-primary-theme"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-neutral-400 mb-1">
              Display Name
            </label>
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="e.g. Prasanth"
              className="w-full bg-[#182032] border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-primary-theme"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 rounded-xl btn-primary-theme text-white font-bold text-xs transition-colors cursor-pointer"
          >
            Enter AniDub Account
          </button>
        </form>

        <p className="text-[10px] text-neutral-500 text-center leading-normal">
          By continuing, your personal Watchlist and Dub Ratings will be stored securely in the database.
        </p>

      </div>
    </div>
  );
};
