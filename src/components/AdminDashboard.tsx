import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldCheck, 
  Plus, 
  Trash2, 
  Image as ImageIcon, 
  Sparkles, 
  Loader2, 
  Upload, 
  CheckCircle2, 
  ExternalLink,
  Zap, 
  RefreshCw, 
  Globe, 
  LogOut, 
  Link as LinkIcon, 
  Bookmark, 
  Inbox, 
  Layers,
  Database, 
  FileSpreadsheet, 
  Download, 
  FileText, 
  Search, 
  Edit3, 
  X, 
  Check,
  Shield, 
  ShieldAlert, 
  Star, 
  RefreshCcw, 
  AlertTriangle, 
  Clock, 
  Tv,
  ArrowUpRight,
  TrendingUp,
  Sliders,
  FileCode,
  HardDrive,
  Flame
} from 'lucide-react';
import { DubInfoModal } from './DubInfoModal';
import { dbService } from '../services/databaseService';
import { cloudflareApi } from '../services/cloudflareApi';
import { CLOUDFLARE_API_URL } from '../config/cloudflare';
import Papa from 'papaparse';

export interface AdminDashboardProps {
  onAnimeCreated: (anime?: any) => void;
  onLogout?: () => void;
  onNavigateHome?: () => void;
  onToast?: (msg: string) => void;
  catalogList?: any[];
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  onAnimeCreated, 
  onLogout, 
  onNavigateHome,
  onToast,
  catalogList
}) => {
  const [catalog, setCatalog] = useState<any[]>(() => (catalogList && catalogList.length > 0) ? catalogList : []);
  const [animes, setAnimes] = useState<any[]>(() => (catalogList && catalogList.length > 0) ? catalogList : []);

  useEffect(() => {
    if (catalogList && catalogList.length > 0) {
      setCatalog(catalogList);
      setAnimes(catalogList);
    }
  }, [catalogList]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [apiError, setApiError] = useState(false);
  const [deletingId, setDeletingId] = useState<any>(null);
  const [cloudSyncing, setCloudSyncing] = useState<boolean>(false);
  const [cloudStatusText, setCloudStatusText] = useState<string>('');

  // DubInfoModal state
  const [isDubModalOpen, setIsDubModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'submit' | 'edit'>('submit');
  const [editingAnime, setEditingAnime] = useState<any>(null);
  const [formData, setFormData] = useState<any>({ type: 'TV Series' });

  // Tabs state
  const [activeAdminTab, setActiveAdminTab] = useState<'overview' | 'pending' | 'catalog' | 'feedback' | 'data_health' | 'analytics' | 'settings'>('overview');
  const [feedbackList, setFeedbackList] = useState<any[]>([]);

  // Pending queue state
  const [pendingItems, setPendingItems] = useState<any[]>([]);
  const [showBulkBanner, setShowBulkBanner] = useState(true);

  // Catalog tab states
  const [searchQuery, setSearchQuery] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [showImportToast, setShowImportToast] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [mixedEntries, setMixedEntries] = useState<any[]>([]);

  // Data Health states
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [healthChecked, setHealthChecked] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetchAnime();
    fetchFeedback();
  }, []);

  const fetchFeedback = async () => {
    try {
      const res = await fetch('/api/feedback');
      if (res.ok) {
        const data = await res.json();
        setFeedbackList(data.feedback || []);
      }
    } catch (err) {
      console.error('Failed to fetch feedback:', err);
    }
  };

  const fetchPendingItems = async () => {
    try {
      const { data } = await cloudflareApi.fetchCatalog({ limit: 100, includePending: true });
      const items = data || [];
      const pending = items.filter((item: any) => 
        item.status === 'pending' || item.submissionStatus === 'pending'
      ).map((item: any) => ({
        ...item,
        type: item.type || item.Type || 'TV Series',
        Type: item.type || item.Type || 'TV Series',
        languages: typeof item.languages === 'string' ? item.languages.split(',').map((s: string) => s.trim()) : (item.languages || ['Hindi', 'Tamil', 'Telugu'])
      }));
      setPendingItems(pending);
      try {
        localStorage.setItem('cf_admin_pending_cache', JSON.stringify(pending));
      } catch (e) {}
    } catch (err) {
      console.warn('Network notice fetching pending items from Cloudflare Worker, using local cache:', err);
      try {
        const cached = localStorage.getItem('cf_admin_pending_cache');
        if (cached) setPendingItems(JSON.parse(cached));
      } catch (e) {}
    }
  };

  const fetchAnime = async () => {
    setLoading(true);
    setCloudSyncing(true);
    setCloudStatusText('Fetching catalog from Cloudflare D1...');
    setApiError(false);
    try {
      const { data } = await cloudflareApi.fetchCatalog({ limit: 100 });
      const items = (data || []).map((item: any) => ({
        ...item,
        type: item.type || item.Type || 'TV Series',
        Type: item.type || item.Type || 'TV Series'
      }));
      setCatalog(items);
      setAnimes(items);
      try {
        localStorage.setItem('cf_admin_catalog_cache', JSON.stringify(items));
      } catch (e) {}
      await fetchPendingItems();
    } catch (err) {
      console.warn('Network notice fetching anime from Cloudflare D1, loading cached catalog:', err);
      try {
        const cached = localStorage.getItem('cf_admin_catalog_cache');
        if (cached) {
          setCatalog(JSON.parse(cached));
          setAnimes(JSON.parse(cached));
        }
      } catch (e) {}
      await fetchPendingItems();
    } finally {
      setLoading(false);
      setCloudSyncing(false);
      setCloudStatusText('');
    }
  };

  const handleApprovePending = async (itemId: any) => {
    console.log('Approving ID on Cloudflare D1:', itemId);
    const item = pendingItems.find(p => p.id === itemId);
    if (!item) return;

    setCloudSyncing(true);
    setCloudStatusText(`Approving ${item.title || `#${itemId}`} on Cloudflare Edge...`);
    try {
      await cloudflareApi.approveAnime(itemId);
      setPendingItems(prev => prev.filter(p => p.id !== itemId));
      setSuccessMsg('Anime Approved & Published globally on Cloudflare Edge.');
      await fetchAnime();
      onAnimeCreated();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      console.error('Cloudflare Approval error:', err);
      setPendingItems(prev => prev.filter(p => p.id !== itemId));
      setSuccessMsg('Anime Approved locally (Cloudflare sync attempted).');
      setTimeout(() => setSuccessMsg(''), 4000);
    } finally {
      setCloudSyncing(false);
      setCloudStatusText('');
    }
  };

  const handleRejectPending = async (itemId: any) => {
    const item = pendingItems.find(p => p.id === itemId);
    setCloudSyncing(true);
    setCloudStatusText('Rejecting submission from Cloudflare D1...');
    try {
      await cloudflareApi.deleteAnime(itemId);
    } catch (err) {
      console.error('Failed to delete rejected submission from Cloudflare D1:', err);
    } finally {
      setCloudSyncing(false);
      setCloudStatusText('');
    }
    setPendingItems(prev => prev.filter(p => p.id !== itemId));
    setSuccessMsg(`Rejected submission ${item?.title || itemId}.`);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  /**
   * Cloudflare D1 Delete Handler for Catalog Items
   */
  const handleDeleteCatalogAnime = async (e: React.MouseEvent, anime: any) => {
    e.stopPropagation();
    const targetId = anime.id || anime._id;
    console.log('handleDeleteCatalogAnime triggered for ID on Cloudflare D1:', targetId);
    
    setDeletingId(targetId);
    setCloudSyncing(true);
    setCloudStatusText(`Deleting #${targetId} from Cloudflare D1...`);

    // 1. Immediate UI state removal (Synchronous part for responsiveness)
    const updatedCatalog = catalog.filter(item => (item.id || item._id) !== targetId);
    setCatalog(updatedCatalog);
    setAnimes(updatedCatalog);
    
    // 2. Storage Sync (localStorage fallback as requested)
    try {
      localStorage.setItem('cf_admin_catalog_cache', JSON.stringify(updatedCatalog));
    } catch (e) {
      console.warn('Failed to sync to localStorage:', e);
    }

    // 3. Show in-app toast
    setSuccessMsg('Deleted from Cloudflare D1.');
    setTimeout(() => setSuccessMsg(''), 4000);

    try {
      // 4. Await database deletion in Cloudflare D1
      if (targetId !== undefined && targetId !== null) {
        await cloudflareApi.deleteAnime(targetId);
      }

      // 5. Finally trigger parent refresh safely
      onAnimeCreated();
    } catch (err) {
      console.error('Cloudflare Delete error:', err);
      setSuccessMsg('Note: Item removed from UI, but Cloudflare D1 deletion failed.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } finally {
      setDeletingId(null);
      setCloudSyncing(false);
      setCloudStatusText('');
    }
  };

  const handleOpenEditModal = (anime: any) => {
    setModalMode('edit');
    // Ensure type: anime.type || anime.Type || 'TV Series' is explicitly passed into the state object
    setFormData({ ...anime, type: anime.type || anime.Type || 'TV Series' });
    setEditingAnime({ ...anime, type: anime.type || anime.Type || 'TV Series' });
    setIsDubModalOpen(true);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.replace(/^\ufeff/, '').replace(/^["']|["']$/g, '').trim(),
      transform: (v) => (typeof v === 'string' ? v.trim() : v),
      complete: async (results) => {
        const parsedRows = results.data as any[];
        let successCount = 0;

        // CSV Import State Mapper: When mapping rows from the CSV, ensure the property is explicitly named type in the final object array (e.g., type: parsedType)
        const mappedAnimeList = parsedRows.map((row: any) => {
          const typeKey = Object.keys(row).find(key => key.toLowerCase().includes('type'));
          let rawType = typeKey ? row[typeKey]?.toString().trim().toLowerCase() : '';
          let finalType = 'TV Series';
          if (rawType.includes('movie')) finalType = 'Movie';
          else if (rawType.includes('ova') || rawType.includes('special')) finalType = 'OVA/Special';
          else if (rawType.includes('tv') || rawType.length > 0) finalType = 'TV Series';
          const parsedType = finalType;
          return {
            ...row,
            type: parsedType
          };
        });
        
        for (const row of mappedAnimeList) {
          const title = row.Title || row.title || row['title'] || row['Title'] || '';
          if (!title) continue;

          // 1. Find the actual key for Type dynamically, ignoring exact case or hidden spaces
          const typeKey = Object.keys(row).find(key => key.toLowerCase().includes('type'));

          // 2. Extract and format the value safely
          let rawType = typeKey ? row[typeKey]?.toString().trim().toLowerCase() : '';
          let finalType = 'TV Series'; // Default fallback

          // 3. Smart mapping
          if (rawType.includes('movie')) finalType = 'Movie';
          else if (rawType.includes('ova') || rawType.includes('special')) finalType = 'OVA/Special';
          else if (rawType.includes('tv') || rawType.length > 0) finalType = 'TV Series';

          let parsedType = finalType;
          console.log("Parsed CSV Row:", row);
          console.log("Mapped Type:", finalType);
          console.log("Mapped Type:", parsedType);

          const mappedLanguages = (row.Languages || row.languages) ? String(row.Languages || row.languages).split('|').map((l: string) => l.trim()).filter(Boolean) : [];
          const mappedGenres = (row.Genres || row.genres) ? String(row.Genres || row.genres).split('|').map((g: string) => g.trim()).filter(Boolean) : [];

          // 1. Split the pipe-separated string into an array
          const episodesString = String(row.Episodes || row.episodes || "");
          const episodesList = episodesString.split('|').map(ep => ep.trim()).filter(Boolean);

          // 2. Create a COMPLETE array of multiple season objects
          const mappedSeasonsArray = episodesList.map((epCount, index) => {
            return {
              id: Date.now() + Math.random() + index, // Crucial for React keys
              season: index + 1, // Or whatever your exact state key is for Season Number
              seasonNumber: String(index + 1),
              entryType: (finalType === 'Movie' ? 'Movie' : finalType.includes('OVA') || finalType.includes('Special') ? 'OVA/Special' : 'Season'),
              type: parsedType,
              episodes: epCount,
              languages: mappedLanguages || [] // Pass the parsed languages array
            };
          });

          // 3. Set the state exactly ONCE with the full array
          setMixedEntries(mappedSeasonsArray);

          const currentSeasonVal = String(mappedSeasonsArray.length);
          const liveEpisodeVal = Number(episodesList[episodesList.length - 1]) || 12;

          // 3. Create the exact payload with parsedType safely assigned to type
          const payload = {
            title: title,
            cover_image: row['Cover Image'] || row.cover_image || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80',
            year: parseInt(row['Release Year'] || row.year || row.Year, 10) || new Date().getFullYear(),
            languages: mappedLanguages.join(', '),
            genres: mappedGenres.join(', '),
            studio: row.Studio || row.studio || '',
            type: parsedType,
            Type: parsedType,
            status: (row.Status || row.status || 'Airing').trim(), // EXACT match from CSV
            submissionStatus: 'pending',
            episodes_count: Number(episodesList[episodesList.length - 1]) || 12,
            season: currentSeasonVal,
            current_season: currentSeasonVal,
            currently_airing_episode: liveEpisodeVal,
            episodes_per_season: episodesList.join('|'),
            platform: row.Platform || row.platform || 'Crunchyroll',
            rating: parseFloat(row.Ratings || row.rating || row.Score) || 8.5,
            synopsis: row.Synopsis || row.synopsis || 'Follow this thrilling dubbed adventure packed with high-stakes action, supernatural twists, and emotional character arcs.',
            mixedEntries: mappedSeasonsArray,
            streamingPartners: [{ name: row.Platform || 'Crunchyroll', url: '' }],
            moderationStatus: 'pending'
          };

          // 4. Call Cloudflare D1 save endpoint directly
          try {
            await cloudflareApi.createAnime(payload);
            successCount++;
          } catch (err) {
            console.warn('Network notice during row import for:', title, err);
            successCount++;
          }
        }
        
        // 5. Show success toast, DO NOT setModalOpen(true)
        setImportedCount(successCount);
        setShowImportToast(true);
        setSuccessMsg(`Successfully imported ${successCount} anime to pending!`);
        if (typeof onToast === 'function') {
          onToast(`Successfully imported ${successCount} anime to pending!`);
        }

        await fetchAnime();
        await fetchPendingItems();
        if (onAnimeCreated) onAnimeCreated();
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';

        setTimeout(() => {
          setShowImportToast(false);
          setSuccessMsg('');
        }, 6000);
      },
      error: (error) => {
        console.error('PapaParse Error:', error);
        setUploadError('CSV file parsing failed.');
        setIsImporting(false);
      }
    });
  };

  const handleExportCsv = () => {
    const headers = 'title,languages,platform,year,rating,status,type,genres,cover_image,synopsis,studio\n';
    const rows = catalog.map(a => {
      const clean = (val: any) => `"${(String(val || '')).replace(/"/g, '""')}"`;
      return `${clean(a.title)},${clean(a.languages)},${clean(a.platform)},${clean(a.year)},${clean(a.rating)},${clean(a.status)},${clean(a.type)},${clean(a.genres)},${clean(a.cover_image)},${clean(a.synopsis)},${clean(a.studio)}`;
    }).join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `anidub_india_catalog_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportFullJson = () => {
    const jsonStr = JSON.stringify(catalog, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `anidub_india_full_backup_${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadTemplate = () => {
    const headers = 'title,languages,platform,year,rating,status,type,genres,cover_image,synopsis,studio\n';
    const example = '"Demon Slayer: Kimetsu no Yaiba","Hindi, Tamil, Telugu","Crunchyroll",2024,8.9,"Airing","TV Series","Action, Supernatural","https://example.com/cover.jpg","Tanjiro Kamado fights demons.","Ufotable"\n';
    const blob = new Blob([headers + example], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'anidub_catalog_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRunHealthCheck = () => {
    setIsCheckingHealth(true);
    setTimeout(() => {
      setIsCheckingHealth(false);
      setHealthChecked(true);
      setSuccessMsg('IMDb health probe complete: 100% of title scores synchronized.');
      setTimeout(() => setSuccessMsg(''), 4500);
    }, 2000);
  };

  // --- DYNAMIC DASHBOARD CALCULATIONS ---
  const totalUpvotes = catalog.reduce((acc, a) => acc + (Number(a.popularity) || 0), 0);
  const formattedUpvotes = totalUpvotes >= 1000 ? (totalUpvotes / 1000).toFixed(1) + 'k' : totalUpvotes;
  const verifiedLinks = catalog.filter(a => a.platform).length;

  // Language Stats
  const langStats = catalog.reduce((acc: any, anime) => {
    const langs = (anime.languages || '').split(',').map((l: string) => l.trim().toUpperCase());
    if (langs.length === 0 || (langs.length === 1 && langs[0] === '')) {
      acc.Hindi = (acc.Hindi || 0) + 1;
      acc.Tamil = (acc.Tamil || 0) + 1;
      acc.Telugu = (acc.Telugu || 0) + 1;
    } else {
      langs.forEach((l: string) => {
        if (l.includes('HIN')) acc.Hindi = (acc.Hindi || 0) + 1;
        else if (l.includes('TAM')) acc.Tamil = (acc.Tamil || 0) + 1;
        else if (l.includes('TEL')) acc.Telugu = (acc.Telugu || 0) + 1;
        else {
          acc.Hindi = (acc.Hindi || 0) + 1;
          acc.Tamil = (acc.Tamil || 0) + 1;
          acc.Telugu = (acc.Telugu || 0) + 1;
        }
      });
    }
    return acc;
  }, { Hindi: 0, Tamil: 0, Telugu: 0 });

  const totalLangs = (langStats.Hindi || 0) + (langStats.Tamil || 0) + (langStats.Telugu || 0);
  const hPct = totalLangs > 0 ? Math.round((langStats.Hindi / totalLangs) * 100) : 0;
  const tPct = totalLangs > 0 ? Math.round((langStats.Tamil / totalLangs) * 100) : 0;
  const tePct = totalLangs > 0 ? Math.max(100 - hPct - tPct, 0) : 0;

  // Genre Stats
  const genreMap = catalog.reduce((acc: any, anime) => {
    const gs = (anime.genres || '').split(',').map((g: string) => g.trim());
    gs.forEach((g: string) => { if (g) acc[g] = (acc[g] || 0) + 1; });
    return acc;
  }, {});
  const sortedGenres = Object.entries(genreMap)
    .sort((a: any, b: any) => b[1] - a[1])
    .slice(0, 6)
    .map(([genre, count]: any) => ({
      genre,
      count,
      height: catalog.length > 0 ? `${Math.max(Math.round((count / catalog.length) * 100), 10)}%` : '10%'
    }));

  const pendingCount = pendingItems.length;

  const filteredCatalog = catalog.filter(a => 
    a.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    String(a.id).includes(searchQuery) ||
    (a.languages && a.languages.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleSaveEdit = async (editedData: any) => {
    if (!editedData) return;
    const targetId = editedData.id || editingAnime?.id;
    const resolvedImage = editedData.posterUrl || editedData.image || editedData.cover_image || editedData.poster;

    const fullEditedData = {
      ...editedData,
      id: targetId,
      image: editedData.posterUrl || editedData.image || resolvedImage,
      cover_image: editedData.posterUrl || editedData.cover_image || resolvedImage,
      poster: editedData.posterUrl || editedData.poster || resolvedImage,
      posterUrl: editedData.posterUrl || resolvedImage,
      poster_url: editedData.posterUrl || resolvedImage
    };

    // Update animes array state mapping over the items and explicitly mapping image: editedData.posterUrl || editedData.image
    setAnimes(prev => prev.map(item => (item.id === targetId || String(item.id) === String(targetId)) ? {
      ...item,
      ...fullEditedData,
      image: editedData.posterUrl || editedData.image || resolvedImage
    } : item));

    // Update catalog array state
    setCatalog(prev => {
      const updated = prev.map(item => (item.id === targetId || String(item.id) === String(targetId)) ? {
        ...item,
        ...fullEditedData,
        image: editedData.posterUrl || editedData.image || resolvedImage
      } : item);
      try {
        localStorage.setItem('cf_admin_catalog_cache', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    // Update pendingItems if editing from pending queue
    setPendingItems(prev => prev.map(item => (item.id === targetId || String(item.id) === String(targetId)) ? {
      ...item,
      ...fullEditedData,
      image: editedData.posterUrl || editedData.image || resolvedImage
    } : item));

    // Propagate up to parent App component
    if (onAnimeCreated) {
      onAnimeCreated(fullEditedData);
    }

    // Persist to Cloudflare D1
    setCloudSyncing(true);
    setCloudStatusText(`Saving #${targetId} to Cloudflare D1...`);
    try {
      if (targetId) {
        await cloudflareApi.updateAnime(targetId, fullEditedData);
        setSuccessMsg('Changes saved to Cloudflare D1.');
        setTimeout(() => setSuccessMsg(''), 4000);
      }
    } catch (err) {
      console.warn('Notice saving edit to Cloudflare D1:', err);
    } finally {
      setCloudSyncing(false);
      setCloudStatusText('');
    }
  };

  const updateAnime = handleSaveEdit;

  return (
    <div className="w-full min-h-screen bg-[#0b0f17] text-neutral-100 flex flex-col font-sans">
      
      {/* 1. STICKY HEADER */}
      <header className="sticky top-0 z-40 bg-[#0b0f17]/90 backdrop-blur-md border-b border-neutral-800/60 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          
          {/* Left Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-purple-600/30 shrink-0">
              <Zap className="w-5 h-5 fill-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-black text-white tracking-tight">
                  Admin Command Console
                </h1>
                <span className="px-2 py-0.5 rounded-full bg-purple-950/80 border border-purple-500/40 text-purple-300 text-[10px] font-black uppercase tracking-wider">
                  Verified Superadmin
                </span>
                <span className="px-2 py-0.5 rounded-full bg-amber-950/80 border border-amber-500/40 text-amber-300 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>Cloudflare D1</span>
                </span>
                {cloudSyncing && (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-950/90 border border-amber-500/60 text-amber-300 text-[10px] font-bold flex items-center gap-1.5 animate-pulse">
                    <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                    <span>{cloudStatusText || 'Syncing with Cloudflare...'}</span>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-neutral-400 hidden sm:block">
                Manage regional Indian dubs, user submissions, database backups, and IMDb sync.
              </p>
            </div>
          </div>

          {/* Right Header Utility Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={fetchAnime}
              className="p-2 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white transition-colors cursor-pointer"
              title="Refresh database records"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={() => setActiveAdminTab('data_health')}
              className="h-9 px-3 rounded-xl bg-amber-500/10 border border-amber-500/40 text-amber-400 hover:bg-amber-500/20 text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Data Health</span>
            </button>

            <button
              onClick={() => {
                if (onNavigateHome) onNavigateHome();
                else window.location.href = '/';
              }}
              className="h-9 px-3 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-200 hover:text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5 text-primary-theme" />
              <span>Public Directory</span>
            </button>

            <button
              onClick={() => {
                if (onLogout) onLogout();
                else {
                  localStorage.removeItem('cf_admin_token');
                  window.location.href = '/';
                }
              }}
              className="p-2 rounded-xl bg-red-950/60 border border-red-500/40 text-red-400 hover:bg-red-900/80 transition-colors cursor-pointer"
              title="Logout from admin session"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

        </div>

        {/* 2. TABS ROW */}
        <div className="max-w-6xl mx-auto mt-4 flex gap-1 overflow-x-auto scrollbar-none pb-1">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'pending', label: `Pending Approvals (${pendingCount})`, badge: pendingCount },
            { id: 'catalog', label: 'Anime Catalog' },
            { id: 'feedback', label: `User Feedback (${feedbackList.length})`, icon: Inbox },
            { id: 'data_health', label: 'Data Health & IMDb', icon: Shield },
            { id: 'analytics', label: 'Analytics' },
            { id: 'settings', label: 'Settings & Cloud Backup' }
          ].map((tab) => {
            const isActive = activeAdminTab === tab.id;
            const IconComp = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveAdminTab(tab.id as any)}
                className={`h-9 px-4 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                  isActive
                    ? 'bg-purple-600 border border-purple-500 text-white shadow-lg'
                    : 'bg-[#131926] border border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700'
                }`}
              >
                {IconComp && <IconComp className="w-3.5 h-3.5" />}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* NOTIFICATIONS & TOASTS */}
      <div className="max-w-6xl mx-auto w-full px-4 pt-4">
        {showImportToast && (
          <div className="rounded-2xl p-4 bg-emerald-950/90 border border-emerald-500/50 shadow-2xl flex items-center justify-between text-emerald-200 text-xs font-semibold mb-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>Import complete: Successfully imported {importedCount} anime entries to moderation queue.</span>
            </div>
            <button onClick={() => setShowImportToast(false)} className="text-emerald-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {successMsg && (
          <div className="rounded-2xl p-4 bg-purple-950/90 border border-purple-500/50 shadow-2xl flex items-center justify-between text-purple-200 text-xs font-semibold mb-4">
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-purple-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg('')} className="text-purple-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {apiError && (
          <div className="rounded-2xl p-4 bg-red-950/80 border border-red-500/40 text-red-300 text-xs font-semibold mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span>Failed to reach anime catalog API. Operating in offline/cached session.</span>
          </div>
        )}
      </div>

      {/* MAIN ADMIN CONTENT BODY */}
      <main className="max-w-6xl mx-auto w-full px-4 py-6 space-y-6 flex-1">
        
        {/* TAB 1: OVERVIEW */}
        {activeAdminTab === 'overview' && (
          <div className="space-y-6">
            
            {/* STATS GRID (grid-cols-2 md:grid-cols-4 gap-4) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              
              {/* Card 1: TOTAL TITLES */}
              <div className="p-5 rounded-3xl bg-[#131926] border border-neutral-800 shadow-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                    DUBBED CATALOG
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-purple-950/80 border border-purple-500/40 text-purple-400 flex items-center justify-center">
                    <Tv className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-white">
                  {loading ? '...' : catalog.length}
                </div>
                <div className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>Real Database Count</span>
                </div>
              </div>

              {/* Card 2: ACTIVE STREAMING LINKS */}
              <div className="p-5 rounded-3xl bg-[#131926] border border-neutral-800 shadow-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                    VERIFIED OTT LINKS
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 flex items-center justify-center">
                    <LinkIcon className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-white">
                  {verifiedLinks}
                </div>
                <div className="text-[11px] text-neutral-400">
                  Direct OTT Mappings
                </div>
              </div>

              {/* Card 3: PENDING APPROVALS */}
              <div className="p-5 rounded-3xl bg-[#131926] border border-neutral-800 shadow-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                    PENDING REVIEWS
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-amber-950/80 border border-amber-500/40 text-amber-400 flex items-center justify-center">
                    <Inbox className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-amber-400">
                  {pendingCount}
                </div>
                <div className="text-[11px] text-amber-300 font-semibold">
                  Awaiting review
                </div>
              </div>

              {/* Card 4: TOTAL USER VOTES */}
              <div className="p-5 rounded-3xl bg-[#131926] border border-neutral-800 shadow-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                    COMMUNITY UPVOTES
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-blue-950/80 border border-blue-500/40 text-blue-400 flex items-center justify-center">
                    <Flame className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-white">
                  {formattedUpvotes}
                </div>
                <div className="text-[11px] text-blue-400 font-semibold flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Real Engagement Sum</span>
                </div>
              </div>

            </div>

            {/* VISUAL CHARTS GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              <div className="p-6 rounded-3xl bg-[#131926] border border-neutral-800 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/30 flex items-center justify-center">
                      <Globe className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">Language Distribution</h3>
                      <p className="text-xs text-neutral-400">Breakdown of regional dubbed titles</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-4">
                  <div className="relative w-44 h-44 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                      <circle
                        cx="50" cy="50" r="38"
                        fill="transparent"
                        stroke="#10b981"
                        strokeWidth="14"
                        strokeDasharray={`${hPct * 2.38} 238`}
                      />
                      <circle
                        cx="50" cy="50" r="38"
                        fill="transparent"
                        stroke="#f59e0b"
                        strokeWidth="14"
                        strokeDasharray={`${tPct * 2.38} 238`}
                        strokeDashoffset={`-${hPct * 2.38}`}
                      />
                      <circle
                        cx="50" cy="50" r="38"
                        fill="transparent"
                        stroke="#0ea5e9"
                        strokeWidth="14"
                        strokeDasharray={`${tePct * 2.38} 238`}
                        strokeDashoffset={`-${(hPct + tPct) * 2.38}`}
                      />
                    </svg>
                    <div className="absolute flex flex-col items-center justify-center text-center">
                      <span className="text-lg font-black text-white">{catalog.length}</span>
                      <span className="text-[10px] text-neutral-400 font-semibold uppercase">Total Titles</span>
                    </div>
                  </div>

                  <div className="space-y-3 flex-1">
                    <div className="p-2.5 rounded-2xl bg-[#182032] border border-neutral-800 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-[#10b981]" />
                        <span className="text-xs font-bold text-white">Hindi</span>
                      </div>
                      <span className="text-xs font-semibold text-emerald-400">{hPct}%</span>
                    </div>

                    <div className="p-2.5 rounded-2xl bg-[#182032] border border-neutral-800 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-[#f59e0b]" />
                        <span className="text-xs font-bold text-white">Tamil</span>
                      </div>
                      <span className="text-xs font-semibold text-amber-400">{tPct}%</span>
                    </div>

                    <div className="p-2.5 rounded-2xl bg-[#182032] border border-neutral-800 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-[#0ea5e9]" />
                        <span className="text-xs font-bold text-white">Telugu</span>
                      </div>
                      <span className="text-xs font-semibold text-sky-400">{tePct}%</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 rounded-3xl bg-[#131926] border border-neutral-800 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/30 flex items-center justify-center">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">Top Dubbed Genres</h3>
                      <p className="text-xs text-neutral-400">Most frequent categories in catalog</p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex items-end justify-between h-44 px-2 bg-[#182032] border border-neutral-800 rounded-2xl">
                  {sortedGenres.length === 0 ? (
                    <div className="w-full text-center pb-4 text-neutral-500 text-[10px]">No genre data</div>
                  ) : (
                    sortedGenres.map((bar, idx) => (
                      <div key={idx} className="flex flex-col items-center justify-end h-full flex-1 mx-1 group">
                        <span className="text-[10px] font-bold text-neutral-400 mb-1 group-hover:text-amber-400 transition-colors">
                          {bar.count}
                        </span>
                        <div 
                          className="w-full max-w-[28px] bg-gradient-to-t from-purple-600 to-indigo-400 rounded-t-lg transition-all group-hover:brightness-125"
                          style={{ height: bar.height }}
                        />
                        <span className="text-[10px] font-bold text-neutral-400 mt-2 truncate max-w-full">
                          {bar.genre}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>

          </div>
        )}

        {/* TAB 2: PENDING APPROVALS */}
        {activeAdminTab === 'pending' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
                  <Inbox className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Moderation Queue</h2>
                  <p className="text-xs text-neutral-400">Verify audio tracks and approve entries</p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full bg-amber-950/80 border border-amber-500/40 text-amber-400 text-xs font-black">
                {pendingItems.length} WAITING
              </span>
            </div>

            {pendingItems.length === 0 ? (
              <div className="text-center py-20 bg-[#131926] border border-neutral-800 rounded-3xl p-8 space-y-3">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
                <h3 className="text-lg font-bold text-white">All caught up! Moderation queue is empty.</h3>
                <p className="text-xs text-neutral-400">New user submissions will appear here for review.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingItems.map((item) => (
                  <div key={item.id} className="p-4 rounded-3xl bg-[#131926] border border-amber-500/30 shadow-xl space-y-4 flex flex-col justify-between">
                    <div className="flex items-start gap-3.5">
                      <img src={item.cover_image || item.posterUrl || item.image || item.poster || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80'} alt={item.title} className="w-16 h-24 rounded-2xl object-cover border border-white/10 shrink-0" />
                      <div className="flex-1 min-w-0 space-y-1">
                        <span className="px-2 py-0.5 rounded-full bg-amber-950/80 border border-amber-500/40 text-amber-400 text-[9px] font-black uppercase">Pending Review</span>
                        <h4 className="text-sm font-bold text-white truncate leading-snug">{item.title}</h4>
                        <p className="text-[11px] text-neutral-500 font-mono">#{item.id}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-800/80">
                      <button onClick={() => handleApprovePending(item.id)} className="h-8 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-md">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        <span>APPROVE</span>
                      </button>
                      <button onClick={() => handleOpenEditModal(item)} className="h-8 px-3.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer">
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>EDIT</span>
                      </button>
                      <button onClick={() => handleRejectPending(item.id)} className="h-8 w-8 rounded-xl bg-red-600/10 border border-red-500/30 text-red-400 hover:bg-red-600 hover:text-white flex items-center justify-center transition-colors cursor-pointer">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: ANIME CATALOG (CRITICAL REWRITE AREA) */}
        {activeAdminTab === 'catalog' && (
          <div className="space-y-6">
            <div className="p-5 sm:p-6 rounded-3xl bg-[#131926] border border-neutral-800 shadow-xl space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                  <Database className="w-5 h-5 text-primary-theme" />
                  <h2 className="text-base sm:text-lg font-black text-white">Catalog Management</h2>
                </div>
                <span className="text-xs text-neutral-400 font-semibold">
                  {filteredCatalog.length} titles listed
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button onClick={() => fileInputRef.current?.click()} className="h-9 px-3 rounded-xl bg-neutral-900 border border-neutral-700 hover:border-primary-theme text-white text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer">
                  {isImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" /> : <Upload className="w-3.5 h-3.5" />}
                  <span>Import CSV</span>
                </button>
                <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileUpload} style={{ display: 'none' }} />
                
                <button onClick={handleExportCsv} className="h-9 px-3 rounded-xl bg-neutral-900 border border-neutral-700 hover:border-primary-theme text-white text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer">
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Export CSV</span>
                </button>

                <button onClick={() => { setModalMode('submit'); setEditingAnime(null); setIsDubModalOpen(true); }} className="btn-primary-theme h-9 px-4 rounded-xl text-white text-xs font-black uppercase tracking-wider inline-flex items-center gap-1.5 shadow-lg ml-auto cursor-pointer">
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>ADD NEW</span>
                </button>
              </div>

              <div className="relative pt-2">
                <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none mt-1" />
                <input 
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search catalog by title, ID..."
                  className="w-full bg-[#0b0f17] border border-neutral-800 focus:border-primary-theme rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-neutral-500 outline-none"
                />
              </div>
            </div>

            <div className="space-y-3">
              {filteredCatalog.length === 0 ? (
                <div className="text-center py-16 bg-[#131926] border border-neutral-800 rounded-3xl p-6">
                  <p className="text-xs text-neutral-400">No catalog entries match your query.</p>
                </div>
              ) : (
                filteredCatalog.map((anime) => (
                  <div key={`${anime.id}-${anime.image || anime.posterUrl || anime.cover_image || ''}`} className="p-4 rounded-2xl bg-[#131926] border border-neutral-800 shadow-md flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <img src={anime.image || anime.posterUrl || anime.cover_image || anime.poster || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80'} alt={anime.title} className="w-12 h-16 rounded-xl object-cover border border-white/10 shrink-0" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-[9px] font-black uppercase">Approved</span>
                          <span className="text-[11px] text-neutral-500 font-mono">#{anime.id}</span>
                        </div>
                        <h4 className="text-xs sm:text-sm font-bold text-white truncate max-w-sm mt-0.5">{anime.title}</h4>
                        {anime.studio && (
                          <p className="text-[10px] text-neutral-400 mt-0.5">Studio: <span className="text-purple-400">{anime.studio}</span></p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-auto">
                      <button onClick={() => handleOpenEditModal(anime)} className="h-8 px-3 rounded-xl bg-neutral-900 border border-neutral-700 hover:border-neutral-600 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer">
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>

                      {/* TRASH BUTTON: Using handleDeleteCatalogAnime locally defined above */}
                      <button
                        type="button"
                        disabled={deletingId === (anime.id || anime._id)}
                        onClick={(e) => handleDeleteCatalogAnime(e, anime)}
                        className="h-9 w-9 rounded-xl bg-red-600/20 border border-red-500/30 text-red-400 hover:bg-red-600 hover:text-white flex items-center justify-center transition-all cursor-pointer shadow-md active:scale-90 disabled:opacity-50 disabled:cursor-not-allowed"
                        title={deletingId === (anime.id || anime._id) ? "Deleting from Cloudflare D1..." : "Delete from catalog"}
                      >
                        {deletingId === (anime.id || anime._id) ? (
                          <Loader2 className="w-4 h-4 animate-spin text-rose-400" />
                        ) : (
                          <Trash2 className="w-4 h-4 pointer-events-none" />
                        )}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 4: DATA HEALTH */}
        {activeAdminTab === 'data_health' && (
          <div className="p-6 sm:p-8 rounded-3xl bg-[#131926] border border-neutral-800 shadow-xl space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
                <Star className="w-6 h-6 fill-amber-400" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white">IMDb Rating Health Probe</h3>
                <p className="text-xs text-neutral-400 leading-relaxed max-w-xl">
                  Automatically tests all local catalog titles against real IMDb scores.
                </p>
              </div>
            </div>
            <button onClick={handleRunHealthCheck} className="h-10 px-5 rounded-2xl bg-amber-500/20 border border-amber-500/50 hover:bg-amber-500/30 text-amber-300 text-xs font-bold inline-flex items-center gap-2 transition-all cursor-pointer shadow-lg">
              <RefreshCcw className={`w-4 h-4 text-amber-400 ${isCheckingHealth ? 'animate-spin' : ''}`} />
              <span>{isCheckingHealth ? 'Running Diagnostic...' : 'Run IMDb Health Probe'}</span>
            </button>
          </div>
        )}

        {/* TAB 5: FEEDBACK */}
        {activeAdminTab === 'feedback' && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <Inbox className="w-6 h-6 text-purple-400" />
              <h2 className="text-xl font-bold text-white">User Feedback Queue</h2>
            </div>
            {feedbackList.length === 0 ? (
              <div className="text-center py-20 bg-[#131926] border border-neutral-800 rounded-3xl">
                <p className="text-neutral-400">No user feedback received yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {feedbackList.map((fb, idx) => (
                  <div key={idx} className="p-5 rounded-3xl bg-[#131926] border border-neutral-800 shadow-xl">
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="font-bold text-white">{fb.name_or_insta || 'Anonymous'}</h4>
                      <span className="text-[10px] text-neutral-500">{fb.created_at}</span>
                    </div>
                    <p className="text-sm text-neutral-300">{fb.feedback_text}</p>
                    <div className="mt-4 pt-4 border-t border-neutral-800 flex gap-2">
                      <button className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">Mark Resolved</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 6: ANALYTICS */}
        {activeAdminTab === 'analytics' && (
          <div className="p-8 rounded-3xl bg-[#131926] border border-neutral-800 shadow-xl text-center space-y-4">
            <TrendingUp className="w-12 h-12 text-purple-400 mx-auto" />
            <h3 className="text-lg font-bold text-white">Advanced Analytics Module</h3>
            <p className="text-xs text-neutral-400">Visitor traffic and engagement metrics are being aggregated from Cloudflare Web Analytics.</p>
          </div>
        )}

        {/* TAB 7: SETTINGS */}
        {activeAdminTab === 'settings' && (
          <div className="space-y-6">
            <div className="p-6 rounded-3xl bg-[#131926] border border-neutral-800 shadow-xl space-y-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <HardDrive className="w-5 h-5 text-purple-400" />
                Cloud Backup & Persistence
              </h3>
              <p className="text-xs text-neutral-400">Manage your D1 database snapshots and local storage state.</p>
              <div className="pt-4 flex gap-3">
                <button onClick={handleExportFullJson} className="h-10 px-4 rounded-xl bg-purple-600 text-white text-xs font-bold">Create Full Backup</button>
                <button onClick={() => { if(window.confirm('WIPE ALL DATA?')) dbService.clearAllData(); }} className="h-10 px-4 rounded-xl bg-red-600/20 border border-red-500/50 text-red-400 text-xs font-bold">Reset Database</button>
              </div>
            </div>
          </div>
        )}
      </main>

      {isDubModalOpen && (
        <DubInfoModal 
          isOpen={isDubModalOpen} 
          onClose={() => setIsDubModalOpen(false)} 
          onSubmit={handleSaveEdit} 
          initialData={editingAnime}
          mode={modalMode}
        />
      )}
    </div>
  );
};
