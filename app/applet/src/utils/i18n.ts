// Multi-language UI Localization Engine (English, Tamil, Telugu, Hindi, Malayalam, Kannada)

export type SupportedLanguage = 'en' | 'ta' | 'te' | 'hi' | 'ml' | 'kn';

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
    yourNickname: 'Your Nickname',
    favoriteDubLanguage: 'Favorite Dub Language',
    shareProfile: 'Share My Profile',
    cancel: 'Cancel',
    saveProfile: 'Save Profile',
    saveProfileAndTheme: 'Save Profile',

    // Backup & Restore
    backupSectionTitle: 'Profile Backup & Cloud-Free Transfer',
    backupSectionSubtitle: 'Backup your entire watchlist, custom avatar & upvotes to move between devices',
    exportBackupBtn: 'Export Data (.json)',
    importBackupBtn: 'Import Data (.json)',
    exportSuccess: 'Backup file generated and downloaded successfully!',
    importSuccess: 'Profile and watchlist successfully restored!',
    importInvalid: 'Invalid backup file. Please select a valid AniDub backup .json file.',

    // Cloud Sync
    cloudTabTitle: 'Cloud Sync',
    identityTabTitle: 'Identity',
    cloudUsername: 'Cloud Username',
    cloudPassword: 'Password',
    cloudBackupBtn: 'Backup to Cloud',
    cloudRestoreBtn: 'Restore from Cloud',
    cloudSyncSubtitle: 'Optionally sync your watchlist and profile to our secure cloud to access on any device.',
    cloudSafeNote: 'Privacy First: No email required. Just a unique username and password.',

    // Hero & Stats
    heroBadge: "India's Largest Regional Anime Dub Tracker",
    heroTitlePart1: "Find Anime Dubbed in",
    heroTitlePart2: "Your Language",
    heroSubtitle: "Discover which anime are dubbed in Tamil, Telugu, Hindi, Malayalam, and Kannada — and where to stream them.",
    surpriseMe: "Surprise Me Roulette",
    randomPick: "Random Pick",
    statsAnime: "Dubbed Titles",
    statsUpvotes: "Community Votes",
    statsLanguages: "Indian Languages",

    // Language Switcher
    langToggleLabel: 'UI Language',
    langEn: 'English',
    langTa: 'தமிழ்',
  },
  ta: {
    appTitle: 'அனிடப் இந்தியா',
    appSubtitle: 'பிராந்திய டப் வழிகாட்டி',
    stealthHint: 'நிர்வாகப் பலகையைத் திறக்க 5 முறை தொடவும்',

    navDirectory: 'வழிகாட்டி',
    navForYou: 'உங்களுக்காக',
    navWatchlist: 'எனது பட்டியல்',
    navSaved: 'சேமித்தவை',
    navSchedule: 'அட்டவணை',
    navMatchmaker: 'பொருத்தம்',
    navProfile: 'சுயவிவரம்',
    submitDub: 'டப் சமர்ப்பிக்க',

    searchPlaceholder: 'அனிமே தலைப்பு, ஸ்டுடியோ அல்லது வகையைத் தேடுங்கள்...',
    searchListening: '🎙️ கேட்கிறது...',
    regionalDubAudio: 'பிராந்திய டப் ஆடியோ',
    resetFilters: 'வடிப்பான்களை மீட்டமை',
    allLanguages: 'அனைத்தும்',
    swipeHint: '💡 விரல் சைகை: வாக்களிக்க வலதுபுறமும் 🔥, சேமிக்க இடதுபுறமும் 💜',

    recentlyViewedTitle: 'சமீபத்தில் பார்த்தவை',
    clearHistory: 'வரலாற்றை நீக்கு',
    noRecentlyViewed: 'சமீபத்தில் பார்த்தவை எதுவும் இல்லை.',

    forYouTitle: 'உங்களுக்காக பிரத்யேகமானது',
    forYouSubtitle: 'உங்கள் பார்வை வரலாறு மற்றும் மொழி விருப்பங்களின் அடிப்படையில்',
    forYouLanguageMatch: 'விருப்பமான டப் மொழி',
    forYouTopGenres: 'பொருந்திய வகைகள்',
    forYouEmpty: 'மேலும் பரிந்துரைகளைப் பெற அனிமேகளை உங்கள் பட்டியலில் சேர்க்கவும்!',

    loadingBatch: 'அடுத்த அனிமேகள் ஏற்றப்படுகின்றன...',
    allLoaded: 'அனைத்து அனிமேகளும் ஏற்றப்பட்டன',
    showingTitles: 'காண்பிக்கப்படுகிறது',
    ofTitles: '/',
    approvedDubs: 'டப் தொடர்கள்',

    profileModalTitle: 'அனிமே அவதாரங்கள் & சுயவிவரம்',
    profileModalSubtitle: 'உங்களுக்குப் பிடித்த அனிமே கதாநாயகனை சுயவிவரப் படமாக அமைக்கவும்',
    yourNickname: 'உங்கள் புனைப்பெயர்',
    favoriteDubLanguage: 'விருப்பமான டப்பிங் மொழி',
    shareProfile: 'சுயவிவரத்தைப் பகிரவும்',
    cancel: 'ரத்து செய்',
    saveProfile: 'சுயவிவரத்தைச் சேமி',
    saveProfileAndTheme: 'சுயவிவரத்தைச் சேமி',

    backupSectionTitle: 'சுயவிவர காப்புப்பிரதி & மீட்பு',
    backupSectionSubtitle: 'உங்கள் பட்டியல் மற்றும் அவதாரத்தை காப்புப்பிரதி எடுக்கவும்',
    exportBackupBtn: 'காப்புப்பிரதி பதிவிறக்கு (.json)',
    importBackupBtn: 'தரவை மீட்டமை (.json)',
    exportSuccess: 'காப்புப்பிரதி கோப்பு வெற்றிகரமாகப் பதிவிறக்கப்பட்டது!',
    importSuccess: 'சுயவிவரம் வெற்றிகரமாக மீட்டமைக்கப்பட்டது!',
    importInvalid: 'செல்லாத காப்புப்பிரதி கோப்பு.',

    cloudTabTitle: 'கிளவுட் ஒத்திசைவு',
    identityTabTitle: 'சுயவிவரம்',
    cloudUsername: 'பயனர் பெயர்',
    cloudPassword: 'கடவுச்சொல்',
    cloudBackupBtn: 'கிளவுட்டில் சேமி',
    cloudRestoreBtn: 'கிளவுட்டிலிருந்து மீட்டெடு',
    cloudSyncSubtitle: 'உங்கள் தரவை கிளவுட்டில் ஒத்திசைக்கவும்.',
    cloudSafeNote: 'மின்னஞ்சல் தேவையில்லை.',

    heroBadge: 'இந்தியாவின் மிகப்பெரிய பிராந்திய அனிமே டப் வழிகாட்டி',
    heroTitlePart1: 'உங்களுக்குப் பிடித்த மொழியில்',
    heroTitlePart2: 'அனிமேகளைக் கண்டறியவும்',
    heroSubtitle: 'தமிழ், தெலுங்கு, இந்தி, மலையாளம் மற்றும் கன்னடம்.',
    surpriseMe: 'அதிர்ஷ்ட அனிமே',
    randomPick: 'சீரற்ற தேர்வு',
    statsAnime: 'டப் செய்யப்பட்டவை',
    statsUpvotes: 'சமூக வாக்குகள்',
    statsLanguages: 'இந்திய மொழிகள்',

    langToggleLabel: 'மொழி',
    langEn: 'English',
    langTa: 'தமிழ்',
  },
  te: {
    appTitle: 'అనిడబ్ ఇండియా',
    appSubtitle: 'ప్రాంతీయ డబ్ డైరెక్టరీ',
    stealthHint: 'అడ్మిన్ ప్యానెల్ తెరవడానికి 5 సార్లు నొక్కండి',

    navDirectory: 'డైరెక్టరీ',
    navForYou: 'మీ కోసం',
    navWatchlist: 'వీక్షణ జాబితా',
    navSaved: 'సేవ్ చేసినవి',
    navSchedule: 'షెడ్యూల్',
    navMatchmaker: 'మ్యాచ్‌మేకర్',
    navProfile: 'ప్రొఫైల్',
    submitDub: 'డబ్ సమర్పించు',

    searchPlaceholder: 'శీర్షిక, స్టూడియో లేదా జానర్ ద్వారా అానిమే వెతకండి...',
    searchListening: '🎙️ వింటోంది...',
    regionalDubAudio: 'ప్రాంతీయ డబ్ ఆడియో',
    resetFilters: 'ఫిల్టర్లను రీసెట్ చేయి',
    allLanguages: 'అన్నీ',
    swipeHint: '💡 ఓటు వేయడానికి కుడివైపు స్వైప్ చేయండి 🔥',

    recentlyViewedTitle: 'ఇటీవల చూసినవి',
    clearHistory: 'చరిత్రను క్లియర్ చేయి',
    noRecentlyViewed: 'ఇటీవల చూసిన అానిమేలు ఏవీ లేవు.',

    forYouTitle: 'మీ కోసం ప్రత్యేకంగా',
    forYouSubtitle: 'మీ వాచ్‌లిస్ట్ మరియు చరిత్ర ఆధారంగా సిఫార్సులు',
    forYouLanguageMatch: 'ఇష్టమైన డబ్ భాష',
    forYouTopGenres: 'అగ్ర శైలులు',
    forYouEmpty: 'మరిన్ని సిఫార్సుల కోసం అానిమేలను మీ వాచ్‌లిస్ట్‌కు జోడించండి!',

    loadingBatch: 'మరిన్ని అానిమేలు లోడ్ అవుతున్నాయి...',
    allLoaded: 'అన్ని అానిమేలు లోడ్ అయ్యాయి',
    showingTitles: 'చూపుతోంది',
    ofTitles: '/',
    approvedDubs: 'డబ్ సిరీస్',

    profileModalTitle: 'ఒటాకు ప్రొఫైల్',
    profileModalSubtitle: 'మీకు ఇష్టమైన అానిమే పాత్రను ఎంచుకోండి',
    yourNickname: 'మీ మారుపేరు',
    favoriteDubLanguage: 'ఇష్టమైన డబ్ భాష',
    shareProfile: 'ప్రొఫైల్ పంచుకోండి',
    cancel: 'రద్దు చేయి',
    saveProfile: 'ప్రొఫైల్ సేవ్ చేయి',
    saveProfileAndTheme: 'ప్రొఫైల్ సేవ్ చేయి',

    backupSectionTitle: 'బ్యాకప్ & పునరుద్ధరణ',
    backupSectionSubtitle: 'మీ జాబితాను బ్యాకప్ చేయండి',
    exportBackupBtn: 'బ్యాకప్ డౌన్‌లోడ్ (.json)',
    importBackupBtn: 'డేటాను పునరుద్ధరించు (.json)',
    exportSuccess: 'బ్యాకప్ విజయవంతంగా డౌన్‌లోడ్ చేయబడింది!',
    importSuccess: 'ప్రొఫైల్ విజయవంతంగా పునరుద్ధరించబడింది!',
    importInvalid: 'చెల్లని బ్యాకప్ ఫైల్.',

    cloudTabTitle: 'క్లౌడ్ సింక్',
    identityTabTitle: 'ప్రొఫైల్',
    cloudUsername: 'యూజర్ పేరు',
    cloudPassword: 'పాస్‌వర్డ్',
    cloudBackupBtn: 'క్లౌడ్‌లో సేవ్ చేయి',
    cloudRestoreBtn: 'క్లౌడ్ నుండి పునరుద్ధరించు',
    cloudSyncSubtitle: 'సురక్షిత క్లౌడ్‌లో సింక్ చేయండి.',
    cloudSafeNote: 'గోప్యత: ఈమెయిల్ అవసరం లేదు.',

    heroBadge: 'భారతదేశపు అతిపెద్ద ప్రాంతీయ అానిమే డబ్ గైడ్',
    heroTitlePart1: 'మీ ఇష్టమైన భాషలో',
    heroTitlePart2: 'అానిమేలను కనుగొనండి',
    heroSubtitle: 'తెలుగు, తమిళం, హిందీ, మలయాళం మరియు కన్నడ.',
    surpriseMe: 'సర్‌ప్రైజ్ మీ',
    randomPick: 'యాదృచ్ఛిక ఎంపిక',
    statsAnime: 'డబ్ శీర్షికలు',
    statsUpvotes: 'కమ్యూనిటీ ఓట్లు',
    statsLanguages: 'భారతీయ భాషలు',

    langToggleLabel: 'భాష',
    langEn: 'English',
    langTa: 'తెలుగు',
  },
  hi: {
    appTitle: 'एनिडब इंडिया',
    appSubtitle: 'क्षेत्रीय डब निर्देशिका',
    stealthHint: 'एडमिन पैनल के लिए 5 बार टैप करें',

    navDirectory: 'डिफेक्ट्री',
    navForYou: 'आपके लिए',
    navWatchlist: 'मेरी वॉचलिस्ट',
    navSaved: 'सहेजे गए',
    navSchedule: 'शेड्यूल',
    navMatchmaker: 'मैचमेकर',
    navProfile: 'प्रोफ़ाइल',
    submitDub: 'डब सबमिट करें',

    searchPlaceholder: 'शीर्षक, स्टूडियो या शैली द्वारा एनीमे खोजें...',
    searchListening: '🎙️ सुन रहा है...',
    regionalDubAudio: 'क्षेत्रीय डब ऑडियो',
    resetFilters: 'सभी फ़िल्टर रीसेट करें',
    allLanguages: 'सभी',
    swipeHint: '💡 वोट करने के लिए दाईं ओर स्वाइप करें 🔥',

    recentlyViewedTitle: 'हाल ही में देखे गए',
    clearHistory: 'इतिहास साफ़ करें',
    noRecentlyViewed: 'अभी तक कोई हालिया एनीमे नहीं.',

    forYouTitle: 'आपके लिए विशेष',
    forYouSubtitle: 'आपकी वॉचलिस्ट और इतिहास के आधार पर अनुशंसाएँ',
    forYouLanguageMatch: 'पसंदीदा डब भाषा',
    forYouTopGenres: 'शीर्ष शैलियाँ',
    forYouEmpty: 'अधिक अनुशंसाओं के लिए अपनी वॉचलिस्ट में एनीमे जोड़ें!',

    loadingBatch: 'एनीमे लोड हो रहा है...',
    allLoaded: 'सभी स्वीकृत एनीमे लोड हो गए',
    showingTitles: 'दिखा रहा है',
    ofTitles: '/',
    approvedDubs: 'डब सीरीज़',

    profileModalTitle: 'ओटाकू प्रोफ़ाइल',
    profileModalSubtitle: 'अपना पसंदीदा एनीमे चरित्र चुनें',
    yourNickname: 'आपका उपनाम',
    favoriteDubLanguage: 'पसंदीदा डब भाषा',
    shareProfile: 'प्रोफ़ाइल साझा करें',
    cancel: 'रद्द करें',
    saveProfile: 'प्रोफ़ाइल सहेजें',
    saveProfileAndTheme: 'प्रोफ़ाइल सहेजें',

    backupSectionTitle: 'बैकअप और पुनर्स्थापना',
    backupSectionSubtitle: 'अपनी वॉचलिस्ट का बैकअप लें',
    exportBackupBtn: 'डेटा निर्यात करें (.json)',
    importBackupBtn: 'डेटा आयात करें (.json)',
    exportSuccess: 'बैकअप फ़ाइल सफलतापूर्वक डाउनलोड हो गई!',
    importSuccess: 'प्रोफ़ाइल सफलतापूर्वक पुनर्स्थापित हो गई!',
    importInvalid: 'अमान्य बैकअप फ़ाइल.',

    cloudTabTitle: 'क्लाउड सिंक',
    identityTabTitle: 'प्रोफ़ाइल',
    cloudUsername: 'यूज़रनेम',
    cloudPassword: 'पासवर्ड',
    cloudBackupBtn: 'क्लाउड में सहेजें',
    cloudRestoreBtn: 'क्लाउड से पुनर्स्थापित करें',
    cloudSyncSubtitle: 'सुरक्षित क्लाउड में सिंक करें.',
    cloudSafeNote: 'गोपनीयता: ईमेल आवश्यक नहीं है.',

    heroBadge: 'भारत का सबसे बड़ा क्षेत्रीय एनीमे डब ट्रैकर',
    heroTitlePart1: 'अपनी भाषा में',
    heroTitlePart2: 'एनीमे खोजें',
    heroSubtitle: 'हिंदी, तमिल, तेलुगु, मलयालम और कन्नड़ में डब किए गए एनीमे खोजें।',
    surpriseMe: 'सरप्राइज मी',
    randomPick: 'यादृच्छिक चयन',
    statsAnime: 'डब किए गए शीर्षक',
    statsUpvotes: 'कम्युनिटी वोट',
    statsLanguages: 'भारतीय भाषाएँ',

    langToggleLabel: 'भाषा',
    langEn: 'English',
    langTa: 'हिंदी',
  },
  ml: {
    appTitle: 'അനിഡബ് ഇന്ത്യ',
    appSubtitle: 'റീജണൽ ഡബ് ഡയറക്ടറി',
    stealthHint: 'അഡ്മിൻ പാനലിനായി 5 തവണ ടാപ്പ് ചെയ്യുക',

    navDirectory: 'ഡയറക്ടറി',
    navForYou: 'നിങ്ങൾക്കായി',
    navWatchlist: 'വാച്ച്‌ലിസ്റ്റ്',
    navSaved: 'സേവ് ചെയ്തവ',
    navSchedule: 'ഷെഡ്യൂൾ',
    navMatchmaker: 'മാച്ച്മേക്കർ',
    navProfile: 'പ്രൊഫൈൽ',
    submitDub: 'ഡബ് സമർപ്പിക്കുക',

    searchPlaceholder: 'ശീർഷകം, സ്റ്റുഡിയോ അല്ലെങ്കിൽ തരം അനുസരിച്ച് ആനിമേഷൻ തിരയുക...',
    searchListening: '🎙️ കേൾക്കുന്നു...',
    regionalDubAudio: 'റീജണൽ ഡബ് ഓഡിയോ',
    resetFilters: 'ഫിൽട്ടറുകൾ റീസെറ്റ് ചെയ്യുക',
    allLanguages: 'എല്ലാം',
    swipeHint: '💡 വോട്ട് ചെയ്യാൻ വലത്തേക്ക് സ്വൈപ്പ് ചെയ്യുക 🔥',

    recentlyViewedTitle: 'അവസാനം കണ്ടവ',
    clearHistory: 'ചരിത്രം മായ്ക്കുക',
    noRecentlyViewed: 'സമീപകാല ആനിമേഷനുകൾ ഒന്നുമില്ല.',

    forYouTitle: 'നിങ്ങൾക്കായുള്ള ശുപാർശകൾ',
    forYouSubtitle: 'നിങ്ങളുടെ വാച്ച്‌ലിസ്റ്റിനെ അടിസ്ഥാനമാക്കി',
    forYouLanguageMatch: 'ഇഷ്ടപ്പെട്ട ഡബ് ഭാഷ',
    forYouTopGenres: 'ടോപ് ജോണറുകൾ',
    forYouEmpty: 'കൂടുതൽ ശുപാർശകൾക്കായി ആനിമേഷനുകൾ ചേർക്കുക!',

    loadingBatch: 'കൂടുതൽ ആനിമേഷനുകൾ ലോഡ് ചെയ്യുന്നു...',
    allLoaded: 'എല്ലാ ആനിമേഷനുകളും ലോഡ് ചെയ്തു',
    showingTitles: 'കാണിക്കുന്നു',
    ofTitles: '/',
    approvedDubs: 'ഡബ് സീരീസ്',

    profileModalTitle: 'ഒടാകു പ്രൊഫൈൽ',
    profileModalSubtitle: 'നിങ്ങളുടെ പ്രിയപ്പെട്ട ആനിമേഷൻ കഥാപാത്രം തിരഞ്ഞെടുക്കുക',
    yourNickname: 'നിങ്ങളുടെ വിളിപ്പേര്',
    favoriteDubLanguage: 'പ്രിയപ്പെട്ട ഡബ് ഭാഷ',
    shareProfile: 'പ്രൊഫൈൽ പങ്കിടുക',
    cancel: 'റദ്ദാക്കുക',
    saveProfile: 'പ്രൊഫൈൽ സേവ് ചെയ്യുക',
    saveProfileAndTheme: 'പ്രൊഫൈൽ സേവ് ചെയ്യുക',

    backupSectionTitle: 'ബാക്ക്അപ്പ് & റീകോൾ',
    backupSectionSubtitle: 'നിങ്ങളുടെ വാച്ച്‌ലിസ്റ്റ് ബാക്ക്അപ്പ് ചെയ്യുക',
    exportBackupBtn: 'ഡാറ്റ എക്സ്പോർട്ട് ചെയ്യുക (.json)',
    importBackupBtn: 'ഡാറ്റ ഇമ്പോർട്ട് ചെയ്യുക (.json)',
    exportSuccess: 'ബാക്ക്അപ്പ് ഫയൽ വിജയകരമായി ഡൗൺലോഡ് ചെയ്തു!',
    importSuccess: 'പ്രൊഫൈൽ വിജയകരമായി റീകോൾ ചെയ്തു!',
    importInvalid: 'അസാധുവായ ബാക്ക്അപ്പ് ഫയൽ.',

    cloudTabTitle: 'ക്ലൗഡ് സിങ്ക്',
    identityTabTitle: 'പ്രൊഫൈൽ',
    cloudUsername: 'യൂസർനാം',
    cloudPassword: 'പാസ്‌വേഡ്',
    cloudBackupBtn: 'ക്ലൗഡിൽ സേവ് ചെയ്യുക',
    cloudRestoreBtn: 'ക്ലൗഡിൽ നിന്ന് റീകോൾ ചെയ്യുക',
    cloudSyncSubtitle: 'സുരക്ഷിത ക്ലൗഡിൽ സിങ്ക് ചെയ്യുക.',
    cloudSafeNote: 'സ്വകാര്യത: ഇമെയിൽ ആവശ്യമില്ല.',

    heroBadge: 'ഇന്ത്യയിലെ ഏറ്റവും വലിയ റീജണൽ ആനിമേഷൻ ഡബ് ഗൈഡ്',
    heroTitlePart1: 'നിങ്ങളുടെ പ്രിയപ്പെട്ട ഭാഷയിൽ',
    heroTitlePart2: 'ആനിമേഷനുകൾ കണ്ടെത്തൂ',
    heroSubtitle: 'മലയാളം, തമിഴ്, തെലുങ്ക്, ഹിന്ദി, കന്നഡ ഭാഷകളിൽ ഡബ് ചെയ്തവ.',
    surpriseMe: 'സർപ്രൈസ് മീ',
    randomPick: 'റാൻഡം തിരഞ്ഞെടുപ്പ്',
    statsAnime: 'ഡബ് ചെയ്ത ടൈറ്റിലുകൾ',
    statsUpvotes: 'കമ്മ്യൂണിറ്റി വോട്ടുകൾ',
    statsLanguages: 'ഇന്ത്യൻ ഭാഷകൾ',

    langToggleLabel: 'ഭാഷ',
    langEn: 'English',
    langTa: 'മലയാളം',
  },
  kn: {
    appTitle: 'ಅನಿಡಬ್ ಇಂಡಿಯಾ',
    appSubtitle: 'ಪ್ರಾದೇಶಿಕ ಡಬ್ ಡೈರೆಕ್ಟರಿ',
    stealthHint: 'ಅಡ್ಮಿನ್ ಪ್ಯಾನೆಲ್ ತೆರೆಯಲು 5 ಬಾರಿ ಟ್ಯಾಪ್ ಮಾಡಿ',

    navDirectory: 'ಡೈರೆಕ್ಟರಿ',
    navForYou: 'ನಿಮ್ಮಗಾಗಿ',
    navWatchlist: 'ವೀಕ್ಷಣೆ ಪಟ್ಟಿ',
    navSaved: 'ಉಳಿಸಿದವು',
    navSchedule: 'ಅನುಸೂಚಿ',
    navMatchmaker: 'ಮ್ಯಾಚ್‌ಮೇಕರ್',
    navProfile: 'ಪ್ರೊಫೈಲ್',
    submitDub: 'ಡಬ್ ಸಲ್ಲಿಸಿ',

    searchPlaceholder: 'ಶೀರ್ಷಿಕೆ, ಸ್ಟುಡಿಯೋ ಅಥವಾ ಪ್ರಕಾರದ ಮೂಲಕ ಅನಿಮೆ ಹುಡುಕಿ...',
    searchListening: '🎙️ ಕೇಳುತ್ತಿದೆ...',
    regionalDubAudio: 'ಪ್ರಾದೇಶಿಕ ಡಬ್ ಆಡಿಯೋ',
    resetFilters: 'ಫಿಲ್ಟರ್‌ಗಳನ್ನು ಮರುಹೊಂದಿಸಿ',
    allLanguages: 'ಎಲ್ಲಾ',
    swipeHint: '💡 ಮತ ಚಲಾಯಿಸಲು ಬಲಕ್ಕೆ ಸ್ವೈಪ್ ಮಾಡಿ 🔥',

    recentlyViewedTitle: 'ಇತ್ತೀಚೆಗೆ ವೀಕ್ಷಿಸಿದವು',
    clearHistory: 'ಇತಿಹಾಸವನ್ನು ತೆರವುಗೊಳಿಸಿ',
    noRecentlyViewed: 'ಇತ್ತೀಚೆಗೆ ವೀಕ್ಷಿಸಿದ ಅನಿಮೆಗಳಿಲ್ಲ.',

    forYouTitle: 'ನಿಮ್ಮಗಾಗಿ ವಿಶೇಷ',
    forYouSubtitle: 'ನಿಮ್ಮ ವೀಕ್ಷಣೆ ಪಟ್ಟಿಯ ಆಧಾರದ ಮೇಲೆ ಶಿಫಾರಸುಗಳು',
    forYouLanguageMatch: 'ನೆಚ್ಚಿನ ಡಬ್ ಭಾಷೆ',
    forYouTopGenres: 'ಪ್ರಮುಖ ಪ್ರಕಾರಗಳು',
    forYouEmpty: 'ಹೆಚ್ಚಿನ ಶಿಫಾರಸುಗಳಿಗಾಗಿ ಅನಿಮೆಗಳನ್ನು ಸೇರಿಸಿ!',

    loadingBatch: 'ಅನಿಮೆಗಳನ್ನು ಲೋಡ್ ಮಾಡಲಾಗುತ್ತಿದೆ...',
    allLoaded: 'ಎಲ್ಲಾ ಅನಿಮೆಗಳು ಲೋಡ್ ಆಗಿವೆ',
    showingTitles: 'ತೋರಿಸಲಾಗುತ್ತಿದೆ',
    ofTitles: '/',
    approvedDubs: 'ಡಬ್ ಸರಣಿ',

    profileModalTitle: 'ಒಟಾಕು ಪ್ರೊಫೈಲ್',
    profileModalSubtitle: 'ನಿಮ್ಮ ಮೆಚ್ಚಿನ ಅನಿಮೆ ಪಾತ್ರವನ್ನು ಆಯ್ಕೆಮಾಡಿ',
    yourNickname: 'ನಿಮ್ಮ ಅಡ್ಡಹೆರು',
    favoriteDubLanguage: 'ನೆಚ್ಚಿನ ಡಬ್ ಭಾಷೆ',
    shareProfile: 'ಪ್ರೊಫೈಲ್ ಹಂಚಿಕೊಳ್ಳಿ',
    cancel: 'ರದ್ದುಮಾಡಿ',
    saveProfile: 'ಪ್ರೊಫೈಲ್ ಉಳಿಸಿ',
    saveProfileAndTheme: 'ಪ್ರೊಫೈಲ್ ಉಳಿಸಿ',

    backupSectionTitle: 'ಬ್ಯಾಕಪ್ ಮತ್ತು ಮರುಸ್ಥಾಪನೆ',
    backupSectionSubtitle: 'ನಿಮ್ಮ ಪಟ್ಟಿಯನ್ನು ಬ್ಯಾಕಪ್ ಮಾಡಿ',
    exportBackupBtn: 'ಡೇಟಾ ರಫ್ತು ಮಾಡಿ (.json)',
    importBackupBtn: 'ಡೇಟಾ ಆಮದು ಮಾಡಿ (.json)',
    exportSuccess: 'ಬ್ಯಾಕಪ್ ಯಶಸ್ವಿಯಾಗಿ ಡೌನ್‌ಲೋಡ್ ಆಗಿದೆ!',
    importSuccess: 'ಪ್ರೊಫೈಲ್ ಯಶಸ್ವಿಯಾಗಿ ಮರುಸ್ಥಾಪಿಸಲಾಗಿದೆ!',
    importInvalid: 'ಅಮಾನ್ಯ ಬ್ಯಾಕಪ್ ಕಡತ.',

    cloudTabTitle: 'ಕ್ಲೌಡ್ ಸಿಂಕ್',
    identityTabTitle: 'ಪ್ರೊಫೈಲ್',
    cloudUsername: 'ಬಳಕೆದಾರ ಹೆಸರು',
    cloudPassword: 'ಪಾಸ್‌ವರ್ಡ್',
    cloudBackupBtn: 'ಕ್ಲೌಡ್‌ನಲ್ಲಿ ಉಳಿಸಿ',
    cloudRestoreBtn: 'ಕ್ಲೌಡ್‌ನಿಂದ ಮರುಸ್ಥಾಪಿಸಿ',
    cloudSyncSubtitle: 'ಸುರಕ್ಷಿತ ಕ್ಲೌಡ್‌ನಲ್ಲಿ ಸಿಂಕ್ ಮಾಡಿ.',
    cloudSafeNote: 'ಗೌಪ್ಯತೆ: ಇಮೇಲ್ ಅಗತ್ಯವಿಲ್ಲ.',

    heroBadge: 'ಭಾರತದ ಅತಿ ದೊಡ್ಡ ಪ್ರಾದೇಶಿಕ ಅನಿಮೆ ಡಬ್ ಗೈಡ್',
    heroTitlePart1: 'ನಿಮ್ಮ ಮೆಚ್ಚಿನ ಭಾಷೆಯಲ್ಲಿ',
    heroTitlePart2: 'ಅನಿಮೆಗಳನ್ನು ಹುಡುಕಿ',
    heroSubtitle: 'ಕನ್ನಡ, ತಮಿಳು, ತೆಲುಗು, ಹಿಂದಿ ಮತ್ತು ಮಲಯಾಳಂ ಭಾಷೆಗಳಲ್ಲಿ ಡಬ್ ಮಾಡಲಾದ ಅನಿಮೆಗಳು.',
    surpriseMe: 'ಸರ್ಪ್ರೈಸ್ ಮೀ',
    randomPick: 'ಯಾದೃಚ್ಛಿಕ ಆಯ್ಕೆ',
    statsAnime: 'ಡಬ್ ಶೀರ್ಷಿಕೆಗಳು',
    statsUpvotes: 'ಸಮುದಾಯ ಮತಗಳು',
    statsLanguages: 'ಭಾರತೀಯ ಭಾಷೆಗಳು',

    langToggleLabel: 'ಭಾಷೆ',
    langEn: 'English',
    langTa: 'ಕನ್ನಡ',
  },
};

export type TranslationKey = keyof typeof TRANSLATIONS.en;

/**
 * Map favorite dub language to SupportedLanguage code
 */
export function mapDubLanguageToUiLang(dubLang: string): SupportedLanguage {
  const normalized = String(dubLang || '').toLowerCase().trim();
  if (normalized.includes('telugu') || normalized === 'te') return 'te';
  if (normalized.includes('hindi') || normalized === 'hi') return 'hi';
  if (normalized.includes('malayalam') || normalized === 'ml') return 'ml';
  if (normalized.includes('kannada') || normalized === 'kn') return 'kn';
  if (normalized.includes('tamil') || normalized === 'ta') return 'ta';
  return 'en';
}

/**
 * Get current UI language from localStorage (defaults to 'en')
 */
export function getSavedUiLanguage(): SupportedLanguage {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('anidub_ui_lang');
      if (saved && ['en', 'ta', 'te', 'hi', 'ml', 'kn'].includes(saved)) {
        return saved as SupportedLanguage;
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
