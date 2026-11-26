import React from 'react';
import { ArrowLeft, Shield, Scale, ExternalLink, FileWarning, CheckCircle2, Mail } from 'lucide-react';
import { AniDubLogo } from './AniDubLogo';
import { Button } from './ui/Button';

export interface LegalPageProps {
  page: 'privacy' | 'copyright';
  onNavigateHome: () => void;
  onSwitchLegalPage: (next: 'privacy' | 'copyright') => void;
  onOpenFeedback?: () => void;
}

export const LegalPage: React.FC<LegalPageProps> = ({
  page,
  onNavigateHome,
  onSwitchLegalPage,
  onOpenFeedback,
}) => {
  const isPrivacy = page === 'privacy';

  return (
    <div className="w-full max-w-3xl mx-auto px-3 sm:px-6 py-6 sm:py-10 font-sans text-[#F4F3FA] overflow-x-clip">
      {/* Top Breadcrumb & Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <Button
          type="button"
          variant="secondary"
          size="md"
          onClick={onNavigateHome}
          leftIcon={<ArrowLeft className="w-4 h-4" />}
          className="text-xs"
        >
          Back to Directory
        </Button>

        <div className="inline-flex items-center rounded-[12px] bg-[#12141E] border border-[#292B39] p-1">
          <button
            type="button"
            onClick={() => onSwitchLegalPage('privacy')}
            aria-current={isPrivacy ? 'page' : undefined}
            className={`min-h-[40px] px-3.5 py-2 rounded-[10px] text-xs font-semibold transition-colors duration-180 motion-reduce:transition-none cursor-pointer ${
              isPrivacy ? 'bg-[#B49AF8] text-[#0B0A10]' : 'text-[#A1A5B5] hover:text-[#F4F3FA]'
            }`}
          >
            Privacy Policy
          </button>
          <button
            type="button"
            onClick={() => onSwitchLegalPage('copyright')}
            aria-current={!isPrivacy ? 'page' : undefined}
            className={`min-h-[40px] px-3.5 py-2 rounded-[10px] text-xs font-semibold transition-colors duration-180 motion-reduce:transition-none cursor-pointer ${
              !isPrivacy ? 'bg-[#B49AF8] text-[#0B0A10]' : 'text-[#A1A5B5] hover:text-[#F4F3FA]'
            }`}
          >
            Copyright &amp; Takedown
          </button>
        </div>
      </div>

      {/* Main Legal Document Card */}
      <article className="rounded-[12px] bg-[#12141E] border border-[#292B39] p-5 sm:p-8 shadow-2xl space-y-8">
        <header className="space-y-4 border-b border-[#292B39] pb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#191C29] border border-[#292B39] flex items-center justify-center text-[#B49AF8] shrink-0">
              {isPrivacy ? <Shield className="w-5 h-5" /> : <Scale className="w-5 h-5" />}
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#B49AF8]">
                AniDub India Legal Documentation
              </p>
              <h1 className="text-2xl sm:text-3xl font-black text-[#F4F3FA] tracking-tight">
                {isPrivacy ? 'Privacy Policy' : 'Copyright & Takedown Policy'}
              </h1>
            </div>
          </div>

          <div className="rounded-xl bg-[#34D399]/10 border border-[#34D399]/30 p-4 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-[#34D399] shrink-0 mt-0.5" />
            <p className="text-xs sm:text-sm text-[#F4F3FA] leading-relaxed">
              <strong>Legal OTT Discovery Directory Only:</strong> AniDub India is an informational index
              for Indian regional anime dubs (Hindi, Tamil, Telugu, Malayalam, Kannada, and more). We do{' '}
              <strong>not</strong> host, stream, upload, or link to pirated anime episodes or unauthorized
              video files. Every watch button links exclusively to official licensed OTT platforms.
            </p>
          </div>
        </header>

        {isPrivacy ? (
          <div className="space-y-6 text-sm text-[#A1A5B5] leading-relaxed">
            <section className="space-y-2">
              <h2 className="text-base sm:text-lg font-bold text-[#F4F3FA]">1. What Information We Collect</h2>
              <p>
                AniDub India is designed to be usable without an account. We collect only the minimum data
                needed to provide discovery, library tracking, and community features:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-[#A1A5B5]">
                <li>
                  <strong className="text-[#F4F3FA]">Local Browser Storage:</strong> Preferred dub language, recent searches,
                  watchlist/library statuses, OTT subscription selections, and local watch progress are
                  stored in your browser&apos;s <code className="text-[#B49AF8]">localStorage</code> and
                  scoped per signed-in account.
                </li>
                <li>
                  <strong className="text-[#F4F3FA]">Account Information (Optional Sign-In):</strong> If you sign in with Clerk to
                  sync your watchlist, watch progress, reviews, or chat messages, we store your Clerk
                  user ID and display username alongside those records in Cloudflare D1.
                </li>
                <li>
                  <strong className="text-[#F4F3FA]">Community Submissions &amp; Feedback:</strong> When you submit a missing dub,
                  report wrong info, or send feedback, we store your submission details (and optional
                  email if you choose to provide it) for moderator review.
                </li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base sm:text-lg font-bold text-[#F4F3FA]">2. How We Use Your Data</h2>
              <ul className="list-disc pl-5 space-y-1.5 text-[#A1A5B5]">
                <li>Prioritize your preferred Indian dub language and OTT subscription filters.</li>
                <li>Sync your saved library, episode progress, and reviews when you are signed in.</li>
                <li>Review community dub submissions and accuracy reports to keep catalog metadata honest.</li>
                <li>Protect community chat and forms from spam and automated abuse.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base sm:text-lg font-bold text-[#F4F3FA]">3. Third-Party Services &amp; Official OTT Links</h2>
              <p>
                When you click an official streaming link (such as Crunchyroll, Netflix, JioHotstar,
                Prime Video, Anime Times, or Muse India), you leave AniDub India and are subject to that
                platform&apos;s privacy policy. Authentication is handled by Clerk, and application data is
                served via Cloudflare Pages, Workers, and D1. We never sell your personal information to
                data brokers.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base sm:text-lg font-bold text-[#F4F3FA]">4. Your Controls &amp; Account Isolation</h2>
              <p>
                You can export your watchlist as CSV at any time from your Library or Profile page, clear
                your recent searches or browser storage directly, and sign out cleanly (which resets
                shared local session caches so data never leaks between accounts on shared devices).
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base sm:text-lg font-bold text-[#F4F3FA]">5. Contact &amp; Data Removal</h2>
              <p>
                To request deletion of your synced reviews, watchlist records, or feedback submissions,
                reach out through our Feedback form with your account email or username.
              </p>
            </section>
          </div>
        ) : (
          <div className="space-y-6 text-sm text-[#A1A5B5] leading-relaxed">
            <section className="space-y-2">
              <h2 className="text-base sm:text-lg font-bold text-[#F4F3FA]">1. Zero Piracy &amp; Official-Link Policy</h2>
              <p>
                AniDub India operates strictly as a legal Indian anime dub directory and discovery guide.
                We do <strong className="text-[#F4F3FA]">not</strong> host video streams, torrent files, magnet links, embedded
                unofficial players, or third-party piracy mirrors. All catalog entries reference official
                licensors and authorized streaming platforms operating in India (including Crunchyroll,
                Netflix, JioHotstar, Prime Video, Anime Times, Sony LIV, Muse India, and Ani-One India).
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base sm:text-lg font-bold text-[#F4F3FA]">2. Trademarks, Posters &amp; Metadata Attribution</h2>
              <p>
                All anime titles, promotional key visuals, character artwork, studio names, and OTT
                platform trademarks belong to their respective copyright holders, production committees,
                and regional licensors. Poster thumbnails and brief descriptive metadata are displayed
                strictly for informational identification and to direct viewers to legal streaming services.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base sm:text-lg font-bold text-[#F4F3FA]">3. Copyright / DMCA Takedown Procedure</h2>
              <p>
                If you are a copyright owner, authorized regional licensor, or legal representative and
                believe that any poster image, metadata entry, or user-submitted link on AniDub India
                infringes your rights or points to an unauthorized destination, please submit a takedown
                notice containing:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-[#A1A5B5]">
                <li>Your name, organization, and verifiable contact email address.</li>
                <li>The exact AniDub India page URL(s) or anime title(s) in question.</li>
                <li>A brief identification of the copyrighted work or trademark you represent.</li>
                <li>The specific correction or removal action requested (e.g., remove image, update official OTT link, or delist entry).</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base sm:text-lg font-bold text-[#F4F3FA]">4. Fast Response Commitment</h2>
              <p>
                Valid takedown requests and reports of broken or unauthorized links are prioritized in our
                Admin moderation queue and acted upon promptly—typically within 24 to 48 hours of
                verification.
              </p>
            </section>

            <div className="rounded-xl bg-[#F9C876]/10 border border-[#F9C876]/30 p-4 flex items-start gap-3">
              <FileWarning className="w-5 h-5 text-[#F9C876] shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs text-[#F4F3FA]">
                <p className="font-bold">Spotted an inaccurate link or unauthorized URL?</p>
                <p className="text-[#A1A5B5]">
                  You can use the <strong className="text-[#F4F3FA]">Report wrong info</strong> button on any Anime Detail page to
                  flag an OTT link immediately, or submit a formal takedown notice via our Feedback page.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Footer action bar */}
        <footer className="pt-6 border-t border-[#292B39] flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AniDubLogo size="sm" showText={true} />
            <span className="text-xs text-[#A1A5B5]">Legal OTT Discovery Directory</span>
          </div>

          <div className="flex items-center gap-2.5">
            {onOpenFeedback && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={onOpenFeedback}
                leftIcon={<Mail className="w-3.5 h-3.5" />}
                className="text-xs"
              >
                Contact / Takedown Form
              </Button>
            )}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onNavigateHome}
              leftIcon={<ExternalLink className="w-3.5 h-3.5 text-[#B49AF8]" />}
              className="text-xs"
            >
              Browse Official Dubs
            </Button>
          </div>
        </footer>
      </article>
    </div>
  );
};
