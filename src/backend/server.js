// Đọc các biến từ file .env — phải gọi đầu tiên trước mọi thứ khác
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const authRoutes = require("./src/routes/auth.routes");

const app = express();

// cors(): cho phép Frontend ở domain khác (Vercel) gọi API này
app.use(cors());

// express.json(): tự động đọc body JSON từ request
// Không có dòng này thì req.body sẽ bị undefined
app.use(express.json());

// Gắn route: mọi request bắt đầu bằng /auth đi vào authRoutes
app.use("/auth", authRoutes);

// Health check: Tuân dùng để CI/CD kiểm tra server còn sống không
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Kết nối MongoDB Atlas
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => {
    console.error("❌ MongoDB error:", err.message);
    process.exit(1);
  });

// Khởi động server lắng nghe trên cổng PORT
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
