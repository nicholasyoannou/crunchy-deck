<script lang="ts">
  let { episode = false }: { episode?: boolean } = $props()
</script>

<div
  class="shrink-0 animate-pulse rounded-card bg-surface-2 {episode ? 'h-[150px] w-[266px]' : 'h-[290px] w-[195px]'}"
></div>
