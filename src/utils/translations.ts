export type LanguageCode = 'en' | 'ta' | 'te' | 'hi' | 'ml' | 'kn' | 'bn' | 'mr';

export interface TranslationSet {
  hero_title: string;
  hero_subtitle: string;
  surprise_me: string;
  search_placeholder: string;
  catalog_title: string;
  trending_now: string;
  for_you: string;
  watchlist: string;
  schedule: string;
  profile: string;
  tier_list: string;
  create_list: string;
  sync: string;
  language_display: string;
}

export const TRANSLATIONS: Record<LanguageCode, TranslationSet> = {
  en: {
    hero_title: 'The Premier Destination for Anime Streaming & Dubbing in India',
    hero_subtitle: 'Official Indian Dubbed Anime Directory',
    surprise_me: 'Surprise Me Roulette',
    search_placeholder: 'Search anime dubs...',
    catalog_title: 'Anime Catalog',
    trending_now: 'Trending Now',
    for_you: 'Recommended For You',
    watchlist: 'My Saved Anime',
    schedule: 'Weekly Schedule',
    profile: 'User Profile',
    tier_list: 'Anime Tier List',
    create_list: 'Create List',
    sync: 'Sync',
    language_display: 'Audio & Display'
  },
  ta: {
    hero_title: 'இந்தியாவின் முதன்மையான அனிம் ஸ்ட்ரீமிங் மற்றும் டப்பிங் தளம்',
    hero_subtitle: 'அதிகாரப்பூர்வ இந்திய டப்பிங் அனிம் அடைவு',
    surprise_me: 'ஆச்சரியப்படுத்தும் அனிம்',
    search_placeholder: 'அனிம் தேடுங்கள்...',
    catalog_title: 'அனிம் அட்டவணை',
    trending_now: 'தற்போது டிரெண்டிங்கில்',
    for_you: 'உங்களுக்காகப் பரிந்துரைக்கப்படுகிறது',
    watchlist: 'எனது சேமிப்புகள்',
    schedule: 'வாராந்திர அட்டவணை',
    profile: 'பயனர் சுயவிவரம்',
    tier_list: 'அனிம் தரவரிசை',
    create_list: 'பட்டியலை உருவாக்கு',
    sync: 'ஒத்திசை',
    language_display: 'ஆடியோ மற்றும் காட்சி'
  },
  te: {
    hero_title: 'భారతదేశపు ప్రీమియర్ అనిమే స్ట్రీమింగ్ & డబ్బింగ్ డెస్టినేషన్',
    hero_subtitle: 'అధికారిక భారతీయ డబ్బింగ్ అనిమే డైరెక్టరీ',
    surprise_me: 'నన్ను ఆశ్చర్యపరచు',
    search_placeholder: 'అనిమే కోసం వెతకండి...',
    catalog_title: 'అనిమే కాటలాగ్',
    trending_now: 'ట్రెండింగ్‌లో ఉంది',
    for_you: 'మీ కోసం సిఫార్సు చేయబడింది',
    watchlist: 'నా పొదుపులు',
    schedule: 'వారపు షెడ్యూల్',
    profile: 'వినియోగదారు ప్రొఫైల్',
    tier_list: 'అనిమే టీర్ లిస్ట్',
    create_list: 'లిస్ట్ సృష్టించండి',
    sync: 'సింక్',
    language_display: 'ఆడియో & డిస్‌ప్లే'
  },
  hi: {
    hero_title: 'भारत में एनीमे स्ट्रीमिंग और डबिंग का प्रमुख गंतव्य',
    hero_subtitle: 'आधिकारिक भारतीय डब एनीमे निर्देशिका',
    surprise_me: 'मुझे आश्चर्यचकित करें',
    search_placeholder: 'एनीमे खोजें...',
    catalog_title: 'एनीमे कैटलॉग',
    trending_now: 'अभी चलन में है',
    for_you: 'आपके लिए अनुशंसित',
    watchlist: 'मेरी बचत',
    schedule: 'साप्ताहिक अनुसूची',
    profile: 'उपयोगकर्ता प्रोफ़ाइल',
    tier_list: 'एनीमे टियर सूची',
    create_list: 'सूची बनाएं',
    sync: 'सिंक करें',
    language_display: 'ऑडियो और डिस्प्ले'
  },
  ml: {
    hero_title: 'ഇന്ത്യയിലെ പ്രീമിയർ ആനിമേഷൻ സ്ട്രീമിംഗും ഡബ്ബിംഗും',
    hero_subtitle: 'ഔദ്യോഗിക ഇന്ത്യൻ ഡബ്ബ് ചെയ്ത ആനിമേഷൻ ഡയറക്ടറി',
    surprise_me: 'എന്നെ അത്ഭുതപ്പെടുത്തുക',
    search_placeholder: 'ആനിമേഷൻ തിരയുക...',
    catalog_title: 'ആനിമേഷൻ കാറ്റലോഗ്',
    trending_now: 'ഇപ്പോൾ ട്രെൻഡിംഗിൽ',
    for_you: 'നിങ്ങൾക്കായി ശുപാർശ ചെയ്യുന്നത്',
    watchlist: 'എന്റെ സേവിംഗുകൾ',
    schedule: 'പ്രതിവാര ഷെഡ്യൂൾ',
    profile: 'പ്രൊഫൈൽ',
    tier_list: 'ആനിമേഷൻ റാങ്കിംഗ്',
    create_list: 'ലിസ്റ്റ് ഉണ്ടാക്കുക',
    sync: 'സിങ്ക്',
    language_display: 'ഓഡിയോ & ഡിസ്‌പ്ലേ'
  },
  kn: {
    hero_title: 'ಭಾರತದ ಪ್ರೀಮಿಯರ್ ಅನಿಮೆ ಸ್ಟ್ರೀಮಿಂಗ್ ಮತ್ತು ಡಬ್ಬಿಂಗ್ ತಾಣ',
    hero_subtitle: 'ಅಧಿಕೃತ ಭಾರತೀಯ ಡಬ್ಬಿಂಗ್ ಅನಿಮೆ ಡೈರೆಕ್ಟರಿ',
    surprise_me: 'ನನ್ನನ್ನು ಆಶ್ಚರ್ಯಗೊಳಿಸಿ',
    search_placeholder: 'ಅನಿಮೆ ಹುಡುಕಿ...',
    catalog_title: 'ಅನಿಮೆ ಕ್ಯಾಟಲಾಗ್',
    trending_now: 'ಈಗ ಟ್ರೆಂಡಿಂಗ್‌ನಲ್ಲಿದೆ',
    for_you: 'ನಿಮಗಾಗಿ ಶಿಫಾರಸು ಮಾಡಲಾಗಿದೆ',
    watchlist: 'ನನ್ನ ಉಳಿತಾಯಗಳು',
    schedule: 'ಸಾಪ್ತಾಹಿಕ ವೇಳಾಪಟ್ಟಿ',
    profile: 'ಪ್ರೊಫೈಲ್',
    tier_list: 'ಅನಿಮೆ ಶ್ರೇಯಾಂಕ',
    create_list: 'ಪಟ್ಟಿಯನ್ನು ರಚಿಸಿ',
    sync: 'ಸಿಂಕ್ ಮಾಡಿ',
    language_display: 'ಆಡಿಯೋ ಮತ್ತು ಪ್ರದರ್ಶನ'
  },
  bn: {
    hero_title: 'ভারতের প্রিমিয়ার অ্যানিমে স্ট্রিমিং এবং ডাবিং গন্তব্য',
    hero_subtitle: 'অফিসিয়াল ভারতীয় ডাব করা অ্যানিমে ডিরেক্টরি',
    surprise_me: 'আমাকে অবাক করুন',
    search_placeholder: 'অ্যানিমে খুঁজুন...',
    catalog_title: 'অ্যানিমে ক্যাটালগ',
    trending_now: 'এখন ট্রেন্ডিং',
    for_you: 'আপনার জন্য প্রস্তাবিত',
    watchlist: 'আমার সঞ্চয়',
    schedule: 'সাপ্তাহিক সময়সূচী',
    profile: 'প্রোফাইল',
    tier_list: 'অ্যানিমে র‍্যাঙ্কিং',
    create_list: 'তালিকা তৈরি করুন',
    sync: 'সিঙ্ক করুন',
    language_display: 'অডিও এবং ডিসপ্লে'
  },
  mr: {
    hero_title: 'भारतातील प्रीमियर ॲनिमे स्ट्रीमिंग आणि डबिंग डेस्टिनेशन',
    hero_subtitle: 'अधिकृत भारतीय डब ॲनिमे डिरेक्टरी',
    surprise_me: 'मला चकित करा',
    search_placeholder: 'ॲनिमे शोधा...',
    catalog_title: 'ॲनिमे कॅटलॉग',
    trending_now: 'सध्या ट्रेंडिंग',
    for_you: 'तुमच्यासाठी शिफारस केलेले',
    watchlist: 'माझी बचत',
    schedule: 'साप्ताहिक वेळापत्रक',
    profile: 'प्रोफाइल',
    tier_list: 'ॲनिमे रँकिंग',
    create_list: 'यादी तयार करा',
    sync: 'सिंक करा',
    language_display: 'ऑडिओ आणि डिस्प्ले'
  }
};

export const LANGUAGES = [
  { code: 'en', native: 'English', english: 'English' },
  { code: 'ta', native: 'தமிழ்', english: 'Tamil' },
  { code: 'te', native: 'తెలుగు', english: 'Telugu' },
  { code: 'hi', native: 'हिन्दी', english: 'Hindi' },
  { code: 'ml', native: 'മലയാളം', english: 'Malayalam' },
  { code: 'kn', native: 'ಕನ್ನಡ', english: 'Kannada' },
  { code: 'bn', native: 'বাংলা', english: 'Bengali' },
  { code: 'mr', native: 'मराठी', english: 'Marathi' },
];
