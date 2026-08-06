export const CATEGORIES = [
  { id: 'all',           label: 'For You',       emoji: '🔥' },
  { id: 'news',          label: 'News',           emoji: '📰' },
  { id: 'sports',        label: 'Sports',         emoji: '⚽' },
  { id: 'entertainment', label: 'Entertainment',  emoji: '🎬' },
  { id: 'music',         label: 'Music',          emoji: '🎵' },
  { id: 'movies',        label: 'Movies',         emoji: '🎥' },
  { id: 'kids',          label: 'Kids',           emoji: '🧸' },
  { id: 'documentary',   label: 'Docs',           emoji: '🌍' },
  { id: 'cooking',       label: 'Cooking',        emoji: '👨‍🍳' },
  { id: 'travel',        label: 'Travel',         emoji: '✈️' },
  { id: 'religious',     label: 'Faith',          emoji: '✨' },
  { id: 'business',      label: 'Business',       emoji: '💼' },
  { id: 'weather',       label: 'Weather',        emoji: '🌤️' },
  { id: 'science',       label: 'Science',        emoji: '🔬' },
  { id: 'auto',          label: 'Auto',           emoji: '🚗' },
  { id: 'general',       label: 'General',        emoji: '📺' },
] as const;

export type CategoryId = typeof CATEGORIES[number]['id'];

export const PAGE_SIZE = 20;
