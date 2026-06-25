import dotenv from 'dotenv'
dotenv.config()

import express from 'express'
import http from 'http'
import mongoose from 'mongoose'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { Server as SocketIO } from 'socket.io'

import aiRouter from './routes/ai.js'
import { registerHealthRoutes } from './health.js'
import messagesRouter from './routes/messages.js'
import authRouter from './backend/src/routes/auth.routes.js'
import userRouter from './backend/src/routes/user.routes.js'
import chatRouter from './backend/src/routes/chat.routes.js'
import groupRouter from './backend/src/routes/group.routes.js'
import fileRouter from './backend/src/routes/file.routes.js'
import kycRouter from './backend/src/routes/kyc.routes.js'
import registerChatSocket from './backend/src/socket/chat.socket.js'
import authMiddleware from './backend/src/middleware/auth.middleware.js'
import rateLimitMiddleware from './backend/src/middleware/rateLimit.middleware.js'
import User from './backend/src/models/User.model.js'

// Environment
const PORT = process.env.PORT || 3000
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/securechat'
const NODE_ENV = process.env.NODE_ENV || 'development'
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*'
const JSON_BODY_LIMIT = process.env.JSON_BODY_LIMIT || '128kb'

// Express app
const app = express()

// Security and parsing middleware
app.use(helmet())
app.use(express.json({ limit: JSON_BODY_LIMIT }))
app.use(express.urlencoded({ extended: true }))
app.use(cors({ origin: CORS_ORIGIN }))
if (NODE_ENV === 'development') app.use(morgan('dev'))

// Health checks
registerHealthRoutes(app, { env: NODE_ENV })

// Mount messages router at /messages
const { verifyToken } = authMiddleware
const { createRateLimiter } = rateLimitMiddleware
const searchLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 60 })
const aiLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 30 })

app.use('/messages', verifyToken, searchLimiter, messagesRouter)
app.use('/ai', verifyToken, aiLimiter, aiRouter)
app.use('/auth', authRouter)
app.use('/users', userRouter)
app.use('/chat', chatRouter)
app.use('/groups', groupRouter)
app.use('/files', fileRouter)
app.use('/kyc', kycRouter)

// Generic error handler
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err)
  res.status(err?.status || 500).json({ error: 'internal_server_error' })
})

// Create HTTP server and attach Socket.IO for real-time features
const server = http.createServer(app)
const io = new SocketIO(server, {
  cors: { origin: CORS_ORIGIN },
})
app.set('io', io)

registerChatSocket(io)

// Start server after successful DB connection
async function start() {
  try {
    await mongoose.connect(MONGO_URI)
    console.log('Connected to MongoDB')
    await User.init().catch((error) => {
      console.warn('Could not ensure user indexes:', error.message)
    })
    await User.updateMany(
      { $or: [{ usernameLower: { $exists: false } }, { usernameLower: null }] },
      [{ $set: { usernameLower: { $toLower: '$username' } } }],
    ).catch((error) => {
      console.warn('Could not backfill usernameLower for legacy users:', error.message)
    })

    server.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`)
    })
  } catch (err) {
    console.error('Failed to start server', err)
    process.exit(1)
  }
}

start()

// Graceful shutdown
async function shutdown() {
  console.log('Shutting down...')
  server.close(() => console.log('HTTP server closed'))
  try {
    await mongoose.disconnect()
    console.log('MongoDB disconnected')
  } catch (err) {
    console.error('Error during MongoDB disconnect', err)
  }
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

// Export app for testing utilities (optional)
export { app, server, io }
