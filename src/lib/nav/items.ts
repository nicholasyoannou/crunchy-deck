export interface NavItem {
  key: string
  label: string
  icon: string // Icon.svelte name (see src/lib/ui/Icon.svelte)
  route: string
}

export interface NavGroup {
  label?: string // optional small section heading; omitted for the lead group
  items: NavItem[]
}

// Main destinations, grouped. Order mirrors the reference TV app (Search/Home lead). Profiles +
// Settings live in the sidebar FOOTER (identity), not in these rows. Only routes that exist are
// listed so the menu never dead-ends on a 404.
export const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { key: 'search', label: 'Search', icon: 'search', route: '/search' },
      { key: 'home', label: 'Home', icon: 'home', route: '/home' },
      { key: 'watchlist', label: 'Watchlist', icon: 'bookmark', route: '/watchlist' },
      { key: 'history', label: 'History', icon: 'history', route: '/history' }
    ]
  },
  {
    label: 'Discover',
    items: [
      { key: 'browse', label: 'Browse', icon: 'compass', route: '/browse' },
      { key: 'categories', label: 'Categories', icon: 'category', route: '/categories' },
      { key: 'seasons', label: 'Simulcasts', icon: 'calendar', route: '/seasons' }
    ]
  }
]

// Flat list of the row items (initial-focus target + current-route lookup).
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items)

// Footer (identity) destinations.
export const SETTINGS_ITEM: NavItem = { key: 'settings', label: 'Settings', icon: 'settings', route: '/settings' }
export const PROFILES_ROUTE = '/profiles'
