export interface IPTVChannel {
  id: string;
  name: string;
  logo: string;
  country: string;
  countryCode: string;
  languages: string[];
  categories: string[];
  streamUrl: string;
  website?: string;
  alt_names?: string[];
  network?: string;
}

export interface Comment {
  id: string;
  channel_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user_profiles?: { username: string };
}

export interface Reaction {
  id: string;
  channel_id: string;
  user_id: string;
  type: string;
  created_at: string;
}

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  avatar?: string;
}

export interface ChannelPage {
  items: IPTVChannel[];
  hasMore: boolean;
  total: number;
}

export interface Favorite {
  id: string;
  user_id: string;
  channel_id: string;
  channel_data: IPTVChannel;
  created_at: string;
}

export interface CountryInfo {
  code: string;
  name: string;
  flag: string;
  count: number;
}

export interface TrendingChannel {
  channel_id: string;
  score: number;
  channel?: IPTVChannel;
}

export interface WatchHistoryItem {
  channelId: string;
  name: string;
  logo: string;
  country: string;
  countryCode: string;
  categories: string[];
  watchedAt: string; // ISO string
}

export interface QualityLevel {
  level: number;       // hls.js level index, -1 = auto
  height: number;
  bitrate: number;
  label: string;
}

/** Unified notification type used across the app */
export interface AppNotification {
  id: string;
  type: 'reaction' | 'comment' | 'system';
  title: string;
  body: string;
  channelId?: string;
  channelName?: string;
  read: boolean;
  createdAt: string;
}

export type Language = 'en' | 'fr' | 'es' | 'ar' | 'zh';

// ── Social types ─────────────────────────────────────────────────────
export interface SocialPost {
  id: string;
  user_id: string;
  content: string;
  media_urls: string[];
  hashtags: string[];
  channel_id?: string;
  repost_of?: string;
  quote_of?: string;
  like_count: number;
  repost_count: number;
  reply_count: number;
  view_count: number;
  created_at: string;
  user_profiles?: SocialUserProfile;
  isLiked?: boolean;
  isReposted?: boolean;
}

export interface SocialUserProfile {
  id: string;
  username: string;
  email: string;
}

export interface SocialFollow {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
}

export interface DirectMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  media_url?: string;
  read_at?: string;
  created_at: string;
}

export interface PremiumSubscription {
  id: string;
  user_id: string;
  pesapal_order_id?: string;
  pesapal_tracking?: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  plan: string;
  expires_at?: string;
  created_at: string;
}
