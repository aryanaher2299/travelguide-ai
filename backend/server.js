// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import queryRoutes from "./routes/query.routes.js";

import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

dotenv.config();

const app = express();

// Allow dev, a fixed prod origin, and Vercel preview subdomains if you want
const STATIC_ALLOWED = ["http://localhost:5173"];
if (process.env.FRONTEND_ORIGIN)
  STATIC_ALLOWED.push(process.env.FRONTEND_ORIGIN);

// Optional: allow *.vercel.app previews (comment out if you want strict)
const VERCEL_REGEX = /\.vercel\.app$/i;

const corsOptions = {
  origin(origin, callback) {
    // Allow same-origin / server-to-server / curl with no Origin
    if (!origin) return callback(null, true);

    // Exact allowlist
    if (STATIC_ALLOWED.includes(origin)) return callback(null, true);

    // Preview domains (e.g., https://myapp-git-branch-user.vercel.app)
    if (VERCEL_REGEX.test(origin)) return callback(null, true);

    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  optionsSuccessStatus: 200, // helps legacy browsers with 204
};

app.use(cors(corsOptions));
app.use(express.json({ limit: "1mb" }));

// simple healthcheck
app.get("/health", (_req, res) => res.status(200).json({ ok: true }));

// API routes
app.use("/query", queryRoutes);

// Handle preflight quickly (optional)
app.options("*", cors(corsOptions));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log("   Allowed origins:", STATIC_ALLOWED.join(", ") || "(none)");
});

app.get("/check-gemini", async (req, res) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const result = await model.generateContent(
      "Say 'Hello from Gemini!' in one line"
    );
    const text = result.response.text();

    res.json({ success: true, message: text });
  } catch (error) {
    console.error("Gemini check failed:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});
