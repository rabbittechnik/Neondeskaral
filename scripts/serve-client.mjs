/**
 * Replit / Cloud: statisches SPA aus client/dist auf PORT und 0.0.0.0 ausliefern.
 * Zuverlässiger als "vite preview" hinter manchen Proxies.
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'client', 'dist')
const port = process.env.PORT ?? '4173'

if (!existsSync(join(dist, 'index.html'))) {
  console.error(
    'Fehler: client/dist/index.html fehlt. Bitte zuerst "npm run build:client" ausführen.',
  )
  process.exit(1)
}

const serveCli = join(root, 'node_modules', 'serve', 'build', 'main.js')
if (!existsSync(serveCli)) {
  console.error('Fehler: Paket "serve" nicht installiert. Bitte "npm install" im Projektroot.')
  process.exit(1)
}

const child = spawn(
  process.execPath,
  [serveCli, dist, '-s', '-l', `tcp://0.0.0.0:${port}`],
  { stdio: 'inherit', cwd: root },
)

child.on('exit', (code) => process.exit(code ?? 0))
