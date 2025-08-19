import { useState } from "react";
import axios from "axios";

type OutputType = {
  attractions?: {
    name: string;
    description?: string;
    location?: string;
    importance?: string;
    entry_fees?: Record<string, string> | string; // accept both
    entryFees?: string; // legacy
    operation_duration?: string;
    operationDuration?: string; // legacy
  }[];
  hotels?: {
    name: string;
    rating?: string | number;
    priceRange?: string;
    approx_cost_per_night?: string;
    location?: string;
    pros_and_cons?: { pros?: string[]; cons?: string[] };
    pros?: string; // legacy
    cons?: string; // legacy
  }[];
  food?: {
    name: string;
    cuisineType?: string;
    rating?: string | number;
    priceRange?: string;
    approx_cost_for_two?: string;
    location?: string;
    pros_and_cons?: { pros?: string[]; cons?: string[] };
    pros?: string; // legacy
    cons?: string; // legacy
  }[];
  scams?: { title: string; description: string }[];
  text?: string;
} | null;

// Use env var (Vercel: set VITE_API_BASE_URL) or fallback for local dev
const API = import.meta.env.VITE_API_URL || "http://localhost:3001";

/** ---- helpers ---- */

// Accept either a JS object (new backend `json`) or a string to parse (legacy `response`)
function parseSafeJsonEnvelope(resData: any): OutputType {
  // New shape: { json: {...} }
  if (resData?.json && typeof resData.json === "object") {
    return resData.json;
  }
  // Legacy shape: { response: " ...json... " }
  const raw = resData?.response;
  if (typeof raw === "string" && raw.trim()) {
    try {
      const clean = raw
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();
      return JSON.parse(clean);
    } catch {
      // try to extract largest {...}
      const start = raw.indexOf("{");
      const end = raw.lastIndexOf("}");
      if (start !== -1 && end > start) {
        try {
          return JSON.parse(raw.slice(start, end + 1));
        } catch {
          return { text: "Could not parse AI output." };
        }
      }
      return { text: "Could not parse AI output." };
    }
  }
  return { text: "No data received." };
}

const Section: React.FC<{ title: string; children?: React.ReactNode }> = ({
  title,
  children,
}) => (
  <div className="card-dark mb-3">
    <h6 className="card-title">{title}</h6>
    <div className="card-divider" />
    {children}
  </div>
);

const Chip: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span
    style={{
      display: "inline-block",
      padding: "0.18rem 0.5rem",
      borderRadius: "999px",
      fontSize: ".75rem",
      lineHeight: 1,
      border: "1px solid rgba(255,255,255,.16)",
      color: "#cfefff",
      background: "rgba(96,220,248,.10)",
      marginRight: 6,
    }}
  >
    {children}
  </span>
);

const hasContent = (data: OutputType) =>
  !!(
    data?.text ||
    (data?.food && data.food.length) ||
    (data?.hotels && data.hotels.length) ||
    (data?.attractions && data.attractions.length) ||
    (data?.scams && data.scams.length)
  );

export default function SearchPanel() {
  const [query, setQuery] = useState("");
  const [searchOutput, setSearchOutput] = useState<OutputType>(null);
  const [foodOutput, setFoodOutput] = useState<OutputType>(null);
  const [hotelOutput, setHotelOutput] = useState<OutputType>(null);
  const [loading, setLoading] = useState(false);

  // --- calls ---

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const { data } = await axios.post(`${API}/query`, { prompt: query });
      setSearchOutput(parseSafeJsonEnvelope(data));
    } catch (err) {
      console.error("Search Error:", err);
      setSearchOutput({ text: "Something went wrong." });
    } finally {
      setLoading(false);
    }
  };

  const handleFoodNearby = () => {
    if (!navigator.geolocation) {
      setFoodOutput({ text: "Geolocation not available in this browser." });
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const prompt = `Return JSON with a "food" array of specific restaurants near latitude ${latitude}, longitude ${longitude} (max 8). Include name, cuisineType, rating, priceRange, approx_cost_for_two, location, and pros_and_cons with brief pros/cons.`;
        try {
          const { data } = await axios.post(`${API}/query`, { prompt });
          setFoodOutput(parseSafeJsonEnvelope(data));
        } catch (err) {
          console.error("Food Nearby Error:", err);
          setFoodOutput({ text: "Error fetching food places." });
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        console.error("Geolocation error:", err);
        setLoading(false);
        setFoodOutput({ text: "Permission denied for location." });
      }
    );
  };

  const handleHotelsNearby = () => {
    if (!navigator.geolocation) {
      setHotelOutput({ text: "Geolocation not available in this browser." });
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const prompt = `Return JSON with a "hotels" array of specific hotels near latitude ${latitude}, longitude ${longitude} (max 8). Include name, rating, priceRange, approx_cost_per_night, location, and pros_and_cons with brief pros/cons.`;
        try {
          const { data } = await axios.post(`${API}/query`, { prompt });
          setHotelOutput(parseSafeJsonEnvelope(data));
        } catch (err) {
          console.error("Hotels Nearby Error:", err);
          setHotelOutput({ text: "Error fetching hotels." });
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        console.error("Geolocation error:", err);
        setLoading(false);
        setHotelOutput({ text: "Permission denied for location." });
      }
    );
  };

  // --- render helpers ---

  const renderOutput = (data: OutputType) => {
    if (!hasContent(data)) return <p>No results.</p>;

    return (
      <>
        {/* Food */}
        {data?.food && data.food.length > 0 && (
          <Section title="🍴 Food Places">
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {data.food.map((f, i) => (
                <li
                  key={i}
                  style={{
                    padding: ".5rem 0",
                    borderTop: i ? "1px dashed rgba(255,255,255,.08)" : "none",
                  }}
                >
                  <div style={{ fontWeight: 600 }}>
                    {f.name} {f.cuisineType && <Chip>{f.cuisineType}</Chip>}
                    {f.rating && <Chip>{f.rating}★</Chip>}
                    {f.priceRange && <Chip>{f.priceRange}</Chip>}
                  </div>
                  <div className="text-muted">📍 {f.location}</div>
                  {/* pros/cons from either pros_and_cons or legacy pros/cons */}
                  {(f as any).pros_and_cons?.pros?.length ? (
                    <div style={{ marginTop: 6 }}>
                      <Chip>✅ {(f as any).pros_and_cons.pros[0]}</Chip>
                    </div>
                  ) : (f as any).pros ? (
                    <div style={{ marginTop: 6 }}>
                      <Chip>✅ {(f as any).pros}</Chip>
                    </div>
                  ) : null}
                  {(f as any).pros_and_cons?.cons?.length ? (
                    <div style={{ marginTop: 6 }}>
                      <Chip>⚠️ {(f as any).pros_and_cons.cons[0]}</Chip>
                    </div>
                  ) : (f as any).cons ? (
                    <div style={{ marginTop: 6 }}>
                      <Chip>⚠️ {(f as any).cons}</Chip>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Hotels */}
        {data?.hotels && data.hotels.length > 0 && (
          <Section title="🏨 Hotels">
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {data.hotels.map((h, i) => (
                <li
                  key={i}
                  style={{
                    padding: ".5rem 0",
                    borderTop: i ? "1px dashed rgba(255,255,255,.08)" : "none",
                  }}
                >
                  <div style={{ fontWeight: 600 }}>
                    {h.name} {h.rating && <Chip>{h.rating}★</Chip>}{" "}
                    {h.priceRange && <Chip>{h.priceRange}</Chip>}
                  </div>
                  <div className="text-muted">📍 {h.location}</div>
                  {/* price/night if present */}
                  {(h as any).approx_cost_per_night && (
                    <div style={{ marginTop: 6 }}>
                      <Chip>💰 {(h as any).approx_cost_per_night}</Chip>
                    </div>
                  )}
                  {(h as any).pros_and_cons?.pros?.length ? (
                    <div style={{ marginTop: 6 }}>
                      <Chip>✅ {(h as any).pros_and_cons.pros[0]}</Chip>
                    </div>
                  ) : (h as any).pros ? (
                    <div style={{ marginTop: 6 }}>
                      <Chip>✅ {(h as any).pros}</Chip>
                    </div>
                  ) : null}
                  {(h as any).pros_and_cons?.cons?.length ? (
                    <div style={{ marginTop: 6 }}>
                      <Chip>⚠️ {(h as any).pros_and_cons.cons[0]}</Chip>
                    </div>
                  ) : (h as any).cons ? (
                    <div style={{ marginTop: 6 }}>
                      <Chip>⚠️ {(h as any).cons}</Chip>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Attractions */}
        {data?.attractions && data.attractions.length > 0 && (
          <Section title="🏞 Attractions">
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {data.attractions.map((a, i) => {
                const fees =
                  typeof a.entry_fees === "string"
                    ? a.entry_fees
                    : a.entryFees
                    ? a.entryFees
                    : a.entry_fees
                    ? Object.entries(a.entry_fees)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(" · ")
                    : "";
                const hours = a.operation_duration || a.operationDuration || "";
                return (
                  <li
                    key={i}
                    style={{
                      padding: ".5rem 0",
                      borderTop: i
                        ? "1px dashed rgba(255,255,255,.08)"
                        : "none",
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>
                      {a.name} {a.importance && <Chip>{a.importance}</Chip>}
                    </div>
                    <div className="text-muted">📍 {a.location}</div>
                    {fees && <Chip>💵 {fees}</Chip>}
                    {hours && <Chip>⏱ {hours}</Chip>}
                    {a.description && (
                      <div style={{ marginTop: 6 }}>{a.description}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Section>
        )}

        {/* Scams */}
        {data?.scams && data.scams.length > 0 && (
          <Section title="⚠️ Scams to watch">
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {data.scams.map((s, i) => (
                <li
                  key={i}
                  style={{
                    padding: ".5rem 0",
                    borderTop: i ? "1px dashed rgba(255,255,255,.08)" : "none",
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{s.title}</div>
                  <div className="text-muted">{s.description}</div>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {data?.text &&
          !data.food &&
          !data.hotels &&
          !data.attractions &&
          !data.scams && <p>{data.text}</p>}
      </>
    );
  };

  return (
    <div style={{ width: "100%" }}>
      {/* Top search card */}
      <div className="card-dark mb-3">
        <h6 className="card-title">Which location would you like to travel?</h6>
        <div className="card-divider" />
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="text"
            placeholder="City, landmark, or country"
            className="form-control"
            style={{ flex: 1 }}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="btn btn-primary" onClick={handleSearch}>
            Search
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button
            className="btn btn-outline-secondary"
            onClick={handleFoodNearby}
          >
            🍽️ Food Nearby
          </button>
          <button
            className="btn btn-outline-secondary"
            onClick={handleHotelsNearby}
          >
            🏨 Hotels Nearby
          </button>
        </div>
      </div>

      {loading && <p>⏳ Loading...</p>}

      {/* Only render sections when they have content */}
      {hasContent(searchOutput) && (
        <div className="card-dark mb-3">
          <h6 className="card-title">🔍 Search Results</h6>
          <div className="card-divider" />
          <div className="results-scroll">{renderOutput(searchOutput)}</div>
        </div>
      )}

      {hasContent(foodOutput) && (
        <div className="card-dark mb-3">
          <h6 className="card-title">🍽️ Food Nearby</h6>
          <div className="card-divider" />
          <div className="results-scroll">{renderOutput(foodOutput)}</div>
        </div>
      )}

      {hasContent(hotelOutput) && (
        <div className="card-dark">
          <h6 className="card-title">🏨 Hotels Nearby</h6>
          <div className="card-divider" />
          <div className="results-scroll">{renderOutput(hotelOutput)}</div>
        </div>
      )}
    </div>
  );
}
