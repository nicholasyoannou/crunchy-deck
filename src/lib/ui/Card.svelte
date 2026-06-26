<script lang="ts">
  let { id, title }: { id: string; title: string } = $props()
</script>

<button
  {id}
  data-focusable
  class="group relative h-[290px] w-[195px] shrink-0 overflow-hidden rounded-card bg-surface-2
         transition-transform duration-150 ease-out outline-none
         select:scale-105 select:shadow-2xl select:shadow-black/60"
>
  <div class="flex h-full w-full items-end bg-gradient-to-t from-black/70 to-surface-3 p-3">
    <span class="text-left text-sm font-bold leading-tight">{title}</span>
  </div>
  <div
    class="pointer-events-none absolute inset-0 rounded-card ring-0 ring-brand transition-all group-select:ring-4"
  ></div>
</button>
