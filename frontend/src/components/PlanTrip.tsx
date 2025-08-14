// frontend/src/components/PlanTrip.tsx
import { useState, useEffect } from "react";
import axios from "axios";
import Navbar from "../components/Navbar";
import "../../styles/components/plantrip.css";

/* ---------- Strict schema types ---------- */

type Attraction = {
  name: string;
  description?: string;
  location?: string;
  importance?: "must see" | "can see if time permits";
  entry_fees?: Record<string, string>; // flexible keys
  operation_duration?: string;
};

type Hotel = {
  name: string;
  rating?: number;
  priceRange?: string;
  location?: string;
  pros_and_cons?: { pros?: string[]; cons?: string[] };
};

type Restaurant = {
  name: string;
  cuisineType?: string;
  rating?: number;
  priceRange?: string;
  location?: string;
  pros_and_cons?: { pros?: string[]; cons?: string[] };
};

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

type AttractionDetails = {
  name: string;
  summary?: string;
  history?: string;
  best_time?: string;
  time_required?: string;
  how_to_reach?: string[];
  tips?: string[];
  crowd_level?: string;
  nearby?: string[];
  scams_warnings?: string[];
};

/* ---------- helpers ---------- */

const parseJSONEnvelope = (raw: any) => {
  // backend returns { json: {...} } normally; fallback to { response: "text" }
  if (raw?.json) return raw.json;
  try {
    const clean = String(raw?.response || "")
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();
    return JSON.parse(clean);
  } catch {
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

  // Save itinerary panel
  const [showSave, setShowSave] = useState(false);
  const makeSmartName = () => {
    const d = tripDetails.destination || "Trip";
    const days = tripDetails.days ? `${tripDetails.days}D` : "";
    const nights = tripDetails.nights ? `${tripDetails.nights}N` : "";
    return `${d} ${days}${nights}`.trim();
  };
  const [itineraryName, setItineraryName] = useState(makeSmartName());

  // Results by step (strict schema arrays)
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  // Planner
  const [planner, setPlanner] = useState<ItemType[]>([]);

  // Modal (attraction “More”)
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = detailsOpen ? "hidden" : "auto";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [detailsOpen]);

  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsData, setDetailsData] = useState<AttractionDetails | null>(
    null
  );

  const steps = ["Attractions", "Hotels", "Restaurants"];

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => setTripDetails({ ...tripDetails, [e.target.name]: e.target.value });

  /* ---------- API: use kind/trip/anchors ---------- */

  const fetchAttractions = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.post("http://localhost:3001/query", {
        kind: "attractions",
        trip: tripDetails,
      });
      const json = parseJSONEnvelope(data);
      setAttractions(Array.isArray(json?.attractions) ? json.attractions : []);
      setFormSubmitted(true);
      setEditingTrip(false);
      setStep(0);
    } catch (e) {
      setError("Couldn't fetch attractions. Try again.");
    } finally {
      setLoading(false);
    }
  };

  // Attractions already added to planner → anchors; else fall back to first few results
  const ensureSelectedAnchors = (): { name: string; location: string }[] => {
    const selected = planner.filter((p) => p.type === "Attraction");
    if (selected.length > 0)
      return selected.map((a) => ({ name: a.name, location: a.location }));
    return attractions.slice(0, 4).map((a) => ({
      name: a.name,
      location: a.location || tripDetails.destination,
    }));
  };

  const fetchHotels = async () => {
    setLoadingStep(1);
    setError(null);
    try {
      const anchors = ensureSelectedAnchors().map(
        (a, i) => `${i + 1}. ${a.name} (${a.location})`
      );
      const { data } = await axios.post("http://localhost:3001/query", {
        kind: "hotels",
        trip: tripDetails,
        anchors,
      });
      const json = parseJSONEnvelope(data);
      setHotels(Array.isArray(json?.hotels) ? json.hotels : []);
    } catch (e) {
      setError("Couldn't fetch hotels. Try again.");
    } finally {
      setLoadingStep(null);
    }
  };

  const fetchRestaurants = async () => {
    setLoadingStep(2);
    setError(null);
    try {
      const anchors = ensureSelectedAnchors().map(
        (a, i) => `${i + 1}. ${a.name} (${a.location})`
      );
      const { data } = await axios.post("http://localhost:3001/query", {
        kind: "food",
        trip: tripDetails,
        anchors,
      });
      const json = parseJSONEnvelope(data);
      setRestaurants(Array.isArray(json?.food) ? json.food : []);
    } catch (e) {
      setError("Couldn't fetch restaurants. Try again.");
    } finally {
      setLoadingStep(null);
    }
  };

  const openAttractionDetails = async (a: Attraction) => {
    setDetailsOpen(true);
    setDetailsLoading(true);
    // show the name immediately so the header isn't blank
    setDetailsData({ name: a.name });

    try {
      const { data } = await axios.post("http://localhost:3001/query", {
        kind: "attraction_details",
        trip: tripDetails,
        attraction: {
          name: a.name,
          location: a.location || tripDetails.destination,
        },
      });

      // backend returns { json: { name, summary, ... } }
      const json = data?.json;
      if (!json || typeof json !== "object") throw new Error("No JSON");
      setDetailsData(json);
    } catch (e) {
      console.error("Details fetch error:", e);
      setDetailsData({
        name: a.name,
        summary: "Sorry—couldn’t fetch details right now.",
      });
    } finally {
      setDetailsLoading(false);
    }
  };

  /* ---------- Planner ---------- */

  const addToPlanner = (item: ItemType) => {
    // avoid collisions across steps: de-dupe by (type + name)
    const exists = planner.some(
      (p) => p.type === item.type && p.name === item.name
    );
    if (!exists) setPlanner((p) => [...p, item]);
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
    alert("Saved! Check My Itineraries.");
  };

  /* ---------- UI ---------- */

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
                      min={1}
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
                      min={1}
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
                      min={1}
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

              {/* ---------- Step 0: Attractions ---------- */}
              {step === 0 && (
                <div className="pt-card">
                  <div
                    className="pt-card-head"
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span>Recommended Attractions</span>
                    <button
                      className="btn btn-outline-secondary btn-sm"
                      onClick={fetchAttractions}
                      disabled={loading || loadingStep === 0}
                    >
                      {loading || loadingStep === 0
                        ? "Refreshing..."
                        : "↻ Regenerate"}
                    </button>
                  </div>
                  <div className="pt-divider" />
                  <div className="pt-scroll">
                    {attractions.length === 0 && (
                      <div className="pt-empty">No recommendations yet.</div>
                    )}
                    {attractions.map((a, i) => (
                      <div className="pt-result-card" key={`${a.name}-${i}`}>
                        {/* Header */}
                        <div className="pt-card-header-row">
                          <div className="pt-result-title">{a.name}</div>
                          <div className="pt-header-right">
                            {a.importance && (
                              <span
                                className={`pt-chip ${
                                  a.importance.toLowerCase() === "must see"
                                    ? "pt-chip--important"
                                    : "pt-chip--optional"
                                }`}
                                title={a.importance}
                              >
                                {a.importance}
                              </span>
                            )}
                            <button
                              className="pt-link-btn"
                              onClick={() => openAttractionDetails(a)}
                            >
                              More
                            </button>
                          </div>
                        </div>

                        {/* Sub + description */}
                        {a.location && (
                          <div className="pt-result-sub">📍 {a.location}</div>
                        )}
                        {a.description && (
                          <p className="pt-description">{a.description}</p>
                        )}

                        {/* Collapsible meta */}
                        {(a.entry_fees || a.operation_duration) && (
                          <details className="pt-details">
                            <summary>Details (hours & fees)</summary>
                            <div className="pt-entry">
                              {a.operation_duration && (
                                <div>
                                  <div className="pt-entry-head">🕒 Hours</div>
                                  <div className="pt-entry-value">
                                    {a.operation_duration}
                                  </div>
                                </div>
                              )}
                              {a.entry_fees && (
                                <div>
                                  <div className="pt-entry-head">
                                    🎟 Entry Fees
                                  </div>
                                  <ul className="pt-fees-list">
                                    {Object.entries(a.entry_fees).map(
                                      ([k, v]) => (
                                        <li className="pt-fees-row" key={k}>
                                          <span className="pt-fees-key">
                                            {k}
                                          </span>
                                          <span className="pt-fees-val">
                                            {v}
                                          </span>
                                        </li>
                                      )
                                    )}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </details>
                        )}

                        {/* Divider + footer button (keeps button visually "inside") */}
                        <div className="pt-card-divider" />
                        <div className="pt-card-footer">
                          <button
                            className="btn btn-outline-secondary pt-add-btn"
                            onClick={() =>
                              addToPlanner({
                                id: Number(`1${Date.now()}${i}`),
                                type: "Attraction",
                                name: a.name,
                                location: a.location || tripDetails.destination,
                                description: a.description || "",
                              })
                            }
                          >
                            ➕ Add to Planner
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ---------- Step 1: Hotels ---------- */}
              {step === 1 && (
                <div className="pt-card">
                  <div
                    className="pt-card-head"
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span>Closest Hotels</span>
                    <button
                      className="btn btn-outline-secondary btn-sm"
                      onClick={fetchHotels}
                      disabled={loadingStep === 1}
                    >
                      {loadingStep === 1 ? "Refreshing..." : "↻ Regenerate"}
                    </button>
                  </div>
                  <div className="pt-divider" />
                  <div className="pt-scroll">
                    {hotels.length === 0 && (
                      <div className="pt-empty">No recommendations yet.</div>
                    )}
                    {hotels.map((h, i) => (
                      <div className="pt-result-card" key={`${h.name}-${i}`}>
                        {/* Header row: name + badges */}
                        <div className="pt-card-header-row">
                          <div className="pt-result-title">{h.name}</div>
                          <div className="pt-header-right">
                            {typeof h.rating === "number" && (
                              <span className="pt-badge-rating">
                                ⭐ {h.rating}
                              </span>
                            )}
                            {h.priceRange && (
                              <span className="pt-chip pt-chip--price">
                                {h.priceRange}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Sub line */}
                        {h.location && (
                          <div className="pt-result-sub">📍 {h.location}</div>
                        )}

                        {/* Pros / Cons */}
                        {h.pros_and_cons &&
                        (h.pros_and_cons.pros?.length ||
                          h.pros_and_cons.cons?.length) ? (
                          <details className="pt-details">
                            <summary>Pros & Cons</summary>
                            <div className="pt-proscons">
                              {h.pros_and_cons.pros?.length ? (
                                <div className="pt-pros">
                                  <div className="pt-pros-head">✅ Pros</div>
                                  <ul>
                                    {h.pros_and_cons.pros.map((p, idx) => (
                                      <li key={idx}>{p}</li>
                                    ))}
                                  </ul>
                                </div>
                              ) : null}
                              {h.pros_and_cons.cons?.length ? (
                                <div className="pt-cons">
                                  <div className="pt-cons-head">⚠️ Cons</div>
                                  <ul>
                                    {h.pros_and_cons.cons.map((c, idx) => (
                                      <li key={idx}>{c}</li>
                                    ))}
                                  </ul>
                                </div>
                              ) : null}
                            </div>
                          </details>
                        ) : null}

                        {/* Add */}
                        <div className="pt-card-divider" />
                        <div className="pt-card-footer">
                          <button
                            className="btn btn-outline-secondary pt-add-btn"
                            onClick={() =>
                              addToPlanner({
                                id: Number(`2${Date.now()}${i}`),
                                type: "Hotel",
                                name: h.name,
                                location: h.location || tripDetails.destination,
                                description: [
                                  typeof h.rating === "number"
                                    ? `⭐ ${h.rating}`
                                    : "",
                                  h.priceRange || "",
                                ]
                                  .filter(Boolean)
                                  .join(" · "),
                              })
                            }
                          >
                            ➕ Add to Planner
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ---------- Step 2: Restaurants ---------- */}
              {step === 2 && (
                <div className="pt-card">
                  <div
                    className="pt-card-head"
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span>Restaurants Near Your Plan</span>
                    <button
                      className="btn btn-outline-secondary btn-sm"
                      onClick={fetchRestaurants}
                      disabled={loadingStep === 2}
                    >
                      {loadingStep === 2 ? "Refreshing..." : "↻ Regenerate"}
                    </button>
                  </div>
                  <div className="pt-divider" />
                  <div className="pt-scroll">
                    {restaurants.length === 0 && (
                      <div className="pt-empty">No recommendations yet.</div>
                    )}
                    {restaurants.map((r, i) => (
                      <div className="pt-result-card" key={`${r.name}-${i}`}>
                        {/* Header row */}
                        <div className="pt-card-header-row">
                          <div className="pt-result-title">{r.name}</div>
                          <div className="pt-header-right">
                            {typeof r.rating === "number" && (
                              <span className="pt-badge-rating">
                                ⭐ {r.rating}
                              </span>
                            )}
                            {r.priceRange && (
                              <span className="pt-chip pt-chip--price">
                                {r.priceRange}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Sub lines */}
                        <div className="pt-result-sub">
                          {r.cuisineType ? `${r.cuisineType}` : ""}
                          {r.cuisineType && r.location ? " · " : ""}
                          {r.location ? `📍 ${r.location}` : ""}
                        </div>

                        {/* Pros / Cons */}
                        {r.pros_and_cons &&
                        (r.pros_and_cons.pros?.length ||
                          r.pros_and_cons.cons?.length) ? (
                          <details className="pt-details">
                            <summary>Pros & Cons</summary>
                            <div className="pt-proscons">
                              {r.pros_and_cons.pros?.length ? (
                                <div className="pt-pros">
                                  <div className="pt-pros-head">✅ Pros</div>
                                  <ul>
                                    {r.pros_and_cons.pros.map((p, idx) => (
                                      <li key={idx}>{p}</li>
                                    ))}
                                  </ul>
                                </div>
                              ) : null}
                              {r.pros_and_cons.cons?.length ? (
                                <div className="pt-cons">
                                  <div className="pt-cons-head">⚠️ Cons</div>
                                  <ul>
                                    {r.pros_and_cons.cons.map((c, idx) => (
                                      <li key={idx}>{c}</li>
                                    ))}
                                  </ul>
                                </div>
                              ) : null}
                            </div>
                          </details>
                        ) : null}

                        {/* Add */}
                        <div className="pt-card-divider" />
                        <div className="pt-card-footer">
                          <button
                            className="btn btn-outline-secondary pt-add-btn"
                            onClick={() =>
                              addToPlanner({
                                id: Number(`3${Date.now()}${i}`),
                                type: "Restaurant",
                                name: r.name,
                                location: r.location || tripDetails.destination,
                                description: [r.cuisineType, r.priceRange]
                                  .filter(Boolean)
                                  .join(" · "),
                              })
                            }
                          >
                            ➕ Add to Planner
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
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

        {/* RIGHT: Trip summary + Planner */}
        <div className="right-panel pt-right">
          <div className="pt-sticky">
            <div className="pt-card td-card">
              <div className="pt-card-head">Trip Details</div>
              <div className="pt-divider" />

              {formSubmitted ? (
                <>
                  <div className="td-route">
                    <span className="td-city">{tripDetails.origin || "—"}</span>
                    <span className="td-arrow">➡</span>
                    <span className="td-city">
                      {tripDetails.destination || "—"}
                    </span>
                  </div>

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

            {/* Planner */}
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

              {/* Save itinerary */}
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

      {/* ----------- Attraction Details Modal ----------- */}
      {detailsOpen && (
        <div className="pt-modal" role="dialog" aria-modal="true">
          <div
            className="pt-modal-backdrop"
            onClick={() => setDetailsOpen(false)}
          />
          <div className="pt-modal-card" role="document">
            <div className="pt-modal-head">
              <div className="pt-modal-title">
                {detailsData?.name || "Attraction details"}
              </div>
              <button
                className="pt-close"
                onClick={() => setDetailsOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="pt-modal-body">
              {detailsLoading ? (
                <div className="pt-modal-loading">Loading…</div>
              ) : detailsData ? (
                <>
                  {detailsData.summary && (
                    <p className="pt-modal-p">{detailsData.summary}</p>
                  )}

                  <div className="pt-modal-grid">
                    {detailsData.best_time && (
                      <div>
                        <div className="pt-modal-k">Best time</div>
                        <div className="pt-modal-v">
                          {detailsData.best_time}
                        </div>
                      </div>
                    )}
                    {detailsData.time_required && (
                      <div>
                        <div className="pt-modal-k">Time required</div>
                        <div className="pt-modal-v">
                          {detailsData.time_required}
                        </div>
                      </div>
                    )}
                    {detailsData.crowd_level && (
                      <div>
                        <div className="pt-modal-k">Crowd</div>
                        <div className="pt-modal-v">
                          {detailsData.crowd_level}
                        </div>
                      </div>
                    )}
                  </div>

                  {detailsData.how_to_reach?.length ? (
                    <div className="pt-modal-section">
                      <div className="pt-modal-k">How to reach</div>
                      <ul className="pt-modal-list">
                        {detailsData.how_to_reach.map((t, idx) => (
                          <li key={idx}>{t}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {detailsData.tips?.length ? (
                    <div className="pt-modal-section">
                      <div className="pt-modal-k">Tips</div>
                      <ul className="pt-modal-list">
                        {detailsData.tips.map((t, idx) => (
                          <li key={idx}>{t}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {detailsData.nearby?.length ? (
                    <div className="pt-modal-section">
                      <div className="pt-modal-k">Nearby</div>
                      <ul className="pt-modal-list">
                        {detailsData.nearby.map((n, idx) => (
                          <li key={idx}>{n}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {detailsData.scams_warnings?.length ? (
                    <div className="pt-modal-section">
                      <div className="pt-modal-k">Warnings</div>
                      <ul className="pt-modal-list">
                        {detailsData.scams_warnings.map((s, idx) => (
                          <li key={idx}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="pt-modal-empty">No details available.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
