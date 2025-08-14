import { useState } from "react";
import axios from "axios";

type OutputType = {
  attractions?: {
    name: string;
    description: string;
    location: string;
    importance?: string;
    entryFees?: string;
    operationDuration?: string;
  }[];
  hotels?: {
    name: string;
    rating: string | number;
    priceRange: string;
    location: string;
    pros?: string;
    cons?: string;
  }[];
  food?: {
    name: string;
    cuisineType: string;
    rating: string | number;
    priceRange: string;
    location: string;
    pros?: string;
    cons?: string;
  }[];
  scams?: {
    title: string;
    description: string;
  }[];
  text?: string;
} | null;

export default function SearchPanel() {
  const [query, setQuery] = useState("");
  const [searchOutput, setSearchOutput] = useState<OutputType>(null);
  const [foodOutput, setFoodOutput] = useState<OutputType>(null);
  const [hotelOutput, setHotelOutput] = useState<OutputType>(null);
  const [loading, setLoading] = useState(false);

  const parseJsonSafe = (s: string) => {
    try {
      const clean = s
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();
      return JSON.parse(clean);
    } catch (e) {
      console.error("JSON parse failed", e);
      return { text: "Something went wrong parsing AI output." };
    }
  };

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await axios.post("http://localhost:3001/query", {
        prompt: query,
      });
      setSearchOutput(parseJsonSafe(res.data.response));
    } catch (err) {
      console.error("Search Error:", err);
      setSearchOutput({ text: "Something went wrong." });
    } finally {
      setLoading(false);
    }
  };

  const handleFoodNearby = () => {
    if (!navigator.geolocation) return;
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const prompt = `Find top food places nearby latitude ${latitude}, longitude ${longitude}`;
        try {
          const res = await axios.post("http://localhost:3001/query", {
            prompt,
          });
          setFoodOutput(parseJsonSafe(res.data.response));
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
      }
    );
  };

  const handleHotelsNearby = () => {
    if (!navigator.geolocation) return;
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const prompt = `Find top hotels nearby latitude ${latitude}, longitude ${longitude}`;
        try {
          const res = await axios.post("http://localhost:3001/query", {
            prompt,
          });
          setHotelOutput(parseJsonSafe(res.data.response));
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
      }
    );
  };

  // --- UI helpers ---
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
                  {f.pros && (
                    <div style={{ marginTop: 6 }}>
                      <Chip>✅ {f.pros}</Chip>
                    </div>
                  )}
                  {f.cons && (
                    <div style={{ marginTop: 6 }}>
                      <Chip>⚠️ {f.cons}</Chip>
                    </div>
                  )}
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
                  {h.pros && (
                    <div style={{ marginTop: 6 }}>
                      <Chip>✅ {h.pros}</Chip>
                    </div>
                  )}
                  {h.cons && (
                    <div style={{ marginTop: 6 }}>
                      <Chip>⚠️ {h.cons}</Chip>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Attractions */}
        {data?.attractions && data.attractions.length > 0 && (
          <Section title="🏞 Attractions">
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {data.attractions.map((a, i) => (
                <li
                  key={i}
                  style={{
                    padding: ".5rem 0",
                    borderTop: i ? "1px dashed rgba(255,255,255,.08)" : "none",
                  }}
                >
                  <div style={{ fontWeight: 600 }}>
                    {a.name} {a.importance && <Chip>{a.importance}</Chip>}
                  </div>
                  <div className="text-muted">📍 {a.location}</div>
                  {a.entryFees && <Chip>💵 {a.entryFees}</Chip>}
                  {a.operationDuration && <Chip>⏱ {a.operationDuration}</Chip>}
                  {a.description && (
                    <div style={{ marginTop: 6 }}>{a.description}</div>
                  )}
                </li>
              ))}
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
