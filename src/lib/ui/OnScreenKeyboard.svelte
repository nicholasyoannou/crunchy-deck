<script lang="ts">
  // Controller-driven text entry. The Steam OSK only appears for apps launched through
  // Steam game-mode, so a terminal/desktop launch needs this in-app keyboard. Keys are
  // data-focusable and edit `value` via onchange; the page debounces the actual search.
  let {
    value,
    onchange
  }: { value: string; onchange: (v: string) => void } = $props()

  const ROWS = ['1234567890', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm']

  const press = (ch: string) => onchange(value + ch)
  const backspace = () => onchange(value.slice(0, -1))
  const space = () => onchange(value + ' ')
  const clear = () => onchange('')

  const keyCls =
    'h-12 min-w-12 grid place-items-center rounded-lg bg-surface-2 px-3 text-lg font-bold uppercase outline-none transition select:bg-brand select:text-black'
</script>

<div class="select-none">
  {#each ROWS as row, r}
    <div class="mb-2 flex gap-2">
      {#each row.split('') as ch, c}
        <button id={`key-${r}-${c}`} data-focusable data-focus-self onclick={() => press(ch)} class={keyCls}
          >{ch}</button
        >
      {/each}
    </div>
  {/each}
  <div class="flex gap-2">
    <button id="key-space" data-focusable data-focus-self onclick={space} class="{keyCls} flex-1">Space</button>
    <button id="key-back" data-focusable data-focus-self onclick={backspace} class="{keyCls} w-20">⌫</button>
    <button id="key-clear" data-focusable data-focus-self onclick={clear} class="{keyCls} w-20">Clear</button>
  </div>
</div>
