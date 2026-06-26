import type { Config } from 'tailwindcss'
import plugin from 'tailwindcss/plugin'

export default {
  content: ['./src/**/*.{html,svelte,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: '#F47521', // Crunchyroll orange
        surface: {
          DEFAULT: '#0a0a0a',
          1: '#141414',
          2: '#1e1e1e',
          3: '#2a2a2a'
        }
      },
      fontFamily: {
        sans: ['Nunito Variable', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'monospace']
      },
      borderRadius: { card: '0.75rem' }
    }
  },
  plugins: [
    // `select:` = hover OR keyboard/controller focus OR active -> one visual system
    plugin(({ addVariant }) => {
      addVariant('select', ['&:hover', '&:focus-visible', '&:focus', '&:active'])
      addVariant('group-select', [
        ':merge(.group):hover &',
        ':merge(.group):focus-visible &',
        ':merge(.group):focus &'
      ])
    })
  ]
} satisfies Config
