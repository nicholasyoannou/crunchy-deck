// See https://svelte.dev/docs/kit/types#app
declare global {
  namespace App {}
  interface Window {
    cr: { version: string }
  }
}

export {}
