import React from 'react';
import { ArrowLeft, Shield, Scale, ExternalLink, FileWarning, CheckCircle2, Mail } from 'lucide-react';
import { AniDubLogo } from './AniDubLogo';

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
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10 font-sans text-neutral-100">
      {/* Top Breadcrumb & Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <button
          type="button"
          onClick={onNavigateHome}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-neutral-200 hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Directory</span>
        </button>

        <div className="inline-flex items-center rounded-xl bg-[#111624] border border-white/10 p-1">
          <button
            type="button"
            onClick={() => onSwitchLegalPage('privacy')}
            aria-current={isPrivacy ? 'page' : undefined}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              isPrivacy ? 'bg-purple-600 text-white' : 'text-neutral-400 hover:text-white'
            }`}
          >
            Privacy Policy
          </button>
          <button
            type="button"
            onClick={() => onSwitchLegalPage('copyright')}
            aria-current={!isPrivacy ? 'page' : undefined}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              !isPrivacy ? 'bg-purple-600 text-white' : 'text-neutral-400 hover:text-white'
            }`}
          >
            Copyright &amp; Takedown
          </button>
        </div>
      </div>

      {/* Main Legal Document Card */}
      <article className="rounded-3xl bg-[#111624]/95 border border-white/10 p-6 sm:p-10 shadow-2xl space-y-8">
        <header className="space-y-4 border-b border-white/10 pb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-300 shrink-0">
              {isPrivacy ? <Shield className="w-5 h-5" /> : <Scale className="w-5 h-5" />}
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-purple-300">
                AniDub India Legal Documentation
              </p>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {isPrivacy ? 'Privacy Policy' : 'Copyright & Takedown Policy'}
              </h1>
            </div>
          </div>

          <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/25 p-4 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed">
              <strong>Legal OTT Discovery Directory Only:</strong> AniDub India is an informational index
              for Indian regional anime dubs (Hindi, Tamil, Telugu, Malayalam, Kannada, and more). We do{' '}
              <strong>not</strong> host, stream, upload, or link to pirated anime episodes or unauthorized
              video files. Every watch button links exclusively to official licensed OTT platforms.
            </p>
          </div>
        </header>

        {isPrivacy ? (
          <div className="space-y-6 text-sm text-neutral-300 leading-relaxed">
            <section className="space-y-2">
              <h2 className="text-base sm:text-lg font-bold text-white">1. What Information We Collect</h2>
              <p>
                AniDub India is designed to be usable without an account. We collect only the minimum data
                needed to provide discovery, library tracking, and community features:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-neutral-300">
                <li>
                  <strong>Local Browser Storage:</strong> Preferred dub language, recent searches,
                  watchlist/library statuses, OTT subscription selections, and local watch progress are
                  stored in your browser&apos;s <code className="text-purple-300">localStorage</code> and
                  scoped per signed-in account.
                </li>
                <li>
                  <strong>Account Information (Optional Sign-In):</strong> If you sign in with Clerk to
                  sync your watchlist, watch progress, reviews, or chat messages, we store your Clerk
                  user ID and display username alongside those records in Cloudflare D1.
                </li>
                <li>
                  <strong>Community Submissions &amp; Feedback:</strong> When you submit a missing dub,
                  report wrong info, or send feedback, we store your submission details (and optional
                  email if you choose to provide it) for moderator review.
                </li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base sm:text-lg font-bold text-white">2. How We Use Your Data</h2>
              <ul className="list-disc pl-5 space-y-1.5 text-neutral-300">
                <li>Prioritize your preferred Indian dub language and OTT subscription filters.</li>
                <li>Sync your saved library, episode progress, and reviews when you are signed in.</li>
                <li>Review community dub submissions and accuracy reports to keep catalog metadata honest.</li>
                <li>Protect community chat and forms from spam and automated abuse.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base sm:text-lg font-bold text-white">3. Third-Party Services &amp; Official OTT Links</h2>
              <p>
                When you click an official streaming link (such as Crunchyroll, Netflix, JioHotstar,
                Prime Video, Anime Times, or Muse India), you leave AniDub India and are subject to that
                platform&apos;s privacy policy. Authentication is handled by Clerk, and application data is
                served via Cloudflare Pages, Workers, and D1. We never sell your personal information to
                data brokers.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base sm:text-lg font-bold text-white">4. Your Controls &amp; Account Isolation</h2>
              <p>
                You can export your watchlist as CSV at any time from your Library or Profile page, clear
                your recent searches or browser storage directly, and sign out cleanly (which resets
                shared local session caches so data never leaks between accounts on shared devices).
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base sm:text-lg font-bold text-white">5. Contact &amp; Data Removal</h2>
              <p>
                To request deletion of your synced reviews, watchlist records, or feedback submissions,
                reach out through our Feedback form with your account email or username.
              </p>
            </section>
          </div>
        ) : (
          <div className="space-y-6 text-sm text-neutral-300 leading-relaxed">
            <section className="space-y-2">
              <h2 className="text-base sm:text-lg font-bold text-white">1. Zero Piracy &amp; Official-Link Policy</h2>
              <p>
                AniDub India operates strictly as a legal Indian anime dub directory and discovery guide.
                We do <strong>not</strong> host video streams, torrent files, magnet links, embedded
                unofficial players, or third-party piracy mirrors. All catalog entries reference official
                licensors and authorized streaming platforms operating in India (including Crunchyroll,
                Netflix, JioHotstar, Prime Video, Anime Times, Sony LIV, Muse India, and Ani-One India).
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base sm:text-lg font-bold text-white">2. Trademarks, Posters &amp; Metadata Attribution</h2>
              <p>
                All anime titles, promotional key visuals, character artwork, studio names, and OTT
                platform trademarks belong to their respective copyright holders, production committees,
                and regional licensors. Poster thumbnails and brief descriptive metadata are displayed
                strictly for informational identification and to direct viewers to legal streaming services.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base sm:text-lg font-bold text-white">3. Copyright / DMCA Takedown Procedure</h2>
              <p>
                If you are a copyright owner, authorized regional licensor, or legal representative and
                believe that any poster image, metadata entry, or user-submitted link on AniDub India
                infringes your rights or points to an unauthorized destination, please submit a takedown
                notice containing:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-neutral-300">
                <li>Your name, organization, and verifiable contact email address.</li>
                <li>The exact AniDub India page URL(s) or anime title(s) in question.</li>
                <li>A brief identification of the copyrighted work or trademark you represent.</li>
                <li>The specific correction or removal action requested (e.g., remove image, update official OTT link, or delist entry).</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base sm:text-lg font-bold text-white">4. Fast Response Commitment</h2>
              <p>
                Valid takedown requests and reports of broken or unauthorized links are prioritized in our
                Admin moderation queue and acted upon promptly—typically within 24 to 48 hours of
                verification.
              </p>
            </section>

            <div className="rounded-2xl bg-amber-500/10 border border-amber-500/25 p-4 flex items-start gap-3">
              <FileWarning className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs text-amber-100/90">
                <p className="font-bold">Spotted an inaccurate link or unauthorized URL?</p>
                <p>
                  You can use the <strong>Report wrong info</strong> button on any Anime Detail page to
                  flag an OTT link immediately, or submit a formal takedown notice via our Feedback page.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Footer action bar */}
        <footer className="pt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AniDubLogo size="sm" showText={true} />
            <span className="text-xs text-neutral-500">Legal OTT Discovery Directory</span>
          </div>

          <div className="flex items-center gap-2.5">
            {onOpenFeedback && (
              <button
                type="button"
                onClick={onOpenFeedback}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Contact / Takedown Form</span>
              </button>
            )}
            <button
              type="button"
              onClick={onNavigateHome}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-200 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Browse Official Dubs</span>
            </button>
          </div>
        </footer>
      </article>
    </div>
  );
};
