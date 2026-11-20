import { env } from './config/env.js'
import { createApp } from './app.js'

const app = createApp({ seedDemo: true, sweepEveryMs: env.SWEEP_INTERVAL_MIN * 60_000 })

app.ready
  .then(() => {
    app.listen(env.PORT, () => {
      console.log(`Thulir server (${env.NODE_ENV}, db=${env.DB_DRIVER}) listening on http://localhost:${env.PORT}`)
    })
  })
  .catch((e) => {
    console.error('Start-up failed', e)
    process.exit(1)
  })
