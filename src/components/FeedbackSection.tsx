import React, { useState } from 'react';
import { Send, CheckCircle2, MessageSquare, Sparkles, Plus } from 'lucide-react';
import { FeedbackSubmission } from '../types/anime';

interface FeedbackSectionProps {
  onOpenSuggestModal: () => void;
}

export const FeedbackSection: React.FC<FeedbackSectionProps> = ({ 
  onOpenSuggestModal,
}) => {
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

    // Dispatch notification to backend API
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nameOrInsta: nameOrInsta.trim(),
          email: email.trim(),
          feedback: feedback.trim(),
        }),
      });
    } catch (err) {
      console.warn('Feedback API error:', err);
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
    <footer className="w-full border-t border-neutral-800/80 bg-[#0c101a] py-16 px-4 mt-16 pb-16 md:pb-20">
      <div className="max-w-xl mx-auto space-y-10">
        
        {/* Major Call-to-Action: Submit Anime */}
        <div className="text-center space-y-5">
          <div className="space-y-2">
            <h2 className="font-heading font-black text-2xl text-white tracking-tight">
              Know a missing dub?
            </h2>
            <p className="text-sm text-neutral-400 font-medium px-4">
              Help us build the ultimate Indian anime directory by contributing new titles or regional audio info.
            </p>
          </div>
          
          <div className="px-2">
            <button
              onClick={onOpenSuggestModal}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-lg py-4 px-8 rounded-2xl shadow-[0_10px_30px_rgba(168,85,247,0.4)] hover:shadow-[0_15px_40px_rgba(168,85,247,0.5)] transition-all duration-300 active:scale-[0.98] cursor-pointer group"
            >
              <div className="bg-white/20 p-1.5 rounded-lg group-hover:rotate-90 transition-transform duration-300">
                <Plus className="w-5 h-5 text-white" strokeWidth={3} />
              </div>
              <span>Submit an Anime or Dub</span>
            </button>
          </div>
          
          <div className="flex items-center justify-center gap-4 text-[10px] font-bold uppercase tracking-widest text-neutral-500">
            <span className="w-8 h-[1px] bg-neutral-800" />
            <span>Community Driven</span>
            <span className="w-8 h-[1px] bg-neutral-800" />
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
                Your feedback has been received. Thank you for helping us improve!
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
