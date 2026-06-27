export interface NavItem {
  key: string
  label: string
  icon: string
  route: string
}

// Destinations shown in the left overlay. Order mirrors the reference TV app
// (Search, Home, …). Grows as later phases land (Watchlist, Browse, History, …);
// only routes that actually exist are listed so the menu never dead-ends on a 404.
export const NAV_ITEMS: NavItem[] = [
  { key: 'search', label: 'Search', icon: '🔍', route: '/search' },
  { key: 'home', label: 'Home', icon: '🏠', route: '/home' },
  { key: 'watchlist', label: 'Watchlist', icon: '🔖', route: '/watchlist' },
  { key: 'history', label: 'History', icon: '🕘', route: '/history' },
  { key: 'browse', label: 'Browse', icon: '🧭', route: '/browse' },
  { key: 'categories', label: 'Categories', icon: '🏷️', route: '/categories' },
  { key: 'seasons', label: 'Simulcasts', icon: '📅', route: '/seasons' },
  { key: 'profiles', label: 'Profiles', icon: '👤', route: '/profiles' },
  { key: 'settings', label: 'Settings', icon: '⚙️', route: '/settings' }
]
