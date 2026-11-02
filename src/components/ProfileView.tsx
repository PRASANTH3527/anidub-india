import React, { useState } from 'react';
import { SignedIn, SignedOut, SignIn, useUser, UserProfile } from '@clerk/clerk-react';
import { 
  Bookmark, 
  Dna, 
  Layers, 
  Edit3, 
  Check, 
  X, 
  Star, 
  Tv, 
  Flame, 
  MessageSquare, 
  Search, 
  Plus, 
  Sparkles, 
  CheckCircle2, 
  Play, 
  ExternalLink,
  ShieldCheck,
  Languages,
  Clock,
  Trophy,
  Share2,
  Compass,
  Film,
  TrendingUp,
  Zap,
  Award,
  ArrowRight,
  User as UserIcon,
  LogOut
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Anime } from './CatalogView';
import { cloudflareApi } from '../services/cloudflareApi';
import { LocalProfileModal } from './LocalProfileModal';
import { AnimeDNAProfile } from './AnimeDNAProfile';

export interface ProfileViewProps {
  watchlist?: number[];
  catalogList?: any[];
  onSelectAnime?: (anime: any) => void;
  onToggleWatchlist?: (animeId: number) => void;
  onOpenCreateCollection?: () => void;
  onNavigateToCatalog?: () => void;
  userAvatar?: string;
  onAvatarChange?: (url: string) => void;
}

export function ProfileView(props: ProfileViewProps) {
  const hasClerkKey = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);

  return (
    <div className="min-h-screen pt-24 px-4 pb-20 flex flex-col items-center justify-center text-neutral-100">
      {hasClerkKey ? (
        <>
          <SignedOut>
             <h2 className="text-white text-2xl font-bold mb-6">Sign in to ANIDUB INDIA</h2>
             <div className="w-full max-w-md flex justify-center">
               <SignIn routing="hash"/>
             </div>
          </SignedOut>

          <SignedIn>
            <ClerkContent {...props} />
          </SignedIn>
        </>
      ) : (
        <LocalContent {...props} />
      )}
    </div>
  );
}

function ClerkContent(props: ProfileViewProps) {
  const { user } = useUser();
  return (
    <div className="w-full max-w-md bg-gradient-to-b from-gray-800 to-gray-900 rounded-3xl p-8 text-center border border-gray-700 shadow-2xl mt-10">
       <img src={user?.imageUrl} className="w-28 h-28 rounded-2xl mx-auto mb-4 border-2 border-purple-500 shadow-lg" alt="Profile Avatar" />
       <h1 className="text-2xl font-bold text-white mb-1">{user?.fullName || 'Verified User'}</h1>
       <p className="text-gray-400 text-sm mb-6">{user?.primaryEmailAddress?.emailAddress || 'user@anidub.india'}</p>
       
       <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <p className="text-green-400 font-semibold text-sm">✓ Active Verified Profile</p>
       </div>
    </div>
  );
}

function LocalContent(props: ProfileViewProps) {
  const [userName, setUserName] = useState(() => localStorage.getItem('anidub_username') || 'Anime Fan');
  const [userAvatar, setUserAvatar] = useState(() => localStorage.getItem('anidub_avatar') || props.userAvatar || 'https://s4.anilist.co/file/anilistcdn/character/large/b127691-9zqh1xpIubn7.png');
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="w-full max-w-md bg-gradient-to-b from-neutral-900 to-neutral-950 rounded-3xl p-8 text-center border border-white/10 shadow-2xl mt-4">
       <img src={userAvatar} className="w-28 h-28 rounded-2xl mx-auto mb-4 object-cover border-2 border-purple-500 shadow-lg" alt="Profile Avatar" />
       <h1 className="text-2xl font-bold text-white mb-1">{userName}</h1>
       <p className="text-neutral-400 text-sm mb-6">Local Guest Session</p>
       
       <button
         onClick={() => setIsModalOpen(true)}
         className="w-full py-3 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm transition-all cursor-pointer shadow-lg mb-4"
       >
         Edit Profile & Avatar
       </button>

       <div className="bg-white/[0.03] rounded-xl p-4 border border-white/10 text-xs text-neutral-400">
          <p>Watchlist items and preferences are saved locally on this device.</p>
       </div>

       <LocalProfileModal
         isOpen={isModalOpen}
         onClose={() => setIsModalOpen(false)}
         currentName={userName}
         onSaveProfile={(newName, newAvatar) => {
           setUserName(newName);
           setUserAvatar(newAvatar);
           localStorage.setItem('anidub_username', newName);
           localStorage.setItem('anidub_avatar', newAvatar);
           if (props.onAvatarChange) props.onAvatarChange(newAvatar);
         }}
       />
    </div>
  );
}

export default ProfileView;
