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

const toInt = (v, fallback = null) => {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? fallback : n;
};

const toTime = (s) => {
  if (!s) return null;
  const m = String(s).match(/^(\d{1,2}):?(\d{2})$/);
  if (!m) return null;
  let hh = parseInt(m[1], 10);
  const mm = m[2];
  if (hh < 0 || hh > 23) return null;
  const hh2 = hh.toString().padStart(2, "0");
  return `${hh2}:${mm}`;
};
const makeRange = (start, end) => {
  const a = toTime(start);
  const b = toTime(end);
  return a && b ? `${a}–${b}` : a || b || "";
};

function normalizeDayPlan(json) {
  if (!json || !Array.isArray(json.plan)) return null;

  // Normalize each slot and compute total
  let total = 0;
  json.plan.forEach((day, idx) => {
    if (typeof day.day !== "number") day.day = idx + 1;
    if (!Array.isArray(day.slots)) day.slots = [];

    day.slots = day.slots.map((s) => {
      const start = toTime(s.start) || toTime(s.time?.split("–")?.[0]);
      const end =
        toTime(s.end) || toTime(s.time?.split("–")?.[1]) || toTime(s.time);

      const time =
        s.time && s.time.includes("–") ? s.time : makeRange(start, end);

      const cost = Number.isFinite(s.cost_min) ? s.cost_min : 0;

      // If category not provided, infer from title keywords
      const title = s.title || "";
      let category = s.category;
      if (!category) {
        const t = title.toLowerCase();
        if (t.includes("check-in") || t.includes("hotel")) category = "Hotel";
        else if (
          t.includes("lunch") ||
          t.includes("dinner") ||
          t.includes("cafe")
        )
          category = "Restaurant";
        else if (t.includes("drive") || t.includes("transfer"))
          category = "Transit";
        else category = "Attraction";
      }

      total += cost;

      return {
        start: start || "",
        end: end || "",
        time: time || "",
        title,
        place: s.place || title,
        address: s.address || "",
        category,
        notes: s.notes || "",
        cost_min: cost,
      };
    });
  });

  if (!json.currency) json.currency = "INR";
  json.total_min_cost = Number.isFinite(json.total_min_cost)
    ? json.total_min_cost
    : total;

  return json;
}

/* ----------------- Prompt builder ------------------ */
const promptFor = ({ kind, trip, anchors = [], attraction }) => {
  const base = `
You are a travel assistant. Return ONLY VALID JSON (no markdown code fences).
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

SCHEMA:
{ "attractions": [ { "name": "string", "description": "string", "location": "string", "importance": "must see"|"can see if time permits", "entry_fees": { "Indian":"...", "Foreign Tourist":"...", "Audio Guide":"..." }, "operation_duration": "string" } ] }

TASK: List exactly 10 attractions for ${dest}. Use "importance" for essentials. Include only relevant "entry_fees" keys. Reply JSON only.
`.trim();
  }

  if (kind === "hotels") {
    return `
${base}

SCHEMA:
{ "hotels": [ { "name":"string","rating":number,"priceRange":"string","approx_cost_per_night":"string","location":"string","pros_and_cons":{"pros":["string"],"cons":["string"]} } ] }

TASK: Recommend 8 hotels in ${dest} ${near}. ${budgetHint}. Reply JSON only.
`.trim();
  }

  if (kind === "food") {
    return `
${base}

SCHEMA:
{ "food": [ { "name":"string","cuisineType":"string","rating":number,"priceRange":"string","approx_cost_for_two":"string","location":"string","pros_and_cons":{"pros":["string"],"cons":["string"]} } ] }

TASK: Recommend 8 restaurants in ${dest} ${near}. ${budgetHint}. Reply JSON only.
`.trim();
  }

  if (kind === "attraction_details") {
    const { name, location } = attraction || {};
    return `
${base}

Return deeper details for the attraction "${name || ""}" in/near "${
      location || trip?.destination || ""
    }" as JSON with keys:
{ "name":"string","summary":"string","history":"string","best_time":"string","time_required":"string","how_to_reach":["string"],"tips":["string"],"crowd_level":"low|moderate|high","nearby":["string"],"scams_warnings":["string"] }
`.trim();
  }

  // STRICT Day plan (specific + time ranges + costs)
  // STRICT Day plan (specific + time ranges + costs + EXACT day count)
  // STRICT Day plan (specific + time ranges + costs + transit + dinner + return)
  if (kind === "day_plan") {
    const plannerBrief =
      Array.isArray(trip?.planner) && trip.planner.length
        ? trip.planner
            .map((p, i) => `${i + 1}. ${p.type}: ${p.name} (${p.location})`)
            .join("\n")
        : "No items selected.";

    const days = toInt(trip?.days, 1);
    const budget = trip?.budget || "No preference";

    return `
You are a travel planning engine. Return ONLY VALID JSON (no markdown).

GOAL: Produce a SPECIFIC, COST-AWARE, TIME-BOUNDED itinerary for ${
      trip?.destination || ""
    }.
- Output **EXACTLY ${days} days** in "plan".
- No vague wording. Every slot must be a concrete place.
- **MANDATORY PER DAY (in order)**:
  1) Morning Attraction(s)
  2) **Transit** slot(s) between places (each transit must include: from, to, mode, eta_min, cost_min)
  3) **Lunch** (Restaurant)
  4) Afternoon Attraction(s) (with required **Transit** between)
  5) **Dinner** (Restaurant). If no specific dinner place is suitable, output:
     - title = "Dinner (choose)"
     - category = "Restaurant"
     - suggestions = [ { "name": "...", "area": "...", "reason": "en-route from X to Y", "approx_cost_for_two": 0 } ] (3 items)
     The suggestions must be **en-route from the previous slot to the next (or hotel)**.
  6) **Return to Hotel** (category = "Hotel"; notes: "Return to hotel / night stay")

- Every slot MUST have **start** and **end** (HH:MM) with no overlaps.
- Each slot has **cost_min** (integer INR; 0 if free).
- Provide **place** and **address** when known.
- category ∈ { "Attraction", "Hotel", "Restaurant", "Transit", "Other" }.
- Keep notes ≤ 20 words.
- If you can infer a valid ISO start date (YYYY-MM-DD) from "${
      trip?.dates || ""
    }", fill "date" per day; else omit.

INPUT:
- Dates: ${trip?.dates || "N/A"}
- Group: ${trip?.people || ""} people (${trip?.travelType || "N/A"})
- Budget: ${budget}
- Selected items (anchors/order hints):
${plannerBrief}

STRICT JSON SHAPE:
{
  "currency": "INR",
  "plan": [
    {
      "day": 1,
      "date": "YYYY-MM-DD",
      "slots": [
        {
          "start": "09:00",
          "end": "09:30",
          "time": "09:00–09:30",
          "title": "Hotel Check-in",
          "place": "The Bloomrooms @ Janpath",
          "address": "Janpath, New Delhi",
          "category": "Hotel",
          "notes": "Early check-in if available.",
          "cost_min": 0
        },
        {
          "start": "10:00",
          "end": "10:30",
          "time": "10:00–10:30",
          "title": "Transit to Red Fort",
          "place": "From Janpath to Red Fort",
          "address": "",
          "category": "Transit",
          "mode": "Taxi",
          "eta_min": 30,
          "cost_min": 250,
          "from": "Janpath",
          "to": "Red Fort"
        }
      ]
    }
  ],
  "total_min_cost": 0
}

Return ONLY JSON. Times must be ordered and non-overlapping per day.
`.trim();
  }

  // fallback
  return `
${base}
Based on the user's query, return only the appropriate top-level JSON.
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
    return res.json({ response: "" });
  } catch (err) {
    console.error("❌ Query route error:", err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
});

/* Day plan route (used by MyItinerary) */
/* Day plan route (used by MyItinerary) */
router.post("/day-plan", async (req, res) => {
  try {
    const { trip } = req.body || {};
    if (!trip) return res.status(400).json({ error: "Missing 'trip'." });

    const expectedDays = toInt(trip?.days, 1); // <-- coerce "3" -> 3
    // Ask model with your strict prompt
    const strictPrompt = promptFor({ kind: "day_plan", trip });
    let raw = await callGemini(strictPrompt);

    if (!raw?.plan || !Array.isArray(raw.plan) || raw.plan.length === 0) {
      return res.status(400).json({ error: "No plan generated." });
    }

    // Normalize to our shape (adds time range, category, cost_min, total)
    let json = normalizeDayPlan(raw);

    // Force exact day count with heuristics if model under-produces
    if (expectedDays && json.plan.length !== expectedDays) {
      json = ensureExactDays(json, expectedDays, trip);
    }

    return res.json({ json });
  } catch (err) {
    console.error("❌ Day-plan error:", err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
});

/**
 * Ensure json.plan has exactly `expectedDays` days.
 * If fewer, split the combined timeline using heuristics (Dinner / night / after 18:30).
 * If still insufficient, evenly chunk by slot count. If more, trim.
 */
function ensureExactDays(json, expectedDays, trip) {
  const out = { ...json, plan: [...json.plan] };

  // Trim if too many
  if (out.plan.length > expectedDays) {
    out.plan = out.plan.slice(0, expectedDays);
  }

  if (out.plan.length < expectedDays) {
    // Gather all slots in order
    const allSlots = out.plan.flatMap((d) => d.slots || []);
    if (allSlots.length === 0) {
      // Fabricate placeholders to keep UI stable
      while (out.plan.length < expectedDays) {
        out.plan.push({
          day: out.plan.length + 1,
          date: "",
          slots: [
            {
              start: "20:00",
              end: "22:00",
              time: "20:00–22:00",
              title: "Hotel / Buffer",
              place: trip?.destination || "",
              address: "",
              category: "Hotel",
              notes: "Auto-generated buffer. Use Regenerate to refine.",
              cost_min: 0,
            },
          ],
        });
      }
      out.total_min_cost = out.plan
        .flatMap((d) => d.slots)
        .reduce((a, s) => a + (s.cost_min || 0), 0);
      return out;
    }

    // Heuristic cut points
    const cuts = [];
    for (let i = 0; i < allSlots.length; i++) {
      const t = (allSlots[i].title || "").toLowerCase();
      const cat = (allSlots[i].category || "").toLowerCase();
      const end = allSlots[i].end || "";

      // strong day-enders
      if (
        t.includes("dinner") ||
        t.includes("night stay") ||
        (cat === "hotel" && !t.includes("check-in"))
      ) {
        cuts.push(i);
        continue;
      }

      // time-based cut: anything ending after 18:30
      if (/^\d{2}:\d{2}$/.test(end)) {
        const [h, m] = end.split(":").map((x) => parseInt(x, 10));
        if (h > 18 || (h === 18 && m >= 30)) cuts.push(i);
      }
    }

    // Build segments using cuts
    const segments = [];
    let startIdx = 0;
    for (const cutIdx of cuts) {
      segments.push(allSlots.slice(startIdx, cutIdx + 1));
      startIdx = cutIdx + 1;
    }
    if (startIdx < allSlots.length) segments.push(allSlots.slice(startIdx));

    // Evenly split the largest segment until we reach expectedDays
    while (segments.length < expectedDays) {
      let largest = segments.reduce(
        (acc, seg, i) => (seg.length > segments[acc].length ? i : acc),
        0
      );
      const seg = segments[largest];
      if (seg.length <= 1) break;
      const mid = Math.ceil(seg.length / 2);
      segments.splice(largest, 1, seg.slice(0, mid), seg.slice(mid));
    }

    // Merge smallest adjacent segments if we overshot
    while (segments.length > expectedDays) {
      let idx = 0;
      for (let i = 1; i < segments.length; i++) {
        if (segments[i].length < segments[idx].length) idx = i;
      }
      if (idx > 0) {
        segments[idx - 1] = [...segments[idx - 1], ...segments[idx]];
        segments.splice(idx, 1);
      } else {
        segments[1] = [...segments[0], ...segments[1]];
        segments.splice(0, 1);
      }
    }

    // Build final plan with dates if we have an ISO base date
    const baseDate = out.plan[0]?.date || "";
    const result = [];
    for (let d = 0; d < expectedDays; d++) {
      result.push({
        day: d + 1,
        date:
          baseDate && /^\d{4}-\d{2}-\d{2}$/.test(baseDate)
            ? addDaysISO(baseDate, d)
            : "",
        slots: segments[d] || [],
      });
    }
    out.plan = result;
  }

  // Recompute total
  out.total_min_cost = out.plan
    .flatMap((d) => d.slots)
    .reduce((a, s) => a + (s.cost_min || 0), 0);

  return out;
}

function addDaysISO(iso, delta) {
  try {
    const [y, m, d] = iso.split("-").map((x) => parseInt(x, 10));
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + delta);
    const yy = dt.getUTCFullYear();
    const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(dt.getUTCDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
  } catch {
    return "";
  }
}

export default router;
