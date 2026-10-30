export const ANIME_CHARACTERS = [
  'Tanjiro', 'Nezuko', 'Zenitsu', 'Inosuke', 'Giyu', 'Rengoku', 'Tengen', 'Muzan', 'Akaza', 'Shinobu',
  'Goku', 'Vegeta', 'Gohan', 'Piccolo', 'Trunks', 'Frieza', 'Beerus', 'Bulma', 'Krillin', 'Broly',
  'Luffy', 'Zoro', 'Sanji', 'Nami', 'Robin', 'Chopper', 'Franky', 'Brook', 'Jinbe', 'Shanks',
  'Naruto', 'Sasuke', 'Kakashi', 'Itachi', 'Madara', 'Minato', 'Hinata', 'Jiraiya', 'Gaara', 'Shikamaru',
  'Gojo', 'Sukuna', 'Yuji', 'Megumi', 'Nobara', 'Nanami', 'Toji', 'Geto', 'Maki', 'Inumaki',
  'Eren', 'Mikasa', 'Armin', 'Levi', 'Erwin', 'Hange', 'Reiner', 'Zeke', 'Jean', 'Sasha',
  'Denji', 'Makima', 'Power', 'Aki', 'Himeno', 'Kobeni', 'Kishibe', 'Quanxi', 'Reze',
  'Asta', 'Yuno', 'Noelle', 'Yami', 'Julius', 'Magna', 'Luck', 'Charmy', 'Finral', 'Gauche',
  'Bojji', 'Kage', 'Daida', 'Hiling', 'Domas', 'Bein', 'Ouken', 'Miranja', 'Desha', 'Seyn'
];

export const INDIAN_REGIONS = [
  'Delhi', 'Chennai', 'Mumbai', 'Bengaluru', 'Kolkata', 'Hyderabad', 'Kerala', 'Pune',
  'Ahmedabad', 'Jaipur', 'Lucknow', 'Patna', 'Varanasi', 'Chandigarh', 'Goa',
  'Surat', 'Indore', 'Bhopal', 'Visakhapatnam', 'Coimbatore', 'Madurai', 'Mysuru', 'Mangaluru',
  'Kochi', 'Thiruvananthapuram', 'Kozhikode', 'Thrissur', 'Guwahati', 'Shillong', 'Imphal', 'Aizawl',
  'Bhubaneswar', 'Cuttack', 'Rourkela', 'Puri', 'Nagpur', 'Nashik', 'Aurangabad', 'Solapur',
  'Vadodara', 'Rajkot', 'Gandhinagar', 'Jodhpur', 'Udaipur', 'Ajmer', 'Kota',
  'Kanpur', 'Agra', 'Meerut', 'Prayagraj', 'Noida', 'Gurugram', 'Dehradun', 'Haridwar',
  'Srinagar', 'Jammu', 'Leh', 'Amritsar', 'Ludhiana', 'Jalandhar', 'Patiala'
];

export function generateRandomUsername(): string {
  try {
    const saved = localStorage.getItem('anidub_guest_chat_name');
    if (saved && saved.trim() && !saved.includes('Indian Anime Fan')) {
      return saved.trim();
    }
    const char = ANIME_CHARACTERS[Math.floor(Math.random() * ANIME_CHARACTERS.length)];
    const region = INDIAN_REGIONS[Math.floor(Math.random() * INDIAN_REGIONS.length)];
    const suffix = Math.floor(Math.random() * 90000 + 10000);
    const generated = `${char}_${region}_${suffix}`;
    localStorage.setItem('anidub_guest_chat_name', generated);
    return generated;
  } catch {
    return `AnimeFan_IN_${Math.floor(Math.random() * 90000 + 10000)}`;
  }
}
