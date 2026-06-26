<script lang="ts">
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'
  onMount(() => goto('/home'))
</script>

<p class="p-8 text-white/60">Loading…</p>
