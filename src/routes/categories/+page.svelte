<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { authGuard } from '$lib/api/guard'
  import ChipPicker from '$lib/ui/ChipPicker.svelte'

  let chips: { id: string; title: string }[] = $state([])
  let loading = $state(true)
  let error = $state('')

  onMount(async () => {
    if (!window.cr) {
      loading = false
      error = 'Preload bridge unavailable.'
      return
    }
    const s = await window.cr.auth.status()
    if (!s.ok || !s.data.authenticated) {
      goto('/login')
      return
    }
    const res = await window.cr.api.categories()
    loading = false
    if (!res.ok) {
      if (authGuard(res)) return
      error = res.error
      return
    }
    chips = res.data
    requestAnimationFrame(() =>
      document.querySelector<HTMLElement>('#app-content [data-focusable]')?.focus()
    )
  })
</script>

<ChipPicker
  title="Categories"
  {chips}
  {loading}
  {error}
  idPrefix="cat"
  href={(c) => `/browse?categories=${encodeURIComponent(c.id)}&title=${encodeURIComponent(c.title)}`}
/>
