import { useState } from "react";
import axios from "axios";

export default function SearchPanel() {
  const [query, setQuery] = useState("");

  // Extended OutputType to include new fields
  type OutputType = {
    attractions?: {
      name: string;
      description: string;
      location: string;
      importance: string; // new
      entryFees: string; // new
      operationDuration: string; // new
    }[];
    hotels?: {
      name: string;
      rating: number;
      priceRange: string;
      location: string;
      pros: string; // new
      cons: string; // new
    }[];
    scams?: {
      title: string;
      description: string;
    }[];
    text?: string;
  } | null;

  const [output, setOutput] = useState<OutputType>(null);
  const [image, setImage] = useState<File | null>(null);

  const handleSearch = async () => {
    try {
      const res = await axios.post("http://localhost:3001/query", {
        prompt: query,
      });

      console.log("Raw API Response:", res.data.response);

      let parsedResponse: OutputType = null;

      if (typeof res.data.response === "string") {
        const cleanString = res.data.response
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim();

        try {
          parsedResponse = JSON.parse(cleanString);
        } catch (err) {
          console.error("JSON.parse error:", err);
        }
      } else {
        parsedResponse = res.data.response;
      }

      console.log("Parsed:", parsedResponse);

      if (parsedResponse && parsedResponse.attractions) {
        setOutput(parsedResponse);
      } else {
        setOutput({ text: "No data found." });
      }
    } catch (err) {
      console.error("Error fetching:", err);
      setOutput({ text: "Something went wrong." });
    }
  };

  const handlePhotoUpload = async () => {
    if (!image) return;
    try {
      const formData = new FormData();
      formData.append("photo", image);

      const res = await axios.post("http://localhost:3001/photo", formData);
      setOutput({ text: res.data.response });
    } catch (err) {
      console.error(err);
      setOutput({ text: "Something went wrong." });
    }
  };

  return (
    <div>
      <input
        type="text"
        placeholder="Which location would you like to travel?"
        className="form-control mb-2"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <button className="btn btn-primary w-100 mb-2" onClick={handleSearch}>
        Search
      </button>

      <div className="search-container">
        <button
          className="btn btn-outline-secondary w-100 mb-2"
          onClick={() => setQuery("Find food nearby")}
        >
          🍽️ Food Nearby
        </button>
        <button
          className="btn btn-outline-secondary w-100 mb-2"
          onClick={() => setQuery("Find hotels nearby")}
        >
          🏨 Hotels Nearby
        </button>
      </div>

      <input
        type="file"
        accept="image/*"
        className="form-control mb-2"
        onChange={(e) => setImage(e.target.files?.[0] || null)}
      />
      <button
        className="btn btn-outline-dark w-100 mb-2"
        onClick={handlePhotoUpload}
      >
        📷 Identify Monument
      </button>

      <div className="mt-3">
        <h6>AI Response:</h6>
        {output && output.attractions ? (
          <>
            {/* Attractions */}
            <strong>🏞 Attractions</strong>
            <ul>
              {output.attractions.map((a, i) => (
                <li key={i}>
                  <b>{a.name}</b>: {a.description} <br />
                  <small>
                    <b>📍 Location:</b> {a.location} | <b>🔥 Importance:</b>{" "}
                    {a.importance} | <b>💵 Entry Fees:</b> {a.entryFees} |{" "}
                    <b>⏱ Duration:</b> {a.operationDuration}
                  </small>
                </li>
              ))}
            </ul>

            {/* Hotels */}
            <strong>🏨 Hotels</strong>
            <ul>
              {output.hotels &&
                output.hotels.map((h, i) => (
                  <li key={i}>
                    <b>{h.name}</b> - ⭐ {h.rating} ({h.priceRange}) <br />
                    <small>📍 {h.location}</small> <br />
                    <small>
                      <b>Pros:</b> {h.pros} <br />
                      <b>Cons:</b> {h.cons}
                    </small>
                  </li>
                ))}
            </ul>

            {/* Scams */}
            <strong>⚠️ Scams</strong>
            <ul>
              {output.scams &&
                output.scams.map((s, i) => (
                  <li key={i}>
                    <b>{s.title}</b>: {s.description}
                  </li>
                ))}
            </ul>
          </>
        ) : (
          <p>{output?.text}</p>
        )}
      </div>
    </div>
  );
}
