<script lang="ts">
  import { goto } from '$app/navigation'
  import { navOpen, closeNav } from '$lib/nav/overlays'
  import { NAV_ITEMS } from '$lib/nav/items'

  function select(route: string) {
    closeNav()
    goto(route)
  }

  // Pull focus into the menu when it opens; hand it back to page content on close.
  let wasOpen = false
  $effect(() => {
    const open = $navOpen
    if (open && !wasOpen) {
      requestAnimationFrame(() => document.getElementById(`nav-${NAV_ITEMS[0].key}`)?.focus())
    } else if (!open && wasOpen) {
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>('#app-content [data-focusable]')?.focus()
      )
    }
    wasOpen = open
  })
</script>

{#if $navOpen}
  <button aria-label="Close menu" tabindex="-1" class="fixed inset-0 z-40 bg-black/60" onclick={closeNav}
  ></button>
  <nav class="fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-surface-1 p-4 shadow-2xl">
    <div class="mb-4 shrink-0 px-3 text-lg font-black text-brand">Crunchy Deck</div>
    <!-- min-h-0 + flex-1 lets this scroll under the pinned title; moveFocus's scrollIntoView
         then keeps the focused item visible as you D-pad down to Settings. -->
    <div class="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
      {#each NAV_ITEMS as item}
        <button
          id={`nav-${item.key}`}
          data-focusable
          data-focus-self
          onclick={() => select(item.route)}
          class="flex shrink-0 items-center gap-3 rounded-card px-3 py-3 text-left text-base font-bold text-white/80 outline-none transition select:bg-surface-3 select:text-white"
        >
          <span class="w-6 text-center text-lg">{item.icon}</span>
          <span>{item.label}</span>
        </button>
      {/each}
    </div>
  </nav>
{/if}
