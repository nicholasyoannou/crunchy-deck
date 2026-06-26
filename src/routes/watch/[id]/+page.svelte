<script lang="ts">
  import { page } from '$app/stores'
  let id = $derived($page.params.id)
</script>

<div class="grid h-screen place-items-center text-center">
  <div>
    <p class="mb-2 text-xl font-bold text-brand">Player</p>
    <p class="text-sm text-white/50">Episode {id}</p>
    <p class="mt-2 text-xs text-white/30">Widevine playback wires up next.</p>
  </div>
</div>
