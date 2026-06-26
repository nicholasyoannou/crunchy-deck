<script lang="ts">
  import Shaka from '$lib/player/Shaka.svelte'
  // Shaka's public Widevine test asset + permissive CWIP license proxy.
  // Proves the CDM pipeline independent of Crunchyroll.
  const manifest = 'https://storage.googleapis.com/shaka-demo-assets/angel-one-widevine/dash.mpd'
  const license = 'https://cwip-shaka-proxy.appspot.com/no_auth'
</script>

<div class="p-6">
  <h1 class="mb-4 text-xl font-bold">Widevine M0 spike</h1>
  <Shaka {manifest} {license} />
</div>
