import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import authRoutes from "./routes/auth";
import connectionRoutes from "./routes/connection";
import chatRoutes from "./routes/chat";
import knowledgeRoutes from "./routes/knowledge";
import userRoutes from "./routes/user";

// Register models so Mongoose knows them before any package references them by name
import "./models/KnowledgeSource";
import "./models/KnowledgeChunk";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/wup";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000";

// Middleware
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: "2mb" }));

// MongoDB Connection
mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log("[WUP API] Connected to MongoDB");
    
    // Migration: update all users to have freeTierLimit: 50 if they have less
    try {
      const collection = mongoose.connection.db!.collection("users");
      const result = await collection.updateMany(
        { $or: [{ freeTierLimit: { $lt: 50 } }, { freeTierLimit: { $exists: false } }] },
        { $set: { freeTierLimit: 50 } }
      );
      if (result.modifiedCount > 0) {
        console.log(`[WUP API] Migrated ${result.modifiedCount} users to 50 free limit.`);
      }
    } catch (err) {
      console.error("[WUP API] Migration failed:", err);
    }

    // Maintenance: ensure indexes are clean
    try {
      const collection = mongoose.connection.db!.collection("users");
      const indexes = await collection.indexes();
      if (indexes.some(idx => idx.name === "username_1")) {
        await collection.dropIndex("username_1");
        console.log("[WUP API] Cleaned stale indexes.");
      }
    } catch (err) {
      // Index might not exist yet — safe to ignore
    }
  })
  .catch(err => console.error("[WUP API] Database connection error:", err));

// Routes
app.use("/auth", authRoutes);
app.use("/connections", connectionRoutes);
app.use("/chats", chatRoutes);
app.use("/knowledge", knowledgeRoutes);
app.use("/user", userRoutes);

// Health Check
app.get("/health", (req, res) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("[WUP API] Unhandled Error:", err);
  res.status(500).json({ error: "Internal Server Error", message: err.message });
});

app.listen(PORT, () => {
  console.log(`[WUP API] Server running on http://localhost:${PORT}`);
});

