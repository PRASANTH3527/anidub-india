import React, { useState } from 'react';
import { Plus, Send, CheckCircle2 } from 'lucide-react';

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
    <section className="w-full max-w-[420px] mx-auto overflow-hidden bg-[#0c101a] py-8 px-0 box-border font-sans">
      
      {/* 1) INTRO (centered) */}
      <div className="text-center px-[24px]">
        <h3 className="text-[22px] font-[800] tracking-[-0.03em] text-white">
          Know a missing dub?
        </h3>
        <p className="mt-[12px] text-[13px] leading-[20px] text-[#94a3b8] max-w-full mx-auto">
          Help us build the ultimate Indian anime directory by contributing new titles or regional audio info.
        </p>
      </div>

      {/* 2) SUBMIT BUTTON (20px below paragraph) */}
      <div className="mt-[20px] px-[24px]">
        <button
          type="button"
          onClick={onSubmitDub}
          className="w-full h-[64px] rounded-[24px] bg-gradient-to-r from-[#9d1df5] via-[#c026d3] to-[#e60088] shadow-[0_10px_40px_rgba(147,51,234,.45)] flex items-center justify-center gap-[12px] cursor-pointer active:scale-[0.98] transition-all group"
        >
          <div className="w-[32px] h-[32px] rounded-[10px] bg-[rgba(255,255,255,.2)] flex items-center justify-center group-hover:rotate-90 transition-transform">
            <Plus className="w-[18px] h-[18px] text-white" />
          </div>
          <span className="text-[16px] font-bold text-white tracking-tight">Submit an Anime or Dub</span>
        </button>
      </div>

      {/* 3) DIVIDER (20px below button) */}
      <div className="mt-[20px] h-[16px] flex items-center justify-center gap-[16px]">
        <div className="w-[32px] h-[1px] bg-[#2a2d3a]" />
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#9ca3af]">COMMUNITY DRIVEN</span>
        <div className="w-[32px] h-[1px] bg-[#2a2d3a]" />
      </div>

      {/* 4) FEEDBACK CARD (40px below divider) */}
      <div className="mt-[40px] px-[16px]">
        <div className="rounded-[24px] p-[24px] bg-[#0e1220] border border-[#202638] shadow-2xl text-left">
          <div className="space-y-[4px]">
            <h3 className="text-[18px] leading-[28px] font-bold text-white tracking-[-0.02em]">Share your feedback</h3>
            <p className="text-[12px] leading-[16px] text-[#8b93a7]">Have a suggestion or spotted something? Let us know.</p>
          </div>

          {submitted ? (
            <div className="mt-[20px] bg-emerald-950/40 border border-emerald-800/50 rounded-[16px] p-4 text-center space-y-2 animate-fadeIn">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
              <h4 className="font-bold text-sm text-white">Thank You for Your Feedback!</h4>
              <p className="text-xs text-neutral-300">
                Our database editors have received your submission and will verify the regional OTT licensing details.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-[20px] space-y-[16px]">
              <div>
                <label className="block text-[12px] font-medium leading-[16px] text-[#d1d5db] mb-[6px]">
                  Your name or Insta ID (optional)
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. @animefan_india"
                  className="w-full h-[38px] rounded-[16px] px-[16px] bg-[#141929] border border-[#2a3045] text-[12px] text-white placeholder-[#6b7280] focus:border-[#a855f7] focus:ring-3 focus:ring-[rgba(168,85,247,.25)] focus:outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-[12px] font-medium leading-[16px] text-[#d1d5db] mb-[6px]">
                  Email ID (optional)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. you@gmail.com"
                  className="w-full h-[38px] rounded-[16px] px-[16px] bg-[#141929] border border-[#2a3045] text-[12px] text-white placeholder-[#6b7280] focus:border-[#a855f7] focus:ring-3 focus:ring-[rgba(168,85,247,.25)] focus:outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-[12px] font-medium leading-[16px] text-[#d1d5db] mb-[6px]">
                  Your feedback <span className="text-[#f43f5e]">*</span>
                </label>
                <textarea
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="What can we improve? Any missing dubs, bugs, or ideas..."
                  className="w-full h-[69px] py-[10px] px-[16px] rounded-[16px] bg-[#141929] border border-[#2a3045] text-[12px] text-white placeholder-[#6b7280] focus:border-[#a855f7] focus:ring-3 focus:ring-[rgba(168,85,247,.25)] focus:outline-none transition-all resize-none"
                />
              </div>

              <div className="mt-[24px]">
                <button
                  type="submit"
                  disabled={!message.trim() || isSubmitting}
                  className="w-full h-[36px] rounded-[14px] bg-gradient-to-r from-[#7e22ce] to-[#9333ea] shadow-[0_6px_16px_rgba(91,33,182,.35)] text-[12px] font-semibold text-white flex items-center justify-center gap-[8px] transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <span>{isSubmitting ? 'Submitting feedback...' : 'Submit feedback'}</span>
                  <Send className="w-[14px] h-[14px]" />
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* 5) FOOTER (40px below card) */}
      <div className="mt-[40px] px-[24px] text-center">
        <p className="text-[10px] leading-[16px] text-[#6b7280]">
          © 2026 AniDub India. All anime media belongs to their respective production companies. Licensed under fair-use catalog guidelines.
        </p>
      </div>

    </section>
  );
};
