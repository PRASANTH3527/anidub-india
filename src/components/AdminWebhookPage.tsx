import React, { useState, useEffect } from 'react';
import { 
  Bot, 
  Radio, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Link2, 
  ShieldCheck, 
  Trash2, 
  Send, 
  ArrowLeft,
  Lock,
  Globe,
  HelpCircle,
  ExternalLink
} from 'lucide-react';

interface WebhookInfo {
  url?: string;
  has_custom_certificate?: boolean;
  pending_update_count?: number;
  last_error_date?: number;
  last_error_message?: string;
  max_connections?: number;
}

const STORAGE_PROD_URL_KEY = 'anidub_admin_prod_webhook_url';
const DEFAULT_PROD_DOMAIN = 'https://anidub.in';

export const AdminWebhookPage: React.FC = () => {
  // Determine initial production webhook URL (avoid dev .run.app or localhost)
  const getInitialProdUrl = (): string => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_PROD_URL_KEY);
      if (saved && saved.startsWith('https://')) return saved;

      const origin = window.location.origin;
      const isDev = origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('.run.app');
      
      // If currently running on production Vercel or custom domain
      if (!isDev && origin.startsWith('https://')) {
        return `${origin}/api/telegram-webhook`;
      }
    }
    return `${DEFAULT_PROD_DOMAIN}/api/telegram-webhook`;
  };

  const [webhookUrl, setWebhookUrl] = useState<string>(getInitialProdUrl);
  const [isLoading, setIsLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [webhookInfo, setWebhookInfo] = useState<WebhookInfo | null>(null);

  const isCurrentDevEnv = typeof window !== 'undefined' && 
    (window.location.origin.includes('localhost') || window.location.origin.includes('.run.app'));

  const isUrlDev = webhookUrl.includes('localhost') || webhookUrl.includes('.run.app');

  useEffect(() => {
    handleCheckStatus();
  }, []);

  // 1. SET WEBHOOK TO PRODUCTION VERCEL URL
  const handleSetWebhook = async () => {
    if (!webhookUrl || !webhookUrl.startsWith('https://')) {
      setErrorMsg('Please enter a valid production HTTPS URL (e.g. https://your-project.vercel.app/api/telegram-webhook)');
      return;
    }

    if (isUrlDev) {
      if (!confirm('⚠️ You have entered a development URL. Telegram requires a public production domain (like your Vercel deployment). Are you sure you want to proceed?')) {
        return;
      }
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      // Save for subsequent visits
      localStorage.setItem(STORAGE_PROD_URL_KEY, webhookUrl.trim());

      const res = await fetch('/api/set-telegram-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl: webhookUrl.trim(),
          dropPendingUpdates: true,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to set Telegram webhook');
      }

      setSuccessMsg(`✅ Webhook successfully linked! Telegram will deliver callback updates to: ${webhookUrl}`);
      if (data.webhookInfo) {
        setWebhookInfo(data.webhookInfo);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error communicating with Telegram API');
    } finally {
      setIsLoading(false);
    }
  };

  // 2. CHECK STATUS
  const handleCheckStatus = async () => {
    setStatusLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/set-telegram-webhook');
      const data = await res.json();

      if (data.webhookInfo) {
        setWebhookInfo(data.webhookInfo);
      } else if (!data.success) {
        setErrorMsg(data.error || 'Could not retrieve webhook info');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Could not fetch webhook info from Telegram.');
    } finally {
      setStatusLoading(false);
    }
  };

  // 3. DELETE / UNLINK WEBHOOK
  const handleDeleteWebhook = async () => {
    if (!confirm('Are you sure you want to delete the Telegram webhook? Telegram will stop delivering callback queries.')) {
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/set-telegram-webhook?drop_pending_updates=true', {
        method: 'DELETE',
      });
      const data = await res.json();

      if (data.success) {
        setSuccessMsg('Telegram webhook was successfully deleted.');
        setWebhookInfo(null);
      } else {
        setErrorMsg(data.message || 'Failed to delete webhook');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error deleting webhook');
    } finally {
      setIsLoading(false);
    }
  };

  // 4. SEND TEST ALERT
  const handleSendTest = async () => {
    setTestLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/telegram-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'test-admin-' + Date.now().toString(36),
          title: 'Demon Slayer: Hashira Training Arc [TEST ALERT]',
          languages: ['Tamil', 'Telugu', 'Hindi'],
          platform: 'Crunchyroll',
          type: 'Series',
          status: 'Ongoing',
          releaseDay: 'Sunday',
          genres: ['Action', 'Fantasy'],
          releaseYear: 2024,
          poster: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80',
          submittedBy: 'Admin Webhook Portal',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to send test message');
      }

      setSuccessMsg('Test notification sent to your Telegram Admin Chat! Tap [Approve] in Telegram to verify instant response.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to send test alert');
    } finally {
      setTestLoading(false);
    }
  };

  const navigateToHome = () => {
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-[#0b0f17] text-neutral-100 flex flex-col items-center justify-center p-4 sm:p-6 selection:bg-purple-600 selection:text-white">
      <div className="w-full max-w-2xl bg-[#111726]/95 border border-purple-500/30 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 backdrop-blur-xl">
        
        {/* Top Secret Badge & Back Button */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-5">
          <button
            onClick={navigateToHome}
            className="flex items-center gap-1.5 text-xs font-semibold text-neutral-400 hover:text-white transition-colors cursor-pointer px-3 py-1.5 rounded-xl hover:bg-neutral-800/60"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Public Catalog</span>
          </button>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-950/60 border border-purple-800/50 text-[11px] font-bold text-purple-300">
            <Lock className="w-3 h-3 text-purple-400" />
            <span>Hidden Route: /admin-webhook</span>
          </div>
        </div>

        {/* Title Header */}
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-700 via-purple-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-purple-600/30 shrink-0">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-heading font-black text-xl sm:text-2xl text-white tracking-tight">
              Telegram Webhook Administration
            </h1>
            <p className="text-xs text-neutral-400 mt-1">
              Configure your production Vercel URL to enable instant <strong className="text-purple-300">[Approve]</strong> & <strong className="text-purple-300">[Reject]</strong> buttons in Telegram.
            </p>
          </div>
        </div>

        {/* Environment Alert */}
        {isCurrentDevEnv && (
          <div className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-800/40 text-amber-200 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-amber-300">Development Environment Active</p>
              <p className="text-[11px] text-amber-200/80">
                You are currently viewing the app in development. Webhooks cannot use development sandbox URLs (<code className="text-amber-300">*.run.app</code> or <code className="text-amber-300">localhost</code>). Ensure the URL below points to your <strong>Production Vercel deployment</strong>.
              </p>
            </div>
          </div>
        )}

        {/* Status Messages */}
        {successMsg && (
          <div className="p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 text-xs flex items-start gap-2.5 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{successMsg}</div>
          </div>
        )}

        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-rose-950/60 border border-rose-800/60 text-rose-300 text-xs flex items-start gap-2.5 animate-fadeIn">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{errorMsg}</div>
          </div>
        )}

        {/* Production URL Input */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-neutral-200 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-purple-400" />
              <span>Production Webhook URL</span>
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setWebhookUrl('https://anidub.in/api/telegram-webhook')}
                className="text-[11px] text-purple-400 hover:text-purple-300 underline font-semibold cursor-pointer"
              >
                anidub.in
              </button>
              <span className="text-neutral-600 text-xs">•</span>
              <button
                type="button"
                onClick={() => setWebhookUrl('https://anidub.vercel.app/api/telegram-webhook')}
                className="text-[11px] text-purple-400 hover:text-purple-300 underline font-semibold cursor-pointer"
              >
                anidub.vercel.app
              </button>
            </div>
          </div>

          <div className="relative">
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://your-production-app.vercel.app/api/telegram-webhook"
              className="w-full bg-[#171e2e] border border-neutral-700/80 focus:border-purple-500 rounded-xl py-3 px-3.5 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-colors font-mono"
            />
          </div>

          <p className="text-[11px] text-neutral-400">
            Target Vercel endpoint: <code className="text-purple-300 font-mono">/api/telegram-webhook</code> on your live production domain.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={handleSetWebhook}
            disabled={isLoading}
            className="py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-purple-600/30"
          >
            {isLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Radio className="w-4 h-4" />
            )}
            <span>Set Telegram Webhook</span>
          </button>

          <button
            onClick={handleCheckStatus}
            disabled={statusLoading}
            className="py-3 px-4 rounded-xl bg-[#171e2e] hover:bg-[#1f283d] border border-neutral-700 disabled:opacity-50 text-neutral-200 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${statusLoading ? 'animate-spin' : ''}`} />
            <span>Check Webhook Status</span>
          </button>
        </div>

        {/* Live Telegram Connection State Panel */}
        <div className="bg-[#141b29] border border-neutral-800 rounded-2xl p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-neutral-300 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Current Telegram Connection State</span>
            </span>
            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
              webhookInfo?.url
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                : 'bg-amber-950 text-amber-300 border border-amber-800/60'
            }`}>
              {webhookInfo?.url ? 'ONLINE & ACTIVE' : 'UNREGISTERED'}
            </span>
          </div>

          <div className="text-xs space-y-2 text-neutral-400 bg-[#0e131d] rounded-xl p-3.5 border border-neutral-800/80 font-mono text-[11px]">
            <div className="flex items-start justify-between gap-3">
              <span className="text-neutral-500 shrink-0">Registered Webhook:</span>
              <span className="text-neutral-200 text-right break-all">
                {webhookInfo?.url || 'None (Using long polling or not configured)'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-500">Pending Update Count:</span>
              <span className="text-neutral-200 font-semibold">
                {webhookInfo?.pending_update_count ?? 0}
              </span>
            </div>
            {webhookInfo?.last_error_message && (
              <div className="text-rose-400 pt-2 border-t border-neutral-800">
                <span className="font-bold">Last Telegram Error: </span>
                <span>{webhookInfo.last_error_message}</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={handleSendTest}
              disabled={testLoading}
              className="text-xs font-semibold text-purple-400 hover:text-purple-300 flex items-center gap-1.5 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{testLoading ? 'Sending test...' : 'Send Test Admin Alert'}</span>
            </button>

            {webhookInfo?.url && (
              <button
                type="button"
                onClick={handleDeleteWebhook}
                disabled={isLoading}
                className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Unset Webhook</span>
              </button>
            )}
          </div>
        </div>

        {/* Admin Instructions */}
        <div className="bg-[#101520] border border-neutral-800/80 rounded-2xl p-4 text-xs space-y-2 text-neutral-400 text-[11px] leading-relaxed">
          <h4 className="font-bold text-neutral-300 flex items-center gap-1.5">
            <HelpCircle className="w-4 h-4 text-purple-400" />
            <span>Admin Access Note</span>
          </h4>
          <p>
            This setup page is hidden from regular visitors. Only administrators can access it directly via <code className="text-purple-300">/admin-webhook</code> or <code className="text-purple-300">/#admin-webhook</code>.
          </p>
          <p>
            Whenever you redeploy or update your Vercel domain, visit this page and click <strong>Set Telegram Webhook</strong> to update Telegram's routing.
          </p>
        </div>

      </div>
    </div>
  );
};
