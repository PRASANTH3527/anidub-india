import React, { useEffect, useState } from 'react';
import { Radio, Plus, Trash2, Edit3, ExternalLink, Loader2, CheckCircle2, X } from 'lucide-react';
import { cloudflareApi } from '../../services/cloudflareApi';
import {
  DUB_RADAR_LANGUAGES,
  DUB_RADAR_STAGES,
  DUB_RADAR_STAGE_META,
  normalizeDubRadarRow,
  type DubRadarEntry,
  type DubRadarStage,
} from '../../utils/dubRadar';
import type { AdminAnimeRecord } from './types';

interface AdminDubRadarTabProps {
  catalog: AdminAnimeRecord[];
  onLog?: (level: string, msg: string) => void;
}

export const AdminDubRadarTab: React.FC<AdminDubRadarTabProps> = ({ catalog, onLog }) => {
  const [entries, setEntries] = useState<DubRadarEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form fields
  const [animeTitle, setAnimeTitle] = useState('');
  const [linkedAnimeId, setLinkedAnimeId] = useState<string>('');
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(['Hindi', 'Tamil']);
  const [platform, setPlatform] = useState('');
  const [stage, setStage] = useState<DubRadarStage>('Official Announcement');
  const [releaseDate, setReleaseDate] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [coverImage, setCoverImage] = useState('');

  const loadEntries = async () => {
    setLoading(true);
    try {
      const rows = await cloudflareApi.fetchDubRadar();
      setEntries(rows.map((r) => normalizeDubRadarRow(r)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadEntries();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setAnimeTitle('');
    setLinkedAnimeId('');
    setSelectedLanguages(['Hindi', 'Tamil']);
    setPlatform('');
    setStage('Official Announcement');
    setReleaseDate('');
    setSourceUrl('');
    setNotes('');
    setCoverImage('');
  };

  const toggleLanguage = (lang: string) => {
    setSelectedLanguages((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]
    );
  };

  const handleLinkCatalogAnime = (animeIdStr: string) => {
    setLinkedAnimeId(animeIdStr);
    const matched = catalog.find((a) => String(a.id) === animeIdStr);
    if (!matched) return;
    setAnimeTitle(matched.title || '');
    if (matched.platform) setPlatform(matched.platform);
    const img = matched.cover_image || matched.posterUrl || matched.image || '';
    if (img) setCoverImage(img);
    if (matched.official_source_url) setSourceUrl(matched.official_source_url);
  };

  const handleEdit = (entry: DubRadarEntry) => {
    setEditingId(entry.id);
    setAnimeTitle(entry.anime_title);
    setLinkedAnimeId(entry.anime_id ? String(entry.anime_id) : '');
    setSelectedLanguages(entry.languages.length > 0 ? entry.languages : ['Hindi']);
    setPlatform(entry.platform || '');
    setStage(entry.stage);
    setReleaseDate(entry.release_date || '');
    setSourceUrl(entry.source_url || '');
    setNotes(entry.notes || '');
    setCoverImage(entry.cover_image || '');
    setFeedback(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (animeTitle.trim().length < 2) {
      setFeedback({ type: 'error', text: 'Anime title is required.' });
      return;
    }
    if (selectedLanguages.length === 0) {
      setFeedback({ type: 'error', text: 'Select at least one Indian dub language.' });
      return;
    }

    const linkedRecord = catalog.find((a) => String(a.id) === linkedAnimeId);
    const payload = {
      anime_title: animeTitle.trim(),
      anime_id: linkedAnimeId ? Number(linkedAnimeId) : null,
      slug: linkedRecord?.slug || null,
      languages: selectedLanguages,
      platform: platform.trim(),
      stage,
      release_date: releaseDate.trim(),
      source_url: sourceUrl.trim(),
      notes: notes.trim(),
      cover_image: coverImage.trim(),
    };

    setSaving(true);
    try {
      const res = editingId
        ? await cloudflareApi.updateDubRadarEntry(editingId, payload)
        : await cloudflareApi.createDubRadarEntry(payload);

      if (res.success) {
        setFeedback({
          type: 'success',
          text: editingId ? 'Dub Radar entry updated.' : 'Dub Radar entry published to D1.',
        });
        onLog?.('OK', `${editingId ? 'Updated' : 'Added'} Dub Radar entry: ${payload.anime_title} (${payload.stage})`);
        resetForm();
        await loadEntries();
      } else {
        setFeedback({ type: 'error', text: res.error || 'Failed to save radar entry.' });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (entry: DubRadarEntry) => {
    setFeedback(null);
    const res = await cloudflareApi.deleteDubRadarEntry(entry.id);
    if (res.success) {
      setEntries((prev) => prev.filter((item) => item.id !== entry.id));
      onLog?.('OK', `Deleted Dub Radar entry: ${entry.anime_title}`);
      setFeedback({ type: 'success', text: `Removed "${entry.anime_title}" from Dub Radar.` });
    } else {
      setFeedback({ type: 'error', text: res.error || 'Failed to delete entry.' });
    }
  };

  return (
    <div className="space-y-6">
      {/* FORM CARD */}
      <section className="rounded-3xl bg-white/[0.03] border border-white/10 p-5 sm:p-6 space-y-5">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-500/35 flex items-center justify-center text-purple-300">
              <Radio className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-white">
                {editingId ? 'Edit Dub Release Radar Entry' : 'Add Dub Release Radar Entry'}
              </h2>
              <p className="text-[11px] text-neutral-400">
                Track verified Indian dub milestones (leave Release Date empty to show TBA).
              </p>
            </div>
          </div>

          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-neutral-200 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Cancel Edit</span>
            </button>
          )}
        </div>

        {feedback && (
          <div
            className={`rounded-xl px-4 py-2.5 border text-xs font-semibold flex items-center gap-2 ${
              feedback.type === 'success'
                ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-200'
                : 'bg-rose-500/15 border-rose-500/35 text-rose-200'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{feedback.text}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-neutral-300 block">
                Link Existing Catalog Anime (Optional)
              </label>
              <select
                value={linkedAnimeId}
                onChange={(e) => handleLinkCatalogAnime(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-black/50 border border-white/10 text-xs text-white focus:outline-none focus:border-purple-400"
              >
                <option value="">-- Standalone / Upcoming Title --</option>
                {catalog.slice(0, 250).map((a) => (
                  <option key={String(a.id)} value={String(a.id)}>
                    {a.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-neutral-300 block">Anime Title *</label>
              <input
                type="text"
                required
                value={animeTitle}
                onChange={(e) => setAnimeTitle(e.target.value)}
                placeholder="e.g. Solo Leveling Season 2"
                className="w-full px-3 py-2.5 rounded-xl bg-black/50 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-purple-400"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-neutral-300 block">Lifecycle Stage *</label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value as DubRadarStage)}
                className="w-full px-3 py-2.5 rounded-xl bg-black/50 border border-white/10 text-xs text-white focus:outline-none focus:border-purple-400"
              >
                {DUB_RADAR_STAGES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-neutral-300 block">OTT Platform</label>
              <input
                type="text"
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                placeholder="Crunchyroll, Netflix, JioHotstar, Muse India..."
                className="w-full px-3 py-2.5 rounded-xl bg-black/50 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-purple-400"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-neutral-300 block">
                Release Date (Leave blank for TBA)
              </label>
              <input
                type="text"
                value={releaseDate}
                onChange={(e) => setReleaseDate(e.target.value)}
                placeholder="e.g. July 2026 or 12 Aug 2026"
                className="w-full px-3 py-2.5 rounded-xl bg-black/50 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-purple-400"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-neutral-300 block">
                Verified Source URL (Optional)
              </label>
              <input
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://www.crunchyroll.com/news/..."
                className="w-full px-3 py-2.5 rounded-xl bg-black/50 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-purple-400"
              />
            </div>
          </div>

          {/* Language checkboxes */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-neutral-300 block">Indian Dub Languages *</span>
            <div className="flex flex-wrap gap-2">
              {DUB_RADAR_LANGUAGES.map((lang) => {
                const active = selectedLanguages.includes(lang);
                return (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => toggleLanguage(lang)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                      active
                        ? 'bg-purple-600 text-white border-purple-400'
                        : 'bg-black/40 text-neutral-400 border-white/10 hover:text-white'
                    }`}
                  >
                    {lang}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-neutral-300 block">Update Notes (Optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Episodes 1–6 Hindi & Tamil dubbed; weekly Sunday drops."
              className="w-full px-3 py-2.5 rounded-xl bg-black/50 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-purple-400"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-black inline-flex items-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              <span>{editingId ? 'Update Radar Entry' : 'Publish to Dub Radar'}</span>
            </button>
          </div>
        </form>
      </section>

      {/* EXISTING ENTRIES LIST */}
      <section className="rounded-3xl bg-white/[0.03] border border-white/10 p-5 sm:p-6 space-y-4">
        <h3 className="text-sm font-black text-white">
          Tracked Dub Radar Entries ({entries.length})
        </h3>

        {loading ? (
          <div className="py-8 flex items-center justify-center gap-2 text-xs text-neutral-400">
            <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
            <span>Loading radar entries...</span>
          </div>
        ) : entries.length === 0 ? (
          <p className="text-xs text-neutral-500 py-4">
            No custom Dub Radar entries saved in D1 yet. Use the form above to add one.
          </p>
        ) : (
          <div className="space-y-2.5">
            {entries.map((entry) => {
              const meta = DUB_RADAR_STAGE_META[entry.stage];
              return (
                <div
                  key={String(entry.id)}
                  className="rounded-2xl bg-black/40 border border-white/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-white truncate">
                        {entry.anime_title}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${meta.badgeClass}`}
                      >
                        {entry.stage}
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-400">
                      {entry.languages.join(', ')} • {entry.platform || 'Platform TBA'} •{' '}
                      {entry.release_date || 'TBA'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {entry.source_url && (
                      <a
                        href={entry.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20"
                        title="Open source link"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => handleEdit(entry)}
                      className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 hover:text-white cursor-pointer"
                      title="Edit entry"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(entry)}
                      className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 cursor-pointer"
                      title="Delete entry"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
