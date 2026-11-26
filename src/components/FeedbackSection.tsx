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
import { Button } from './ui/Button';

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
      <footer className="w-full max-w-6xl mx-auto px-3 sm:px-6 pt-8 pb-6 mt-10 border-t border-[#292B39] font-sans">
        <div className="rounded-2xl bg-[#12141E] border border-[#292B39] p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-1.5 max-w-xl">
            <h3 className="text-base sm:text-lg font-extrabold text-[#F4F3FA] tracking-tight">
              Know a missing dub?
            </h3>
            <p className="text-xs sm:text-sm text-[#A1A5B5] leading-relaxed">
              Submit verified Indian dub info with an official streaming link, or share feedback to help keep the directory accurate.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {onSubmitDub && (
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={onSubmitDub}
                leftIcon={<Plus className="w-4 h-4 shrink-0" />}
              >
                Submit an Anime or Dub
              </Button>
            )}
            {onOpenFeedbackPage && (
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={onOpenFeedbackPage}
                leftIcon={<MessageSquare className="w-4 h-4 shrink-0 text-[#B49AF8]" />}
              >
                Share Feedback
              </Button>
            )}
          </div>
        </div>

        {/* Language Quick Links & Copyright */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="flex items-center gap-3">
            <AniDubLogo size="sm" showText={true} />
            <span className="text-xs text-[#292B39] hidden sm:inline">•</span>
            <span className="text-xs text-[#A1A5B5]">Official Indian Dubbed Anime Directory</span>
          </div>

          <div className="flex flex-col sm:items-end gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#A1A5B5]">
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
                  className="text-[#A1A5B5] hover:text-[#B49AF8] transition-colors duration-150 font-medium"
                >
                  {lang} Dubs
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-[#292B39] flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-[#A1A5B5]">
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
              className="text-[#A1A5B5] hover:text-[#B49AF8] transition-colors duration-150"
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
              className="text-[#A1A5B5] hover:text-[#B49AF8] transition-colors duration-150"
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
    <section className="w-full max-w-2xl mx-auto overflow-x-clip py-8 px-3 sm:px-4 md:px-6 box-border font-sans text-[#F4F3FA]">
      {/* 1) INTRO */}
      <div className="text-center px-2 sm:px-4">
        <h2 className="text-2xl font-extrabold tracking-tight text-[#F4F3FA]">
          Know a missing dub?
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-[#A1A5B5] max-w-lg mx-auto">
          Help keep AniDub India accurate by submitting new dubbed titles or sending us feedback and bug reports.
        </p>
      </div>

      {/* 2) SUBMIT BUTTON */}
      {onSubmitDub && (
        <div className="mt-5 px-2 sm:px-4">
          <Button
            type="button"
            variant="secondary"
            size="lg"
            fullWidth
            onClick={onSubmitDub}
            leftIcon={<Plus className="w-4 h-4 stroke-[2.5] text-[#B49AF8]" />}
          >
            Submit an Anime or Dub
          </Button>
        </div>
      )}

      {/* 3) FEEDBACK FORM CARD */}
      <div className="mt-8 w-full bg-[#12141E] border border-[#292B39] rounded-2xl p-5 sm:p-6 shadow-xl">
        <div className="text-left mb-5">
          <h3 className="text-lg font-extrabold text-[#F4F3FA] tracking-tight">
            Share your feedback
          </h3>
          <p className="mt-1.5 text-xs text-[#A1A5B5] leading-relaxed">
            Report broken links, suggest missing features, or tell us how we can improve the directory.
          </p>
        </div>

        {submitError && (
          <div
            role="alert"
            className="mb-5 p-4 rounded-xl bg-[#F87171]/10 border border-[#F87171]/35 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div className="flex items-start gap-2.5 text-xs text-[#F87171]">
              <AlertCircle className="w-4 h-4 text-[#F87171] shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-[#F4F3FA]">Feedback could not be delivered</p>
                <p className="text-[#F87171] mt-0.5">{submitError}</p>
              </div>
            </div>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={submitFeedbackRequest}
              disabled={isSubmitting || !message.trim()}
              leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isSubmitting ? 'animate-spin' : ''}`} />}
            >
              Retry
            </Button>
          </div>
        )}

        {submitted ? (
          <div className="py-10 text-center space-y-3" role="status">
            <div className="w-12 h-12 rounded-full bg-[#34D399]/15 border border-[#34D399]/40 flex items-center justify-center mx-auto text-[#34D399]">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-lg text-[#F4F3FA]">Feedback Received</h4>
            <p className="text-xs text-[#A1A5B5] max-w-sm mx-auto leading-relaxed">
              Thank you! Your message has been saved and routed to the AniDub India moderation team.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 text-left">
                <label className="text-xs font-semibold text-[#F4F3FA] block">
                  Your Name (optional)
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full h-[44px] bg-[#191C29] border border-[#292B39] focus:border-[#B49AF8] rounded-[12px] px-3.5 text-sm text-[#F4F3FA] placeholder-[#A1A5B5] outline-none transition-colors duration-180 motion-reduce:transition-none"
                />
              </div>
              <div className="space-y-1.5 text-left">
                <label className="text-xs font-semibold text-[#F4F3FA] block">
                  Email (optional)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="For follow-up replies"
                  className="w-full h-[44px] bg-[#191C29] border border-[#292B39] focus:border-[#B49AF8] rounded-[12px] px-3.5 text-sm text-[#F4F3FA] placeholder-[#A1A5B5] outline-none transition-colors duration-180 motion-reduce:transition-none"
                />
              </div>
            </div>

            <div className="space-y-1.5 text-left">
              <label className="text-xs font-semibold text-[#F4F3FA] block">
                Your Message <span className="text-[#B49AF8]">*</span>
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
                className="w-full bg-[#191C29] border border-[#292B39] focus:border-[#B49AF8] rounded-[12px] p-3.5 text-sm text-[#F4F3FA] placeholder-[#A1A5B5] outline-none transition-colors duration-180 motion-reduce:transition-none resize-none leading-relaxed"
              />
            </div>

            {/* Optional Screenshot Upload */}
            <div className="space-y-1.5 text-left">
              <label className="text-xs font-semibold text-[#F4F3FA] block">
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
                <p role="alert" className="text-xs text-[#F87171] font-medium">{fileError}</p>
              )}
              {!screenshot ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`w-full min-h-[72px] py-4 px-4 border border-dashed rounded-[12px] flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-colors duration-180 motion-reduce:transition-none ${
                    isDragging
                      ? 'border-[#B49AF8] bg-[#B49AF8]/10'
                      : 'border-[#292B39] bg-[#191C29]/60 hover:border-[#B49AF8]/60'
                  }`}
                >
                  <Upload className="w-4 h-4 text-[#A1A5B5]" />
                  <span className="text-xs text-[#F4F3FA] font-medium">
                    Click to attach or drag a screenshot here
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3 p-3 rounded-[12px] bg-[#191C29] border border-[#292B39]">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={screenshot}
                      alt="Screenshot preview"
                      width={40}
                      height={40}
                      className="w-10 h-10 rounded-lg object-cover border border-[#292B39] shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#F4F3FA] truncate flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5 text-[#B49AF8] shrink-0" />
                        <span className="truncate">{fileName}</span>
                      </p>
                      <p className="text-[11px] text-[#A1A5B5]">{fileSize}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    aria-label="Remove screenshot"
                    className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-[12px] text-[#A1A5B5] hover:text-[#F87171] hover:bg-[#F87171]/10 flex items-center justify-center transition-colors duration-180 cursor-pointer shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              disabled={isSubmitting || !message.trim()}
              leftIcon={!isSubmitting ? <Send className="w-4 h-4" /> : undefined}
            >
              {isSubmitting ? 'Submitting…' : 'Send Feedback'}
            </Button>
          </form>
        )}
      </div>

      {/* Footer note */}
      <div className="mt-8 pt-6 border-t border-[#292B39] text-center space-y-3">
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
            className="text-[#A1A5B5] hover:text-[#B49AF8] transition-colors duration-150"
          >
            Privacy Policy
          </a>
          <span className="text-[#292B39]">•</span>
          <a
            href="/copyright"
            onClick={(e) => {
              if (onOpenCopyright) {
                e.preventDefault();
                onOpenCopyright();
              }
            }}
            className="text-[#A1A5B5] hover:text-[#B49AF8] transition-colors duration-150"
          >
            Copyright &amp; Takedown
          </a>
        </div>
        <p className="text-xs text-[#A1A5B5]">
          © {new Date().getFullYear()} AniDub India — Legal Indian Dubbed Anime Discovery Directory
        </p>
      </div>
    </section>
  );
};
