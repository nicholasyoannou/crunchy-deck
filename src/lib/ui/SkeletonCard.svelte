<script lang="ts">
  let { episode = false }: { episode?: boolean } = $props()
</script>

<div
  class="shimmer shrink-0 rounded-card {episode ? 'h-[150px] w-[266px]' : 'h-[290px] w-[195px]'}"
></div>
