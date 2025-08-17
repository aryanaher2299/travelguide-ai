import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import queryRoutes from "./routes/query.routes.js";
// (Optional placeholder) import photoRoutes from "./routes/photo.routes.js";

dotenv.config();

if (!process.env.GOOGLE_API_KEY) {
  console.warn("⚠️  GOOGLE_API_KEY is missing in .env");
} else {
  console.log("✅ GOOGLE_API_KEY loaded");
}

const app = express();

// Basic hard-open CORS (tighten later if needed)
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));

// Routes
app.use("/query", queryRoutes);
// app.use("/photo", photoRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () =>
  console.log(`🚀 Server running on http://localhost:${PORT}`)
);
