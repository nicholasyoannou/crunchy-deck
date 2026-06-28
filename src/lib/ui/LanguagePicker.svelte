<script lang="ts">
  import { fly, fade } from 'svelte/transition'
  import { cubicOut } from 'svelte/easing'
  import { picker, closePicker } from './picker'

  function pick(code: string) {
    const onSelect = $picker.onSelect
    closePicker()
    onSelect(code)
  }

  // Focus the current option when opened; hand focus back to the page on close.
  let wasOpen = false
  $effect(() => {
    const open = $picker.open
    if (open && !wasOpen) {
      requestAnimationFrame(() => {
        const cur = $picker.options.findIndex((o) => o.code === $picker.current)
        document.getElementById(`pick-${cur >= 0 ? cur : 0}`)?.focus()
      })
    } else if (!open && wasOpen) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>('#app-content [data-focusable]')?.focus())
    }
    wasOpen = open
  })
</script>

{#if $picker.open}
  <button
    aria-label="Close"
    tabindex="-1"
    class="fixed inset-0 z-[60] bg-black/70"
    onclick={closePicker}
    transition:fade={{ duration: 160 }}></button>
  <div class="fixed inset-0 z-[61] grid place-items-center p-8" transition:fade={{ duration: 160 }}>
    <div
      class="flex max-h-[80vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl bg-surface-1 shadow-2xl"
      transition:fly={{ y: 16, duration: 200, easing: cubicOut }}>
      <div class="shrink-0 px-5 pb-3 pt-5 text-lg font-extrabold text-white">{$picker.title}</div>
      <div class="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-3">
        {#each $picker.options as opt, i (opt.code)}
          {@const sel = opt.code === $picker.current}
          <button
            id={`pick-${i}`}
            data-focusable
            data-focus-self
            onclick={() => pick(opt.code)}
            class="flex shrink-0 items-center gap-3 rounded-card px-4 py-3 text-left text-[0.9375rem] font-bold outline-none transition select:scale-[1.02] select:bg-brand/15 select:text-white select:shadow-[inset_0_0_0_1.5px_#F47521] {sel
              ? 'text-white'
              : 'text-white/55'}">
            <span class="flex-1">{opt.label}</span>
            {#if sel}<span class="h-2 w-2 shrink-0 rounded-full bg-brand"></span>{/if}
          </button>
        {/each}
      </div>
    </div>
  </div>
{/if}
