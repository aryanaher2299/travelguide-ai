import express from "express";
import fetch from "node-fetch";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { prompt } = req.body;

    // Ensure prompt is valid
    if (!prompt || prompt.trim() === "") {
      console.error("❌ Empty prompt received");
      return res.status(400).json({ error: "Prompt cannot be empty." });
    }

    // Add context: Make Gemini only return JSON
    const fullPrompt = `
      You are a travel assistant. Based on the query, return ONLY valid JSON.
      If the query is about "food nearby", return:
      {
        "food": [{ "name": "...", "cuisineType": "...", "rating": "...", "priceRange": "...", "location": "...", "pros": "...", "cons": "..." }]
      }
      If the query is about "hotels nearby", return:
      {
        "hotels": [{ "name": "...", "rating": "...", "priceRange": "...", "location": "...", "pros": "...", "cons": "..." }]
      }
      For general travel queries, return ONLY valid JSON:
       - attractions: an array of { name, description, location, importance(must see or can see if time permits), entry fees, operation duration}
      - hotels: an array of { name, rating(avg based on multiple sites), priceRange, location, pros and cons based on reviews online}
      - scams: an array of { title, description }
      
      Query: ${prompt}
    `;

    console.log("🔹 Sending to Gemini:", fullPrompt);

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
      console.error("❌ Gemini Error:", data.error);
      return res.status(400).json({ error: data.error });
    }

    const output =
      data.candidates?.[0]?.content?.parts?.[0]?.text || "No response";

    console.log("✅ Gemini Response:", output);

    return res.json({ response: output });
  } catch (error) {
    console.error("❌ Gemini API error:", error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
