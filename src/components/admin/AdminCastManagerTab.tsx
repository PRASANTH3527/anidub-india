import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Edit3,
  RefreshCw,
  Loader2,
  ShieldCheck,
  X,
} from 'lucide-react';
import { cloudflareApi } from '../../services/cloudflareApi';
import {
  CAST_SUPPORTED_LANGUAGES,
  type AdminCastEntry,
} from '../../utils/adminPhase3Intelligence';

export interface AdminCastManagerTabProps {
  catalog: any[];
  initialAnimeId?: string | number | null;
  onSuccess?: (msg: string) => void;
}

export const AdminCastManagerTab: React.FC<AdminCastManagerTabProps> = ({
  catalog = [],
  initialAnimeId = null,
  onSuccess,
}) => {
  const [selectedAnimeId, setSelectedAnimeId] = useState<string>(() => {
    if (initialAnimeId !== null && initialAnimeId !== undefined) return String(initialAnimeId);
    return catalog.length > 0 && catalog[0]?.id !== undefined ? String(catalog[0].id) : '';
  });
  const [catalogSearch, setCatalogSearch] = useState<string>('');
  const [activeLanguageTab, setActiveLanguageTab] = useState<string>('All');
  const [entries, setEntries] = useState<AdminCastEntry[]>([]);
  const [tableReady, setTableReady] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Add / Edit Form State — IMPORTANT: verified defaults to false (unverified) until explicitly checked!
  const [editingCastId, setEditingCastId] = useState<number | null>(null);
  const [characterName, setCharacterName] = useState<string>('');
  const [role, setRole] = useState<'Main' | 'Supporting'>('Main');
  const [characterImage, setCharacterImage] = useState<string>('');
  const [voiceActorName, setVoiceActorName] = useState<string>('');
  const [actorImage, setActorImage] = useState<string>('');
  const [dubLanguage, setDubLanguage] = useState<string>('Tamil');
  const [isVerified, setIsVerified] = useState<boolean>(false);

  useEffect(() => {
    if (initialAnimeId !== null && initialAnimeId !== undefined) {
      setSelectedAnimeId(String(initialAnimeId));
    } else if (!selectedAnimeId && catalog.length > 0 && catalog[0]?.id !== undefined) {
      setSelectedAnimeId(String(catalog[0].id));
    }
  }, [initialAnimeId, catalog, selectedAnimeId]);

  const loadCastEntries = useCallback(async (animeIdToLoad: string) => {
    if (!animeIdToLoad) {
      setEntries([]);
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await cloudflareApi.fetchAdminCastEntries({ animeId: animeIdToLoad });
      setTableReady(res.tableReady);
      setEntries(res.entries || []);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to load cast & voice actor entries.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCastEntries(selectedAnimeId);
  }, [selectedAnimeId, loadCastEntries]);

  const filteredCatalogOptions = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    return catalog
      .filter((a) => {
        if (!a || a.id === undefined) return false;
        if (!q) return true;
        return (
          String(a.title || '').toLowerCase().includes(q) ||
          String(a.slug || '').toLowerCase().includes(q) ||
          String(a.id) === q
        );
      })
      .slice(0, 60);
  }, [catalog, catalogSearch]);

  const selectedAnimeObj = useMemo(
    () => catalog.find((a) => String(a?.id) === String(selectedAnimeId)) || null,
    [catalog, selectedAnimeId]
  );

  const countsByLanguage = useMemo(() => {
    const counts: Record<string, number> = { All: entries.length };
    for (const lang of CAST_SUPPORTED_LANGUAGES) {
      counts[lang] = 0;
    }
    for (const e of entries) {
      counts[e.dub_language] = (counts[e.dub_language] || 0) + 1;
    }
    return counts;
  }, [entries]);

  const visibleEntries = useMemo(() => {
    if (activeLanguageTab === 'All') return entries;
    return entries.filter(
      (e) => e.dub_language.toLowerCase() === activeLanguageTab.toLowerCase()
    );
  }, [entries, activeLanguageTab]);

  const resetForm = () => {
    setEditingCastId(null);
    setCharacterName('');
    setRole('Main');
    setCharacterImage('');
    setVoiceActorName('');
    setActorImage('');
    setIsVerified(false);
  };

  const handleStartEdit = (entry: AdminCastEntry) => {
    setEditingCastId(entry.id);
    setCharacterName(entry.character_name);
    setRole(entry.role);
    setCharacterImage(entry.character_image || '');
    setVoiceActorName(entry.voice_actor_name);
    setActorImage(entry.actor_image || '');
    setDubLanguage(entry.dub_language);
    setIsVerified(Boolean(entry.verified));
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedAnimeId) {
      setErrorMsg('Please select an anime first.');
      return;
    }
    if (!characterName.trim() || !voiceActorName.trim()) {
      setErrorMsg('Both Character Name and Voice Actor Name are required.');
      return;
    }

    setSaving(true);
    try {
      if (editingCastId !== null) {
        await cloudflareApi.updateAdminCastEntry(editingCastId, {
          anime_id: selectedAnimeId,
          character_name: characterName.trim(),
          role,
          voice_actor_name: voiceActorName.trim(),
          dub_language: dubLanguage,
          character_image: characterImage.trim() || null,
          actor_image: actorImage.trim() || null,
          verified: isVerified,
        });
        onSuccess?.(`Updated ${dubLanguage} voice actor "${voiceActorName.trim()}"!`);
      } else {
        await cloudflareApi.createAdminCastEntry({
          anime_id: selectedAnimeId,
          character_name: characterName.trim(),
          role,
          voice_actor_name: voiceActorName.trim(),
          dub_language: dubLanguage,
          character_image: characterImage.trim() || null,
          actor_image: actorImage.trim() || null,
          verified: isVerified,
        });
        onSuccess?.(`Added ${dubLanguage} voice actor "${voiceActorName.trim()}"!`);
      }
      resetForm();
      await loadCastEntries(selectedAnimeId);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save voice actor entry.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleVerifiedInline = async (entry: AdminCastEntry) => {
    setSaving(true);
    setErrorMsg(null);
    try {
      const nextVerified = !entry.verified;
      await cloudflareApi.updateAdminCastEntry(entry.id, { verified: nextVerified });
      setEntries((prev) =>
        prev.map((item) => (item.id === entry.id ? { ...item, verified: nextVerified } : item))
      );
      onSuccess?.(
        `Marked "${entry.voice_actor_name}" (${entry.dub_language}) as ${
          nextVerified ? 'Verified' : 'Unverified'
        }.`
      );
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to toggle verification status.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEntry = async (entry: AdminCastEntry) => {
    setSaving(true);
    setErrorMsg(null);
    try {
      await cloudflareApi.deleteAdminCastEntry(entry.id);
      setEntries((prev) => prev.filter((item) => item.id !== entry.id));
      onSuccess?.(`Deleted cast entry "${entry.character_name} / ${entry.voice_actor_name}".`);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to delete cast entry.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      data-testid="admin-cast-manager-tab"
      className="space-y-6 text-[var(--text-primary)] pb-12"
    >
      {/* Top Header */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-sm">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold text-[var(--text-primary)] flex items-center gap-2.5">
            <Users className="w-5 h-5 text-[var(--accent-primary)]" />
            <span>Characters &amp; Indian / Japanese Voice Actor Manager</span>
          </h2>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
            Manage verified voice actors (`anime_cast_entries`) across Japanese, Tamil, Hindi, Telugu, Malayalam, Kannada, and Bengali. Entries default to Unverified until explicitly verified.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadCastEntries(selectedAnimeId)}
          disabled={loading}
          className="min-h-[44px] px-4 py-2 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] inline-flex items-center gap-2 self-start lg:self-center cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 text-[var(--accent-primary)] ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Cast</span>
        </button>
      </div>

      {!tableReady && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-500 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Additive Migration Notice:</span> `anime_cast_entries` will initialize automatically on your first save or when `migrations/003_anime_details_v2.sql` is applied.
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs font-bold text-red-500 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Anime Target Selector Bar */}
      <div className="p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
        <div className="md:col-span-5">
          <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5">
            Filter Catalog Anime
          </label>
          <div className="relative">
            <Search className="w-4 h-4 text-[var(--text-secondary)] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={catalogSearch}
              onChange={(e) => setCatalogSearch(e.target.value)}
              placeholder="Search anime title or ID..."
              className="w-full min-h-[44px] pl-10 pr-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs sm:text-sm text-[var(--text-primary)]"
            />
          </div>
        </div>

        <div className="md:col-span-7">
          <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5">
            Selected Anime for Cast &amp; Voice Actors
          </label>
          <select
            value={selectedAnimeId}
            onChange={(e) => {
              setSelectedAnimeId(e.target.value);
              resetForm();
            }}
            className="w-full min-h-[44px] px-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs sm:text-sm font-bold text-[var(--text-primary)]"
          >
            {filteredCatalogOptions.map((a) => (
              <option key={a.id} value={String(a.id)}>
                #{a.id} — {a.title} ({a.year || a.releaseYear || 'N/A'})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Fast Language-Tab Filter Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {(['All', ...CAST_SUPPORTED_LANGUAGES] as const).map((lang) => {
          const isActive = activeLanguageTab === lang;
          const count = countsByLanguage[lang] || 0;
          return (
            <button
              key={lang}
              type="button"
              data-testid={`cast-lang-tab-${lang.toLowerCase()}`}
              onClick={() => {
                setActiveLanguageTab(lang);
                if (lang !== 'All') {
                  setDubLanguage(lang);
                }
              }}
              className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap border transition-all inline-flex items-center gap-2 cursor-pointer ${
                isActive
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary,#fff)] border-[var(--accent-primary)]'
                  : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
              }`}
            >
              <span>{lang}</span>
              <span
                className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold ${
                  isActive ? 'bg-black/20 text-white' : 'bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main 2-Column Layout: Add/Edit Voice Actor Form (Left 5 cols) + Cast Table/Cards (Right 7 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 5 Columns: Add / Edit Character & Voice Actor Form */}
        <form
          onSubmit={handleSubmitForm}
          className="lg:col-span-5 p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-4"
        >
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
            <div>
              <h3 className="text-sm font-extrabold text-[var(--text-primary)]">
                {editingCastId !== null
                  ? `Edit Cast Entry #${editingCastId}`
                  : 'Add Character & Voice Actor'}
              </h3>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                {selectedAnimeObj ? selectedAnimeObj.title : `Anime #${selectedAnimeId}`}
              </p>
            </div>
            {editingCastId !== null && (
              <button
                type="button"
                onClick={resetForm}
                className="min-h-[36px] px-2.5 rounded-lg bg-[var(--bg-elevated)] text-xs font-bold text-[var(--text-secondary)] inline-flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </button>
            )}
          </div>

          <div className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                  Character Name *
                </label>
                <input
                  type="text"
                  value={characterName}
                  onChange={(e) => setCharacterName(e.target.value)}
                  placeholder="e.g., Sung Jinwoo, Tanjiro Kamado"
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs sm:text-sm text-[var(--text-primary)]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                  Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'Main' | 'Supporting')}
                  className="w-full min-h-[44px] px-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs sm:text-sm font-bold text-[var(--text-primary)]"
                >
                  <option value="Main">Main</option>
                  <option value="Supporting">Supporting</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                  Audio Language *
                </label>
                <select
                  value={dubLanguage}
                  onChange={(e) => setDubLanguage(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs sm:text-sm font-bold text-[var(--text-primary)]"
                >
                  {CAST_SUPPORTED_LANGUAGES.map((lang) => (
                    <option key={lang} value={lang}>
                      {lang}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                  Voice Actor Name *
                </label>
                <input
                  type="text"
                  value={voiceActorName}
                  onChange={(e) => setVoiceActorName(e.target.value)}
                  placeholder="Official dub artist name"
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs sm:text-sm text-[var(--text-primary)]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                Character Image URL (Optional HTTPS)
              </label>
              <input
                type="url"
                value={characterImage}
                onChange={(e) => setCharacterImage(e.target.value)}
                placeholder="https://s4.anilist.co/file/anilistcdn/character/large/..."
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                Voice Actor Portrait URL (Optional HTTPS)
              </label>
              <input
                type="url"
                value={actorImage}
                onChange={(e) => setActorImage(e.target.value)}
                placeholder="https://..."
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
              />
            </div>

            {/* Explicit Verified Toggle (Defaults to Unverified unless explicitly checked) */}
            <label
              data-testid="cast-verified-toggle"
              className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                isVerified
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)]'
              }`}
            >
              <input
                type="checkbox"
                checked={isVerified}
                onChange={(e) => setIsVerified(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-emerald-500"
              />
              <div className="text-xs">
                <div className="font-extrabold text-[var(--text-primary)] flex items-center gap-1.5">
                  <ShieldCheck
                    className={`w-4 h-4 ${
                      isVerified ? 'text-emerald-500' : 'text-[var(--text-secondary)]'
                    }`}
                  />
                  <span>
                    {isVerified ? 'Verified Credit (Published Live)' : 'Unverified Draft (Hidden on Public Page)'}
                  </span>
                </div>
                <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                  Only voice actors explicitly marked Verified appear on the public Anime Details 2.0 page.
                </p>
              </div>
            </label>
          </div>

          <button
            type="submit"
            disabled={saving || !selectedAnimeId}
            className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[var(--accent-primary)] text-[var(--accent-on-primary,#fff)] text-xs font-extrabold inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-sm"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            <span>
              {editingCastId !== null ? 'Update Cast Entry' : `Save ${dubLanguage} Voice Actor`}
            </span>
          </button>
        </form>

        {/* Right 7 Columns: Cast Entries List for Selected Language Tab */}
        <div className="lg:col-span-7 p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
            <div>
              <h3 className="text-sm font-extrabold text-[var(--text-primary)]">
                {activeLanguageTab === 'All'
                  ? `All Cast & Voice Actor Credits (${visibleEntries.length})`
                  : `${activeLanguageTab} Voice Actor Credits (${visibleEntries.length})`}
              </h3>
              <p className="text-xs text-[var(--text-secondary)]">
                Toggle Verified status with 1 click or edit character/actor details.
              </p>
            </div>
          </div>

          {visibleEntries.length === 0 ? (
            <div className="p-8 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-center space-y-2">
              <Users className="w-8 h-8 text-[var(--text-secondary)] mx-auto opacity-60" />
              <div className="text-sm font-bold text-[var(--text-primary)]">
                No Voice Actors Recorded Yet
              </div>
              <p className="text-xs text-[var(--text-secondary)] max-w-md mx-auto">
                Add verified Japanese or Indian regional voice actors on the left. Unverified or empty cast sections remain cleanly hidden on public pages.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleEntries.map((entry) => (
                <div
                  key={entry.id}
                  data-testid={`cast-entry-row-${entry.id}`}
                  className="p-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {entry.character_image ? (
                      <img
                        src={entry.character_image}
                        alt={entry.character_name}
                        className="w-11 h-11 rounded-xl object-cover shrink-0 border border-[var(--border-subtle)]"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-xs font-extrabold text-[var(--accent-primary)] shrink-0">
                        {entry.character_name.slice(0, 2).toUpperCase()}
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-extrabold text-[var(--text-primary)] truncate">
                          {entry.character_name}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">
                          {entry.role}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-[var(--accent-soft)] text-[var(--accent-primary)]">
                          {entry.dub_language}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-[var(--text-secondary)] mt-0.5 truncate">
                        Voice Actor: <span className="text-[var(--text-primary)]">{entry.voice_actor_name}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleVerifiedInline(entry)}
                      disabled={saving}
                      className={`min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-extrabold border inline-flex items-center gap-1.5 cursor-pointer transition-all ${
                        entry.verified
                          ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-500 border-amber-500/30'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{entry.verified ? 'Verified' : 'Unverified'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleStartEdit(entry)}
                      aria-label={`Edit ${entry.character_name}`}
                      className="min-w-[44px] min-h-[44px] rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[var(--text-primary)] flex items-center justify-center cursor-pointer"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteEntry(entry)}
                      disabled={saving}
                      aria-label={`Delete ${entry.character_name}`}
                      className="min-w-[44px] min-h-[44px] rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-500 flex items-center justify-center cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
