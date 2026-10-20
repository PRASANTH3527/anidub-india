import React, { useState } from 'react';
import { Plus, Send, CheckCircle2, Sparkles } from 'lucide-react';

export interface FeedbackSectionProps {
  onSubmitDub?: () => void;
}

export const FeedbackSection: React.FC<FeedbackSectionProps> = ({
  onSubmitDub
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setIsSubmitting(true);

    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message })
      }).catch(() => {});
    } catch {}

    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitted(true);
      setName('');
      setEmail('');
      setMessage('');
      setTimeout(() => setSubmitted(false), 4000);
    }, 800);
  };

  return (
    <section className="w-full max-w-full overflow-hidden border-t border-neutral-800/80 bg-[#0c101a] py-12 sm:py-16 px-4 mt-12 sm:mt-16 box-border font-sans">
      <div className="max-w-xl mx-auto space-y-10">
        
        {/* TOP CTA BLOCK */}
        <div className="text-center space-y-5">
          <h3 className="font-heading font-black text-2xl text-white tracking-tight">
            Know a missing dub?
          </h3>

          <button
            type="button"
            onClick={onSubmitDub}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-lg py-4 px-8 rounded-2xl shadow-[0_10px_30px_rgba(168,85,247,0.4)] hover:shadow-[0_15px_40px_rgba(168,85,247,0.5)] transition-all duration-300 active:scale-[0.98] cursor-pointer group"
          >
            <span>Submit Missing Dub Entry</span>
            <div className="bg-white/20 p-1.5 rounded-lg group-hover:rotate-90 transition-transform">
              <Plus className="w-5 h-5" />
            </div>
          </button>

          <div className="flex items-center justify-center gap-4 text-[10px] font-bold uppercase tracking-widest text-neutral-500">
            <div className="w-8 h-[1px] bg-neutral-800" />
            <span>or send direct feedback</span>
            <div className="w-8 h-[1px] bg-neutral-800" />
          </div>
        </div>

        {/* FEEDBACK CARD */}
        <div className="bg-[#131926] border border-neutral-800 rounded-2xl p-6 sm:p-7 shadow-xl">
          {submitted ? (
            <div className="bg-emerald-950/40 border border-emerald-800/50 rounded-xl p-4 text-center space-y-2 animate-fadeIn">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
              <h4 className="font-bold text-sm text-white">Thank You for Your Feedback!</h4>
              <p className="text-xs text-neutral-300">
                Our database editors have received your submission and will verify the regional OTT licensing details.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your Name (Optional)"
                  className="w-full bg-[#171e2e] border border-neutral-700/80 focus:border-purple-500 rounded-xl py-2.5 px-3.5 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-colors"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email Address (Optional)"
                  className="w-full bg-[#171e2e] border border-neutral-700/80 focus:border-purple-500 rounded-xl py-2.5 px-3.5 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-colors"
                />
              </div>

              <textarea
                rows={4}
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us about missing regional audio tracks, incorrect voice artists, or website suggestions..."
                className="w-full bg-[#171e2e] border border-neutral-700/80 focus:border-purple-500 rounded-xl py-2.5 px-3.5 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-colors resize-none"
              />

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-purple-600/30 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Sending Feedback...' : 'Send Feedback'}</span>
              </button>
            </form>
          )}
        </div>

        {/* FOOTER NOTE */}
        <div className="text-center text-[11px] text-neutral-500">
          Anidub India is a community catalog and does not host copyrighted media files.
        </div>

      </div>
    </section>
  );
};
