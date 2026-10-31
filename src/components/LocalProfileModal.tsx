import React, { useState } from 'react';
import { 
  User,
  X,
  Check,
  Search,
  Share2,
  Sparkles,
  Zap,
  Languages, 
  ShieldCheck,
  Upload,
  FileUp,
  FileDown
} from 'lucide-react';
import { motion } from 'motion/react';

export interface LocalProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentName?: string;
  onSaveProfile?: (name: string, avatarUrl: string, language: string) => void;
}

// Custom self-contained SVG anime avatar generator (no external APIs or rate limits)
export const getAiAvatarUrl = (characterName: string) => {
  const hash = Array.from(characterName).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const hue1 = (hash * 37) % 360;
  const hue2 = (hue1 + 55) % 360;
  const hue3 = (hue1 + 170) % 360;
  const initials = characterName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <defs>
    <linearGradient id="bg_${hash}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="hsl(${hue1}, 85%, 22%)" />
      <stop offset="100%" stop-color="hsl(${hue2}, 90%, 10%)" />
    </linearGradient>
    <linearGradient id="glow_${hash}" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="hsl(${hue1}, 100%, 65%)" />
      <stop offset="100%" stop-color="hsl(${hue3}, 100%, 60%)" />
    </linearGradient>
    <filter id="shadow_${hash}" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#000000" flood-opacity="0.7"/>
    </filter>
  </defs>
  <rect width="256" height="256" fill="url(#bg_${hash})" rx="64" />
  <circle cx="128" cy="128" r="92" fill="none" stroke="url(#glow_${hash})" stroke-width="4" opacity="0.35" />
  <circle cx="128" cy="128" r="76" fill="none" stroke="hsl(${hue3}, 80%, 55%)" stroke-width="2" stroke-dasharray="10 6" opacity="0.5" />
  <circle cx="128" cy="114" r="44" fill="hsl(${hue2}, 65%, 16%)" stroke="url(#glow_${hash})" stroke-width="3.5" filter="url(#shadow_${hash})" />
  <path d="M94 138 C94 104, 162 104, 162 138 C162 154, 150 166, 128 170 C106 166, 94 154, 94 138 Z" fill="hsl(${hue1}, 55%, 32%)" opacity="0.95" />
  <polygon points="128,58 146,86 110,86" fill="url(#glow_${hash})" />
  <text x="128" y="127" font-family="system-ui, -apple-system, sans-serif" font-size="30" font-weight="900" fill="#ffffff" text-anchor="middle" dominant-baseline="central" letter-spacing="3">${initials}</text>
  <path d="M194 56 L198 68 L210 72 L198 76 L194 88 L190 76 L178 72 L190 68 Z" fill="hsl(${hue3}, 100%, 75%)" />
</svg>`;

  return `data:image/svg+xml;base64,${b16Encode(svg)}`;
};

// Base64 helper supporting unicode strings safely
function b16Encode(str: string) {
  return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) => String.fromCharCode(parseInt(p1, 16))));
}

export interface AnimeAvatarItem {
  id: string;
  name: string;
  tag: 'Shonen' | 'Ninjas' | 'Sorcerers' | 'Saiyans' | 'Hunters';
  url: string;
}

const RAW_CHARACTER_DATA: { name: string; tag: 'Shonen' | 'Ninjas' | 'Sorcerers' | 'Saiyans' | 'Hunters' }[] = [
  // --- 1. SORCERERS (Jujutsu Kaisen, Frieren, Black Clover, Fate) ---
  { name: 'Gojo Satoru', tag: 'Sorcerers' },
  { name: 'Yuji Itadori', tag: 'Sorcerers' },
  { name: 'Ryomen Sukuna', tag: 'Sorcerers' },
  { name: 'Megumi Fushiguro', tag: 'Sorcerers' },
  { name: 'Nobara Kugisaki', tag: 'Sorcerers' },
  { name: 'Kento Nanami', tag: 'Sorcerers' },
  { name: 'Suguru Geto', tag: 'Sorcerers' },
  { name: 'Yuta Okkotsu', tag: 'Sorcerers' },
  { name: 'Maki Zenin', tag: 'Sorcerers' },
  { name: 'Toge Inumaki', tag: 'Sorcerers' },
  { name: 'Aoi Todo', tag: 'Sorcerers' },
  { name: 'Toji Fushiguro', tag: 'Sorcerers' },
  { name: 'Choso', tag: 'Sorcerers' },
  { name: 'Frieren', tag: 'Sorcerers' },
  { name: 'Fern', tag: 'Sorcerers' },
  { name: 'Stark', tag: 'Sorcerers' },
  { name: 'Julius Novachrono', tag: 'Sorcerers' },
  { name: 'Yami Sukehiro', tag: 'Sorcerers' },
  { name: 'Asta', tag: 'Sorcerers' },
  { name: 'Noelle Silva', tag: 'Sorcerers' },
  { name: 'Rin Tohsaka', tag: 'Sorcerers' },
  { name: 'Megumin', tag: 'Sorcerers' },

  // --- 2. NINJAS (Naruto, Boruto, Demon Slayer Shinobi) ---
  { name: 'Naruto Uzumaki', tag: 'Ninjas' },
  { name: 'Sasuke Uchiha', tag: 'Ninjas' },
  { name: 'Kakashi Hatake', tag: 'Ninjas' },
  { name: 'Itachi Uchiha', tag: 'Ninjas' },
  { name: 'Minato Namikaze', tag: 'Ninjas' },
  { name: 'Jiraiya', tag: 'Ninjas' },
  { name: 'Madara Uchiha', tag: 'Ninjas' },
  { name: 'Obito Uchiha', tag: 'Ninjas' },
  { name: 'Gaara', tag: 'Ninjas' },
  { name: 'Hinata Hyuga', tag: 'Ninjas' },
  { name: 'Shikamaru Nara', tag: 'Ninjas' },
  { name: 'Rock Lee', tag: 'Ninjas' },
  { name: 'Neji Hyuga', tag: 'Ninjas' },
  { name: 'Tsunade Senju', tag: 'Ninjas' },
  { name: 'Orochimaru', tag: 'Ninjas' },
  { name: 'Pain Nagato', tag: 'Ninjas' },
  { name: 'Hashirama Senju', tag: 'Ninjas' },
  { name: 'Tobirama Senju', tag: 'Ninjas' },
  { name: 'Tengen Uzui', tag: 'Ninjas' },
  { name: 'Boruto Uzumaki', tag: 'Ninjas' },
  { name: 'Sarada Uchiha', tag: 'Ninjas' },
  { name: 'Might Guy', tag: 'Ninjas' },

  // --- 3. SAIYANS (Dragon Ball Z / Super) ---
  { name: 'Son Goku', tag: 'Saiyans' },
  { name: 'Vegeta', tag: 'Saiyans' },
  { name: 'Future Trunks', tag: 'Saiyans' },
  { name: 'Son Gohan', tag: 'Saiyans' },
  { name: 'Broly', tag: 'Saiyans' },
  { name: 'Gogeta', tag: 'Saiyans' },
  { name: 'Vegito', tag: 'Saiyans' },
  { name: 'Bardock', tag: 'Saiyans' },
  { name: 'Goten', tag: 'Saiyans' },
  { name: 'Kid Trunks', tag: 'Saiyans' },
  { name: 'Ultra Instinct Goku', tag: 'Saiyans' },
  { name: 'Super Saiyan Blue Vegeta', tag: 'Saiyans' },
  { name: 'Beast Gohan', tag: 'Saiyans' },
  { name: 'Caulifla', tag: 'Saiyans' },
  { name: 'Kale', tag: 'Saiyans' },
  { name: 'Cabba', tag: 'Saiyans' },
  { name: 'Raditz', tag: 'Saiyans' },
  { name: 'Nappa', tag: 'Saiyans' },
  { name: 'Beerus', tag: 'Saiyans' },
  { name: 'Whis', tag: 'Saiyans' },

  // --- 4. HUNTERS (Solo Leveling, Hunter x Hunter, Chainsaw Man) ---
  { name: 'Sung Jinwoo', tag: 'Hunters' },
  { name: 'Cha Hae-In', tag: 'Hunters' },
  { name: 'Baek Yoonho', tag: 'Hunters' },
  { name: 'Choi Jong-In', tag: 'Hunters' },
  { name: 'Go Gunhee', tag: 'Hunters' },
  { name: 'Thomas Andre', tag: 'Hunters' },
  { name: 'Killua Zoldyck', tag: 'Hunters' },
  { name: 'Gon Freecss', tag: 'Hunters' },
  { name: 'Kurapika', tag: 'Hunters' },
  { name: 'Hisoka Morrow', tag: 'Hunters' },
  { name: 'Chrollo Lucilfer', tag: 'Hunters' },
  { name: 'Illumi Zoldyck', tag: 'Hunters' },
  { name: 'Isaac Netero', tag: 'Hunters' },
  { name: 'Feitan Portor', tag: 'Hunters' },
  { name: 'Meruem', tag: 'Hunters' },
  { name: 'Denji', tag: 'Hunters' },
  { name: 'Aki Hayakawa', tag: 'Hunters' },
  { name: 'Makima', tag: 'Hunters' },
  { name: 'Power', tag: 'Hunters' },
  { name: 'Kishibe', tag: 'Hunters' },
  { name: 'Reze', tag: 'Hunters' },
  { name: 'Pochita', tag: 'Hunters' },

  // --- 5. SHONEN (One Piece, Demon Slayer, Bleach, Attack on Titan, Death Note) ---
  { name: 'Monkey D. Luffy', tag: 'Shonen' },
  { name: 'Roronoa Zoro', tag: 'Shonen' },
  { name: 'Vinsmoke Sanji', tag: 'Shonen' },
  { name: 'Trafalgar D. Water Law', tag: 'Shonen' },
  { name: 'Portgas D. Ace', tag: 'Shonen' },
  { name: 'Red-Haired Shanks', tag: 'Shonen' },
  { name: 'Nico Robin', tag: 'Shonen' },
  { name: 'Nami', tag: 'Shonen' },
  { name: 'Tanjiro Kamado', tag: 'Shonen' },
  { name: 'Nezuko Kamado', tag: 'Shonen' },
  { name: 'Zenitsu Agatsuma', tag: 'Shonen' },
  { name: 'Inosuke Hashibira', tag: 'Shonen' },
  { name: 'Kyojuro Rengoku', tag: 'Shonen' },
  { name: 'Giyu Tomioka', tag: 'Shonen' },
  { name: 'Muichiro Tokito', tag: 'Shonen' },
  { name: 'Shinobu Kocho', tag: 'Shonen' },
  { name: 'Levi Ackerman', tag: 'Shonen' },
  { name: 'Eren Yeager', tag: 'Shonen' },
  { name: 'Mikasa Ackerman', tag: 'Shonen' },
  { name: 'Erwin Smith', tag: 'Shonen' },
  { name: 'Light Yagami', tag: 'Shonen' },
  { name: 'L Lawliet', tag: 'Shonen' },
  { name: 'Ichigo Kurosaki', tag: 'Shonen' },
  { name: 'Sosuke Aizen', tag: 'Shonen' },
  { name: 'Kisuke Urahara', tag: 'Shonen' },
  { name: 'Saitama', tag: 'Shonen' }
];

export const AVATAR_LIST: AnimeAvatarItem[] = [
  { id: 'char_0_monkey_d_luffy', name: 'Monkey D. Luffy', tag: 'Shonen', url: 'https://cdn.myanimelist.net/images/characters/9/310307.jpg' },
  { id: 'char_1_roronoa_zoro', name: 'Roronoa Zoro', tag: 'Shonen', url: 'https://cdn.myanimelist.net/images/characters/3/100534.jpg' },
  { id: 'char_2_vinsmoke_sanji', name: 'Vinsmoke Sanji', tag: 'Shonen', url: 'https://cdn.myanimelist.net/images/characters/5/379256.jpg' },
  { id: 'char_3_eren_yeager', name: 'Eren Yeager', tag: 'Shonen', url: 'https://cdn.myanimelist.net/images/characters/8/205625.jpg' },
  { id: 'char_4_levi_ackerman', name: 'Levi Ackerman', tag: 'Shonen', url: 'https://cdn.myanimelist.net/images/characters/2/241413.jpg' },
  { id: 'char_5_tanjiro_kamado', name: 'Tanjiro Kamado', tag: 'Shonen', url: 'https://cdn.myanimelist.net/images/characters/7/378408.jpg' },
  { id: 'char_6_nezuko_kamado', name: 'Nezuko Kamado', tag: 'Shonen', url: 'https://cdn.myanimelist.net/images/characters/9/378410.jpg' },
  { id: 'char_7_son_goku', name: 'Son Goku', tag: 'Shonen', url: 'https://cdn.myanimelist.net/images/characters/3/71627.jpg' },
  { id: 'char_8_naruto_uzumaki', name: 'Naruto Uzumaki', tag: 'Shonen', url: 'https://cdn.myanimelist.net/images/characters/9/131317.jpg' },
  { id: 'char_9_saitama', name: 'Saitama', tag: 'Shonen', url: 'https://cdn.myanimelist.net/images/characters/8/285523.jpg' },
  { id: 'char_10_ichigo_kurosaki', name: 'Ichigo Kurosaki', tag: 'Shonen', url: 'https://cdn.myanimelist.net/images/characters/6/53342.jpg' },
  { id: 'char_11_asta', name: 'Asta', tag: 'Shonen', url: 'https://cdn.myanimelist.net/images/characters/8/335805.jpg' },
  { id: 'char_12_izuku_midoriya', name: 'Izuku Midoriya', tag: 'Shonen', url: 'https://cdn.myanimelist.net/images/characters/9/308146.jpg' },
  { id: 'char_13_katsuki_bakugo', name: 'Katsuki Bakugo', tag: 'Shonen', url: 'https://cdn.myanimelist.net/images/characters/11/308148.jpg' },
  { id: 'char_14_gojo_satoru', name: 'Gojo Satoru', tag: 'Shonen', url: 'https://cdn.myanimelist.net/images/characters/15/422168.jpg' },
  { id: 'char_15_ryomen_sukuna', name: 'Ryomen Sukuna', tag: 'Shonen', url: 'https://cdn.myanimelist.net/images/characters/11/410292.jpg' },
  { id: 'char_16_yuji_itadori', name: 'Yuji Itadori', tag: 'Shonen', url: 'https://cdn.myanimelist.net/images/characters/3/492407.jpg' },
  { id: 'char_17_killua_zoldyck', name: 'Killua Zoldyck', tag: 'Shonen', url: 'https://cdn.myanimelist.net/images/characters/2/212443.jpg' },
  { id: 'char_18_gon_freecss', name: 'Gon Freecss', tag: 'Shonen', url: 'https://cdn.myanimelist.net/images/characters/11/212441.jpg' },
  { id: 'char_19_ken_kaneki', name: 'Ken Kaneki', tag: 'Shonen', url: 'https://cdn.myanimelist.net/images/characters/8/252273.jpg' },
  { id: 'char_20_portgas_d_ace', name: 'Portgas D. Ace', tag: 'Shonen', url: 'https://cdn.myanimelist.net/images/characters/2/81571.jpg' },
  { id: 'char_21_trafalgar_law', name: 'Trafalgar Law', tag: 'Shonen', url: 'https://cdn.myanimelist.net/images/characters/6/157297.jpg' },
  { id: 'char_22_shanks', name: 'Shanks', tag: 'Shonen', url: 'https://cdn.myanimelist.net/images/characters/11/86367.jpg' },
  { id: 'char_23_nico_robin', name: 'Nico Robin', tag: 'Shonen', url: 'https://cdn.myanimelist.net/images/characters/8/63919.jpg' },
  { id: 'char_24_nami', name: 'Nami', tag: 'Shonen', url: 'https://cdn.myanimelist.net/images/characters/3/81363.jpg' },
  { id: 'char_25_naruto_uzumaki', name: 'Naruto Uzumaki', tag: 'Ninjas', url: 'https://cdn.myanimelist.net/images/characters/9/131317.jpg' },
  { id: 'char_26_sasuke_uchiha', name: 'Sasuke Uchiha', tag: 'Ninjas', url: 'https://cdn.myanimelist.net/images/characters/9/131315.jpg' },
  { id: 'char_27_kakashi_hatake', name: 'Kakashi Hatake', tag: 'Ninjas', url: 'https://cdn.myanimelist.net/images/characters/7/284129.jpg' },
  { id: 'char_28_itachi_uchiha', name: 'Itachi Uchiha', tag: 'Ninjas', url: 'https://cdn.myanimelist.net/images/characters/9/189917.jpg' },
  { id: 'char_29_minato_namikaze', name: 'Minato Namikaze', tag: 'Ninjas', url: 'https://cdn.myanimelist.net/images/characters/8/55013.jpg' },
  { id: 'char_30_jiraiya', name: 'Jiraiya', tag: 'Ninjas', url: 'https://cdn.myanimelist.net/images/characters/8/62657.jpg' },
  { id: 'char_31_madara_uchiha', name: 'Madara Uchiha', tag: 'Ninjas', url: 'https://cdn.myanimelist.net/images/characters/6/193233.jpg' },
  { id: 'char_32_obito_uchiha', name: 'Obito Uchiha', tag: 'Ninjas', url: 'https://cdn.myanimelist.net/images/characters/4/215779.jpg' },
  { id: 'char_33_gaara', name: 'Gaara', tag: 'Ninjas', url: 'https://cdn.myanimelist.net/images/characters/7/82875.jpg' },
  { id: 'char_34_hinata_hyuga', name: 'Hinata Hyuga', tag: 'Ninjas', url: 'https://cdn.myanimelist.net/images/characters/6/102075.jpg' },
  { id: 'char_35_shikamaru_nara', name: 'Shikamaru Nara', tag: 'Ninjas', url: 'https://cdn.myanimelist.net/images/characters/9/62659.jpg' },
  { id: 'char_36_rock_lee', name: 'Rock Lee', tag: 'Ninjas', url: 'https://cdn.myanimelist.net/images/characters/6/62661.jpg' },
  { id: 'char_37_neji_hyuga', name: 'Neji Hyuga', tag: 'Ninjas', url: 'https://cdn.myanimelist.net/images/characters/9/131327.jpg' },
  { id: 'char_38_tsunade', name: 'Tsunade', tag: 'Ninjas', url: 'https://cdn.myanimelist.net/images/characters/3/55011.jpg' },
  { id: 'char_39_orochimaru', name: 'Orochimaru', tag: 'Ninjas', url: 'https://cdn.myanimelist.net/images/characters/4/62665.jpg' },
  { id: 'char_40_pain', name: 'Pain', tag: 'Ninjas', url: 'https://cdn.myanimelist.net/images/characters/4/110599.jpg' },
  { id: 'char_41_hashirama_senju', name: 'Hashirama Senju', tag: 'Ninjas', url: 'https://cdn.myanimelist.net/images/characters/8/193231.jpg' },
  { id: 'char_42_tobirama_senju', name: 'Tobirama Senju', tag: 'Ninjas', url: 'https://cdn.myanimelist.net/images/characters/11/193237.jpg' },
  { id: 'char_43_tengen_uzui', name: 'Tengen Uzui', tag: 'Ninjas', url: 'https://cdn.myanimelist.net/images/characters/16/439732.jpg' },
  { id: 'char_44_boruto_uzumaki', name: 'Boruto Uzumaki', tag: 'Ninjas', url: 'https://cdn.myanimelist.net/images/characters/10/288762.jpg' },
  { id: 'char_45_sarada_uchiha', name: 'Sarada Uchiha', tag: 'Ninjas', url: 'https://cdn.myanimelist.net/images/characters/11/288764.jpg' },
  { id: 'char_46_might_guy', name: 'Might Guy', tag: 'Ninjas', url: 'https://cdn.myanimelist.net/images/characters/6/82921.jpg' },
  { id: 'char_47_deidara', name: 'Deidara', tag: 'Ninjas', url: 'https://cdn.myanimelist.net/images/characters/10/62663.jpg' },
  { id: 'char_48_sasori', name: 'Sasori', tag: 'Ninjas', url: 'https://cdn.myanimelist.net/images/characters/3/82909.jpg' },
  { id: 'char_49_konan', name: 'Konan', tag: 'Ninjas', url: 'https://cdn.myanimelist.net/images/characters/7/131321.jpg' },
  { id: 'char_50_gojo_satoru', name: 'Gojo Satoru', tag: 'Sorcerers', url: 'https://cdn.myanimelist.net/images/characters/15/422168.jpg' },
  { id: 'char_51_yuji_itadori', name: 'Yuji Itadori', tag: 'Sorcerers', url: 'https://cdn.myanimelist.net/images/characters/3/492407.jpg' },
  { id: 'char_52_ryomen_sukuna', name: 'Ryomen Sukuna', tag: 'Sorcerers', url: 'https://cdn.myanimelist.net/images/characters/11/410292.jpg' },
  { id: 'char_53_megumi_fushiguro', name: 'Megumi Fushiguro', tag: 'Sorcerers', url: 'https://cdn.myanimelist.net/images/characters/3/410294.jpg' },
  { id: 'char_54_nobara_kugisaki', name: 'Nobara Kugisaki', tag: 'Sorcerers', url: 'https://cdn.myanimelist.net/images/characters/2/410296.jpg' },
  { id: 'char_55_kento_nanami', name: 'Kento Nanami', tag: 'Sorcerers', url: 'https://cdn.myanimelist.net/images/characters/8/415555.jpg' },
  { id: 'char_56_suguru_geto', name: 'Suguru Geto', tag: 'Sorcerers', url: 'https://cdn.myanimelist.net/images/characters/14/412217.jpg' },
  { id: 'char_57_yuta_okkotsu', name: 'Yuta Okkotsu', tag: 'Sorcerers', url: 'https://cdn.myanimelist.net/images/characters/6/455327.jpg' },
  { id: 'char_58_maki_zenin', name: 'Maki Zenin', tag: 'Sorcerers', url: 'https://cdn.myanimelist.net/images/characters/10/410298.jpg' },
  { id: 'char_59_toge_inumaki', name: 'Toge Inumaki', tag: 'Sorcerers', url: 'https://cdn.myanimelist.net/images/characters/3/410300.jpg' },
  { id: 'char_60_aoi_todo', name: 'Aoi Todo', tag: 'Sorcerers', url: 'https://cdn.myanimelist.net/images/characters/11/415557.jpg' },
  { id: 'char_61_toji_fushiguro', name: 'Toji Fushiguro', tag: 'Sorcerers', url: 'https://cdn.myanimelist.net/images/characters/14/504382.jpg' },
  { id: 'char_62_choso', name: 'Choso', tag: 'Sorcerers', url: 'https://cdn.myanimelist.net/images/characters/11/427909.jpg' },
  { id: 'char_63_frieren', name: 'Frieren', tag: 'Sorcerers', url: 'https://cdn.myanimelist.net/images/characters/11/512993.jpg' },
  { id: 'char_64_fern', name: 'Fern', tag: 'Sorcerers', url: 'https://cdn.myanimelist.net/images/characters/10/513000.jpg' },
  { id: 'char_65_stark', name: 'Stark', tag: 'Sorcerers', url: 'https://cdn.myanimelist.net/images/characters/16/512999.jpg' },
  { id: 'char_66_julius_novachrono', name: 'Julius Novachrono', tag: 'Sorcerers', url: 'https://cdn.myanimelist.net/images/characters/11/350993.jpg' },
  { id: 'char_67_yami_sukehiro', name: 'Yami Sukehiro', tag: 'Sorcerers', url: 'https://cdn.myanimelist.net/images/characters/8/335807.jpg' },
  { id: 'char_68_asta', name: 'Asta', tag: 'Sorcerers', url: 'https://cdn.myanimelist.net/images/characters/8/335805.jpg' },
  { id: 'char_69_noelle_silva', name: 'Noelle Silva', tag: 'Sorcerers', url: 'https://cdn.myanimelist.net/images/characters/2/338276.jpg' },
  { id: 'char_70_rin_tohsaka', name: 'Rin Tohsaka', tag: 'Sorcerers', url: 'https://cdn.myanimelist.net/images/characters/7/59807.jpg' },
  { id: 'char_71_megumin', name: 'Megumin', tag: 'Sorcerers', url: 'https://cdn.myanimelist.net/images/characters/8/312067.jpg' },
  { id: 'char_72_aqua', name: 'Aqua', tag: 'Sorcerers', url: 'https://cdn.myanimelist.net/images/characters/6/300405.jpg' },
  { id: 'char_73_darkness', name: 'Darkness', tag: 'Sorcerers', url: 'https://cdn.myanimelist.net/images/characters/6/300407.jpg' },
  { id: 'char_74_shoto_todoroki', name: 'Shoto Todoroki', tag: 'Sorcerers', url: 'https://cdn.myanimelist.net/images/characters/11/308150.jpg' },
  { id: 'char_75_son_goku', name: 'Son Goku', tag: 'Saiyans', url: 'https://cdn.myanimelist.net/images/characters/3/71627.jpg' },
  { id: 'char_76_vegeta', name: 'Vegeta', tag: 'Saiyans', url: 'https://cdn.myanimelist.net/images/characters/9/75739.jpg' },
  { id: 'char_77_trunks', name: 'Trunks', tag: 'Saiyans', url: 'https://cdn.myanimelist.net/images/characters/5/72311.jpg' },
  { id: 'char_78_son_gohan', name: 'Son Gohan', tag: 'Saiyans', url: 'https://cdn.myanimelist.net/images/characters/9/52839.jpg' },
  { id: 'char_79_broly', name: 'Broly', tag: 'Saiyans', url: 'https://cdn.myanimelist.net/images/characters/6/357948.jpg' },
  { id: 'char_80_gogeta', name: 'Gogeta', tag: 'Saiyans', url: 'https://cdn.myanimelist.net/images/characters/12/367683.jpg' },
  { id: 'char_81_vegito', name: 'Vegito', tag: 'Saiyans', url: 'https://cdn.myanimelist.net/images/characters/10/73111.jpg' },
  { id: 'char_82_bardock', name: 'Bardock', tag: 'Saiyans', url: 'https://cdn.myanimelist.net/images/characters/6/73397.jpg' },
  { id: 'char_83_goten', name: 'Goten', tag: 'Saiyans', url: 'https://cdn.myanimelist.net/images/characters/3/73117.jpg' },
  { id: 'char_84_goku_black', name: 'Goku Black', tag: 'Saiyans', url: 'https://cdn.myanimelist.net/images/characters/10/314115.jpg' },
  { id: 'char_85_caulifla', name: 'Caulifla', tag: 'Saiyans', url: 'https://cdn.myanimelist.net/images/characters/16/334236.jpg' },
  { id: 'char_86_kale', name: 'Kale', tag: 'Saiyans', url: 'https://cdn.myanimelist.net/images/characters/9/334237.jpg' },
  { id: 'char_87_cabba', name: 'Cabba', tag: 'Saiyans', url: 'https://cdn.myanimelist.net/images/characters/9/308960.jpg' },
  { id: 'char_88_raditz', name: 'Raditz', tag: 'Saiyans', url: 'https://cdn.myanimelist.net/images/characters/5/73289.jpg' },
  { id: 'char_89_nappa', name: 'Nappa', tag: 'Saiyans', url: 'https://cdn.myanimelist.net/images/characters/11/73121.jpg' },
  { id: 'char_90_beerus', name: 'Beerus', tag: 'Saiyans', url: 'https://cdn.myanimelist.net/images/characters/7/243697.jpg' },
  { id: 'char_91_whis', name: 'Whis', tag: 'Saiyans', url: 'https://cdn.myanimelist.net/images/characters/3/243699.jpg' },
  { id: 'char_92_cell', name: 'Cell', tag: 'Saiyans', url: 'https://cdn.myanimelist.net/images/characters/9/73133.jpg' },
  { id: 'char_93_frieza', name: 'Frieza', tag: 'Saiyans', url: 'https://cdn.myanimelist.net/images/characters/11/73129.jpg' },
  { id: 'char_94_piccolo', name: 'Piccolo', tag: 'Saiyans', url: 'https://cdn.myanimelist.net/images/characters/8/73127.jpg' },
  { id: 'char_95_krillin', name: 'Krillin', tag: 'Saiyans', url: 'https://cdn.myanimelist.net/images/characters/11/73125.jpg' },
  { id: 'char_96_tien_shinhan', name: 'Tien Shinhan', tag: 'Saiyans', url: 'https://cdn.myanimelist.net/images/characters/10/73131.jpg' },
  { id: 'char_97_yamcha', name: 'Yamcha', tag: 'Saiyans', url: 'https://cdn.myanimelist.net/images/characters/4/73135.jpg' },
  { id: 'char_98_chi-chi', name: 'Chi-Chi', tag: 'Saiyans', url: 'https://cdn.myanimelist.net/images/characters/7/73139.jpg' },
  { id: 'char_99_bulma', name: 'Bulma', tag: 'Saiyans', url: 'https://cdn.myanimelist.net/images/characters/4/73137.jpg' },
  { id: 'char_100_sung_jinwoo', name: 'Sung Jinwoo', tag: 'Hunters', url: 'https://cdn.myanimelist.net/images/characters/11/498877.jpg' },
  { id: 'char_101_cha_hae-in', name: 'Cha Hae-In', tag: 'Hunters', url: 'https://cdn.myanimelist.net/images/characters/11/498879.jpg' },
  { id: 'char_102_baek_yoonho', name: 'Baek Yoonho', tag: 'Hunters', url: 'https://cdn.myanimelist.net/images/characters/16/518335.jpg' },
  { id: 'char_103_choi_jong-in', name: 'Choi Jong-In', tag: 'Hunters', url: 'https://cdn.myanimelist.net/images/characters/11/518334.jpg' },
  { id: 'char_104_go_gunhee', name: 'Go Gunhee', tag: 'Hunters', url: 'https://cdn.myanimelist.net/images/characters/11/518336.jpg' },
  { id: 'char_105_thomas_andre', name: 'Thomas Andre', tag: 'Hunters', url: 'https://cdn.myanimelist.net/images/characters/11/528314.jpg' },
  { id: 'char_106_killua_zoldyck', name: 'Killua Zoldyck', tag: 'Hunters', url: 'https://cdn.myanimelist.net/images/characters/2/212443.jpg' },
  { id: 'char_107_gon_freecss', name: 'Gon Freecss', tag: 'Hunters', url: 'https://cdn.myanimelist.net/images/characters/11/212441.jpg' },
  { id: 'char_108_kurapika', name: 'Kurapika', tag: 'Hunters', url: 'https://cdn.myanimelist.net/images/characters/4/212445.jpg' },
  { id: 'char_109_hisoka_morrow', name: 'Hisoka Morrow', tag: 'Hunters', url: 'https://cdn.myanimelist.net/images/characters/12/212447.jpg' },
  { id: 'char_110_chrollo_lucilfer', name: 'Chrollo Lucilfer', tag: 'Hunters', url: 'https://cdn.myanimelist.net/images/characters/2/212449.jpg' },
  { id: 'char_111_illumi_zoldyck', name: 'Illumi Zoldyck', tag: 'Hunters', url: 'https://cdn.myanimelist.net/images/characters/2/212451.jpg' },
  { id: 'char_112_isaac_netero', name: 'Isaac Netero', tag: 'Hunters', url: 'https://cdn.myanimelist.net/images/characters/10/225643.jpg' },
  { id: 'char_113_feitan_portor', name: 'Feitan Portor', tag: 'Hunters', url: 'https://cdn.myanimelist.net/images/characters/4/212453.jpg' },
  { id: 'char_114_meruem', name: 'Meruem', tag: 'Hunters', url: 'https://cdn.myanimelist.net/images/characters/10/225641.jpg' },
  { id: 'char_115_denji', name: 'Denji', tag: 'Hunters', url: 'https://cdn.myanimelist.net/images/characters/12/414438.jpg' },
  { id: 'char_116_aki_hayakawa', name: 'Aki Hayakawa', tag: 'Hunters', url: 'https://cdn.myanimelist.net/images/characters/11/414440.jpg' },
  { id: 'char_117_makima', name: 'Makima', tag: 'Hunters', url: 'https://cdn.myanimelist.net/images/characters/10/414442.jpg' },
  { id: 'char_118_power', name: 'Power', tag: 'Hunters', url: 'https://cdn.myanimelist.net/images/characters/11/414444.jpg' },
  { id: 'char_119_kishibe', name: 'Kishibe', tag: 'Hunters', url: 'https://cdn.myanimelist.net/images/characters/11/427907.jpg' },
  { id: 'char_120_reze', name: 'Reze', tag: 'Hunters', url: 'https://cdn.myanimelist.net/images/characters/11/437985.jpg' },
  { id: 'char_121_pochita', name: 'Pochita', tag: 'Hunters', url: 'https://cdn.myanimelist.net/images/characters/11/427906.jpg' },
  { id: 'char_122_leorio_paradinight', name: 'Leorio Paradinight', tag: 'Hunters', url: 'https://cdn.myanimelist.net/images/characters/6/212455.jpg' },
  { id: 'char_123_biscuit_krueger', name: 'Biscuit Krueger', tag: 'Hunters', url: 'https://cdn.myanimelist.net/images/characters/8/225645.jpg' },
  { id: 'char_124_neferpitou', name: 'Neferpitou', tag: 'Hunters', url: 'https://cdn.myanimelist.net/images/characters/10/225647.jpg' },
];

const FILTERS = ['All', 'Shonen', 'Ninjas', 'Sorcerers', 'Saiyans', 'Hunters'] as const;

const proxyUrl = (url: string) => url.startsWith('https://cdn.myanimelist.net/') ? `/api/proxy-image?url=${encodeURIComponent(url)}` : url;

// Single Avatar Card component using DiceBear Lorelei SVG API
const AvatarCard: React.FC<{
  avatar: AnimeAvatarItem;
  isSelected: boolean;
  onSelect: () => void;
}> = ({ avatar, isSelected, onSelect }) => {
  return (
    <div
      onClick={onSelect}
      className={`relative group aspect-square rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 bg-[#0c101a] ${
        isSelected
          ? 'ring-4 ring-purple-500 ring-offset-2 ring-offset-[#0a0e17] scale-105 shadow-xl shadow-purple-500/40 border-2 border-purple-400 z-10'
          : 'border border-white/10 hover:border-purple-500/80 hover:scale-105 hover:ring-2 hover:ring-purple-500/80 bg-neutral-900/60'
      }`}
      title={`${avatar.name} (${avatar.tag})`}
    >
      <img
        src={proxyUrl(avatar.url)}
        alt={avatar.name}
        className="w-full h-full object-cover aspect-square transition-transform duration-300 group-hover:scale-110"
      />

      {/* Ambient hover tag overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-1.5 pointer-events-none">
        <span className="text-[9px] font-black text-white truncate drop-shadow-md leading-tight">
          {avatar.name}
        </span>
        <span className="text-[7.5px] font-bold text-purple-300 uppercase tracking-wider">
          {avatar.tag}
        </span>
      </div>

      {/* Selected Indicator */}
      {isSelected && (
        <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center text-white shadow-lg border border-white/50 z-20">
          <Check className="w-3 h-3 stroke-[3]" />
        </div>
      )}
    </div>
  );
};

export const LocalProfileModal: React.FC<LocalProfileModalProps> = ({
  isOpen,
  onClose,
  currentName = 'User',
  onSaveProfile
}) => {
  if (!isOpen) return null;

  const [name, setName] = useState(currentName);
  const [selectedAvatar, setSelectedAvatar] = useState(AVATAR_LIST[0].url);
  const [customAvatar, setCustomAvatar] = useState<string | null>(null);
  const [selectedLang, setSelectedLang] = useState('Tamil (தமிழ்)');
  const [activeTab, setActiveTab] = useState<'identity' | 'stats'>('identity');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [copied, setCopied] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const backupInputRef = React.useRef<HTMLInputElement>(null);

  const filteredAvatars = AVATAR_LIST.filter(avatar => {
    const matchesSearch = !searchQuery.trim() || avatar.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = selectedFilter === 'All' || avatar.tag === selectedFilter;
    return matchesSearch && matchesFilter;
  });

  const handleSave = () => {
    if (onSaveProfile) {
      onSaveProfile(name.trim() || 'Anime Fan', selectedAvatar, selectedLang);
    }
    onClose();
  };

  const handleShareProfile = () => {
    const profileUrl = `${window.location.origin}/?user=${encodeURIComponent(name)}`;
    navigator.clipboard?.writeText(profileUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setCustomAvatar(base64);
        setSelectedAvatar(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsImporting(true);
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) {
            localStorage.setItem('cf_anime_watchlist', JSON.stringify(parsed));
            alert('Watchlist backup imported successfully! The page will refresh to apply changes.');
            window.location.reload();
          } else {
            throw new Error('Invalid backup format');
          }
        } catch (err) {
          alert('Failed to import backup. Please ensure the file is a valid JSON watchlist export.');
        } finally {
          setIsImporting(false);
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      
      {/* MODAL CONTAINER */}
      <div 
        className="relative w-full max-w-2xl bg-[#121829] border border-primary-theme rounded-3xl p-5 sm:p-6 shadow-2xl z-10 animate-in zoom-in-95 duration-200 text-neutral-100 font-sans max-h-[90vh] overflow-y-auto no-scrollbar"
        style={{ boxShadow: '0 20px 50px -10px var(--primary-glow)' }}
      >
        
        {/* HEADER */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl btn-primary-theme flex items-center justify-center text-white shadow-lg shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-heading font-black text-white text-base sm:text-lg flex items-center gap-1.5">
                <span>Edit Profile & Avatar</span>
                <span className="badge-primary-theme text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>100+ AI Characters</span>
                </span>
              </h2>
              <p className="text-neutral-400 text-xs mt-0.5">
                Customize your identity, regional dubbed language preference & shareable profile.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* MODERN SEGMENTED CONTROL TABS */}
        <div className="relative flex items-center p-1 bg-[#0a0e17] border border-neutral-800 mt-6 rounded-2xl">
          {/* Sliding background pill */}
          <motion.div
            className="absolute top-1 bottom-1 rounded-xl bg-primary-theme shadow-lg z-0"
            initial={false}
            animate={{
              left: activeTab === 'identity' ? '4px' : '50%',
              right: activeTab === 'identity' ? '50%' : '4px'
            }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          />

          <button
            onClick={() => setActiveTab('identity')}
            className={`relative z-10 flex-1 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'identity' ? 'text-white' : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            Avatar & Identity
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`relative z-10 flex-1 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'stats' ? 'text-white' : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            Watchlist Stats & Backup
          </button>
        </div>

        {/* IDENTITY TAB CONTENT */}
        {activeTab === 'identity' && (
          <div className="space-y-5 pt-4">
            
            {/* Active DP Preview Card */}
            <div className="flex items-center justify-between p-3 sm:p-3.5 rounded-2xl bg-[#0c101a] border border-neutral-800/90 shadow-inner">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <img
                    src={selectedAvatar}
                    alt="Active DP"
                    onError={(e) => {
                      e.currentTarget.src = `https://api.dicebear.com/9.x/adventurer/svg?seed=AnimeFan&backgroundColor=0a0e17`;
                    }}
                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover border-2 shadow-lg"
                    style={{ borderColor: 'var(--primary-accent)' }}
                  />
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center shadow-md animate-pulse">
                    <Zap className="w-3 h-3 text-neutral-950 fill-current" />
                  </div>
                </div>
                <div>
                  <h4 className="font-bold text-sm sm:text-base text-white">
                    {name || 'User'}
                  </h4>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    Active Regional Enthusiast • {selectedLang}
                  </p>
                </div>
              </div>

              <div className="text-right hidden sm:block">
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded-lg border border-emerald-500/30">
                  Verified Creator
                </span>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search character avatars by name..."
                className="w-full bg-[#0a0e17] border border-neutral-800 focus:border-accent-theme rounded-xl py-2 pl-9 pr-8 text-xs text-white outline-none transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white text-xs"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar select-none text-[11px]">
              {FILTERS.map((filter) => {
                const active = selectedFilter === filter;
                return (
                  <button
                    key={filter}
                    onClick={() => setSelectedFilter(filter)}
                    className={`px-3 py-1.5 rounded-full font-bold shrink-0 transition-all cursor-pointer ${
                      active
                        ? 'active-tab-theme text-white'
                        : 'bg-[#0a0e17] border border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800/60'
                    }`}
                  >
                    {filter}
                  </button>
                );
              })}
            </div>

            {/* 100+ AI Avatars Grid */}
            <div className="rounded-2xl bg-[#0a0e17]/90 border border-neutral-800/90 p-2 sm:p-3 max-h-72 sm:max-h-80 overflow-y-auto no-scrollbar shadow-inner">
              <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2 sm:gap-2.5">
                
                {/* Custom Upload Button - Always First Option */}
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative group aspect-square rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all duration-300 hover:scale-105 ${
                    customAvatar && selectedAvatar === customAvatar
                      ? 'border-purple-500 bg-purple-500/10 ring-4 ring-purple-500/30'
                      : 'border-white/15 hover:border-purple-500/80 bg-neutral-900/50'
                  }`}
                  title="Upload Custom Image Avatar"
                >
                  <input 
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                  />
                  {customAvatar ? (
                    <img 
                      src={customAvatar} 
                      className="w-full h-full object-cover rounded-2xl" 
                      alt="Custom"
                    />
                  ) : (
                    <>
                      <Upload className="w-5 h-5 text-neutral-400 group-hover:text-purple-300 transition-colors" />
                      <span className="text-[8px] font-black text-neutral-400 group-hover:text-purple-300 mt-1 uppercase tracking-wider">Custom</span>
                    </>
                  )}
                  {customAvatar && selectedAvatar === customAvatar && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center text-white shadow-md z-20">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  )}
                </div>

                {/* 100+ AI Generated Anime Character Avatars */}
                {filteredAvatars.map((avatar) => (
                  <AvatarCard
                    key={`avatar_profile_${avatar.id}`}
                    avatar={avatar}
                    isSelected={selectedAvatar === avatar.url}
                    onSelect={() => setSelectedAvatar(avatar.url)}
                  />
                ))}
              </div>
            </div>

            {/* Nickname & Language Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                  Profile Nickname
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#0a0e17] border border-neutral-800 focus:border-accent-theme rounded-2xl px-3 sm:px-4 py-2.5 text-xs text-white outline-none"
                  placeholder="Enter your name..."
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                  Preferred Dub Language
                </label>
                <select
                  value={selectedLang}
                  onChange={(e) => setSelectedLang(e.target.value)}
                  className="w-full bg-[#0a0e17] border border-neutral-800 focus:border-accent-theme rounded-2xl px-3 sm:px-4 py-2.5 text-xs text-white outline-none"
                >
                  <option value="Tamil (தமிழ்)">Tamil (தமிழ்)</option>
                  <option value="Telugu (తెలుగు)">Telugu (తెలుగు)</option>
                  <option value="Hindi (हिन्दी)">Hindi (हिन्दी)</option>
                  <option value="Malayalam (മലയാളം)">Malayalam (മലയാളം)</option>
                  <option value="Kannada (ಕನ್ನಡ)">Kannada (ಕನ್ನಡ)</option>
                </select>
              </div>
            </div>

          </div>
        )}

        {/* STATS & BACKUP TAB CONTENT */}
        {activeTab === 'stats' && (
          <div className="space-y-5 pt-4">
            <div className="p-4 rounded-2xl bg-[#0a0e17] border border-neutral-800 space-y-3">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Cloud Synchronization</span>
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Your watchlist items, custom collections, and profile preferences are securely persisted and synchronized across your sessions.
              </p>
            </div>

            {/* Backup Box */}
            <div className="p-4 rounded-2xl bg-[#0d121f] border border-neutral-800 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white block uppercase tracking-wider">Export / Import Watchlist Backup</span>
                <span className="text-[10px] font-bold text-neutral-500 bg-black/40 px-2 py-0.5 rounded border border-neutral-800">JSON Format</span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    const data = localStorage.getItem('cf_anime_watchlist') || '[]';
                    const blob = new Blob([data], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'anidub_watchlist_backup.json';
                    a.click();
                  }}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#182032] border border-neutral-700/60 hover:bg-[#202940] hover:border-neutral-500 text-xs font-bold text-white transition-all cursor-pointer shadow-sm active:scale-95"
                >
                  <FileDown className="w-4 h-4 text-emerald-400" />
                  <span>Export JSON</span>
                </button>

                <div className="relative">
                  <input 
                    type="file"
                    ref={backupInputRef}
                    className="hidden"
                    accept=".json"
                    onChange={handleImportBackup}
                  />
                  <button
                    disabled={isImporting}
                    onClick={() => backupInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#182032] border border-neutral-700/60 hover:bg-[#202940] hover:border-neutral-500 text-xs font-bold text-white transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
                  >
                    <FileUp className="w-4 h-4 text-blue-400" />
                    <span>{isImporting ? 'Processing...' : 'Import JSON'}</span>
                  </button>
                </div>
              </div>

              <p className="text-[11px] text-neutral-500 italic leading-relaxed">
                Tip: Importing a backup will overwrite your current local watchlist. Export your current data first if you wish to keep it.
              </p>
            </div>
          </div>
        )}

        {/* FOOTER ACTIONS */}
        <div className="flex items-center justify-between pt-5 border-t border-neutral-800 mt-6">
          <button
            type="button"
            onClick={handleShareProfile}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0a0e17] border border-neutral-800 hover:border-neutral-700 text-xs font-bold text-neutral-300 hover:text-white transition-all cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5 text-primary-theme" />
            <span>{copied ? 'Link Copied!' : 'Share Profile'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-bold text-neutral-300 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-6 py-2.5 rounded-xl btn-primary-theme text-xs font-extrabold shadow-lg cursor-pointer transition-transform active:scale-95"
            >
              Save Profile
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
