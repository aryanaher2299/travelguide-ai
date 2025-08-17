// backend/routes/query.routes.js
import express from "express";
import fetch from "node-fetch";

const router = express.Router();

/* ----------------- Small utils ------------------ */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry(url, options, tries = 3) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, options);
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`${res.status} ${res.statusText} :: ${txt}`);
      }
      return res;
    } catch (e) {
      lastErr = e;
      if (i < tries - 1) await sleep(400 * (i + 1));
    }
  }
  throw lastErr;
}

function looseParseJSON(text) {
  if (!text) return null;
  const clean = String(text)
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  try {
    return JSON.parse(clean);
  } catch {
    // try to find the largest {...} block
    const start = clean.indexOf("{");
    const end = clean.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      const slice = clean.slice(start, end + 1);
      try {
        return JSON.parse(slice);
      } catch {}
    }
    return null;
  }
}

/* ----------------- Prompt builder ------------------ */
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
      "entry_fees": {
        // include only relevant items for that attraction; omit items that don't apply
        "Indian": "string",
        "Indian Student": "string",
        "Foreign Tourist": "string",
        "Foreign Student": "string",
        "Audio Guide": "string",
        "Light Show (English)": "string",
        "Light Show (Hindi)": "string",
        "Elephant Ride": "string",
        "Other": "string"
      },
      "operation_duration": "string"
    }
  ]
}

Hotels:
{
  "hotels": [
    {
      "name": "string",
      "rating": number, // 1-10, or 1-5 normalized to one scale
      "priceRange": "string", // human friendly
      "approx_cost_per_night": "string", // e.g. "₹7,000–₹9,000"
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
      "approx_cost_for_two": "string", // e.g. "₹1,200–₹1,600"
      "location": "string",
      "pros_and_cons": { "pros": ["string"], "cons": ["string"] }
    }
  ]
}
`.trim();

  const dest = trip?.destination || "the destination";
  const budget = trip?.budget || "No preference";
  const budgetHint =
    budget === "Budget Friendly"
      ? "Keep costs low"
      : budget === "Mid-range"
      ? "Prefer moderate pricing"
      : budget === "Luxury"
      ? "Prefer premium options"
      : "Any price is fine";

  const near =
    anchors && anchors.length
      ? `near these selected sights: ${anchors.join("; ")}`
      : "near central/most-visited areas";

  if (kind === "attractions") {
    return `
${base}

TASK: List 10 attractions for ${dest}.
- Use "importance" to mark essentials as "must see".
- "entry_fees": include only items relevant for each attraction (omit non-applicable keys).
- Include "operation_duration" if commonly known.
- Descriptions concise (1–3 sentences).
Return ONLY JSON as per schema.
`.trim();
  }

  if (kind === "hotels") {
    return `
${base}

TASK: Recommend 8 hotels in ${dest} ${near}.
- ${budgetHint}.
- Optimize proximity to selected sights.
- Include "approx_cost_per_night".
- "rating" numeric. "priceRange" human-friendly.
- Provide balanced "pros_and_cons".
Return ONLY JSON as per schema.
`.trim();
  }

  if (kind === "food") {
    return `
${base}

TASK: Recommend 8 restaurants in ${dest} ${near}.
- ${budgetHint}.
- Mix local must-try + a few hidden gems.
- Include "approx_cost_for_two" in addition to "priceRange".
- Provide balanced "pros_and_cons".
Return ONLY JSON as per schema.
`.trim();
  }

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

  // Day plan
  if (kind === "day_plan") {
    const plannerBrief =
      Array.isArray(trip?.planner) && trip.planner.length
        ? trip.planner
            .map((p, i) => `${i + 1}. ${p.type}: ${p.name} (${p.location})`)
            .join("\n")
        : "No items selected.";

    return `
${base}

Given:
- Destination: ${trip?.destination || ""}
- Dates: ${trip?.dates || ""}
- Group: ${trip?.people || ""} people, ${trip?.travelType || "N/A"}
- Budget: ${budget}
- Selected items:
${plannerBrief}

TASK:
Build a compact day-wise itinerary that sequences items hour-by-hour. For each day, include:
- "slots": an ordered list with items such as "Attraction", "Lunch", "Snack/Market", "Attraction", and "Hotel night stay".
- Each slot must have "time", "title", and "notes".

Return ONLY:
{
  "plan": [
    { "day": 1, "date": "YYYY-MM-DD", "slots": [ { "time": "09:00", "title": "Amber Fort", "notes": "..." }, ... ] },
    ...
  ]
}
`.trim();
  }

  // fallback for SearchPanel etc.
  return `
${base}
Based on the user's query, return ONLY the appropriate top-level key(s).
`.trim();
};

/* ----------------- Core call ------------------ */
async function callGemini(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${process.env.GOOGLE_API_KEY}`;
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
  };

  const res = await fetchWithRetry(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (data.error) throw new Error(`${data.error?.message || "Gemini error"}`);

  const raw =
    data?.candidates?.[0]?.content?.parts?.[0]?.text ??
    data?.candidates?.[0]?.content?.parts?.[0]?.inline_data ??
    "";
  return looseParseJSON(raw);
}

/* ----------------- Routes ------------------ */
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

    // Handle occasional overloads gracefully
    let json = null;
    try {
      json = await callGemini(finalPrompt);
    } catch (e1) {
      await sleep(350);
      try {
        json = await callGemini(finalPrompt);
      } catch (e2) {
        return res
          .status(503)
          .json({ error: "Model overloaded, please retry." });
      }
    }

    if (json) return res.json({ json });
    return res.json({ response: "" }); // frontend has a parser fallback
  } catch (err) {
    console.error("❌ Query route error:", err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
});

/* Day plan route (used by MyItinerary) */
router.post("/day-plan", async (req, res) => {
  try {
    const { trip } = req.body || {};
    if (!trip) return res.status(400).json({ error: "Missing 'trip'." });
    const prompt = promptFor({ kind: "day_plan", trip });
    const json = await callGemini(prompt);
    if (!json?.plan)
      return res.status(400).json({ error: "No plan generated." });
    return res.json({ json });
  } catch (err) {
    console.error("❌ Day-plan error:", err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
});

export default router;
