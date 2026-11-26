import React from 'react';
import { Shield, FileText, AlertCircle, ArrowLeft, Calendar, Mail } from 'lucide-react';

export interface LegalPageProps {
  type?: 'privacy' | 'terms' | 'dmca' | 'copyright';
  page?: 'privacy' | 'copyright' | 'terms' | 'dmca' | string;
  onBack?: () => void;
  onNavigateHome?: () => void;
  onSwitchLegalPage?: (nextPage: 'privacy' | 'copyright') => void;
  onOpenFeedback?: () => void;
}

export const LegalPage: React.FC<LegalPageProps> = ({
  type: typeProp,
  page,
  onBack: onBackProp,
  onNavigateHome,
}) => {
  const onBack = onBackProp || onNavigateHome || (() => {});
  const rawType = typeProp || page || 'privacy';
  const type: 'privacy' | 'terms' | 'dmca' =
    rawType === 'copyright' || rawType === 'dmca'
      ? 'dmca'
      : rawType === 'terms'
        ? 'terms'
        : 'privacy';
  const renderPrivacyContent = () => (
    <div className="space-y-6 text-[#A1A5B5] text-[15px] sm:text-[16px] leading-[1.7]">
      <section id="section-1" className="space-y-2">
        <h2 className="text-[18px] sm:text-[20px] font-bold text-[#F4F3FA]">
          1. Information We Collect
        </h2>
        <p>
          AniDub India collects minimal data necessary to provide our regional dub discovery and watchlist service. When you use our platform as a guest, your watchlist, per-season episode progress, and language filter preferences are stored locally in your browser&apos;s storage (`localStorage`).
        </p>
        <p>
          If you create an account via Clerk Authentication, we store your email address, display name, and synchronized watchlist records in our secure Cloudflare D1 database.
        </p>
      </section>

      <section id="section-2" className="space-y-2">
        <h2 className="text-[18px] sm:text-[20px] font-bold text-[#F4F3FA]">
          2. How We Use Your Data
        </h2>
        <p>
          We use your information strictly to synchronize your watchlist across devices, remember your preferred Indian regional dub languages (Tamil, Hindi, Telugu, Malayalam, Kannada, Bengali), and display community reviews or chat messages you explicitly submit. We never sell personal data to third parties.
        </p>
      </section>

      <section id="section-3" className="space-y-2">
        <h2 className="text-[18px] sm:text-[20px] font-bold text-[#F4F3FA]">
          3. Third-Party Services &amp; Official OTT Links
        </h2>
        <p>
          Our service includes outbound links to official streaming platforms operating in India (such as Crunchyroll, Netflix, Prime Video, JioCinema, and Muse Asia). Once you follow an outbound link, that streaming platform&apos;s own privacy policy applies.
        </p>
      </section>
    </div>
  );

  const renderTermsContent = () => (
    <div className="space-y-6 text-[#A1A5B5] text-[15px] sm:text-[16px] leading-[1.7]">
      <section id="section-1" className="space-y-2">
        <h2 className="text-[18px] sm:text-[20px] font-bold text-[#F4F3FA]">
          1. Acceptance of Terms
        </h2>
        <p>
          By accessing and using AniDub India, you agree to be bound by these Terms of Service. AniDub India operates strictly as an informational metadata directory and discovery guide for official regional anime dubs in India.
        </p>
      </section>

      <section id="section-2" className="space-y-2">
        <h2 className="text-[18px] sm:text-[20px] font-bold text-[#F4F3FA]">
          2. No Video Hosting or Piracy
        </h2>
        <p>
          AniDub India does not host, stream, or distribute any copyrighted video files. All streaming links provided in our catalog point exclusively to verified legal OTT platforms available in India. Users are strictly prohibited from posting pirated links in reviews or community chat.
        </p>
      </section>

      <section id="section-3" className="space-y-2">
        <h2 className="text-[18px] sm:text-[20px] font-bold text-[#F4F3FA]">
          3. Community Contributions &amp; Data Honesty
        </h2>
        <p>
          When submitting regional dub metadata, episode counts, or reviews, you agree to provide accurate, verifiable information backed by official OTT announcements and to respect spoiler etiquette.
        </p>
      </section>
    </div>
  );

  const renderDmcaContent = () => (
    <div className="space-y-6 text-[#A1A5B5] text-[15px] sm:text-[16px] leading-[1.7]">
      <section id="section-1" className="space-y-2">
        <h2 className="text-[18px] sm:text-[20px] font-bold text-[#F4F3FA]">
          1. Metadata Directory &amp; Rights-Holder Notice
        </h2>
        <p>
          AniDub India is an informational index of regional anime dub availability in India. All anime titles, promotional poster artwork, and platform trademarks belong to their respective copyright owners and official Indian licensees.
        </p>
      </section>

      <section id="section-2" className="space-y-2">
        <h2 className="text-[18px] sm:text-[20px] font-bold text-[#F4F3FA]">
          2. Submitting a Takedown or Metadata Correction Request
        </h2>
        <p>
          If you are a copyright owner or authorized licensee and wish to request the removal or modification of any poster image, synopsis, or platform listing, please send a notice containing:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Identification of the copyrighted work or catalog entry URL.</li>
          <li>Your contact information and proof of authorization on behalf of the rights-holder.</li>
          <li>A statement made in good faith requesting removal or correction.</li>
        </ul>
      </section>

      <section id="section-3" className="space-y-2">
        <h2 className="text-[18px] sm:text-[20px] font-bold text-[#F4F3FA]">
          3. Expedited Response Commitment
        </h2>
        <p>
          Verified rights-holder takedown and metadata correction requests are reviewed and actioned within 24–48 hours.
        </p>
      </section>
    </div>
  );

  const pageConfig = {
    privacy: {
      title: 'Privacy Policy',
      badge: 'Data & Privacy',
      icon: Shield,
      toc: [
        { id: '#section-1', label: '1. Information We Collect' },
        { id: '#section-2', label: '2. How We Use Your Data' },
        { id: '#section-3', label: '3. Third-Party Services' },
      ],
      body: renderPrivacyContent(),
    },
    terms: {
      title: 'Terms of Service',
      badge: 'Platform Rules',
      icon: FileText,
      toc: [
        { id: '#section-1', label: '1. Acceptance of Terms' },
        { id: '#section-2', label: '2. No Video Hosting' },
        { id: '#section-3', label: '3. Community Contributions' },
      ],
      body: renderTermsContent(),
    },
    dmca: {
      title: 'DMCA & Rights-Holder Policy',
      badge: 'Copyright & Attribution',
      icon: AlertCircle,
      toc: [
        { id: '#section-1', label: '1. Rights-Holder Notice' },
        { id: '#section-2', label: '2. Takedown Requests' },
        { id: '#section-3', label: '3. Expedited Response' },
      ],
      body: renderDmcaContent(),
    },
  }[type];

  const Icon = pageConfig.icon;

  return (
    <article className="max-w-[700px] mx-auto px-4 sm:px-6 pt-3 sm:pt-4 pb-24 text-[#F4F3FA]">
      {/* Back Button & Last Updated Badge */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <button
          type="button"
          onClick={onBack}
          className="min-h-[44px] px-3.5 rounded-[12px] bg-[#12141E] hover:bg-[#191C29] text-[#F4F3FA] border border-[#292B39] inline-flex items-center gap-2 text-[13px] font-semibold transition-colors duration-180"
        >
          <ArrowLeft className="w-4 h-4 text-[#B49AF8]" />
          <span>Back</span>
        </button>

        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-[#12141E] border border-[#292B39] text-[12px] text-[#A1A5B5]">
          <Calendar className="w-3.5 h-3.5 text-[#B49AF8]" />
          <span>Last updated: <strong className="text-[#F4F3FA]">November 2026</strong></span>
        </span>
      </div>

      {/* Main Editorial Card */}
      <div className="rounded-[18px] bg-[#12141E] border border-[#292B39] p-5 sm:p-8 space-y-6">
        {/* Heading starting cleanly 24px below header */}
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] bg-[#B49AF8]/15 border border-[#B49AF8]/30 text-[#CBB6FF] text-[11px] font-bold uppercase tracking-wider mb-2">
            <Icon className="w-3.5 h-3.5" />
            <span>{pageConfig.badge}</span>
          </div>
          <h1 className="text-[28px] sm:text-[32px] font-bold text-[#F4F3FA] leading-[1.2] tracking-[-0.02em]">
            {pageConfig.title}
          </h1>
        </div>

        {/* Compact Table of Contents Jump Links */}
        <nav
          aria-label="Table of Contents"
          className="rounded-[12px] bg-[#191C29] border border-[#292B39] p-3.5"
        >
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#A1A5B5] mb-2">
            On this page
          </div>
          <div className="flex flex-wrap gap-2">
            {pageConfig.toc.map((item) => (
              <a
                key={item.id}
                href={item.id}
                className="min-h-[40px] px-3 py-1.5 rounded-[8px] bg-[#12141E] hover:bg-[#292B39] text-[#CBB6FF] border border-[#292B39] text-[12px] font-semibold inline-flex items-center transition-colors"
              >
                {item.label}
              </a>
            ))}
          </div>
        </nav>

        {/* Editorial Body */}
        {pageConfig.body}

        {/* Contact / Takedown Action Section */}
        <div className="pt-5 border-t border-[#292B39] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-[15px] font-bold text-[#F4F3FA]">
              Questions or Rights-Holder Inquiries?
            </h3>
            <p className="text-[13px] text-[#A1A5B5]">
              Reach our compliance and catalog verification team directly.
            </p>
          </div>
          <a
            href="mailto:legal@anidub.in?subject=AniDub%20India%20Legal%20Inquiry"
            className="min-h-[44px] px-4 rounded-[12px] bg-[#B49AF8] hover:bg-[#CBB6FF] text-[#0B0A10] font-bold text-[13px] inline-flex items-center justify-center gap-2 shrink-0 transition-colors"
          >
            <Mail className="w-4 h-4" />
            <span>Contact Legal Team</span>
          </a>
        </div>
      </div>
    </article>
  );
};
