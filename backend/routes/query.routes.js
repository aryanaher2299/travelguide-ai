import express from "express";
import fetch from "node-fetch";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { prompt } = req.body;

    const fullPrompt = `
      You are a travel assistant. Given the user's query, return a JSON response with ONLY:
      - attractions: an array of { name, description, location, importance(must see or can see if time permits), entry fees, operation duration}
      - hotels: an array of { name, rating(avg based on multiple sites), priceRange, location, pros and cons based on reviews online}
      - scams: an array of { title, description }
      Query: ${prompt}
    `;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${process.env.GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }],
        }),
      }
    );

    const data = await response.json();

    if (data.error) {
      return res.status(400).json({ error: data.error });
    }

    const output = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

    res.json({ response: output }); // Always respond with JSON
  } catch (error) {
    console.error("Gemini API error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
