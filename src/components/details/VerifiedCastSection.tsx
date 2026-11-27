import React, { useEffect, useState } from 'react';
import { Mic, ShieldCheck } from 'lucide-react';
import { getLanguageScriptBadge } from '../../utils/animeDetailIntelligence';
import type { VerifiedCastEntry } from '../../utils/animeDetailsV2';

export interface VerifiedCastSectionProps {
  entries: VerifiedCastEntry[];
  languages: string[];
  byLanguage: Record<string, VerifiedCastEntry[]>;
}

function getInitials(name: string): string {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

const CastAvatar: React.FC<{
  src: string | null;
  name: string;
  accent?: boolean;
}> = ({ src, name, accent = false }) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={name}
        width={48}
        height={48}
        loading="lazy"
        onError={() => setFailed(true)}
        className="w-12 h-12 rounded-[10px] object-cover border border-[var(--border-subtle)] bg-[var(--bg-surface)] shrink-0"
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className={`w-12 h-12 rounded-[10px] border flex items-center justify-center text-[13px] font-extrabold tracking-wide shrink-0 ${
        accent
          ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)] border-[var(--accent-primary)]/30'
          : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
      }`}
    >
      {getInitials(name)}
    </div>
  );
};

/**
 * Verified Characters & Indian Voice Actors showcase.
 * Strictly renders only verified D1 cast entries (`verified = 1`), filterable by Indian dub language.
 * Returns null completely when no verified cast records exist for the anime.
 */
export const VerifiedCastSection: React.FC<VerifiedCastSectionProps> = ({
  entries,
  languages,
  byLanguage,
}) => {
  const [selectedLang, setSelectedLang] = useState<string>(languages[0] || '');

  useEffect(() => {
    if (languages.length > 0 && !languages.includes(selectedLang)) {
      setSelectedLang(languages[0]);
    }
  }, [languages, selectedLang]);

  if (!Array.isArray(entries) || entries.length === 0 || languages.length === 0) {
    return null;
  }

  const activeLanguage = languages.includes(selectedLang) ? selectedLang : languages[0];
  const activeCast = byLanguage[activeLanguage] || [];

  if (activeCast.length === 0) return null;

  return (
    <section
      data-testid="verified-cast-section"
      className="rounded-[var(--radius-card)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-[9px] bg-[var(--accent-soft)] border border-[var(--accent-primary)]/30 flex items-center justify-center shrink-0">
            <Mic className="w-4 h-4 text-[var(--accent-primary)]" />
          </div>
          <div className="min-w-0">
            <h2 className="text-[16px] font-bold text-[var(--text-primary)] truncate">
              Characters &amp; Indian Voice Actors
            </h2>
            <p className="text-[12px] text-[var(--text-secondary)]">
              Verified regional dub voice credits
            </p>
          </div>
        </div>

        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[8px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[11px] font-semibold text-[var(--text-secondary)] shrink-0">
          <ShieldCheck className="w-3.5 h-3.5 text-[#34D399]" />
          Verified Cast
        </span>
      </div>

      {/* Indian Dub Language Switcher */}
      <div
        role="tablist"
        aria-label="Filter Indian voice cast by dub language"
        className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 mb-4"
      >
        {languages.map((lang) => {
          const isActive = lang === activeLanguage;
          const count = (byLanguage[lang] || []).length;
          return (
            <button
              key={lang}
              type="button"
              role="tab"
              aria-selected={isActive}
              data-testid={`cast-lang-tab-${lang.toLowerCase()}`}
              onClick={() => setSelectedLang(lang)}
              className={`min-h-[44px] px-3 rounded-[10px] border inline-flex items-center gap-2 text-[13px] font-semibold whitespace-nowrap transition-colors shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary)] border-[var(--accent-primary)]'
                  : 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/40'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-[6px] text-[11px] font-bold flex items-center justify-center ${
                  isActive
                    ? 'bg-black/15 text-[var(--accent-on-primary)]'
                    : 'bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                }`}
              >
                {getLanguageScriptBadge(lang)}
              </span>
              <span>{lang}</span>
              <span
                className={`text-[11px] tabular-nums ${
                  isActive ? 'opacity-90' : 'text-[var(--text-muted)]'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Two-Sided Character <-> Voice Actor Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {activeCast.map((item) => (
          <div
            key={item.id}
            data-testid={`cast-card-${item.id}`}
            className="rounded-[12px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-3 flex items-center justify-between gap-3 min-w-0"
          >
            {/* Character Side */}
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <CastAvatar src={item.character_image} name={item.character_name} />
              <div className="min-w-0">
                <div className="text-[13px] font-bold text-[var(--text-primary)] truncate">
                  {item.character_name}
                </div>
                <div className="text-[11px] font-semibold text-[var(--text-secondary)]">
                  {item.role}
                </div>
              </div>
            </div>

            {/* Indian Voice Actor Side */}
            <div className="flex items-center justify-end gap-2.5 min-w-0 flex-1 text-right">
              <div className="min-w-0">
                <div className="text-[13px] font-bold text-[var(--text-primary)] truncate">
                  {item.voice_actor_name}
                </div>
                <div className="text-[11px] text-[var(--accent-primary)] font-semibold truncate">
                  {item.dub_language} Dub
                </div>
              </div>
              <CastAvatar src={item.actor_image} name={item.voice_actor_name} accent />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
