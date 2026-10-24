export type SupportedLanguage = 'en' | 'ja' | 'es' | 'hi' | 'zh' | 'ko' | 'ta';

export const translate = (key: string, lang: SupportedLanguage = 'en'): string => {
  const translations: Record<string, Partial<Record<SupportedLanguage, string>>> = {
    'hero.title': {
      en: 'Discover Anime in Supreme Dubs',
      ja: '最高のダブでアニメを発見',
      es: 'Descubre anime en doblajes supremos',
      hi: 'सुप्रीम डब में एनीमे खोजें',
      zh: '探索最高配音动画',
      ko: '최고의 더빙으로 애니메이션 발견',
      ta: 'சுப்ரீம் டப்பில் அனிமேவைக் கண்டறியுங்கள்',
    },
    'hero.subtitle': {
      en: 'Explore the ultimate collection of dubbed anime across Tamil, Hindi, Telugu, Malayalam, and Kannada.',
      ja: 'タミル語、ヒンディー語、テルグ語、マラヤーラム語、カンナダ語の吹き替えアニメの究極のコレクションを探索します。',
      es: 'Explora la colección definitiva de anime doblado en tamil, hindi, telugu, malayalam y canarés.',
      hi: 'तमिल, हिंदी, तेलुगु, मलयालम और कन्नड़ में डब किए गए एनीमे के अंतिम संग्रह का अन्वेषण करें।',
      zh: '探索泰米尔语、印地语、泰卢固语、马拉雅拉姆语和卡纳达语配音动漫的终极合集。',
      ko: '타밀어, 힌디어, 텔루구어, 말라얄람어, 칸나다어 더빙 애니메이션의 궁극의 컬렉션을 탐색하세요.',
      ta: 'தமிழ், இந்தி, தெலுங்கு, மலையாளம் மற்றும் கன்னடத்தில் டப் செய்யப்பட்ட அனிமேஷன் சேகரிப்பை ஆராயுங்கள்.',
    },
    'surpriseMe': {
      en: 'Surprise Me',
      ta: 'ஆச்சரியப்படுங்கள்',
    },
    'randomPick': {
      en: 'Random Pick',
      ta: 'சீரற்ற தேர்வு',
    },
  };
  return translations[key]?.[lang] || translations[key]?.['en'] || key;
};
