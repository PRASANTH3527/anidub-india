import React, { useEffect, useState } from 'react';
import { Shield, X, AlertCircle, CheckCircle2, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cloudflareApi } from '../services/cloudflareApi';
import { getCloudflareUrl } from '../config/cloudflare';
import { useUser, useAuth, useClerk, SignIn } from '@clerk/nextjs';
import { isAuthorizedClerkAdmin } from '../utils/auth';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { isSignedIn, user } = useUser();
  const { getToken } = useAuth();
  const { signOut } = useClerk();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [serverAdminVerified, setServerAdminVerified] = useState(false);
  const [checkingServerAdmin, setCheckingServerAdmin] = useState(false);

  const clientAdminMatch = Boolean(isSignedIn && user && isAuthorizedClerkAdmin(user));

  useEffect(() => {
    if (!isOpen || !isSignedIn) {
      setServerAdminVerified(false);
      setCheckingServerAdmin(false);
      return;
    }

    let cancelled = false;
    setCheckingServerAdmin(true);
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch(getCloudflareUrl('/api/admin/verify'), {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        const data: any = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok) {
          setServerAdminVerified(true);
          setError('');
        } else {
          setServerAdminVerified(clientAdminMatch);
          if (data.error) setError(data.error);
        }
      } catch (err: any) {
        if (!cancelled) {
          setServerAdminVerified(clientAdminMatch);
          if (err?.message) setError(err.message);
        }
      } finally {
        if (!cancelled) setCheckingServerAdmin(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, isSignedIn, clientAdminMatch, getToken]);

  const isAuthorizedAdmin = clientAdminMatch || serverAdminVerified;

  const handleVerifyClerkAdmin = async () => {
    setError('');
    setLoading(true);
    try {
      const token = await getToken();
      const verifyRes = await fetch(getCloudflareUrl('/api/admin/verify'), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const verifyData: any = await verifyRes.json().catch(() => ({}));
      if (verifyRes.ok) {
        onSuccess();
        onClose();
        return;
      }

      const data = await cloudflareApi.loginAdmin(token);
      if (data.success) {
        onSuccess();
        onClose();
      } else {
        setError(verifyData.error || data.error || 'Clerk Administrator verification failed.');
      }
    } catch {
      setError('Unable to verify Clerk Admin session with the edge server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden"
          >
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Clerk Admin Protection</h3>
                  <p className="text-xs text-neutral-400">Authorized Clerk Administrator Only</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-neutral-400 hover:text-white rounded-full hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!isSignedIn ? (
              <div className="flex flex-col items-center space-y-4">
                <p className="text-xs text-neutral-300 text-center">
                  Sign in with your authorized Clerk Administrator account to access <code className="text-purple-400">/admin</code>.
                </p>
                <SignIn />
              </div>
            ) : checkingServerAdmin ? (
              <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/25 text-center space-y-1">
                <p className="text-xs font-bold text-purple-300">Verifying Clerk Administrator...</p>
                <p className="text-[11px] text-neutral-400">Checking session credentials with edge runtime...</p>
              </div>
            ) : isAuthorizedAdmin ? (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-emerald-300">Verified Clerk Admin Account</p>
                    <p className="text-[11px] text-neutral-300 truncate">{user?.primaryEmailAddress?.emailAddress}</p>
                  </div>
                </div>

                {error && (
                  <div className="flex items-center space-x-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 p-3 rounded-xl">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleVerifyClerkAdmin}
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-semibold rounded-xl shadow-lg shadow-orange-500/20 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {loading ? 'Verifying Clerk Session...' : 'Enter Admin Console'}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start space-x-2.5 text-red-300 text-xs bg-red-500/10 border border-red-500/25 p-4 rounded-2xl">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-red-300">Unauthorized Account</p>
                    <p className="mt-1 text-neutral-300">
                      Signed in as <span className="font-mono text-white">{user?.primaryEmailAddress?.emailAddress}</span>. Only the authorized Clerk Administrator can access protected <code className="text-red-300">/admin</code> routes.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => signOut()}
                  className="w-full py-2.5 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out & Switch Clerk Account</span>
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
