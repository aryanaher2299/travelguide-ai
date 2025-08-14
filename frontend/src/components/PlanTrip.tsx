import { useState } from "react";
import axios from "axios";
import Navbar from "../components/Navbar";
import "../../styles/components/plantrip.css";

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

type LLMOutput = {
  attractions?: {
    name: string;
    description?: string;
    location: string;
    importance?: string;
    entryFees?: string;
    operationDuration?: string;
  }[];
  hotels?: {
    name: string;
    rating?: string | number;
    priceRange?: string;
    location: string;
    pros?: string;
    cons?: string;
  }[];
  food?: {
    name: string;
    cuisineType?: string;
    rating?: string | number;
    priceRange?: string;
    location: string;
    pros?: string;
    cons?: string;
  }[];
  text?: string;
} | null;

const stripAndParse = (s: string) => {
  try {
    const clean = s
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
    return JSON.parse(clean);
  } catch (e) {
    console.error("JSON parse failed:", e);
    return null;
  }
};

export default function PlanTrip() {
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [editingTrip, setEditingTrip] = useState(false);
  const [step, setStep] = useState<0 | 1 | 2>(0);

  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<0 | 1 | 2 | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [tripDetails, setTripDetails] = useState({
    destination: "",
    origin: "",
    people: 1,
    travelType: "",
    days: 0,
    nights: 0,
    budget: "",
  });

  // NEW state for save panel
  const [showSave, setShowSave] = useState(false);
  const makeSmartName = () => {
    const d = tripDetails.destination || "Trip";
    const days = tripDetails.days ? `${tripDetails.days}D` : "";
    const nights = tripDetails.nights ? `${tripDetails.nights}N` : "";
    return `${d} ${days}${nights}`.trim();
  };

  const [itineraryName, setItineraryName] = useState(makeSmartName());
  const [attractions, setAttractions] = useState<ItemType[]>([]);
  const [hotels, setHotels] = useState<ItemType[]>([]);
  const [restaurants, setRestaurants] = useState<ItemType[]>([]);
  const [planner, setPlanner] = useState<ItemType[]>([]);

  const steps = ["Attractions", "Hotels", "Restaurants"];

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => setTripDetails({ ...tripDetails, [e.target.name]: e.target.value });

  // ---------- PROMPTS ----------
  const attractionsPrompt = () => {
    const { destination, origin, people, travelType, days, nights, budget } =
      tripDetails;

    return `
You are a travel assistant. Return ONLY valid JSON with this exact shape:

{
  "attractions": [
    { "name":"...", "description":"...", "location":"Neighborhood/Area", "importance":"must see|nice to have", "entryFees":"...", "operationDuration":"..." }
  ]
}

Rules:
- Provide EXACTLY 10 attractions for ${destination}.
- Keep each description to 1–2 lines.
- Prefer a mix of iconic sights and under‑the‑radar picks.
- Use *local neighborhood names* in "location".
- Consider trip context:
  - Origin: ${origin}
  - People: ${people}
  - Travel Type: ${travelType || "N/A"}
  - Duration: ${days} days / ${nights} nights
  - Budget: ${budget || "No preference"}
- Output ONLY JSON, no extra text.
`;
  };

  const hotelsPrompt = (
    selectedAttractions: { name: string; location: string }[]
  ) => {
    const { destination, budget } = tripDetails;
    const anchors = selectedAttractions
      .map((a, i) => `${i + 1}. ${a.name} (${a.location})`)
      .join("\n");

    return `
You are a travel assistant. Return ONLY valid JSON with this exact shape:

{
  "hotels": [
    { "name":"...", "rating":"4.5", "priceRange":"$", "location":"Area", "pros":"...", "cons":"..." }
  ]
}

Goal:
- Recommend hotels in/around ${destination} that minimize commute to these selected attractions:
${anchors}

Rules:
- Prefer walkable or short‑transit distances to the above.
- Be mindful of budget preference: ${budget || "No preference"}.
- Include a range of price tiers but keep proximity strong.
- Provide 10 hotel options.
- Output ONLY JSON, no extra text.
`;
  };

  const restaurantsPrompt = (
    selectedAttractions: { name: string; location: string }[]
  ) => {
    const { destination, budget, travelType } = tripDetails;
    const anchors = selectedAttractions
      .map((a, i) => `${i + 1}. ${a.name} (${a.location})`)
      .join("\n");

    return `
You are a travel assistant. Return ONLY valid JSON with this exact shape:

{
  "food": [
    { "name":"...", "cuisineType":"...", "rating":"4.4", "priceRange":"$$", "location":"Area", "pros":"...", "cons":"..." }
  ]
}

Goal:
- Recommend restaurants in/around ${destination} that are close to these selected attractions:
${anchors}

Rules:
- Blend local must‑try spots + a couple of hidden gems.
- Consider group vibe: ${travelType || "N/A"}; budget: ${
      budget || "No preference"
    }.
- Provide 10 options.
- Output ONLY JSON, no extra text.
`;
  };

  // ---------- API wrappers ----------
  const postQuery = async (prompt: string) => {
    const res = await axios.post("http://localhost:3001/query", { prompt });
    return stripAndParse(res.data.response) as LLMOutput;
  };

  // ---------- FETCHERS ----------
  const fetchAttractions = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await postQuery(attractionsPrompt());
      const items =
        (data?.attractions || []).map((x, i) => ({
          id: Number(`1${i}`),
          type: "Attraction" as const,
          name: x.name,
          location: x.location || tripDetails.destination,
          description:
            x.description ||
            [x.entryFees, x.operationDuration].filter(Boolean).join(" · "),
        })) || [];
      setAttractions(items);
      setFormSubmitted(true);
      setEditingTrip(false);
      setStep(0);
    } catch (e) {
      console.error(e);
      setError("Couldn't fetch attractions. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const ensureSelectedAnchors = () => {
    // Use attractions already added to planner; if none, fall back to first 3 from attractions list
    const selected = planner.filter((p) => p.type === "Attraction");
    if (selected.length > 0)
      return selected.map((a) => ({ name: a.name, location: a.location }));
    return attractions
      .slice(0, 3)
      .map((a) => ({ name: a.name, location: a.location }));
  };

  const fetchHotels = async () => {
    setLoadingStep(1);
    setError(null);
    try {
      const anchors = ensureSelectedAnchors();
      const data = await postQuery(hotelsPrompt(anchors));
      const items =
        (data?.hotels || []).map((x, i) => ({
          id: Number(`2${Date.now()}${i}`),
          type: "Hotel" as const,
          name: x.name,
          location: x.location || tripDetails.destination,
          description: [x.pros, x.cons].filter(Boolean).join(" · "),
        })) || [];
      setHotels(items);
    } catch (e) {
      console.error(e);
      setError("Couldn't fetch hotels. Try again.");
    } finally {
      setLoadingStep(null);
    }
  };

  const fetchRestaurants = async () => {
    setLoadingStep(2);
    setError(null);
    try {
      const anchors = ensureSelectedAnchors();
      const data = await postQuery(restaurantsPrompt(anchors));
      const items =
        (data?.food || []).map((x, i) => ({
          id: Number(`3${Date.now()}${i}`),
          type: "Restaurant" as const,
          name: x.name,
          location: x.location || tripDetails.destination,
          description: [x.cuisineType, x.pros, x.cons]
            .filter(Boolean)
            .join(" · "),
        })) || [];
      setRestaurants(items);
    } catch (e) {
      console.error(e);
      setError("Couldn't fetch restaurants. Try again.");
    } finally {
      setLoadingStep(null);
    }
  };

  // ---------- Planner ----------
  const addToPlanner = (item: ItemType) => {
    if (!planner.find((p) => p.id === item.id)) setPlanner((p) => [...p, item]);
  };
  const removeFromPlanner = (id: number) =>
    setPlanner((p) => p.filter((x) => x.id !== id));

  const resetTrip = () => {
    setFormSubmitted(false);
    setPlanner([]);
    setStep(0);
    setAttractions([]);
    setHotels([]);
    setRestaurants([]);
    setTripDetails({
      destination: "",
      origin: "",
      people: 1,
      travelType: "",
      days: 0,
      nights: 0,
      budget: "",
    });
  };

  const saveItinerary = () => {
    const name = (itineraryName || makeSmartName()).trim();
    if (!name) return;

    const savedData: SavedItinerary = { name, tripDetails, planner };
    const existing = JSON.parse(
      localStorage.getItem("savedItineraries") || "[]"
    );
    existing.push(savedData);
    localStorage.setItem("savedItineraries", JSON.stringify(existing));
    setShowSave(false);
    // Optional toast
    alert("Saved! Check My Itineraries.");
  };

  // ---------- UI ----------
  const Stepper = () => (
    <ul className="pt-stepper">
      {steps.map((label, index) => (
        <li
          key={label}
          className={`pt-step ${
            index === step ? "active" : index < step ? "completed" : ""
          }`}
        >
          <span>{index + 1}</span>
          <p>{label}</p>
        </li>
      ))}
    </ul>
  );

  const ListCard = ({
    title,
    items,
    which,
  }: {
    title: string;
    items: ItemType[];
    which: 0 | 1 | 2;
  }) => (
    <div className="pt-card">
      <div
        className="pt-card-head"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span>{title}</span>
        <button
          className="btn btn-outline-secondary btn-sm"
          onClick={() =>
            which === 0
              ? fetchAttractions()
              : which === 1
              ? fetchHotels()
              : fetchRestaurants()
          }
          disabled={loadingStep === which || loading}
        >
          {loadingStep === which || loading ? "Refreshing..." : "↻ Regenerate"}
        </button>
      </div>
      <div className="pt-divider" />
      <div className="pt-scroll">
        {items.map((item) => (
          <div className="pt-item" key={item.id}>
            <div className="pt-item-title">{item.name}</div>
            <div className="pt-item-sub">📍 {item.location}</div>
            {item.description && (
              <div className="pt-item-desc">{item.description}</div>
            )}
            <button
              className="btn btn-outline-secondary pt-add-btn"
              onClick={() => addToPlanner(item)}
            >
              ➕ Add to Planner
            </button>
          </div>
        ))}
        {items.length === 0 && (
          <div className="pt-empty">No recommendations yet.</div>
        )}
      </div>
    </div>
  );

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    fetchAttractions();
  };

  const handleNext = async () => {
    if (step === 0) {
      await fetchHotels();
      setStep(1);
      return;
    }
    if (step === 1) {
      await fetchRestaurants();
      setStep(2);
      return;
    }
  };

  return (
    <div>
      <Navbar />
      <div className="main">
        {/* LEFT */}
        <div className="left-panel pt-left">
          {!formSubmitted || editingTrip ? (
            <form className="w-100" onSubmit={handleSubmitForm}>
              <div className="pt-card" style={{ marginBottom: 12 }}>
                <div className="pt-card-head">Plan Your Trip</div>
                <div className="pt-divider" />
                <div className="pt-grid">
                  <div className="pt-field">
                    <label>Destination</label>
                    <input
                      type="text"
                      name="destination"
                      placeholder="Where to?"
                      className="form-control"
                      value={tripDetails.destination}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="pt-field">
                    <label>Origin / Starting Location</label>
                    <input
                      type="text"
                      name="origin"
                      placeholder="Where from?"
                      className="form-control"
                      value={tripDetails.origin}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="pt-field">
                    <label>People</label>
                    <input
                      type="number"
                      name="people"
                      className="form-control"
                      min="1"
                      value={tripDetails.people}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="pt-field">
                    <label>Travel Type</label>
                    <select
                      name="travelType"
                      className="form-control"
                      value={tripDetails.travelType}
                      onChange={handleChange}
                    >
                      <option value="">Select</option>
                      <option>Friends</option>
                      <option>Family</option>
                      <option>Solo</option>
                    </select>
                  </div>
                  <div className="pt-field">
                    <label>Days</label>
                    <input
                      type="number"
                      name="days"
                      className="form-control"
                      min="1"
                      value={tripDetails.days}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="pt-field">
                    <label>Nights</label>
                    <input
                      type="number"
                      name="nights"
                      className="form-control"
                      min="1"
                      value={tripDetails.nights}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="pt-field span-2">
                    <label>Budget</label>
                    <select
                      name="budget"
                      className="form-control"
                      value={tripDetails.budget}
                      onChange={handleChange}
                    >
                      <option value="">No preference</option>
                      <option>Budget Friendly</option>
                      <option>Mid-range</option>
                      <option>Luxury</option>
                    </select>
                  </div>
                </div>
                <button
                  type="submit"
                  className="btn btn-primary w-100"
                  disabled={loading}
                >
                  {loading ? "Fetching..." : "Get Attractions"}
                </button>
                {error && (
                  <p style={{ marginTop: 8, color: "#ffb4b4" }}>{error}</p>
                )}
              </div>
            </form>
          ) : (
            <div className="w-100">
              <div className="pt-card" style={{ marginBottom: 12 }}>
                <div className="pt-card-head">Your Recommendations</div>
                <div className="pt-divider" />
                <Stepper />
              </div>

              {step === 0 && (
                <ListCard
                  title="Recommended Attractions"
                  items={attractions}
                  which={0}
                />
              )}
              {step === 1 && (
                <ListCard title="Closest Hotels" items={hotels} which={1} />
              )}
              {step === 2 && (
                <ListCard
                  title="Restaurants Near Your Plan"
                  items={restaurants}
                  which={2}
                />
              )}

              <div className="pt-step-actions">
                {step > 0 && (
                  <button
                    className="btn btn-outline-dark"
                    onClick={() =>
                      setStep((s) => (s === 0 ? 0 : ((s - 1) as 0 | 1)))
                    }
                  >
                    ◀ Previous
                  </button>
                )}
                {step < 2 && (
                  <button
                    className="btn btn-primary"
                    onClick={handleNext}
                    disabled={loadingStep !== null}
                  >
                    {step === 0 ? "Next ▶ (Hotels)" : "Next ▶ (Restaurants)"}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT */}
        {/* RIGHT: Trip summary + Planner (sticky) */}
        <div className="right-panel pt-right">
          <div className="pt-sticky">
            <div className="pt-card td-card">
              <div className="pt-card-head">Trip Details</div>
              <div className="pt-divider" />

              {formSubmitted ? (
                <>
                  {/* Route pill */}
                  <div className="td-route">
                    <span className="td-city">{tripDetails.origin || "—"}</span>
                    <span className="td-arrow">➡</span>
                    <span className="td-city">
                      {tripDetails.destination || "—"}
                    </span>
                  </div>

                  {/* Meta grid */}
                  <div className="td-meta">
                    <div className="td-row">
                      <span className="td-icon">👥</span>
                      <span className="td-label">People</span>
                      <span className="td-value">
                        {tripDetails.people} ({tripDetails.travelType || "N/A"})
                      </span>
                    </div>
                    <div className="td-row">
                      <span className="td-icon">🗓️</span>
                      <span className="td-label">Duration</span>
                      <span className="td-value">
                        {tripDetails.days} Days / {tripDetails.nights} Nights
                      </span>
                    </div>
                    <div className="td-row">
                      <span className="td-icon">💰</span>
                      <span className="td-label">Budget</span>
                      <span className="td-value">
                        <span className="td-badge td-badge--budget">
                          {tripDetails.budget || "No preference"}
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="td-actions">
                    <button
                      className="btn btn-outline-secondary"
                      onClick={() => setEditingTrip(true)}
                    >
                      ✏️ Edit
                    </button>
                    <button
                      className="btn btn-outline-dark"
                      onClick={resetTrip}
                      disabled={!formSubmitted}
                    >
                      🔄 Reset
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-muted">Fill the form to see trip details.</p>
              )}
            </div>

            {/* === YOUR PLANNER (single authoritative block) === */}
            <div className="pt-card" style={{ marginTop: 12 }}>
              <div className="pt-card-head">Your Planner</div>
              <div className="pt-divider" />

              {planner.length === 0 ? (
                <p className="text-muted">No items selected yet.</p>
              ) : (
                <div className="pt-scroll">
                  {planner.map((p, idx) => (
                    <div
                      className="pt-item-row"
                      key={`${p.type}-${p.name}-${idx}`}
                    >
                      <div>
                        <div className="pt-item-title">
                          {p.type} — {p.name}
                        </div>
                        <div className="pt-item-sub">📍 {p.location}</div>
                      </div>
                      <button
                        className="btn btn-outline-dark btn-sm"
                        onClick={() => removeFromPlanner(p.id)}
                        aria-label={`Remove ${p.name}`}
                      >
                        ❌
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Save itinerary (single place) */}
              {planner.length > 0 && !showSave && (
                <button
                  className="btn-save-itinerary"
                  onClick={() => {
                    setItineraryName(makeSmartName());
                    setShowSave(true);
                  }}
                >
                  💾 Save Itinerary
                </button>
              )}

              {planner.length > 0 && showSave && (
                <div className="pt-save">
                  <label className="pt-save-label">Itinerary name</label>
                  <input
                    className="form-control mb-2 pt-save-input"
                    placeholder="e.g., Delhi 3D2N"
                    value={itineraryName}
                    onChange={(e) => setItineraryName(e.target.value)}
                  />

                  <div className="pt-save-actions">
                    <button
                      className="btn-save-solid"
                      onClick={saveItinerary}
                      aria-label="Save itinerary"
                    >
                      💾 Save
                    </button>

                    <button
                      className="btn-cancel-ghost"
                      onClick={() => setShowSave(false)}
                      aria-label="Cancel"
                    >
                      ✖ Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
