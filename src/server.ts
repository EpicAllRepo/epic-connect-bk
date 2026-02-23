import http from "http";
import app from "./app";
import dotenv from "dotenv";
import connectDB from "./config/db";
import startEmailProcessor from "./utils/emailProcessor";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";

// Load env vars
dotenv.config();

// Connect DB
connectDB();

// Start Background Email Processor
startEmailProcessor();

const PORT = process.env.PORT || 5000;

/* 🔥 Create HTTP Server */
const server = http.createServer(app);

/* 🔥 Setup Socket.IO */
export const io = new Server(server, {
  cors: {
    origin: process.env.BASE_URL || "http://localhost:3000",
    credentials: true,
  },
});

/* 🔐 Socket Authentication */
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error("Unauthorized"));
    }

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    socket.data.userId = decoded.userId;

    next();
  } catch (err) {
    next(new Error("Unauthorized"));
  }
});

/* 🔥 On Connection */
io.on("connection", (socket) => {
  const userId = socket.data.userId;

  console.log("⚡ Socket connected:", userId);

  // Join personal room
  socket.join(userId);

  socket.on("disconnect", () => {
    console.log("❌ Socket disconnected:", userId);
  });
});

/* 🔥 Start Server */
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});