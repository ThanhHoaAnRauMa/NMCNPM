require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const authRoutes = require("./src/routes/auth.routes");
const userRoutes = require("./src/routes/user.routes");
const groupRoutes = require("./src/routes/group.routes");
const chatRoutes = require("./src/routes/chat.routes");

const chatSocket = require("./src/socket/chat.socket");

const app = express();

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  }),
);
app.use(express.json({ limit: "10mb" }));

// const security = require("./src/middleware/security");
// app.use(security.rateLimiter);
// app.use(security.helmetConfig);
// app.use(security.xssClean);

app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/groups", groupRoutes);
app.use("/chat", chatRoutes);

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

chatSocket(io);

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => {
    console.error("❌ MongoDB error:", err.message);
    process.exit(1);
  });

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔌 Socket.io ready`);
});
