import cors from 'cors'
import express from 'express'
import { adminApiGate } from './middleware/adminApiGate.js'
import { stationsRouter } from './routes/stations.routes.js'
import { employeesRouter } from './routes/employees.routes.js'
import { workAreasRouter } from './routes/workAreas.routes.js'
import { shiftsRouter } from './routes/shifts.routes.js'
import { absencesRouter } from './routes/absences.routes.js'
import { vacationBlocksRouter } from './routes/vacationBlocks.routes.js'
import { tasksRouter, taskLogsRouter } from './routes/tasks.routes.js'
import { timeEntriesRouter, terminalRouter } from './routes/timeTracking.routes.js'
import { devRouter } from './routes/dev.routes.js'
import { authRouter } from './routes/auth.routes.js'
import { employeeAccessRouter } from './routes/employeeAccess.routes.js'
import { scheduleAssistantRouter } from './routes/scheduleAssistant.routes.js'

function parseCorsOrigins(): boolean | string[] {
  const raw = process.env.CLIENT_ORIGIN?.trim()
  if (!raw || raw === '*') return true
  return raw.split(',').map((s) => s.trim()).filter(Boolean)
}

export function createApp() {
  const app = express()
  app.use(
    cors({
      origin: parseCorsOrigins(),
      credentials: true,
    }),
  )
  app.use(express.json({ limit: '2mb' }))

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'neonshift-server' })
  })

  app.use(adminApiGate)

  app.use('/api/auth', authRouter)
  app.use('/api/employee-access', employeeAccessRouter)
  app.use('/api/terminal', terminalRouter)

  app.use('/api/schedule-assistant', scheduleAssistantRouter)
  app.use('/api/stations', stationsRouter)
  app.use('/api/employees', employeesRouter)
  app.use('/api/work-areas', workAreasRouter)
  app.use('/api/shifts', shiftsRouter)
  app.use('/api/absences', absencesRouter)
  app.use('/api/vacation-blocks', vacationBlocksRouter)
  app.use('/api/tasks', tasksRouter)
  app.use('/api/task-logs', taskLogsRouter)
  app.use('/api/time-entries', timeEntriesRouter)
  app.use('/api/dev', devRouter)

  app.use((_req, res) => {
    res.status(404).json({ ok: false, error: 'Nicht gefunden' })
  })

  return app
}
