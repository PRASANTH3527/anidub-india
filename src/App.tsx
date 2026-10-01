import React, { useState, useMemo, useEffect } from 'react';
import { Navbar, NavTab } from './components/Navbar';
import { Hero } from './components/Hero';
import { FilterBar } from './components/FilterBar';
import { AnimeCard } from './components/AnimeCard';
import { SkeletonGrid } from './components/SkeletonGrid';
import { AnimeDetailPage } from './components/AnimeDetailPage';
import { RecommendationSystem } from './components/RecommendationSystem';
import { ProfileView } from './components/ProfileView';
import { ScheduleView } from './components/ScheduleView';
import { RecentUpdates } from './components/RecentUpdates';
import { FeedbackSection } from './components/FeedbackSection';
import { SubmitDubModal } from './components/SubmitDubModal';
import { AuthModal } from './components/AuthModal';
import { AdminWebhookPage } from './components/AdminWebhookPage';
import { dbService } from './services/databaseService';
import { authService } from './services/authService';
import { AnimeRecord, WatchlistEntry } from './types/database';
import { Anime, WatchlistItem, DubLanguage } from './types/anime';
import { updateSeoTags } from './utils/seo';
import { ChevronLeft, ChevronRight, Frown, Sparkles, PlusCircle } from 'lucide-react';

const ITEMS_PER_PAGE = 12;

export default function App() {
  // 1. Reactive DB State: Home & Search feeds ONLY fetch approved anime
  const [approvedAnime, setApprovedAnime] = useState<AnimeRecord[]>(() => dbService.getApprovedAnime());
  
  // Auth state
  const [currentUser, setCurrentUser] = useState(authService.getCurrentUser());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Watchlist entries from DB
  const [dbWatchlist, setDbWatchlist] = useState<WatchlistEntry[]>(() => {
    return dbService.getUserWatchlist(authService.getCurrentUser()?.uid || 'guest');
  });

  // Navigation state
  const [activeTab, setActiveTab] = useState<NavTab>('library');
  const [viewingAnimeId, setViewingAnimeId] = useState<string | null>(null);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('All');
  const [selectedGenre, setSelectedGenre] = useState<string>('All Genres');
  const [selectedType, setSelectedType] = useState<string>('All Types');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [sortBy, setSortBy] = useState<string>('Recently Added');
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  // Check if current route is the hidden /admin-webhook route
  const checkIsAdminWebhook = () => {
    if (typeof window === 'undefined') return false;
    const path = window.location.pathname.toLowerCase();
    const hash = window.location.hash.toLowerCase().replace('#', '').replace('/', '');
    return (
      path === '/admin-webhook' || 
      path === '/admin-webhook/' || 
      hash === 'admin-webhook' || 
      hash === 'admin/webhook'
    );
  };

  const [isAdminWebhook, setIsAdminWebhook] = useState(checkIsAdminWebhook);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);

  // Subscribe to DB & Auth changes
  useEffect(() => {
    const unsubDb = dbService.subscribe(() => {
      // Re-fetch only approved anime for the public catalog
      setApprovedAnime(dbService.getApprovedAnime());
      if (currentUser) {
        setDbWatchlist(dbService.getUserWatchlist(currentUser.uid));
      }
    });

    const unsubAuth = authService.subscribe((user) => {
      setCurrentUser(user);
      if (user) {
        setDbWatchlist(dbService.getUserWatchlist(user.uid));
      }
    });

    return () => {
      unsubDb();
      unsubAuth();
    };
  }, [currentUser]);

  // Dynamic Routing & SEO Hash Sync
  useEffect(() => {
    const handleLocationChange = () => {
      const isWebhook = checkIsAdminWebhook();
      setIsAdminWebhook(isWebhook);
      if (isWebhook) {
        updateSeoTags({
          title: 'Telegram Webhook Setup — AniDub India Admin',
          description: 'Secret administration dashboard for AniDub India Telegram Bot.',
        });
        return;
      }

      const hash = window.location.hash.replace('#', '');
      
      if (hash.startsWith('anime/')) {
        const id = hash.replace('anime/', '');
        setViewingAnimeId(id);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      setViewingAnimeId(null);
      if (hash === 'recommendations') {
        setActiveTab('recommendations');
        updateSeoTags({
          title: 'Anime Recommendation Matchmaker — AniDub India',
          description: 'Find personalized anime titles dubbed in Tamil, Telugu, Hindi, Malayalam, and Kannada.',
        });
      } else if (hash === 'schedule') {
        setActiveTab('schedule');
        updateSeoTags({
          title: 'Airing Now & Simulcast Dub Schedule — AniDub India',
          description: 'Weekly schedule of new Indian dubbed episodes premiering on Crunchyroll, Netflix, and JioCinema.',
        });
      } else if (hash === 'profile') {
        setActiveTab('profile');
        updateSeoTags({
          title: 'My Profile & Watchlist — AniDub India',
          description: 'Manage your saved Indian dubbed anime, track watched episodes, and review dub quality.',
        });
      } else {
        setActiveTab('library');
        updateSeoTags({
          title: 'AniDub India — Tamil, Telugu & Hindi Dubbed Anime Directory',
          description: 'Discover which anime are dubbed in Tamil, Telugu, Hindi, Malayalam, and Kannada — and where to stream them legally.',
          keywords: ['Tamil dubbed anime', 'Telugu anime dubs', 'Hindi dubbed anime online', 'Kannada anime dubs'],
        });
      }
    };

    handleLocationChange();
    window.addEventListener('hashchange', handleLocationChange);
    window.addEventListener('popstate', handleLocationChange);
    return () => {
      window.removeEventListener('hashchange', handleLocationChange);
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, []);

  // Open anime detail (Dedicated Information Page)
  const handleOpenAnimeDetail = (anime: Anime) => {
    setViewingAnimeId(anime.id);
    window.location.hash = `anime/${anime.id}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToLibrary = () => {
    setViewingAnimeId(null);
    window.location.hash = activeTab;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleTabChange = (tab: NavTab) => {
    setViewingAnimeId(null);
    setActiveTab(tab);
    window.location.hash = tab;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Watchlist Actions (Database synced with user ID)
  const handleToggleWatchlist = (anime: Anime) => {
    const userId = currentUser?.uid || 'guest';
    dbService.toggleWatchlist(userId, anime.id);
  };

  const handleToggleWatchedStatus = (animeId: string) => {
    const userId = currentUser?.uid || 'guest';
    dbService.toggleWatchlistStatus(userId, animeId);
  };

  const handleRemoveFromWatchlist = (animeId: string) => {
    const userId = currentUser?.uid || 'guest';
    dbService.removeFromWatchlist(userId, animeId);
  };

  // Convert DB watchlist to UI format
  const watchlistItemsForUI: WatchlistItem[] = useMemo(() => {
    return (dbWatchlist || []).map((entry) => ({
      animeId: entry.animeId,
      status: entry.status,
      addedAt: entry.addedAt,
      completedAt: entry.completedAt,
    }));
  }, [dbWatchlist]);

  const watchlistAnimeIds = useMemo(() => (dbWatchlist || []).map((w) => w.animeId), [dbWatchlist]);
  const watchedAnimeIds = useMemo(
    () => (dbWatchlist || []).filter((w) => w.status === 'watched').map((w) => w.animeId),
    [dbWatchlist]
  );

  // Find currently viewed anime (STRICT: ONLY approved anime can be viewed on website)
  const currentViewingAnime = useMemo(() => {
    if (!viewingAnimeId) return null;
    return approvedAnime.find((a) => a.id === viewingAnimeId) || null;
  }, [viewingAnimeId, approvedAnime]);

  // Main Home Page & Search Feeds: ONLY APPROVED ANIME
  const filteredApprovedAnime = useMemo(() => {
    return approvedAnime
      .filter((anime) => {
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase().trim();
          const matchesTitle = anime.title.toLowerCase().includes(query);
          const matchesRomaji = anime.romajiTitle?.toLowerCase().includes(query);
          const matchesStudio = anime.studio.toLowerCase().includes(query);
          const matchesGenre = anime.genres.some((g) => g.toLowerCase().includes(query));
          const matchesTheme = anime.themes?.some((t) => t.toLowerCase().includes(query));
          if (!matchesTitle && !matchesRomaji && !matchesStudio && !matchesGenre && !matchesTheme) {
            return false;
          }
        }

        if (selectedLanguage !== 'All') {
          if (!anime.dubs.includes(selectedLanguage as DubLanguage)) {
            return false;
          }
        }

        if (selectedGenre !== 'All Genres') {
          const hasGenre = anime.genres && anime.genres.some(
            (g) => g.toLowerCase() === selectedGenre.toLowerCase()
          );
          if (!hasGenre) {
            return false;
          }
        }

        if (selectedType !== 'All Types') {
          if (anime.type?.toLowerCase() !== selectedType.toLowerCase()) {
            return false;
          }
        }

        if (selectedStatus !== 'All') {
          const animeStatusLower = anime.status?.toLowerCase();
          const selectedLower = selectedStatus.toLowerCase();
          const matches =
            animeStatusLower === selectedLower ||
            (selectedLower === 'ongoing' && (animeStatusLower === 'airing' || anime.airingStatus?.toLowerCase() === 'ongoing')) ||
            (selectedLower === 'completed' && animeStatusLower === 'completed');

          if (!matches) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'Recently Added') {
          return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
        }
        if (sortBy === 'Highest Rated') {
          return b.rating - a.rating;
        }
        if (sortBy === 'Year (Newest)') {
          return b.releaseYear - a.releaseYear;
        }
        if (sortBy === 'Year (Oldest)') {
          return a.releaseYear - b.releaseYear;
        }
        if (sortBy === 'Title (A-Z)') {
          return a.title.localeCompare(b.title);
        }
        return 0;
      });
  }, [approvedAnime, searchQuery, selectedLanguage, selectedGenre, selectedType, selectedStatus, sortBy]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredApprovedAnime.length / ITEMS_PER_PAGE) || 1;
  const paginatedAnime = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredApprovedAnime.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredApprovedAnime, currentPage]);

  const handleLanguageFilter = (lang: string) => {
    if (lang === selectedLanguage) return;
    setIsLoading(true);
    setSelectedLanguage(lang);
    setCurrentPage(1);
    setTimeout(() => setIsLoading(false), 240);
  };

  const handleResetFilters = () => {
    setIsLoading(true);
    setSearchQuery('');
    setSelectedLanguage('All');
    setSelectedGenre('All Genres');
    setSelectedType('All Types');
    setSelectedStatus('All');
    setSortBy('Recently Added');
    setCurrentPage(1);
    setTimeout(() => setIsLoading(false), 180);
  };

  // If secret admin route, render AdminWebhookPage directly
  if (isAdminWebhook) {
    return <AdminWebhookPage />;
  }

  return (
    <div className="min-h-screen bg-[#0b0f17] text-neutral-100 flex flex-col font-sans selection:bg-purple-600 selection:text-white">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        watchlistCount={watchlistAnimeIds.length}
        onOpenSuggestModal={() => setIsSubmitModalOpen(true)}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
      />

      <main className="flex-grow">
        {/* 1. Dedicated Information Page (Route #anime/:id) */}
        {currentViewingAnime ? (
          <AnimeDetailPage
            anime={currentViewingAnime}
            watchlistItem={watchlistItemsForUI.find((w) => w.animeId === currentViewingAnime.id)}
            onToggleWatchlist={handleToggleWatchlist}
            onToggleWatchedStatus={handleToggleWatchedStatus}
            onBack={handleBackToLibrary}
            onSelectSimilarAnime={handleOpenAnimeDetail}
            onOpenAuthModal={() => setIsAuthModalOpen(true)}
            allAnime={approvedAnime}
          />
        ) : (
          <>
            {/* 2. Main Dub Library (ONLY FETCHES APPROVED ANIME) */}
            {activeTab === 'library' && (
              <>
                <Hero totalCount={approvedAnime.length} />

                <FilterBar
                  searchQuery={searchQuery}
                  setSearchQuery={(q) => {
                    setSearchQuery(q);
                    setCurrentPage(1);
                  }}
                  selectedLanguage={selectedLanguage}
                  setSelectedLanguage={handleLanguageFilter}
                  selectedGenre={selectedGenre}
                  setSelectedGenre={(g) => {
                    setSelectedGenre(g);
                    setCurrentPage(1);
                  }}
                  selectedType={selectedType}
                  setSelectedType={(t) => {
                    setSelectedType(t);
                    setCurrentPage(1);
                  }}
                  selectedStatus={selectedStatus}
                  setSelectedStatus={(s) => {
                    setSelectedStatus(s);
                    setCurrentPage(1);
                  }}
                  sortBy={sortBy}
                  setSortBy={setSortBy}
                  totalFiltered={filteredApprovedAnime.length}
                  isLoading={isLoading}
                  onReset={handleResetFilters}
                />

                <div className="max-w-6xl mx-auto px-4">
                  {isLoading ? (
                    <SkeletonGrid count={8} />
                  ) : (paginatedAnime && paginatedAnime.length > 0) ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-4">
                      {paginatedAnime.map((anime) => (
                        <AnimeCard
                          key={anime.id}
                          anime={anime}
                          isBookmarked={watchlistAnimeIds.includes(anime.id)}
                          onToggleBookmark={handleToggleWatchlist}
                          onSelect={handleOpenAnimeDetail}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-16 bg-[#131926]/50 border border-neutral-800 rounded-3xl p-8 max-w-lg mx-auto shadow-xl">
                      {approvedAnime.length === 0 ? (
                        <>
                          <div className="w-14 h-14 rounded-2xl bg-purple-950/60 border border-purple-800/60 flex items-center justify-center mx-auto mb-4 text-purple-400">
                            <Sparkles className="w-7 h-7" />
                          </div>
                          <h3 className="font-heading font-black text-xl text-white mb-2">
                            Fresh Database Ready
                          </h3>
                          <p className="text-xs text-neutral-400 mb-6 leading-relaxed">
                            All mock entries have been cleared. The database is empty and waiting for real anime submissions!
                          </p>
                          <button
                            onClick={() => setIsSubmitModalOpen(true)}
                            className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-lg shadow-purple-600/30 flex items-center gap-2 mx-auto"
                          >
                            <PlusCircle className="w-4 h-4" />
                            <span>Submit First Dub Info</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <Frown className="w-10 h-10 text-neutral-500 mx-auto mb-3" />
                          <h3 className="font-heading font-black text-lg text-white mb-1">
                            No Approved Dubbed Anime Found
                          </h3>
                          <p className="text-xs text-neutral-400 mb-5">
                            No anime matches your filter criteria. Try choosing another regional language or resetting filters.
                          </p>
                          <button
                            onClick={handleResetFilters}
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-lg shadow-purple-600/30"
                          >
                            Reset All Filters
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  {/* Pagination */}
                  {!isLoading && totalPages > 1 && (
                    <div className="flex items-center justify-center gap-1.5 sm:gap-2 my-10 select-none">
                      <button
                        disabled={currentPage === 1}
                        onClick={() => {
                          setCurrentPage((p) => Math.max(1, p - 1));
                          window.scrollTo({ top: 380, behavior: 'smooth' });
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[#141b29] border border-neutral-800 text-xs font-semibold text-neutral-300 hover:text-white hover:border-neutral-700 disabled:opacity-40 disabled:pointer-events-none cursor-pointer flex items-center gap-1 transition-colors"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>Prev</span>
                      </button>

                      {Array.from({ length: totalPages }).map((_, i) => {
                        const pageNum = i + 1;
                        const isActive = pageNum === currentPage;
                        return (
                          <button
                            key={pageNum}
                            onClick={() => {
                              setCurrentPage(pageNum);
                              window.scrollTo({ top: 380, behavior: 'smooth' });
                            }}
                            className={`w-8 h-8 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              isActive
                                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/40 ring-1 ring-purple-400/50'
                                : 'bg-[#141b29] border border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}

                      <button
                        disabled={currentPage === totalPages}
                        onClick={() => {
                          setCurrentPage((p) => Math.min(totalPages, p + 1));
                          window.scrollTo({ top: 380, behavior: 'smooth' });
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[#141b29] border border-neutral-800 text-xs font-semibold text-neutral-300 hover:text-white hover:border-neutral-700 disabled:opacity-40 disabled:pointer-events-none cursor-pointer flex items-center gap-1 transition-colors"
                      >
                        <span>Next</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                <RecentUpdates />
              </>
            )}

            {/* 4. Recommendation Matchmaker */}
            {activeTab === 'recommendations' && (
              <RecommendationSystem
                animeList={approvedAnime}
                watchlistIds={watchlistAnimeIds}
                watchedIds={watchedAnimeIds}
                onToggleWatchlist={handleToggleWatchlist}
                onSelectAnime={handleOpenAnimeDetail}
              />
            )}

            {/* 5. Airing Schedule */}
            {activeTab === 'schedule' && (
              <ScheduleView onSelectAnime={handleOpenAnimeDetail} />
            )}

            {/* 6. Profile & My Watchlist Page */}
            {activeTab === 'profile' && (
              <ProfileView
                allAnime={approvedAnime}
                watchlistItems={watchlistItemsForUI}
                onToggleWatchedStatus={handleToggleWatchedStatus}
                onRemoveFromWatchlist={handleRemoveFromWatchlist}
                onSelectAnime={handleOpenAnimeDetail}
                onNavigateToTab={(tab) => handleTabChange(tab)}
              />
            )}
          </>
        )}
      </main>

      {/* Footer & Feedback */}
      <FeedbackSection 
        onOpenSuggestModal={() => setIsSubmitModalOpen(true)}
      />

      {/* Submit Dub Info Modal with Jikan API Auto-Fill */}
      <SubmitDubModal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        onSuccess={() => {
          // If admin, notify or update
        }}
      />

      {/* Google Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onLoginSuccess={() => {
          if (currentUser) {
            setDbWatchlist(dbService.getUserWatchlist(currentUser.uid));
          }
        }}
      />
    </div>
  );
}
