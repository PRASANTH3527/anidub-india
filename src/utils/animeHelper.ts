import { Anime, CharacterVoiceActor } from '../types/anime';
import { ANIME_DATABASE } from '../data/animeData';
import { ANIME_ENRICHMENT_MAP, ALL_RECOMMENDATION_THEMES } from '../data/animeEnrichment';

// Helper to provide realistic fallback characters based on anime genres/title
const getFallbackCharacters = (anime: Anime): CharacterVoiceActor[] => {
  return [
    {
      characterName: `Protagonist of ${anime.title.split(':')[0]}`,
      role: 'Main',
      characterImage: anime.poster,
      japaneseVA: 'Kenjiro Tsuda / Mamoru Miyano',
      indianVA: {
        language: anime.dubs[0] || 'Tamil',
        actor: 'Leading Indian Dub Voice Artist',
      },
    },
    {
      characterName: 'Key Companion / Rival',
      role: 'Main',
      characterImage: anime.poster,
      japaneseVA: 'Takahiro Sakurai / Saori Hayami',
      indianVA: {
        language: anime.dubs[1] || anime.dubs[0] || 'Hindi',
        actor: 'Featured Regional Voice Artist',
      },
    },
    {
      characterName: 'Mentor / Supporting Ally',
      role: 'Supporting',
      characterImage: anime.poster,
      japaneseVA: 'Takehito Koyasu',
    },
  ];
};

// Returns fully enriched anime list
export const getEnrichedAnimeList = (): Anime[] => {
  return ANIME_DATABASE.map((item) => {
    const enrichment = ANIME_ENRICHMENT_MAP[item.id];
    const defaultDate = `October ${10 + (item.releaseYear % 15)}, ${item.releaseYear}`;
    
    // Auto derive themes from genres if not in enrichment map
    const defaultThemes: string[] = [];
    if (item.genres.includes('Action') || item.genres.includes('Shonen')) {
      defaultThemes.push('Super Power', 'High Stakes Survival');
    }
    if (item.genres.includes('Fantasy') || item.genres.includes('Supernatural')) {
      defaultThemes.push('Dark Fantasy', 'Magic & Humanity');
    }
    if (item.genres.includes('Isekai')) {
      defaultThemes.push('Reincarnation / Isekai', 'Underdog to OP');
    }
    if (item.genres.includes('Romance') || item.genres.includes('Slice of Life')) {
      defaultThemes.push('Wholesome Romance', 'School Life & Youth');
    }
    if (item.genres.includes('Sports')) {
      defaultThemes.push('Sports Tournament', 'Ego & Rivalry');
    }
    if (item.genres.includes('Comedy')) {
      defaultThemes.push('Overpowered Hero Parody');
    }
    if (defaultThemes.length === 0) {
      defaultThemes.push('Grand Adventure');
    }

    return {
      ...item,
      originalReleaseDate: enrichment?.originalReleaseDate || item.originalReleaseDate || defaultDate,
      themes: enrichment?.themes || item.themes || defaultThemes,
      characters: enrichment?.characters || item.characters || getFallbackCharacters(item),
    };
  });
};
