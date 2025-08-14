import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import Navbar from "../components/Navbar";
import "../../styles/components/myitinerary.css";

type ItemType = {
  id: number;
  type: "Attraction" | "Hotel" | "Restaurant";
  name: string;
  location: string;
  description?: string;
};

type SavedItinerary = {
  name: string;
  tripDetails: {
    destination: string;
    origin: string;
    people: number;
    travelType: string;
    days: number;
    nights: number;
    budget: string;
  };
  planner: ItemType[];
};

type LLMOut = {
  attractions?: { name: string; location: string; description?: string }[];
  hotels?: { name: string; location: string; pros?: string; cons?: string }[];
  food?: {
    name: string;
    location: string;
    cuisineType?: string;
    pros?: string;
    cons?: string;
  }[];
} | null;

const parseOut = (data: any): LLMOut => {
  if (data?.json) return data.json as LLMOut;
  try {
    const clean = String(data?.response || "")
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();
    return JSON.parse(clean);
  } catch {
    return null;
  }
};

type DayPlan = {
  day: number;
  morning?: ItemType;
  afternoon?: ItemType;
  dinner?: ItemType;
  night?: ItemType;
};

type SlotType = "morning" | "afternoon" | "dinner" | "night";

export default function MyItinerary() {
  const [itins, setItins] = useState<SavedItinerary[]>([]);
  const [selectedName, setSelectedName] = useState<string | null>(null);

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("savedItineraries") || "[]");
    setItins(stored);
    if (stored.length && !selectedName) setSelectedName(stored[0].name);
  }, []);

  const selected = useMemo(
    () => itins.find((i) => i.name === selectedName) || null,
    [itins, selectedName]
  );

  const saveAll = (next: SavedItinerary[]) => {
    localStorage.setItem("savedItineraries", JSON.stringify(next));
    setItins(next);
  };

  const updateSelected = (
    updater: (prev: SavedItinerary) => SavedItinerary
  ) => {
    setItins((prev) => {
      const idx = prev.findIndex((i) => i.name === selectedName);
      if (idx === -1) return prev;
      const next = [...prev];
      next[idx] = updater(prev[idx]);
      localStorage.setItem("savedItineraries", JSON.stringify(next));
      return next;
    });
  };

  const deleteItinerary = (name: string) => {
    const filtered = itins.filter((i) => i.name !== name);
    saveAll(filtered);
    if (selectedName === name) setSelectedName(filtered[0]?.name ?? null);
  };

  // ---------- schedule ----------
  const buildSchedule = (it: SavedItinerary): DayPlan[] => {
    const days = Math.max(1, Number(it.tripDetails.days || 1));
    const nights = Math.max(1, Number(it.tripDetails.nights || days));

    const attractions = it.planner.filter((p) => p.type === "Attraction");
    const hotels = it.planner.filter((p) => p.type === "Hotel");
    const restaurants = it.planner.filter((p) => p.type === "Restaurant");

    const plan: DayPlan[] = Array.from({ length: days }, (_, i) => ({
      day: i + 1,
    }));

    let ai = 0;
    for (let d = 0; d < days; d++) {
      if (ai < attractions.length) plan[d].morning = attractions[ai++];
      if (ai < attractions.length) plan[d].afternoon = attractions[ai++];
    }
    for (let d = 0; d < days; d++) {
      if (restaurants.length)
        plan[d].dinner = restaurants[d % restaurants.length];
    }
    for (let n = 0; n < nights; n++) {
      if (hotels.length) plan[n].night = hotels[n % hotels.length];
    }
    return plan;
  };

  // ---------- inline slot suggestions ----------
  const [slotKey, setSlotKey] = useState<string | null>(null); // `${day}:${slot}`
  const [slotLoading, setSlotLoading] = useState(false);
  const [slotItems, setSlotItems] = useState<ItemType[]>([]);

  const keyOf = (day: number, slot: SlotType) => `${day}:${slot}`;
  const parseKey = (k: string) => {
    const [d, s] = k.split(":");
    return { day: Number(d), slot: s as SlotType };
  };

  const anchorsForDay = (plan: DayPlan[], day: number) => {
    const d = plan[day - 1];
    const around: string[] = [];
    if (d?.morning) around.push(`${d.morning.name} (${d.morning.location})`);
    if (d?.afternoon)
      around.push(`${d.afternoon.name} (${d.afternoon.location})`);
    // fallback: previous/next day
    if (around.length === 0 && plan[day - 2]?.morning)
      around.push(
        `${plan[day - 2].morning!.name} (${plan[day - 2].morning!.location})`
      );
    return around;
  };

  const fetchSlotSuggestions = async (day: number, slot: SlotType) => {
    if (!selected) return;
    if (slotKey === keyOf(day, slot)) {
      setSlotKey(null);
      return;
    }
    setSlotKey(keyOf(day, slot));
    setSlotLoading(true);
    setSlotItems([]);

    const plan = buildSchedule(selected);
    const around = anchorsForDay(plan, day);
    const dest = selected.tripDetails.destination;
    const budget = selected.tripDetails.budget || "No preference";

    let prompt = "";
    if (slot === "morning" || slot === "afternoon") {
      prompt = `
Return ONLY valid JSON:
{ "attractions": [ { "name":"...", "location":"Area", "description":"..." } ] }

Goal: Suggest 3–5 attractions in/around ${dest} ${
        around.length ? `near:\n- ${around.join("\n- ")}` : ""
      }

Rules: concise (1–2 lines), mix of iconic + hidden gems. ONLY JSON.
`;
    } else if (slot === "dinner") {
      prompt = `
Return ONLY valid JSON:
{ "food": [ { "name":"...", "location":"Area", "cuisineType":"...", "pros":"...", "cons":"..." } ] }

Goal: Suggest 3–5 dinner restaurants in ${dest} ${
        around.length ? `near:\n- ${around.join("\n- ")}` : ""
      }

Rules: suit budget: ${budget}. Mix famous + local favorites. ONLY JSON.
`;
    } else {
      // night
      prompt = `
Return ONLY valid JSON:
{ "hotels": [ { "name":"...", "location":"Area", "pros":"...", "cons":"..." } ] }

Goal: Suggest 3–5 hotels in ${dest} ${
        around.length ? `close to:\n- ${around.join("\n- ")}` : ""
      }

Rules: minimize commute to sights; respect budget: ${budget}. ONLY JSON.
`;
    }

    try {
      const res = await axios.post("http://localhost:3001/query", { prompt });
      const out = parseOut(res.data);

      let items: ItemType[] = [];
      if (slot === "morning" || slot === "afternoon") {
        items = (out?.attractions || []).slice(0, 5).map((x, i) => ({
          id: Number(`41${Date.now()}${i}`),
          type: "Attraction",
          name: x.name,
          location: x.location || dest,
          description: x.description,
        }));
      } else if (slot === "dinner") {
        items = (out?.food || []).slice(0, 5).map((x, i) => ({
          id: Number(`42${Date.now()}${i}`),
          type: "Restaurant",
          name: x.name,
          location: x.location || dest,
          description: [x.cuisineType, x.pros, x.cons]
            .filter(Boolean)
            .join(" · "),
        }));
      } else {
        items = (out?.hotels || []).slice(0, 5).map((x, i) => ({
          id: Number(`43${Date.now()}${i}`),
          type: "Hotel",
          name: x.name,
          location: x.location || dest,
          description: [x.pros, x.cons].filter(Boolean).join(" · "),
        }));
      }
      setSlotItems(items);
    } catch (e) {
      console.error("slot suggestion error", e);
      setSlotItems([]);
    } finally {
      setSlotLoading(false);
    }
  };

  const addToPlanner = (it: ItemType) => {
    if (!selected) return;
    const exists = selected.planner.some(
      (p) => p.type === it.type && p.name === it.name
    );
    if (exists) return;
    updateSelected((prev) => ({ ...prev, planner: [...prev.planner, it] }));
    setSlotKey(null); // 🔹 closes suggestions after adding
  };

  // ---------- UI ----------
  const SummaryList = () => (
    <div className="mi-list">
      {itins.length === 0 && (
        <p className="text-muted">No itineraries saved yet.</p>
      )}
      {itins.map((it) => (
        <div
          key={it.name}
          className={`mi-list-card ${selectedName === it.name ? "active" : ""}`}
          onClick={() => setSelectedName(it.name)}
        >
          <div className="mi-list-title">{it.name}</div>
          <div className="mi-list-sub">
            🌍 {it.tripDetails.origin} ➜ {it.tripDetails.destination}
          </div>
          <div className="mi-list-sub">
            👥 {it.tripDetails.people} • {it.tripDetails.days}D /{" "}
            {it.tripDetails.nights}N • {it.tripDetails.travelType || "N/A"}
          </div>
        </div>
      ))}
    </div>
  );

  const Slot = ({
    title,
    value,
    onFind,
    day,
    slot,
  }: {
    title: string;
    value?: ItemType;
    onFind: () => void;
    day: number;
    slot: SlotType;
  }) => {
    const k = keyOf(day, slot);
    const open = slotKey === k;

    return (
      <div className="mi-slot">
        <div className="mi-slot-title">{title}</div>

        {value ? (
          <div className="mi-item">
            <div className="mi-item-title">{value.name}</div>
            <div className="mi-item-sub">📍 {value.location}</div>
            {value.description && (
              <div className="mi-item-desc">{value.description}</div>
            )}
          </div>
        ) : (
          <button className="mi-empty mi-empty-btn" onClick={onFind}>
            + Find {title.toLowerCase()}
          </button>
        )}

        {/* Inline suggestions for this slot */}
        {open && (
          <div className="mi-suggest-inline">
            {slotLoading ? (
              <p className="text-muted">Loading options…</p>
            ) : slotItems.length === 0 ? (
              <p className="text-muted">No suggestions yet.</p>
            ) : (
              slotItems.map((s, i) => (
                <div className="mi-suggest-item" key={`${k}-${i}`}>
                  <div>
                    <div className="mi-item-title">{s.name}</div>
                    <div className="mi-item-sub">📍 {s.location}</div>
                    {s.description && (
                      <div className="mi-item-desc">{s.description}</div>
                    )}
                  </div>
                  <button
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => addToPlanner(s)}
                  >
                    ➕ Add
                  </button>
                </div>
              ))
            )}
            <div className="mi-suggest-actions">
              <button
                className="btn btn-outline-dark btn-sm"
                onClick={() => setSlotKey(null)}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const DetailPanel = () => {
    if (!selected) {
      return (
        <div className="mi-card">
          <div className="mi-card-head">Itinerary</div>
          <div className="mi-divider" />
          <p className="text-muted">Select an itinerary from the left.</p>
        </div>
      );
    }

    const plan = buildSchedule(selected);

    return (
      <div className="mi-card">
        <div className="mi-card-head">Itinerary — {selected.name}</div>
        <div className="mi-divider" />

        <div className="td-route" style={{ marginBottom: 10 }}>
          <span className="td-city">{selected.tripDetails.origin}</span>
          <span className="td-arrow">➡</span>
          <span className="td-city">{selected.tripDetails.destination}</span>
        </div>

        <div className="mi-grid">
          {plan.map((d) => (
            <div className="mi-day" key={d.day}>
              <div className="mi-day-head">Day {d.day}</div>

              <Slot
                title="Morning"
                value={d.morning}
                day={d.day}
                slot="morning"
                onFind={() => fetchSlotSuggestions(d.day, "morning")}
              />

              <Slot
                title="Afternoon"
                value={d.afternoon}
                day={d.day}
                slot="afternoon"
                onFind={() => fetchSlotSuggestions(d.day, "afternoon")}
              />

              <Slot
                title="Dinner"
                value={d.dinner}
                day={d.day}
                slot="dinner"
                onFind={() => fetchSlotSuggestions(d.day, "dinner")}
              />

              <Slot
                title="Night"
                value={d.night}
                day={d.day}
                slot="night"
                onFind={() => fetchSlotSuggestions(d.day, "night")}
              />
            </div>
          ))}
        </div>

        <div className="mi-actions">
          <button
            className="btn btn-outline-danger"
            onClick={() => deleteItinerary(selected.name)}
          >
            ❌ Delete
          </button>
          <button
            className="btn btn-outline-secondary"
            onClick={() => alert("Load in Planner coming next")}
          >
            ↩ Load in Planner
          </button>
        </div>
      </div>
    );
  };

  return (
    <div>
      <Navbar />
      <div className="main">
        <div className="left-panel itinerary-left">
          <div className="mi-card">
            <div className="mi-card-head">My Saved Itineraries</div>
            <div className="mi-divider" />
            <SummaryList />
          </div>
        </div>

        <div className="right-panel itinerary-right">
          <DetailPanel />
        </div>
      </div>
    </div>
  );
}
