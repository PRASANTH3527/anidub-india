import React, { useState } from 'react';
import { Send, CheckCircle2, MessageSquare, Sparkles } from 'lucide-react';
import { FeedbackSubmission } from '../types/anime';
import { sendTelegramFeedbackAlert } from '../services/telegramServerless';

interface FeedbackSectionProps {
  onOpenSuggestModal: () => void;
}

export const FeedbackSection: React.FC<FeedbackSectionProps> = ({ onOpenSuggestModal }) => {
  const [nameOrInsta, setNameOrInsta] = useState('');
  const [email, setEmail] = useState('');
  const [feedback, setFeedback] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedback.trim()) return;

    setLoading(true);

    const submission: FeedbackSubmission = {
      id: 'sub-' + Date.now(),
      nameOrInsta: nameOrInsta.trim() || 'Anonymous Otaku',
      email: email.trim(),
      feedback: feedback.trim(),
      timestamp: new Date().toISOString(),
    };

    // Dispatch notification to Telegram bot
    try {
      const res = await fetch('/api/telegram-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nameOrInsta: nameOrInsta.trim(),
          email: email.trim(),
          feedback: feedback.trim(),
        }),
      });

      if (!res.ok) {
        // Fallback to direct client-side Telegram Bot API
        await sendTelegramFeedbackAlert({
          nameOrInsta: nameOrInsta.trim(),
          email: email.trim(),
          feedback: feedback.trim(),
        });
      }
    } catch (err) {
      console.warn('API error, falling back to direct Telegram dispatch:', err);
      await sendTelegramFeedbackAlert({
        nameOrInsta: nameOrInsta.trim(),
        email: email.trim(),
        feedback: feedback.trim(),
      });
    }

    // Save locally for persistence
    try {
      const existing = JSON.parse(localStorage.getItem('anidub_feedback') || '[]');
      localStorage.setItem('anidub_feedback', JSON.stringify([submission, ...existing]));
    } catch (e) {
      // ignore
    }

    setLoading(false);
    setSubmitted(true);
    setNameOrInsta('');
    setEmail('');
    setFeedback('');

    setTimeout(() => {
      setSubmitted(false);
    }, 6000);
  };

  return (
    <footer className="w-full border-t border-neutral-800/80 bg-[#0c101a] py-12 px-4 mt-16">
      <div className="max-w-xl mx-auto space-y-8">
        
        {/* Community Info Banner */}
        <div className="text-center space-y-2">
          <p className="text-sm text-neutral-400 font-medium">
            AniDub India — community-driven directory of Indian language anime dubs
          </p>
          <div>
            <button
              onClick={onOpenSuggestModal}
              className="text-xs font-semibold text-purple-400 hover:text-purple-300 underline underline-offset-4 cursor-pointer hover:opacity-90 transition-opacity"
            >
              Submit an anime or dub →
            </button>
          </div>
        </div>

        {/* Feedback Card */}
        <div className="bg-[#131926] border border-neutral-800 rounded-2xl p-6 sm:p-7 shadow-xl">
          <div className="mb-5">
            <h3 className="font-heading font-black text-lg text-white">
              Share your feedback
            </h3>
            <p className="text-xs text-neutral-400 mt-1">
              Have a suggestion or spotted something? Let us know.
            </p>
          </div>

          {submitted ? (
            <div className="bg-emerald-950/40 border border-emerald-800/50 rounded-xl p-4 text-center space-y-2 animate-fadeIn">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto" />
              <p className="text-sm font-bold text-emerald-300">
                Thank you for your feedback!
              </p>
              <p className="text-xs text-emerald-400/80">
                Your feedback was delivered directly to our team on Telegram.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                  Your name or Insta ID (optional)
                </label>
                <input
                  type="text"
                  value={nameOrInsta}
                  onChange={(e) => setNameOrInsta(e.target.value)}
                  placeholder="e.g. @animefan_india"
                  className="w-full bg-[#171e2e] border border-neutral-700/80 focus:border-purple-500 rounded-xl py-2.5 px-3.5 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                  Email ID (optional)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. you@gmail.com"
                  className="w-full bg-[#171e2e] border border-neutral-700/80 focus:border-purple-500 rounded-xl py-2.5 px-3.5 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                  Your feedback <span className="text-rose-400">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="What can we improve? Any missing dubs, bugs, or ideas..."
                  className="w-full bg-[#171e2e] border border-neutral-700/80 focus:border-purple-500 rounded-xl py-2.5 px-3.5 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-colors resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !feedback.trim()}
                className="w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-purple-600/30"
              >
                {loading ? (
                  <span>Sending feedback...</span>
                ) : (
                  <>
                    <span>Submit feedback</span>
                    <Send className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        <div className="text-center text-[11px] text-neutral-500">
          © {new Date().getFullYear()} AniDub India. All anime media belongs to their respective production committees and licensors.
        </div>
      </div>
    </footer>
  );
};
