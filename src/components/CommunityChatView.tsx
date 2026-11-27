import React, { useState, useMemo } from 'react';
import { MessageSquare, ShieldCheck, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LiveChat } from './LiveChat';
import { useUser, useClerk } from '../lib/clerk';

export interface CommunityChatViewProps {
  user?: { id?: string; name: string; email: string; avatar?: string } | null;
  onOpenAuth?: () => void;
  onShowToast?: (message: string, type?: 'success' | 'info' | 'error') => void;
  onNavigateToCatalog?: () => void;
  onSelectAnime?: (anime: any) => void;
}

const ROOMS = [
  { id: 'Global', key: 'community:rooms.general', fallback: 'General' },
  { id: 'Tamil', key: 'community:rooms.tamil', fallback: 'Tamil Dubs' },
  { id: 'Hindi', key: 'community:rooms.hindi', fallback: 'Hindi Dubs' },
  { id: 'Telugu', key: 'community:rooms.telugu', fallback: 'Telugu Dubs' },
] as const;

export const CommunityChatView: React.FC<CommunityChatViewProps> = ({
  user: userProp,
  onOpenAuth: onOpenAuthProp,
  onShowToast,
}) => {
  const { t } = useTranslation(['community']);
  const { isSignedIn, user: clerkUser } = useUser();
  const { openSignIn } = useClerk();

  const user = useMemo(() => {
    if (userProp !== undefined) return userProp;
    if (isSignedIn && clerkUser) {
      const email = clerkUser.primaryEmailAddress?.emailAddress || '';
      return {
        id: clerkUser.id,
        name: clerkUser.fullName || clerkUser.username || email.split('@')[0] || 'AnimeFan_IN',
        email,
        avatar: clerkUser.imageUrl,
      };
    }
    return null;
  }, [userProp, isSignedIn, clerkUser]);

  const onOpenAuth = onOpenAuthProp || (() => openSignIn?.());
  const [selectedRoom, setSelectedRoom] = useState<string>('Global');

  return (
    <section className="max-w-[1040px] mx-auto px-4 sm:px-6 pt-5 pb-24 text-[var(--text-primary)] space-y-5">
      {/* Header & Room Filter Pills (44px touch targets) */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--accent-primary)] mb-1">
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Regional Anime Hub</span>
          </div>
          <h1 className="text-[24px] sm:text-[30px] font-bold text-[var(--text-primary)] leading-[1.2] tracking-[-0.02em]">
            {t('community:title', 'Community Chat')}
          </h1>
          <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
            {t('community:subtitle', 'Live discussion with Indian anime dub fans')}
          </p>
        </div>

        {/* 44px Room Filter Pills */}
        <div
          role="tablist"
          aria-label="Select chat room"
          className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5"
        >
          {ROOMS.map((room) => {
            const active = selectedRoom === room.id;
            return (
              <button
                key={room.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSelectedRoom(room.id)}
                className={`min-h-[44px] px-4 rounded-[12px] text-[13px] font-semibold whitespace-nowrap border inline-flex items-center gap-1.5 transition-all duration-180 motion-reduce:transition-none ${
                  active
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-on-primary)] border-[var(--accent-primary)]'
                    : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                }`}
              >
                <Globe className="w-3.5 h-3.5 shrink-0" />
                <span>{t(room.key, room.fallback)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Community Guidelines Slim Notice */}
      <div className="rounded-[12px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-4 py-2.5 flex items-center gap-2.5 text-[12px] text-[var(--text-secondary)]">
        <ShieldCheck className="w-4 h-4 text-[#34D399] shrink-0" />
        <span>
          Respectful regional discussion only. Spoiler-tag plot twists and never share unofficial piracy links.
        </span>
      </div>

      {/* Embedded LiveChat Container */}
      <LiveChat
        user={user}
        onOpenAuth={onOpenAuth}
        onShowToast={onShowToast}
        embedded={true}
        activeRoom={selectedRoom}
      />
    </section>
  );
};
