import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import authRoutes from "./routes/auth";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/wup";

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log("[WUP API] Connected to MongoDB");
    // Maintenance: ensure indexes are clean
    try {
      const collection = mongoose.connection.db.collection("users");
      const indexes = await collection.indexes();
      if (indexes.some(idx => idx.name === "username_1")) {
        await collection.dropIndex("username_1");
        console.log("[WUP API] Cleaned stale indexes.");
      }
    } catch (err) {
      // Index might not exist yet
    }
  })
  .catch(err => console.error("[WUP API] Database connection error:", err));

// Routes
app.use("/auth", authRoutes);

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
  console.log(`[WUP API] Infrastructure running on http://localhost:${PORT}`);
});
