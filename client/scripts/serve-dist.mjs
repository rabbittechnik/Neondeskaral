/**
 * Statisches SPA aus ./dist (relativ zum client-Paket).
 * Liegt im Workspace-Paket, damit Railpack/Railway die Datei in der Runtime behält.
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const clientRoot = join(__dirname, '..')
const dist = join(clientRoot, 'dist')
const port = process.env.PORT ?? '4173'

if (!existsSync(join(dist, 'index.html'))) {
  console.error(
    '[static] FEHLER: dist/index.html fehlt. Build zuerst ausführen (z. B. npm run build --workspace=client).',
  )
  console.error('[static] clientRoot=', clientRoot)
  process.exit(1)
}

const require = createRequire(import.meta.url)
let serveMain
try {
  serveMain = require.resolve('serve/build/main.js', { paths: [clientRoot] })
} catch {
  console.error(
    '[static] Paket "serve" nicht auflösbar. Prüfe dependencies in client/package.json.',
  )
  process.exit(1)
}

console.info(`[static] ${dist} -> http://0.0.0.0:${port}/`)

const child = spawn(
  process.execPath,
  [serveMain, dist, '-s', '-l', `tcp://0.0.0.0:${port}`],
  { stdio: 'inherit', cwd: clientRoot },
)

child.on('exit', (code) => process.exit(code ?? 0))
