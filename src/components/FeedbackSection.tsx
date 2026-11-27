import React, { useState } from 'react';
import {
  MessageSquare, Send, CheckCircle2, Heart, Bug, Sparkles, Database, Eye, HelpCircle
} from 'lucide-react';
import { cloudflareApi } from '../services/cloudflareApi';
import { useTranslation } from 'react-i18next';

export interface FeedbackSectionProps {
  onShowToast?: (message: string, type?: 'success' | 'info' | 'error') => void;
  onOpenLegal?: (page: 'privacy' | 'terms' | 'dmca') => void;
  mode?: 'full' | 'footer';
  onSubmitDub?: () => void;
  onNavigateLanguage?: (language: string) => void;
  onOpenFeedbackPage?: () => void;
  onOpenPrivacy?: () => void;
  onOpenCopyright?: () => void;
}

const FEEDBACK_CATEGORIES = [
  { id: 'bug', label: 'Report a bug', icon: Bug },
  { id: 'feature', label: 'Suggest a feature', icon: Sparkles },
  { id: 'data', label: 'Incorrect anime data', icon: Database },
  { id: 'accessibility', label: 'Accessibility issue', icon: Eye },
  { id: 'other', label: 'Other feedback', icon: HelpCircle },
] as const;

const REGIONAL_FOOTER_LANGUAGES = [
  { name: 'Hindi', slug: 'hindi' },
  { name: 'Tamil', slug: 'tamil' },
  { name: 'Telugu', slug: 'telugu' },
  { name: 'Malayalam', slug: 'malayalam' },
  { name: 'Kannada', slug: 'kannada' },
] as const;

export const FeedbackSection: React.FC<FeedbackSectionProps> = ({
  onShowToast,
  onOpenLegal,
  onNavigateLanguage,
  onOpenPrivacy,
  onOpenCopyright,
  mode = 'footer',
}) => {
  const { t } = useTranslation(['common', 'forms']);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState<string>('Report a bug');
  const [message, setMessage] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    const debugContext =
      typeof window !== 'undefined'
        ? `\n\n[Category: ${category} | Page: ${window.location.pathname}]`
        : `\n\n[Category: ${category}]`;

    try {
      await cloudflareApi.submitFeedback({
        name: name || 'Anonymous',
        email,
        feedback: `${message.trim()}${debugContext}`,
        message: `${message.trim()}${debugContext}`,
      });
    } catch (error) {
      console.error('Failed to submit feedback to Cloudflare:', error);
    }

    const feedbacks = JSON.parse(localStorage.getItem('user_feedbacks') || '[]');
    feedbacks.push({
      id: Date.now().toString(),
      name: name || 'Anonymous',
      email,
      category,
      message,
      date: new Date().toISOString(),
    });
    localStorage.setItem('user_feedbacks', JSON.stringify(feedbacks));

    setIsSubmitted(true);
    setName('');
    setEmail('');
    setMessage('');

    if (onShowToast) {
      onShowToast('Thank you for your feedback!', 'success');
    }

    setTimeout(() => {
      setIsSubmitted(false);
    }, 5000);
  };

  if (mode === 'footer') {
    return (
      <footer className="relative mt-16 border-t border-[var(--border-subtle)] bg-[var(--bg-canvas)] pb-24 md:pb-8 overflow-hidden">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-5">
          {/* Compact Regional Dubbed Anime SEO Directory Links */}
          <nav
            aria-label={t('common:footer.regionalHeading', 'Regional Dubbed Anime Languages')}
            className="flex flex-wrap items-center justify-center md:justify-between gap-2 pb-4 border-b border-[var(--border-subtle)]/70"
          >
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              {t('common:footer.regionalHeading', 'Regional Dubbed Anime Languages')}
            </span>
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              {REGIONAL_FOOTER_LANGUAGES.map((lang) => (
                <a
                  key={lang.slug}
                  href={`/dubbed-anime/${lang.slug}`}
                  onClick={(e) => {
                    if (onNavigateLanguage) {
                      e.preventDefault();
                      onNavigateLanguage(lang.name);
                    }
                  }}
                  className="min-h-[40px] px-3 py-1.5 rounded-[8px] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/40 text-[12px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] inline-flex items-center transition-colors"
                >
                  {t('common:footer.dubbedAnimeSuffix', {
                    language: t(`common:languages.${lang.slug}`, lang.name),
                    defaultValue: `${lang.name} Dubbed Anime`,
                  })}
                </a>
              ))}
            </div>
          </nav>

          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-[12px] text-[var(--text-secondary)]">
            <div className="flex items-center gap-2">
              <span className="anidub-logo-wrap shrink-0">
                <img
                  src="/logo.png?v=2"
                  alt="AniDub India"
                  loading="lazy"
                  className="h-7 w-auto object-contain"
                />
              </span>
              <span>
                {t('common:footer.rights', {
                  year: new Date().getFullYear(),
                  defaultValue: `© ${new Date().getFullYear()} All rights reserved.`,
                })}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => (onOpenLegal ? onOpenLegal('privacy') : onOpenPrivacy?.())}
                className="min-h-[44px] px-2 hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              >
                {t('common:footer.privacy', 'Privacy Policy')}
              </button>
              <button
                type="button"
                onClick={() => (onOpenLegal ? onOpenLegal('terms') : onOpenCopyright?.())}
                className="min-h-[44px] px-2 hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              >
                {t('common:footer.terms', 'Terms of Service')}
              </button>
              <button
                type="button"
                onClick={() => (onOpenLegal ? onOpenLegal('dmca') : onOpenCopyright?.())}
                className="min-h-[44px] px-2 hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              >
                {t('common:footer.dmca', 'DMCA / Rights-Holder')}
              </button>
            </div>

            <div className="flex items-center gap-1.5 text-center">
              <Heart className="w-3.5 h-3.5 text-[var(--accent-primary)] fill-current shrink-0" />
              <span>{t('common:footer.madeForFans', 'Rights-holder metadata directory built for Indian anime fans')}</span>
            </div>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <section className="max-w-3xl mx-auto px-4 sm:px-6 pt-5 pb-24 text-[var(--text-primary)]">
      <div className="rounded-[18px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-5 sm:p-7">
        <div className="mb-6">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] bg-[var(--accent-primary)]/15 border border-[var(--accent-primary)]/30 text-[var(--accent-hover)] text-[11px] font-bold uppercase tracking-wider mb-2">
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Help &amp; Feedback</span>
          </div>
          <h1 className="text-[24px] sm:text-[30px] font-bold text-[var(--text-primary)] leading-[1.2] tracking-[-0.02em]">
            {t('forms:feedback.title', 'Send Feedback')}
          </h1>
          <p className="text-[14px] text-[var(--text-secondary)] mt-1">
            {t('forms:feedback.subtitle', 'Share ideas, report UI bugs, or request new languages')}
          </p>
        </div>

        {isSubmitted ? (
          <div className="rounded-[14px] bg-emerald-500/10 border border-emerald-500/30 p-6 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center mb-3 text-[#34D399]">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h2 className="text-[18px] font-bold text-[var(--text-primary)] mb-1">Feedback Received!</h2>
            <p className="text-[13px] text-[var(--text-secondary)]">
              Thank you for helping us keep regional dub discovery accurate and fast.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Selectable 44px+ Feedback Category Cards */}
            <div>
              <label className="block text-[12px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-2">
                Feedback Category
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {FEEDBACK_CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  const isSelected = category === cat.label;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.label)}
                      className={`min-h-[44px] px-3.5 py-2.5 rounded-[12px] border text-left flex items-center gap-2.5 text-[13px] font-semibold transition-all duration-180 ${
                        isSelected
                          ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary)] border-[var(--accent-primary)]'
                          : 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/40'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[12px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                  Name (Optional)
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full min-h-[44px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[12px] px-3.5 text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
                />
              </div>
              <div>
                <label className="block text-[12px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                  Email (Optional)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full min-h-[44px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[12px] px-3.5 text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[12px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                Details <span className="text-[var(--accent-primary)]">*</span>
              </label>
              <textarea
                required
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t('forms:feedback.messagePlaceholder', `Describe your "${category}" feedback...`)}
                className="w-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[12px] p-3.5 text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)] resize-none"
              />
              <p className="text-[11px] text-[var(--text-secondary)] mt-1.5">
                Current page route and browser viewport context are automatically attached to help diagnose issues faster.
              </p>
            </div>

            <button
              type="submit"
              className="w-full sm:w-auto min-h-[44px] px-6 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-[var(--accent-on-primary)] font-bold rounded-[12px] transition-colors flex items-center justify-center gap-2 text-[14px]"
            >
              <Send className="w-4 h-4" />
              <span>{t('forms:feedback.submitCta', 'Submit Feedback')}</span>
            </button>
          </form>
        )}
      </div>
    </section>
  );
};
