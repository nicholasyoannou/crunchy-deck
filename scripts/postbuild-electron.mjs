// dist-electron is emitted as CommonJS, but the repo root package.json is type:module.
// Drop a package.json so Node treats the compiled Electron output as CommonJS.
import { writeFileSync, mkdirSync } from 'node:fs'
mkdirSync('dist-electron', { recursive: true })
writeFileSync('dist-electron/package.json', JSON.stringify({ type: 'commonjs' }))
