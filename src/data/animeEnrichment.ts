import { CharacterVoiceActor, DubLanguage } from '../types/anime';

export interface AnimeEnrichmentInfo {
  originalReleaseDate: string;
  themes: string[];
  characters: CharacterVoiceActor[];
}

export const ANIME_ENRICHMENT_MAP: Record<string, AnimeEnrichmentInfo> = {
  'solo-leveling': {
    originalReleaseDate: 'January 7, 2024',
    themes: ['Underdog to OP', 'Dungeon Crawling', 'Monsters & Hunters', 'Leveling System', 'Revenge'],
    characters: [
      {
        characterName: 'Sung Jin-woo',
        role: 'Main',
        characterImage: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=300&auto=format&fit=crop&q=80',
        japaneseVA: 'Taito Ban',
        indianVA: { language: 'Tamil', actor: 'Pravin Kumar (Crunchyroll Tamil)' },
      },
      {
        characterName: 'Cha Hae-in',
        role: 'Main',
        characterImage: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=300&auto=format&fit=crop&q=80',
        japaneseVA: 'Reina Ueda',
        indianVA: { language: 'Hindi', actor: 'Pooja Punjabi' },
      },
      {
        characterName: 'Go Gun-hee',
        role: 'Supporting',
        characterImage: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=300&auto=format&fit=crop&q=80',
        japaneseVA: 'Banjou Ginga',
        indianVA: { language: 'Telugu', actor: 'Suresh Babu' },
      },
      {
        characterName: 'Woo Jin-chul',
        role: 'Supporting',
        characterImage: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=300&auto=format&fit=crop&q=80',
        japaneseVA: 'Makoto Furukawa',
      },
    ],
  },
  'demon-slayer': {
    originalReleaseDate: 'April 6, 2019',
    themes: ['Demons & Exorcism', 'Dark Fantasy', 'Family Bonds', 'Martial Arts Swordsmanship', 'Historical Taisho'],
    characters: [
      {
        characterName: 'Tanjiro Kamado',
        role: 'Main',
        characterImage: 'https://images.unsplash.com/photo-1569003339405-ea396a5a8a90?w=300&auto=format&fit=crop&q=80',
        japaneseVA: 'Natsuki Hanae',
        indianVA: { language: 'Hindi', actor: 'Suraj Sonik' },
      },
      {
        characterName: 'Nezuko Kamado',
        role: 'Main',
        characterImage: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=300&auto=format&fit=crop&q=80',
        japaneseVA: 'Akari Kito',
        indianVA: { language: 'Tamil', actor: 'Divya S.' },
      },
      {
        characterName: 'Zenitsu Agatsuma',
        role: 'Main',
        characterImage: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=300&auto=format&fit=crop&q=80',
        japaneseVA: 'Hiro Shimono',
        indianVA: { language: 'Telugu', actor: 'Ravi Teja V.' },
      },
      {
        characterName: 'Inosuke Hashibira',
        role: 'Main',
        characterImage: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=300&auto=format&fit=crop&q=80',
        japaneseVA: 'Yoshitsugu Matsuoka',
      },
    ],
  },
  'jujutsu-kaisen': {
    originalReleaseDate: 'October 3, 2020',
    themes: ['Cursed Energy & Spirits', 'Dark Fantasy', 'Super Power', 'High-Stakes Combat', 'School Life'],
    characters: [
      {
        characterName: 'Yuji Itadori',
        role: 'Main',
        characterImage: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=300&auto=format&fit=crop&q=80',
        japaneseVA: 'Junya Enoki',
        indianVA: { language: 'Hindi', actor: 'Vidit Kumar' },
      },
      {
        characterName: 'Satoru Gojo',
        role: 'Main',
        characterImage: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&auto=format&fit=crop&q=80',
        japaneseVA: 'Yuichi Nakamura',
        indianVA: { language: 'Tamil', actor: 'Karthik Raja' },
      },
      {
        characterName: 'Megumi Fushiguro',
        role: 'Main',
        characterImage: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=300&auto=format&fit=crop&q=80',
        japaneseVA: 'Yuma Uchida',
        indianVA: { language: 'Telugu', actor: 'Naveen Kumar' },
      },
      {
        characterName: 'Nobara Kugisaki',
        role: 'Main',
        characterImage: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=300&auto=format&fit=crop&q=80',
        japaneseVA: 'Asami Seto',
      },
    ],
  },
  'attack-on-titan': {
    originalReleaseDate: 'April 7, 2013',
    themes: ['Survival & War', 'Dark Fantasy', 'Mystery & Lore', 'Military & Politics', 'High Stakes'],
    characters: [
      {
        characterName: 'Eren Yeager',
        role: 'Main',
        characterImage: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&auto=format&fit=crop&q=80',
        japaneseVA: 'Yuki Kaji',
        indianVA: { language: 'Hindi', actor: 'Lohit Sharma' },
      },
      {
        characterName: 'Mikasa Ackerman',
        role: 'Main',
        characterImage: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=300&auto=format&fit=crop&q=80',
        japaneseVA: 'Yui Ishikawa',
        indianVA: { language: 'Tamil', actor: 'Ananya Ramesh' },
      },
      {
        characterName: 'Levi Ackerman',
        role: 'Main',
        characterImage: 'https://images.unsplash.com/photo-1560972550-aba3456b5564?w=300&auto=format&fit=crop&q=80',
        japaneseVA: 'Hiroshi Kamiya',
        indianVA: { language: 'Telugu', actor: 'Chaitanya V.' },
      },
    ],
  },
  'blue-lock': {
    originalReleaseDate: 'October 9, 2022',
    themes: ['Sports Tournament', 'Ego & Rivalry', 'High Stakes Survival', 'Psychological Battles', 'Teamwork & Solo'],
    characters: [
      {
        characterName: 'Yoichi Isagi',
        role: 'Main',
        characterImage: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=300&auto=format&fit=crop&q=80',
        japaneseVA: 'Kazuki Ura',
        indianVA: { language: 'Tamil', actor: 'Ganesh Nathan' },
      },
      {
        characterName: 'Meguru Bachira',
        role: 'Main',
        characterImage: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=300&auto=format&fit=crop&q=80',
        japaneseVA: 'Tasuku Kaito',
        indianVA: { language: 'Telugu', actor: 'Kiran Deep' },
      },
      {
        characterName: 'Jinpachi Ego',
        role: 'Main',
        characterImage: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=300&auto=format&fit=crop&q=80',
        japaneseVA: 'Hiroshi Kamiya',
        indianVA: { language: 'Hindi', actor: 'Sanjay Kulkarni' },
      },
    ],
  },
  'spy-x-family': {
    originalReleaseDate: 'April 9, 2022',
    themes: ['Espionage & Family', 'Wholesome & Comedy', 'Mind Reading & Telepathy', 'Secret Identity', 'School Life'],
    characters: [
      {
        characterName: 'Loid Forger (Twilight)',
        role: 'Main',
        characterImage: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=300&auto=format&fit=crop&q=80',
        japaneseVA: 'Takuya Eguchi',
        indianVA: { language: 'Hindi', actor: 'Sahil Vaid' },
      },
      {
        characterName: 'Anya Forger',
        role: 'Main',
        characterImage: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=300&auto=format&fit=crop&q=80',
        japaneseVA: 'Atsumi Tanezaki',
        indianVA: { language: 'Tamil', actor: 'Shruthi Priya' },
      },
      {
        characterName: 'Yor Forger (Thorn Princess)',
        role: 'Main',
        characterImage: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=300&auto=format&fit=crop&q=80',
        japaneseVA: 'Saori Hayami',
        indianVA: { language: 'Telugu', actor: 'Deepika S.' },
      },
    ],
  },
  'one-piece': {
    originalReleaseDate: 'October 20, 1999',
    themes: ['Pirates & High Seas', 'Friendship & Nakama', 'Grand Adventure', 'Freedom vs Oppression', 'Super Power'],
    characters: [
      {
        characterName: 'Monkey D. Luffy',
        role: 'Main',
        characterImage: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&auto=format&fit=crop&q=80',
        japaneseVA: 'Mayumi Tanaka',
        indianVA: { language: 'Tamil', actor: 'Balaji K.' },
      },
      {
        characterName: 'Roronoa Zoro',
        role: 'Main',
        characterImage: 'https://images.unsplash.com/photo-1560972550-aba3456b5564?w=300&auto=format&fit=crop&q=80',
        japaneseVA: 'Kazuya Nakai',
        indianVA: { language: 'Hindi', actor: 'Manoj Pandey' },
      },
      {
        characterName: 'Nami',
        role: 'Main',
        characterImage: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=300&auto=format&fit=crop&q=80',
        japaneseVA: 'Akemi Okamura',
      },
    ],
  },
  'death-note': {
    originalReleaseDate: 'October 4, 2006',
    themes: ['Mind Games & Strategy', 'Cat & Mouse Thriller', 'Supernatural Morality', 'Psychological', 'Shinigami'],
    characters: [
      {
        characterName: 'Light Yagami (Kira)',
        role: 'Main',
        characterImage: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=300&auto=format&fit=crop&q=80',
        japaneseVA: 'Mamoru Miyano',
        indianVA: { language: 'Hindi', actor: 'Sanket Mhatre' },
      },
      {
        characterName: 'L Lawliet',
        role: 'Main',
        characterImage: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=300&auto=format&fit=crop&q=80',
        japaneseVA: 'Kappei Yamaguchi',
        indianVA: { language: 'Tamil', actor: 'Sriram Raman' },
      },
      {
        characterName: 'Ryuk',
        role: 'Main',
        characterImage: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=300&auto=format&fit=crop&q=80',
        japaneseVA: 'Shidou Nakamura',
      },
    ],
  },
  'frieren': {
    originalReleaseDate: 'September 29, 2023',
    themes: ['Quiet Pilgrimage', 'Elven Longevity', 'Bittersweet Memories', 'Magic & Humanity', 'Fantasy Journey'],
    characters: [
      {
        characterName: 'Frieren',
        role: 'Main',
        characterImage: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&auto=format&fit=crop&q=80',
        japaneseVA: 'Atsumi Tanezaki',
        indianVA: { language: 'Tamil', actor: 'Meera Krishnan' },
      },
      {
        characterName: 'Fern',
        role: 'Main',
        characterImage: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=300&auto=format&fit=crop&q=80',
        japaneseVA: 'Kana Ichinose',
        indianVA: { language: 'Hindi', actor: 'Urvi Ashar' },
      },
      {
        characterName: 'Stark',
        role: 'Main',
        characterImage: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=300&auto=format&fit=crop&q=80',
        japaneseVA: 'Chiaki Kobayashi',
        indianVA: { language: 'Telugu', actor: 'Tarun Kumar' },
      },
    ],
  },
  'naruto': {
    originalReleaseDate: 'October 3, 2002',
    themes: ['Underdog to Hokage', 'Ninja World & Jutsu', 'Bonds & Betrayal', 'Hard Work vs Destiny', 'Martial Arts'],
    characters: [
      {
        characterName: 'Naruto Uzumaki',
        role: 'Main',
        characterImage: 'https://images.unsplash.com/photo-1569003339405-ea396a5a8a90?w=300&auto=format&fit=crop&q=80',
        japaneseVA: 'Junko Takeuchi',
        indianVA: { language: 'Hindi', actor: 'Vinod Kulkarni / Pooja Punjabi' },
      },
      {
        characterName: 'Sasuke Uchiha',
        role: 'Main',
        characterImage: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=300&auto=format&fit=crop&q=80',
        japaneseVA: 'Noriaki Sugiyama',
        indianVA: { language: 'Tamil', actor: 'Vigneshwaran' },
      },
      {
        characterName: 'Kakashi Hatake',
        role: 'Main',
        characterImage: 'https://images.unsplash.com/photo-1560972550-aba3456b5564?w=300&auto=format&fit=crop&q=80',
        japaneseVA: 'Kazuhiko Inoue',
        indianVA: { language: 'Telugu', actor: 'Sanjay Swaroop' },
      },
    ],
  },
  'dandadan': {
    originalReleaseDate: 'October 4, 2024',
    themes: ['Ghosts & Aliens', 'Occult Rom-Com', 'High-Speed Action', 'Supernatural Battles', 'Crazy Comedy'],
    characters: [
      {
        characterName: 'Momo Ayase',
        role: 'Main',
        characterImage: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=300&auto=format&fit=crop&q=80',
        japaneseVA: 'Shion Wakayama',
        indianVA: { language: 'Hindi', actor: 'Rupali Ghosh' },
      },
      {
        characterName: 'Ken Takakura (Okarun)',
        role: 'Main',
        characterImage: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=300&auto=format&fit=crop&q=80',
        japaneseVA: 'Natsuki Hanae',
        indianVA: { language: 'Tamil', actor: 'Vijay Anand' },
      },
      {
        characterName: 'Turbo Granny',
        role: 'Supporting',
        characterImage: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&auto=format&fit=crop&q=80',
        japaneseVA: 'Mayumi Tanaka',
      },
    ],
  },
  'one-punch-man': {
    originalReleaseDate: 'October 5, 2015',
    themes: ['Overpowered Hero Parody', 'Hilarious Boredom', 'Hero Association', 'Monster Attacks', 'Epic Fights'],
    characters: [
      {
        characterName: 'Saitama',
        role: 'Main',
        characterImage: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=300&auto=format&fit=crop&q=80',
        japaneseVA: 'Makoto Furukawa',
        indianVA: { language: 'Hindi', actor: 'Anurag Sharma' },
      },
      {
        characterName: 'Genos (Demon Cyborg)',
        role: 'Main',
        characterImage: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=300&auto=format&fit=crop&q=80',
        japaneseVA: 'Kaito Ishikawa',
        indianVA: { language: 'Tamil', actor: 'Ashwin Kumar' },
      },
    ],
  },
  'suzume': {
    originalReleaseDate: 'November 11, 2022',
    themes: ['Disaster & Doors', 'Supernatural Road Trip', 'Mythical Cat & Chair', 'Coming of Age', 'Healing Grief'],
    characters: [
      {
        characterName: 'Suzume Iwato',
        role: 'Main',
        characterImage: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=300&auto=format&fit=crop&q=80',
        japaneseVA: 'Nanoka Hara',
        indianVA: { language: 'Hindi', actor: 'Ketaki Mategaonkar' },
      },
      {
        characterName: 'Souta Munakata',
        role: 'Main',
        characterImage: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=300&auto=format&fit=crop&q=80',
        japaneseVA: 'Hokuto Matsumura',
        indianVA: { language: 'Tamil', actor: 'Raghavan S.' },
      },
    ],
  },
  'vinland-saga': {
    originalReleaseDate: 'July 7, 2019',
    themes: ['Vikings & War', 'Revenge to Pacifism', 'Historical Brutality', 'Warrior Code', 'True Warrior'],
    characters: [
      {
        characterName: 'Thorfinn Karlsefni',
        role: 'Main',
        characterImage: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&auto=format&fit=crop&q=80',
        japaneseVA: 'Yuto Uemura',
        indianVA: { language: 'Hindi', actor: 'Vaibhav Thakkar' },
      },
      {
        characterName: 'Askeladd',
        role: 'Main',
        characterImage: 'https://images.unsplash.com/photo-1560972550-aba3456b5564?w=300&auto=format&fit=crop&q=80',
        japaneseVA: 'Naoya Uchida',
        indianVA: { language: 'Tamil', actor: 'Selva Kumar' },
      },
    ],
  },
  'chainsaw-man': {
    originalReleaseDate: 'October 12, 2022',
    themes: ['Devil Hunters & Chainsaws', 'Gritty & Chaotic', 'Dark Fantasy', 'Survival', 'Tragic Ambition'],
    characters: [
      {
        characterName: 'Denji',
        role: 'Main',
        characterImage: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=300&auto=format&fit=crop&q=80',
        japaneseVA: 'Kikunosuke Toya',
        indianVA: { language: 'Telugu', actor: 'Ajay Varma' },
      },
      {
        characterName: 'Makima',
        role: 'Main',
        characterImage: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=300&auto=format&fit=crop&q=80',
        japaneseVA: 'Tomori Kusunoki',
        indianVA: { language: 'Hindi', actor: 'Kavita Kaushik' },
      },
    ],
  },
};

// General themes list for recommendation wizard
export const ALL_RECOMMENDATION_THEMES = [
  'Underdog to OP',
  'Dark Fantasy',
  'Mind Games & Strategy',
  'High Stakes Survival',
  'Sports Tournament',
  'Espionage & Family',
  'Demons & Exorcism',
  'Cursed Energy & Spirits',
  'Revenge',
  'Grand Adventure',
  'Wholesome Romance',
  'Overpowered Hero Parody',
  'Reincarnation / Isekai',
  'Ghosts & Aliens',
  'Vikings & War',
  'Disaster & Doors',
  'Dungeon Crawling',
  'School Life & Youth',
  'Magic & Humanity',
  'Quiet Pilgrimage',
];
