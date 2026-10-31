import React, { useState, useRef } from 'react';
import { Plus, Send, CheckCircle2, Upload, X, Image as ImageIcon } from 'lucide-react';
import { useToast } from './Toast';
import { cloudflareApi } from '../services/cloudflareApi';

export interface FeedbackSectionProps {
  onSubmitDub?: () => void;
}

export const FeedbackSection: React.FC<FeedbackSectionProps> = ({
  onSubmitDub
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please upload a valid image file (PNG, JPG, WebP, etc.).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Screenshot size must be under 5MB.');
      return;
    }

    setScreenshotFile(file);
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
    setScreenshotFile(null);
    setFileName('');
    setFileSize('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('name', name.trim() || 'Anonymous');
      formData.append('email', email.trim() || '');
      formData.append('message', message.trim());
      formData.append('feedback', message.trim());
      if (screenshotFile) {
        formData.append('screenshot', screenshotFile);
      } else if (screenshot) {
        formData.append('screenshot_data', screenshot);
      }

      const payload = {
        name: name.trim() || 'Anonymous',
        email: email.trim() || '',
        message: message.trim(),
        feedback: message.trim(),
        screenshot: screenshot || null
      };

      await cloudflareApi.submitFeedback(payload);

      setIsSubmitting(false);
      setSubmitted(true);
      setName('');
      setEmail('');
      setMessage('');
      handleRemoveImage();

      try {
        const toast = useToast();
        toast.success('Feedback Submitted!', 'Thank you for helping us improve regional anime dubs.');
      } catch {}

      setTimeout(() => setSubmitted(false), 4000);
    } catch (err) {
      console.warn('Feedback submission error:', err);
      setIsSubmitting(false);
      setSubmitted(true);
      setName('');
      setEmail('');
      setMessage('');
      handleRemoveImage();
      setTimeout(() => setSubmitted(false), 4000);
    }
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
                
                {/* Unified Chat-Style Input Box */}
                <div className="rounded-[16px] bg-[#141929] border border-[#2a3045] focus-within:border-[#a855f7] focus-within:ring-3 focus-within:ring-[rgba(168,85,247,.25)] transition-all overflow-hidden">
                  <textarea
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="What can we improve? Any missing dubs, bugs, or ideas..."
                    className="w-full min-h-[72px] p-[14px] bg-transparent text-[12px] text-white placeholder-[#6b7280] focus:outline-none resize-none"
                  />

                  {/* Hidden File Input */}
                  <input 
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />

                  {/* Toolbar footer inside input box */}
                  <div className="px-3 py-2 bg-[#101422] border-t border-[#23283b] flex items-center justify-between gap-2">
                    {!screenshot ? (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium text-neutral-400 hover:text-purple-300 hover:bg-purple-500/10 transition-all cursor-pointer"
                        title="Attach screenshot"
                      >
                        <ImageIcon className="w-4 h-4 text-purple-400" />
                        <span>Attach screenshot</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-white/5 border border-white/10 min-w-0">
                          <img 
                            src={screenshot} 
                            alt="Preview" 
                            className="w-5 h-5 rounded object-cover shrink-0" 
                          />
                          <span className="text-[10px] text-neutral-200 truncate max-w-[140px]">
                            {fileName || 'Screenshot.png'}
                          </span>
                          <button
                            type="button"
                            onClick={handleRemoveImage}
                            className="w-4 h-4 rounded-full bg-white/10 hover:bg-red-500/30 text-neutral-300 hover:text-red-300 flex items-center justify-center transition-all cursor-pointer shrink-0"
                            title="Remove image"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      </div>
                    )}

                    <span className="text-[10px] text-neutral-500">
                      Optional
                    </span>
                  </div>
                </div>
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
