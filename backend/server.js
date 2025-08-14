import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import queryRoutes from "./routes/query.routes.js";
//import photoRoutes from "./routes/photo.routes.js";

dotenv.config();
console.log(
  "Loaded API Key:",
  process.env.GOOGLE_API_KEY ? "✅ FOUND GOOGLE API KEY" : "❌ MISSING"
);

const app = express();

app.use(cors());
app.use(express.json());

// Register routes
app.use("/query", queryRoutes);
//app.use("/photo", photoRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
