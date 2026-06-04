import dotenv from 'dotenv'
dotenv.config()

import express from 'express'
import http from 'http'
import mongoose from 'mongoose'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { Server as SocketIO } from 'socket.io'

import messagesRouter from './routes/messages.js'

// Environment
const PORT = process.env.PORT || 3000
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/securechat'
const NODE_ENV = process.env.NODE_ENV || 'development'
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*'

// Express app
const app = express()

// Security and parsing middleware
app.use(helmet())
app.use(express.json({ limit: '10kb' }))
app.use(express.urlencoded({ extended: true }))
app.use(cors({ origin: CORS_ORIGIN }))
if (NODE_ENV === 'development') app.use(morgan('dev'))

// Health check
app.get('/healthz', (_req, res) => res.json({ ok: true, env: NODE_ENV }))

// Mount messages router at /messages
app.use('/messages', messagesRouter)

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

// Basic Socket.IO handlers (join/leave rooms per conversation)
io.on('connection', (socket) => {
  console.log('Socket connected', socket.id)

  socket.on('join', ({ conversationId }) => {
    if (conversationId) socket.join(conversationId)
  })

  socket.on('leave', ({ conversationId }) => {
    if (conversationId) socket.leave(conversationId)
  })

  socket.on('disconnect', () => {
    console.log('Socket disconnected', socket.id)
  })
})

// Start server after successful DB connection
async function start() {
  try {
    await mongoose.connect(MONGO_URI)
    console.log('Connected to MongoDB')

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
