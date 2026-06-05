export function getHealthPayload() {
  return {
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  }
}

export function registerHealthRoutes(app, { env } = {}) {
  app.get('/health', (_req, res) => res.json(getHealthPayload()))
  app.get('/healthz', (_req, res) => res.json({ ok: true, env }))
}
