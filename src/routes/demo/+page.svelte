<script lang="ts">
  import Card from '$lib/ui/Card.svelte'
  import { onMount } from 'svelte'

  const rows = [
    { title: 'Continue Watching', items: Array.from({ length: 12 }, (_, i) => ({ id: `cw-${i}`, title: `Series ${i + 1}` })) },
    { title: 'Popular', items: Array.from({ length: 12 }, (_, i) => ({ id: `pop-${i}`, title: `Popular ${i + 1}` })) },
    { title: 'Newly Added', items: Array.from({ length: 12 }, (_, i) => ({ id: `new-${i}`, title: `New ${i + 1}` })) }
  ]

  onMount(() => {
    document.querySelector<HTMLElement>('[data-focusable]')?.focus()
  })
</script>

<div class="h-screen overflow-y-auto p-10">
  <h1 class="mb-8 text-3xl font-black text-brand">Crunchy Deck</h1>
  {#each rows as row}
    <section class="mb-10">
      <h2 class="mb-3 text-lg font-bold text-white/80">{row.title}</h2>
      <div class="flex gap-4 overflow-x-auto pb-4">
        {#each row.items as item}
          <Card id={item.id} title={item.title} />
        {/each}
      </div>
    </section>
  {/each}
</div>
