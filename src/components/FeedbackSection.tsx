import React, { useState, useRef } from 'react';
import {
  Plus,
  Send,
  CheckCircle2,
  Upload,
  X,
  Image as ImageIcon,
  AlertCircle,
  RefreshCw,
  MessageSquare,
} from 'lucide-react';
import { useToast } from './Toast';
import { cloudflareApi } from '../services/cloudflareApi';
import { AniDubLogo } from './AniDubLogo';
import { PRIMARY_SEO_LANGUAGES, getLanguageSlug } from '../utils/seoMeta';

export interface FeedbackSectionProps {
  onSubmitDub?: () => void;
  onNavigateLanguage?: (language: string) => void;
  onOpenFeedbackPage?: () => void;
  onOpenPrivacy?: () => void;
  onOpenCopyright?: () => void;
  mode?: 'full' | 'footer';
}

export const FeedbackSection: React.FC<FeedbackSectionProps> = ({
  onSubmitDub,
  onNavigateLanguage,
  onOpenFeedbackPage,
  onOpenPrivacy,
  onOpenCopyright,
  mode = 'full',
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageFile = (file: File) => {
    setFileError(null);
    if (!file.type.startsWith('image/')) {
      setFileError('Please upload a valid image file (PNG, JPG, WebP, etc.).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFileError('Screenshot size must be under 5MB.');
      return;
    }

    setFileName(file.name);
    const sizeKb = Math.round(file.size / 1024);
    setFileSize(sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`);

    const reader = new FileReader();
    reader.onloadend = () => {
      setScreenshot(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleImageFile(file);
    }
  };

  const handleRemoveImage = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setScreenshot(null);
    setFileName('');
    setFileSize('');
    setFileError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const submitFeedbackRequest = async () => {
    if (!message.trim()) return;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const payload = {
        name: name.trim() || 'Anonymous',
        email: email.trim() || '',
        feedback: message.trim(),
        ...(screenshot ? { screenshot } : {}),
      };

      const res = await cloudflareApi.submitFeedback(payload);

      if (!res || !res.success) {
        const errMsg =
          res?.error || 'Could not submit your feedback right now. Your message has been kept below so you can retry.';
        setSubmitError(errMsg);
        if (toast?.error) {
          toast.error('Submission Failed', errMsg);
        }
        return;
      }

      // ONLY clear inputs and show success state on verified 2xx response
      setSubmitted(true);
      setName('');
      setEmail('');
      setMessage('');
      handleRemoveImage();

      if (toast?.success) {
        toast.success('Feedback Submitted', 'Thank you for helping us improve regional anime dubs.');
      }

      setTimeout(() => setSubmitted(false), 5000);
    } catch (err: any) {
      const errMsg =
        err?.message || 'Network error while sending feedback. Your message has been preserved — please retry.';
      setSubmitError(errMsg);
      if (toast?.error) {
        toast.error('Submission Failed', errMsg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitFeedbackRequest();
  };

  // Compact footer mode for main catalog/discovery views (keeps full feedback form dedicated to /feedback)
  if (mode === 'footer') {
    return (
      <footer className="w-full max-w-6xl mx-auto px-3 sm:px-6 pt-8 pb-6 mt-10 border-t border-white/10 font-sans">
        <div className="rounded-2xl bg-[#0d111a]/90 border border-white/10 p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-1.5 max-w-xl">
            <h3 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
              Know a missing dub?
            </h3>
            <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
              Submit verified Indian dub info with an official streaming link, or share feedback to help keep the directory accurate.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {onSubmitDub && (
              <button
                type="button"
                onClick={onSubmitDub}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span>Submit an Anime or Dub</span>
              </button>
            )}
            {onOpenFeedbackPage && (
              <button
                type="button"
                onClick={onOpenFeedbackPage}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-200 hover:text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
              >
                <MessageSquare className="w-4 h-4 shrink-0 text-purple-400" />
                <span>Share Feedback</span>
              </button>
            )}
          </div>
        </div>

        {/* Language Quick Links & Copyright */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="flex items-center gap-3">
            <AniDubLogo size="sm" showText={true} />
            <span className="text-xs text-neutral-500 hidden sm:inline">•</span>
            <span className="text-xs text-neutral-400">Official Indian Dubbed Anime Directory</span>
          </div>

          <div className="flex flex-col sm:items-end gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              Regional Dubbed Anime Languages
            </span>
            <div className="flex flex-wrap items-center justify-center sm:justify-end gap-x-4 gap-y-1.5 text-xs">
              {PRIMARY_SEO_LANGUAGES.map((lang) => (
                <a
                  key={lang}
                  href={`/dubbed-anime/${getLanguageSlug(lang)}`}
                  onClick={(e) => {
                    if (onNavigateLanguage) {
                      e.preventDefault();
                      onNavigateLanguage(lang);
                    }
                  }}
                  className="text-neutral-400 hover:text-purple-300 transition-colors font-medium"
                >
                  {lang} Dubs
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-neutral-500">
          <p className="text-center sm:text-left">
            © {new Date().getFullYear()} AniDub India. Legal OTT discovery directory — we do not host video streams. Rights-holder requests are honored promptly.
          </p>
          <div className="flex items-center gap-4 font-semibold">
            <a
              href="/privacy"
              onClick={(e) => {
                if (onOpenPrivacy) {
                  e.preventDefault();
                  onOpenPrivacy();
                }
              }}
              className="text-neutral-400 hover:text-purple-300 transition-colors"
            >
              Privacy Policy
            </a>
            <a
              href="/copyright"
              onClick={(e) => {
                if (onOpenCopyright) {
                  e.preventDefault();
                  onOpenCopyright();
                }
              }}
              className="text-neutral-400 hover:text-purple-300 transition-colors"
            >
              Copyright &amp; Takedown
            </a>
          </div>
        </div>
      </footer>
    );
  }

  // Dedicated Full Feedback & Community Contribution Page
  return (
    <section className="w-full max-w-2xl mx-auto overflow-x-clip py-8 px-3 sm:px-4 md:px-6 box-border font-sans">
      {/* 1) INTRO */}
      <div className="text-center px-2 sm:px-4">
        <h2 className="text-2xl font-extrabold tracking-tight text-white">
          Know a missing dub?
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-neutral-400 max-w-lg mx-auto">
          Help keep AniDub India accurate by submitting new dubbed titles or sending us feedback and bug reports.
        </p>
      </div>

      {/* 2) SUBMIT BUTTON */}
      {onSubmitDub && (
        <div className="mt-5 px-2 sm:px-4">
          <button
            type="button"
            onClick={onSubmitDub}
            className="w-full min-h-[48px] bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors active:scale-[0.99] cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Submit an Anime or Dub</span>
          </button>
        </div>
      )}

      {/* 3) FEEDBACK FORM CARD */}
      <div className="mt-8 w-full bg-[#131926] border border-[#242d46] rounded-2xl p-5 sm:p-6">
        <div className="text-left mb-5">
          <h3 className="text-lg font-extrabold text-white tracking-tight">
            Share your feedback
          </h3>
          <p className="mt-1.5 text-xs text-neutral-400 leading-relaxed">
            Report broken links, suggest missing features, or tell us how we can improve the directory.
          </p>
        </div>

        {submitError && (
          <div
            role="alert"
            className="mb-5 p-4 rounded-xl bg-rose-500/10 border border-rose-500/35 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div className="flex items-start gap-2.5 text-xs text-rose-200">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-rose-300">Feedback could not be delivered</p>
                <p className="text-rose-200/85 mt-0.5">{submitError}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={submitFeedbackRequest}
              disabled={isSubmitting || !message.trim()}
              className="px-3.5 py-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-200 text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSubmitting ? 'animate-spin' : ''}`} />
              <span>Retry</span>
            </button>
          </div>
        )}

        {submitted ? (
          <div className="py-10 text-center space-y-3" role="status">
            <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center mx-auto text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-lg text-white">Feedback Received</h4>
            <p className="text-xs text-neutral-400 max-w-sm mx-auto leading-relaxed">
              Thank you! Your message has been saved and routed to the AniDub India moderation team.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 text-left">
                <label className="text-xs font-semibold text-neutral-300 block">
                  Your Name (optional)
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full h-11 bg-[#0b0e18] border border-[#2a344d] focus:border-purple-500 rounded-xl px-3.5 text-sm text-white placeholder-neutral-500 outline-none transition-colors"
                />
              </div>
              <div className="space-y-1.5 text-left">
                <label className="text-xs font-semibold text-neutral-300 block">
                  Email (optional)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="For follow-up replies"
                  className="w-full h-11 bg-[#0b0e18] border border-[#2a344d] focus:border-purple-500 rounded-xl px-3.5 text-sm text-white placeholder-neutral-500 outline-none transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5 text-left">
              <label className="text-xs font-semibold text-neutral-300 block">
                Your Message <span className="text-purple-400">*</span>
              </label>
              <textarea
                rows={4}
                required
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  if (submitError) setSubmitError(null);
                }}
                placeholder="Tell us what needs fixing or how we can improve AniDub India..."
                className="w-full bg-[#0b0e18] border border-[#2a344d] focus:border-purple-500 rounded-xl p-3.5 text-sm text-white placeholder-neutral-500 outline-none transition-colors resize-none leading-relaxed"
              />
            </div>

            {/* Optional Screenshot Upload */}
            <div className="space-y-1.5 text-left">
              <label className="text-xs font-semibold text-neutral-300 block">
                Screenshot (optional, max 5MB)
              </label>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />
              {fileError && (
                <p className="text-xs text-rose-400 font-medium">{fileError}</p>
              )}
              {!screenshot ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`w-full py-5 px-4 border border-dashed rounded-xl flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                    isDragging
                      ? 'border-purple-400 bg-purple-500/10'
                      : 'border-[#2a344d] bg-[#0b0e18]/60 hover:border-purple-500/50'
                  }`}
                >
                  <Upload className="w-4 h-4 text-neutral-400" />
                  <span className="text-xs text-neutral-300 font-medium">
                    Click to attach or drag a screenshot here
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#0b0e18] border border-purple-500/35">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={screenshot}
                      alt="Screenshot preview"
                      className="w-10 h-10 rounded-lg object-cover border border-white/10 shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                        <span className="truncate">{fileName}</span>
                      </p>
                      <p className="text-[11px] text-neutral-400">{fileSize}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    aria-label="Remove screenshot"
                    className="p-2 rounded-lg text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !message.trim()}
              className="w-full min-h-[46px] bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSubmitting ? (
                <span>Submitting...</span>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Send Feedback</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>

      {/* Footer note */}
      <div className="mt-8 pt-6 border-t border-white/10 text-center space-y-3">
        <div className="flex justify-center">
          <AniDubLogo size="sm" showText={true} />
        </div>
        <div className="flex items-center justify-center gap-4 text-xs font-semibold">
          <a
            href="/privacy"
            onClick={(e) => {
              if (onOpenPrivacy) {
                e.preventDefault();
                onOpenPrivacy();
              }
            }}
            className="text-neutral-400 hover:text-purple-300 transition-colors"
          >
            Privacy Policy
          </a>
          <span className="text-neutral-600">•</span>
          <a
            href="/copyright"
            onClick={(e) => {
              if (onOpenCopyright) {
                e.preventDefault();
                onOpenCopyright();
              }
            }}
            className="text-neutral-400 hover:text-purple-300 transition-colors"
          >
            Copyright &amp; Takedown
          </a>
        </div>
        <p className="text-xs text-neutral-500">
          © {new Date().getFullYear()} AniDub India — Legal Indian Dubbed Anime Discovery Directory
        </p>
      </div>
    </section>
  );
};
