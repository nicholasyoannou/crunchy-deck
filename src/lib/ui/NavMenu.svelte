<script lang="ts">
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { fly, fade } from 'svelte/transition'
  import { cubicOut } from 'svelte/easing'
  import { navOpen, closeNav } from '$lib/nav/overlays'
  import { NAV_GROUPS, NAV_ITEMS, SETTINGS_ITEM, PROFILES_ROUTE } from '$lib/nav/items'
  import { currentProfile, loadCurrentProfile, avatarUrl } from '$lib/api/profileStore'
  import Icon from './Icon.svelte'

  function select(route: string) {
    closeNav()
    goto(route)
  }

  // Current route -> active highlight. Home also covers '/'.
  const path = $derived($page.url.pathname)
  const isCurrent = (route: string) =>
    route === '/home' ? path === '/home' || path === '/' : path.startsWith(route)

  // On open: refresh the footer profile + drop focus on the current page's item (or the first).
  // On close: hand focus back to the page content.
  let wasOpen = false
  $effect(() => {
    const open = $navOpen
    if (open && !wasOpen) {
      loadCurrentProfile()
      requestAnimationFrame(() => {
        const cur = NAV_ITEMS.find((i) => isCurrent(i.route))
        document.getElementById(`nav-${cur?.key ?? NAV_ITEMS[0].key}`)?.focus()
      })
    } else if (!open && wasOpen) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>('#app-content [data-focusable]')?.focus())
    }
    wasOpen = open
  })
</script>

{#if $navOpen}
  <button
    aria-label="Close menu"
    tabindex="-1"
    class="fixed inset-0 z-40 bg-black/70"
    onclick={closeNav}
    transition:fade={{ duration: 180 }}></button>

  <nav
    class="fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-surface-1 shadow-2xl"
    transition:fly={{ x: -288, duration: 240, easing: cubicOut }}>
    <!-- header -->
    <div class="flex shrink-0 items-center gap-3 px-5 pb-4 pt-6">
      <div class="grid h-8 w-8 place-items-center rounded-lg bg-brand text-base font-black text-[#3a1c08]">C</div>
      <div class="text-base font-extrabold tracking-tight text-white">Crunchy Deck</div>
    </div>

    <!-- groups (scroll under the pinned header/footer; moveFocus's scrollIntoView keeps focus visible) -->
    <div class="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-1">
      {#each NAV_GROUPS as group}
        {#if group.label}
          <div class="px-3 pb-1 pt-4 text-[0.625rem] font-extrabold uppercase tracking-[0.14em] text-white/30">
            {group.label}
          </div>
        {/if}
        {#each group.items as item (item.key)}
          {@const current = isCurrent(item.route)}
          <button
            id={`nav-${item.key}`}
            data-focusable
            data-focus-self
            aria-current={current ? 'page' : undefined}
            onclick={() => select(item.route)}
            class="group relative flex shrink-0 items-center gap-3 rounded-card px-3 py-2.5 text-left text-[0.9375rem] font-bold outline-none transition duration-150 select:scale-[1.02] select:bg-brand/15 select:text-white select:shadow-[inset_0_0_0_1.5px_#F47521] {current
              ? 'text-white'
              : 'text-white/55'}">
            <span
              class="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-full bg-brand transition-opacity duration-150 {current
                ? 'opacity-100'
                : 'opacity-0'}"></span>
            <span class="transition-colors duration-150 {current ? 'text-brand' : 'text-white/45 group-select:text-brand'}">
              <Icon name={item.icon} size={20} />
            </span>
            <span>{item.label}</span>
            {#if current}<span class="ml-auto h-1.5 w-1.5 rounded-full bg-brand"></span>{/if}
          </button>
        {/each}
      {/each}
    </div>

    <!-- footer: identity (switch profile) + settings -->
    <div class="flex shrink-0 items-center gap-2 border-t border-white/10 p-3">
      <button
        id="nav-profiles"
        data-focusable
        data-focus-self
        data-right="#nav-settings"
        aria-current={isCurrent(PROFILES_ROUTE) ? 'page' : undefined}
        onclick={() => select(PROFILES_ROUTE)}
        class="group flex min-w-0 flex-1 items-center gap-3 rounded-card px-2 py-2 text-left outline-none transition select:bg-white/5 select:shadow-[inset_0_0_0_1.5px_#F47521]">
        {#if $currentProfile?.avatar}
          <img
            src={avatarUrl($currentProfile.avatar)}
            alt=""
            class="h-9 w-9 shrink-0 rounded-lg object-cover ring-1 ring-white/10" />
        {:else}
          <div class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-3 text-white/55">
            <Icon name="user" size={20} />
          </div>
        {/if}
        <span class="min-w-0 flex-1">
          <span class="block truncate text-sm font-bold text-white">{$currentProfile?.name ?? 'Profile'}</span>
          <span class="flex items-center gap-0.5 text-[0.6875rem] font-bold text-brand">
            Switch profile <Icon name="chevron-right" size={12} stroke={2.5} />
          </span>
        </span>
      </button>
      <button
        id="nav-settings"
        data-focusable
        data-focus-self
        data-left="#nav-profiles"
        aria-label="Settings"
        aria-current={isCurrent(SETTINGS_ITEM.route) ? 'page' : undefined}
        onclick={() => select(SETTINGS_ITEM.route)}
        class="grid h-11 w-11 shrink-0 place-items-center rounded-card outline-none transition select:bg-brand/15 select:shadow-[inset_0_0_0_1.5px_#F47521] {isCurrent(
          SETTINGS_ITEM.route
        )
          ? 'text-brand'
          : 'text-white/55 select:text-brand'}">
        <Icon name="settings" size={20} />
      </button>
    </div>
  </nav>
{/if}
