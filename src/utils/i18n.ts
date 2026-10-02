// Bilingual UI Localization Engine (English & Tamil)

export type SupportedLanguage = 'en' | 'ta';

export const TRANSLATIONS = {
  en: {
    appTitle: 'AniDub India',
    appSubtitle: 'Regional Dub Directory',
    stealthHint: 'Tap 5 times to reveal stealth admin panel',
    
    // Navigation Tabs
    navDirectory: 'Directory',
    navForYou: 'For You',
    navWatchlist: 'My Watchlist',
    navSaved: 'Saved',
    navSchedule: 'Schedule',
    navMatchmaker: 'Matchmaker',
    navProfile: 'Profile',
    submitDub: 'Submit Dub',
    
    // Search & Filter
    searchPlaceholder: 'Search dubbed anime by title, studio, or genre (e.g., Demon Slayer, Bleach)...',
    searchListening: "🎙️ Listening... Speak now (e.g., 'Demon Slayer', 'Naruto')...",
    regionalDubAudio: 'Regional Dub Audio',
    resetFilters: 'reset all filters',
    allLanguages: 'All',
    swipeHint: '💡 Mobile Gesture: Swipe card Right to Upvote 🔥, Swipe Left to Save 💜',
    
    // Recently Viewed
    recentlyViewedTitle: 'Recently Viewed',
    clearHistory: 'Clear History',
    noRecentlyViewed: 'No recently viewed anime yet.',
    
    // For You Feed
    forYouTitle: 'Curated For You',
    forYouSubtitle: 'Smart recommendations powered by your local watchlist, favorites & watch history',
    forYouLanguageMatch: 'Preferred Dub Language',
    forYouTopGenres: 'Top Matched Genres',
    forYouEmpty: 'Interact with more anime or add to your Watchlist to train your recommendation feed!',
    
    // Infinite Scroll & Grid
    loadingBatch: 'Loading next batch of anime...',
    allLoaded: 'All approved anime loaded',
    showingTitles: 'Showing',
    ofTitles: 'of',
    approvedDubs: 'approved dubs',
    
    // Profile Modal & Backup/Restore
    profileModalTitle: 'Anime Character Avatars & Profile',
    profileModalSubtitle: 'Choose any legendary anime character as your local display picture (DP)',
    primaryAccentTheme: 'Primary Accent Theme',
    instantThemeHint: 'Applied instantly across app',
    yourNickname: 'Your Nickname',
    favoriteDubLanguage: 'Favorite Dub Language',
    shareProfile: 'Share My Profile',
    cancel: 'Cancel',
    saveProfileAndTheme: 'Save Profile & Theme',
    
    // Backup & Restore
    backupSectionTitle: 'Profile Backup & Cloud-Free Transfer',
    backupSectionSubtitle: 'Backup your entire watchlist, custom avatar, theme & upvotes to move between devices',
    exportBackupBtn: 'Export Data (.json)',
    importBackupBtn: 'Import Data (.json)',
    exportSuccess: 'Backup file generated and downloaded successfully!',
    importSuccess: 'Profile, watchlist, and theme successfully restored!',
    importInvalid: 'Invalid backup file. Please select a valid AniDub backup .json file.',
    
    // Language Switcher
    langToggleLabel: 'UI Language',
    langEn: 'English',
    langTa: 'தமிழ் (Tamil)',
  },
  ta: {
    appTitle: 'அனிடப் இந்தியா',
    appSubtitle: 'பிராந்திய டப் வழிகாட்டி',
    stealthHint: 'நிர்வாகப் பலகையைத் திறக்க 5 முறை தொடவும்',
    
    // Navigation Tabs
    navDirectory: 'வழிகாட்டி',
    navForYou: 'உங்களுக்காக',
    navWatchlist: 'எனது பட்டியல்',
    navSaved: 'சேமித்தவை',
    navSchedule: 'அட்டவணை',
    navMatchmaker: 'பொருத்தம்',
    navProfile: 'சுயவிவரம்',
    submitDub: 'டப் சமர்ப்பிக்க',
    
    // Search & Filter
    searchPlaceholder: 'அனிமே தலைப்பு, ஸ்டுடியோ அல்லது வகையைத் தேடுங்கள் (எ.கா: Demon Slayer, Naruto)...',
    searchListening: '🎙️ கேட்கிறது... இப்போது பேசவும் (எ.கா: Demon Slayer)...',
    regionalDubAudio: 'பிராந்திய டப் ஆடியோ',
    resetFilters: 'வடிப்பான்களை மீட்டமை',
    allLanguages: 'அனைத்தும்',
    swipeHint: '💡 விரல் சைகை: வாக்களிக்க வலதுபுறமும் 🔥, சேமிக்க இடதுபுறமும் 💜 ஸ்வைப் செய்யவும்',
    
    // Recently Viewed
    recentlyViewedTitle: 'சமீபத்தில் பார்த்தவை',
    clearHistory: 'வரலாற்றை நீக்கு',
    noRecentlyViewed: 'சமீபத்தில் பார்த்தவை எதுவும் இல்லை.',
    
    // For You Feed
    forYouTitle: 'உங்களுக்காக பிரத்யேகமானது',
    forYouSubtitle: 'உங்கள் பார்வை வரலாறு மற்றும் மொழி விருப்பங்களின் அடிப்படையில் தேர்ந்தெடுக்கப்பட்டது',
    forYouLanguageMatch: 'விருப்பமான டப் மொழி',
    forYouTopGenres: 'பொருந்திய வகைகள்',
    forYouEmpty: 'மேலும் பரிந்துரைகளைப் பெற அனிமேகளை உங்கள் பட்டியலில் சேர்க்கவும்!',
    
    // Infinite Scroll & Grid
    loadingBatch: 'அடுத்த அனிமேகள் ஏற்றப்படுகின்றன...',
    allLoaded: 'அனைத்து அங்கீகரிக்கப்பட்ட அனிமேகளும் ஏற்றப்பட்டன',
    showingTitles: 'காண்பிக்கப்படுகிறது',
    ofTitles: '/',
    approvedDubs: 'டப் தொடர்கள்',
    
    // Profile Modal & Backup/Restore
    profileModalTitle: 'அனிமே அவதாரங்கள் & சுயவிவரம்',
    profileModalSubtitle: 'உங்களுக்குப் பிடித்த அனிமே கதாநாயகனை சுயவிவரப் படமாக அமைக்கவும்',
    primaryAccentTheme: 'முக்கிய வண்ண தீம்',
    instantThemeHint: 'செயலி முழுவதும் உடனடியாகப் பயன்படுத்தப்படும்',
    yourNickname: 'உங்கள் புனைப்பெயர்',
    favoriteDubLanguage: 'விருப்பமான டப்பிங் மொழி',
    shareProfile: 'சுயவிவரத்தைப் பகிரவும்',
    cancel: 'ரத்து செய்',
    saveProfileAndTheme: 'சுயவிவரம் & தீமைச் சேமி',
    
    // Backup & Restore
    backupSectionTitle: 'சுயவிவர காப்புப்பிரதி & மீட்பு',
    backupSectionSubtitle: 'உங்கள் பட்டியல், அவதார், தீம் மற்றும் வாக்குகளை வேறு சாதனத்திற்கு மாற்ற காப்புப்பிரதி எடுக்கவும்',
    exportBackupBtn: 'காப்புப்பிரதி பதிவிறக்கு (.json)',
    importBackupBtn: 'தரவை மீட்டமை (.json)',
    exportSuccess: 'காப்புப்பிரதி கோப்பு வெற்றிகரமாகப் பதிவிறக்கப்பட்டது!',
    importSuccess: 'சுயவிவரம் மற்றும் பட்டியல் வெற்றிகரமாக மீட்டமைக்கப்பட்டது!',
    importInvalid: 'செல்லாத காப்புப்பிரதி கோப்பு. சரியான .json கோப்பைத் தேர்ந்தெடுக்கவும்.',
    
    // Language Switcher
    langToggleLabel: 'மொழி',
    langEn: 'English',
    langTa: 'தமிழ்',
  },
};

export type TranslationKey = keyof typeof TRANSLATIONS.en;

/**
 * Get current UI language from localStorage (defaults to 'en')
 */
export function getSavedUiLanguage(): SupportedLanguage {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('anidub_ui_lang');
      if (saved === 'ta' || saved === 'en') {
        return saved;
      }
    } catch {}
  }
  return 'en';
}

/**
 * Persist UI language to localStorage
 */
export function setSavedUiLanguage(lang: SupportedLanguage): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('anidub_ui_lang', lang);
    } catch {}
  }
}

/**
 * Helper to get translated string with fallback to English
 */
export function translate(key: TranslationKey, lang: SupportedLanguage): string {
  const dict = TRANSLATIONS[lang] || TRANSLATIONS.en;
  return dict[key] || TRANSLATIONS.en[key] || (key as string);
}
