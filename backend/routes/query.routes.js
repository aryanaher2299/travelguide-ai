// backend/routes/query.routes.js
import express from "express";
import fetch from "node-fetch";

const router = express.Router();

/** ---------- Helpers ---------- **/

// Your strict schemas + task prompts, reused per step
const promptFor = ({ kind, trip, anchors = [], attraction }) => {
  const base = `
You are a travel assistant. Return ONLY VALID JSON (no markdown code fences).

SCHEMAS (use EXACT keys):

Attractions:
{
  "attractions": [
    {
      "name": "string",
      "description": "string",
      "location": "string",
      "importance": "must see" | "can see if time permits",
      "entry_fees": { "label": "price or NA", "...": "..." },  // free-form, only relevant items
      "operation_duration": "string"
    }
  ]
}

Hotels:
{
  "hotels": [
    {
      "name": "string",
      "rating": number,
      "priceRange": "string",
      "location": "string",
      "pros_and_cons": { "pros": ["string"], "cons": ["string"] }
    }
  ]
}

Restaurants:
{
  "food": [
    {
      "name": "string",
      "cuisineType": "string",
      "rating": number,
      "priceRange": "string",
      "location": "string",
      "pros_and_cons": { "pros": ["string"], "cons": ["string"] }
    }
  ]
}
`.trim();

  const dest = trip?.destination || "the destination";
  const budget = trip?.budget || "No preference";
  const near = anchors?.length
    ? `near: ${anchors.join("; ")}`
    : "near the main attractions";

  if (kind === "attractions") {
    return `
${base}

TASK: List 10 attractions for ${dest}.
- Use "importance" to mark essentials as "must see".
- "entry_fees" is a free-form object: include ONLY relevant items for each place
  (e.g., "Indian", "Student", "Audio Guide", "Light Show", "Elephant Ride", etc.). Omit keys that don't apply.
- Add "operation_duration" if commonly known.
- Descriptions concise (1–3 sentences).
Return ONLY JSON as per schema.
`.trim();
  }

  if (kind === "hotels") {
    return `
${base}

TASK: Recommend 8 hotels in ${dest} ${near}.
- Optimize for minimal commute to sights above.
- Respect budget: ${budget}.
- "rating" must be numeric (e.g., 8.9).
- "priceRange" human readable.
- Provide balanced "pros_and_cons".
Return ONLY JSON as per schema.
`.trim();
  }

  if (kind === "food") {
    return `
${base}

TASK: Recommend 8 restaurants in ${dest} ${near}.
- Mix of local must-try + a couple hidden gems.
- Include cuisineType, rating, priceRange.
- Provide balanced "pros_and_cons".
Return ONLY JSON as per schema.
`.trim();
  }

  // NEW: deep details for one attraction (for the modal)
  if (kind === "attraction_details") {
    const { name, location } = attraction || {};
    return `
${base}

Give deeper details for this attraction:
- Name: ${name || ""}
- Area: ${location || trip?.destination || ""}

Return:
{
  "name": "string",
  "summary": "2–3 sentences",
  "history": "3–5 short sentences max",
  "best_time": "times/seasons",
  "time_required": "e.g., 1.5–2 hours",
  "how_to_reach": ["brief bullets"],
  "tips": ["brief bullets"],
  "crowd_level": "low|moderate|high",
  "nearby": ["other nearby sights"],
  "scams_warnings": ["optional bullets"]
}
Only JSON.
`.trim();
  }

  // Fallback
  return `
${base}

Based on the user's query, return ONLY the appropriate top-level key(s)
(e.g., "food", "hotels", "attractions", "scams") following the schemas above.
`.trim();
};

// Best‑effort JSON parse on responses that may include fences
const cleanAndParse = (text) => {
  if (!text) return null;
  const clean = String(text)
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  try {
    return JSON.parse(clean);
  } catch {
    return null;
  }
};

/** ---------- Route ---------- **/

router.post("/", async (req, res) => {
  try {
    const { prompt, kind, trip, anchors, attraction } = req.body || {};
    if (!prompt && !kind) {
      return res
        .status(400)
        .json({ error: "Provide either 'prompt' or 'kind'." });
    }

    const finalPrompt = kind
      ? promptFor({ kind, trip, anchors, attraction })
      : prompt;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${process.env.GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: finalPrompt }] }], // ✅ keep simple; no response_mime_type here
          // generationConfig: { response_mime_type: "application/json" } // ❌ remove this
        }),
      }
    );

    const data = await response.json();
    if (data.error) {
      console.error("❌ Gemini Error:", data.error);
      return res.status(400).json({ error: data.error });
    }

    // Try to extract and parse JSON from text
    const rawText =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ??
      data?.candidates?.[0]?.content?.parts?.[0]?.inline_data ??
      "";

    const parseLooseJson = (txt) => {
      if (!txt) return null;
      const clean = String(txt)
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();

      // Try direct parse first
      try {
        return JSON.parse(clean);
      } catch {}

      // Fallback: grab first {...} block (handles leading chatter)
      const start = clean.indexOf("{");
      const end = clean.lastIndexOf("}");
      if (start !== -1 && end !== -1 && end > start) {
        const slice = clean.slice(start, end + 1);
        try {
          return JSON.parse(slice);
        } catch {}
      }
      return null;
    };

    const outJSON = parseLooseJson(rawText);
    if (outJSON) return res.json({ json: outJSON });

    // Last resort: return raw so frontend can attempt parsing too
    console.warn("⚠️ Could not parse JSON cleanly, returning text fallback.");
    return res.json({ response: rawText || "No response" });
  } catch (error) {
    console.error("❌ Gemini API error:", error);
    return res.status(500).json({ error: error.message });
  }
});
export default router;
