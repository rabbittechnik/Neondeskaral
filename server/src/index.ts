import 'dotenv/config'
import { createApp } from './app.js'
import { initDatabase } from './db/database.js'

initDatabase()

const app = createApp()
const PORT = Number(process.env.PORT) || 3001
const HOST = process.env.HOST || '0.0.0.0'

app.listen(PORT, HOST, () => {
  console.log(`Neonshift API http://${HOST}:${PORT}/api/health`)
})
