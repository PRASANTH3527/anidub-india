import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '../components/Toast';
import { ActivityType, formatNotificationTitle, formatNotificationBody } from '../utils/notifications';

export interface NotificationItem {
  id: string | number;
  type: ActivityType;
  title: string;
  message: string;
  user?: string;
  anime_id?: number | string | null;
  anime_title?: string | null;
  rating?: number | null;
  language?: string | null;
  link?: string | null;
  timestamp: string;
  read?: boolean;
}

export interface NotificationContextType {
  notifications: NotificationItem[];
  unreadCount: number;
  isSoundEnabled: boolean;
  browserPermission: NotificationPermission | 'unsupported';
  isLiveConnected: boolean;
  toggleSound: () => void;
  requestBrowserPermission: () => Promise<boolean>;
  markAllAsRead: () => void;
  markAsRead: (id: string | number) => void;
  clearNotifications: () => void;
  triggerTestNotification: () => Promise<void>;
  addManualNotification: (notif: Partial<NotificationItem>) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Web Audio API pure synthesized chime (no external mp3/wav files required)
function playNotificationChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    // Uplifting two-tone bell chime (D5 -> A5)
    osc.type = 'sine';
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.start(now);
    osc.stop(now + 0.4);
  } catch {}
}

const STORAGE_KEY = 'anidub_community_notifications';
const SOUND_KEY = 'anidub_notif_sound_enabled';

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { showToast } = useToast();

  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [
      {
        id: 'init_welcome_alert',
        type: 'system',
        title: '🌟 Welcome to AniDub India Live Feed',
        message: 'Real-time notifications active for new dub reviews, community chats & anime drops.',
        timestamp: 'Just now',
        read: true
      }
    ];
  });

  const [isSoundEnabled, setIsSoundEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(SOUND_KEY);
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const [browserPermission, setBrowserPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Check browser notification support & permission
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setBrowserPermission(Notification.permission);
    } else {
      setBrowserPermission('unsupported');
    }
  }, []);

  // Save notifications to LocalStorage on update
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications.slice(0, 50)));
    } catch {}
  }, [notifications]);

  // Request browser notification permission
  const requestBrowserPermission = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      showToast('Notification API', 'Desktop notifications are not supported in this browser.', 'warning');
      return false;
    }

    try {
      const perm = await Notification.requestPermission();
      setBrowserPermission(perm);
      if (perm === 'granted') {
        showToast('Push Notifications Enabled', 'You will now receive instant desktop alerts for community activity!', 'success');
        try {
          new Notification('AniDub India Notifications Active', {
            body: 'You are now receiving instant alerts for dub reviews and community chat.',
            icon: 'https://i.ibb.co/vzS8G90/default-avatar.png'
          });
        } catch {}
        return true;
      } else {
        showToast('Notifications Blocked', 'Permission was denied. You can enable them anytime in browser site settings.', 'warning');
        return false;
      }
    } catch (e) {
      console.warn('Notification permission error:', e);
      return false;
    }
  }, [showToast]);

  const toggleSound = useCallback(() => {
    setIsSoundEnabled(prev => {
      const next = !prev;
      try {
        localStorage.setItem(SOUND_KEY, String(next));
      } catch {}
      if (next) playNotificationChime();
      return next;
    });
  }, []);

  // Helper: Display in-app toast, audio chime, and optional browser notification
  const handleIncomingNotification = useCallback((payload: Partial<NotificationItem>) => {
    const type: ActivityType = (payload.type as ActivityType) || 'system';
    const title = payload.title || formatNotificationTitle({ type, ...payload });
    const message = payload.message || formatNotificationBody({ type, ...payload });
    const timestamp = payload.timestamp || new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    const newNotification: NotificationItem = {
      id: payload.id || `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type,
      title,
      message,
      user: payload.user || 'Community Fan',
      anime_id: payload.anime_id ?? null,
      anime_title: payload.anime_title ?? null,
      rating: payload.rating ?? null,
      language: payload.language ?? null,
      link: payload.link ?? null,
      timestamp,
      read: false
    };

    // 1. Prepend to notifications list
    setNotifications(prev => {
      // Deduplicate by ID or identical title+message
      const isDuplicate = prev.some(n => n.id === newNotification.id || (n.title === newNotification.title && n.message === newNotification.message));
      if (isDuplicate) return prev;
      return [newNotification, ...prev].slice(0, 50);
    });

    // 2. Play subtle chime
    if (isSoundEnabled) {
      playNotificationChime();
    }

    // 3. Trigger In-App Toast (skip chat messages to prevent global popups on initial load or live messages)
    if (type !== 'chat') {
      const toastType = (type === 'review' || type === 'anime_approved') 
        ? 'success' 
        : (type === 'report' ? 'warning' : 'info');
      showToast(title, message, toastType);
    }

    // 4. Trigger Browser Notification (if permitted)
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body: message,
          icon: 'https://i.ibb.co/vzS8G90/default-avatar.png',
          badge: 'https://i.ibb.co/vzS8G90/default-avatar.png'
        });
      } catch {}
    }
  }, [isSoundEnabled, showToast]);

  // Connect to SSE (/api/notifications/stream)
  useEffect(() => {
    let isMounted = true;

    const connectSSE = () => {
      if (!isMounted) return;

      try {
        const sse = new EventSource('/api/notifications/stream');
        eventSourceRef.current = sse;

        sse.onopen = () => {
          if (!isMounted) return;
          setIsLiveConnected(true);
        };

        sse.onmessage = (event) => {
          if (!isMounted) return;
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'connected') {
              setIsLiveConnected(true);
              return;
            }
            handleIncomingNotification(data);
          } catch (e) {
            console.warn('Failed parsing notification SSE message:', e);
          }
        };

        sse.onerror = () => {
          if (!isMounted) return;
          setIsLiveConnected(false);
          sse.close();
          // Auto-reconnect after 4s
          if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = setTimeout(connectSSE, 4000);
        };
      } catch (err) {
        console.warn('SSE connection init error:', err);
        setIsLiveConnected(false);
      }
    };

    connectSSE();

    return () => {
      isMounted = false;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [handleIncomingNotification]);

  // Also connect to Cloudflare Worker WebSocket as secondary channel
  useEffect(() => {
    let wsActive = true;
    try {
      const ws = new WebSocket('wss://anime-chat.samayaprasanth0.workers.dev/ws');
      wsRef.current = ws;

      ws.onmessage = (event) => {
        if (!wsActive) return;
        try {
          const data = JSON.parse(event.data);
          // If a new live review or chat arrived via Cloudflare WS
          if (data && (data.text || data.comment)) {
            // Avoid duplicate if it's the welcome greeting
            if (data.id === 'welcome_init' || data.user === 'AniDub_Bot') return;
            // Check if current guest sent it themselves to avoid double alert
            const currentGuest = localStorage.getItem('anidub_guest_chat_name');
            if (currentGuest && data.user === currentGuest) return;

            const isReview = Boolean(data.isReview || data.rating);
            handleIncomingNotification({
              id: data.id || `ws_${Date.now()}`,
              type: isReview ? 'review' : 'chat',
              user: data.user,
              rating: data.rating,
              language: data.language,
              message: data.text || data.comment,
              anime_title: isReview ? (data.animeTitle || 'Community Dub Review') : undefined,
              timestamp: data.timestamp
            });
          }
        } catch {}
      };
    } catch {}

    return () => {
      wsActive = false;
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [handleIncomingNotification]);

  // Fetch recent notifications on mount
  useEffect(() => {
    const fetchRecent = async () => {
      try {
        const res = await fetch('/api/notifications/recent');
        if (res.ok) {
          const data = await res.json();
          const list = data.notifications || data.data || [];
          if (Array.isArray(list) && list.length > 0) {
            setNotifications(prev => {
              const ids = new Set(prev.map(p => p.id));
              const newItems = list.filter((item: any) => !ids.has(item.id)).map((item: any) => ({
                id: item.id,
                type: item.type || 'system',
                title: item.title,
                message: item.message,
                user: item.user,
                anime_id: item.anime_id,
                anime_title: item.anime_title,
                rating: item.rating,
                language: item.language,
                link: item.link,
                timestamp: item.created_at ? new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent',
                read: true
              }));
              return [...prev, ...newItems].slice(0, 50);
            });
          }
        }
      } catch {}
    };
    fetchRecent();
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const markAsRead = useCallback((id: string | number) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, []);

  const triggerTestNotification = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'review',
          user: 'Tanjiro_Delhi',
          anime_title: 'Demon Slayer: Hashira Training Arc',
          rating: 9.8,
          language: 'Hindi Dub',
          message: 'The Hindi dub voice acting for Tanjiro and Giyu is simply phenomenal!'
        })
      });
      if (res.ok) {
        showToast('Test Notification Sent', 'Broadcasted across live SSE, in-app toast, and Telegram bot!', 'success');
      } else {
        // Fallback locally
        handleIncomingNotification({
          type: 'review',
          user: 'Tanjiro_Delhi',
          anime_title: 'Demon Slayer',
          rating: 9.8,
          language: 'Hindi Dub',
          message: 'Test alert: Broadcasted to live feed and Telegram bot.'
        });
      }
    } catch {
      handleIncomingNotification({
        type: 'review',
        user: 'Tanjiro_Delhi',
        anime_title: 'Demon Slayer',
        rating: 9.8,
        language: 'Hindi Dub',
        message: 'Test alert: Broadcasted to live feed and Telegram bot.'
      });
    }
  }, [handleIncomingNotification, showToast]);

  const addManualNotification = useCallback((notif: Partial<NotificationItem>) => {
    handleIncomingNotification(notif);
  }, [handleIncomingNotification]);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        isSoundEnabled,
        browserPermission,
        isLiveConnected,
        toggleSound,
        requestBrowserPermission,
        markAllAsRead,
        markAsRead,
        clearNotifications,
        triggerTestNotification,
        addManualNotification
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
