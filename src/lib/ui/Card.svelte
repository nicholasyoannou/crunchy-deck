<script lang="ts">
  let { id, title }: { id: string; title: string } = $props()
</script>

<button
  {id}
  data-focusable
  data-focus-self
  class="group relative h-[290px] w-[195px] shrink-0 overflow-hidden rounded-card bg-surface-2
         outline-none transition-[transform,box-shadow] duration-150 ease-out
         select:scale-105 select:shadow-[0_0_0_3px_#F47521,0_14px_34px_rgba(0,0,0,0.65)]"
>
  <div class="flex h-full w-full items-end bg-gradient-to-t from-black/70 to-surface-3 p-3">
    <span class="text-left text-sm font-bold leading-tight">{title}</span>
  </div>
</button>
