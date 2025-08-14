import { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import "../../styles/components/myitinerary.css";

type ItemType = {
  id: number;
  type: string;
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

export default function MyItinerary() {
  const [itineraries, setItineraries] = useState<SavedItinerary[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("savedItineraries") || "[]");
    setItineraries(stored);
  }, []);

  const deleteItinerary = (name: string) => {
    const filtered = itineraries.filter((i) => i.name !== name);
    localStorage.setItem("savedItineraries", JSON.stringify(filtered));
    setItineraries(filtered);
  };

  const toggleExpand = (name: string) => {
    setExpanded(expanded === name ? null : name);
  };

  return (
    <div>
      <Navbar />
      <div className="main">
        <div className="left-panel itinerary-left">
          <div className="mi-card">
            <div className="mi-card-head">My Saved Itineraries</div>
            <div className="mi-divider" />

            {itineraries.length === 0 && (
              <p className="text-muted">No itineraries saved yet.</p>
            )}

            <div className="mi-scroll">
              {itineraries.map((itinerary) => (
                <div key={itinerary.name} className="mi-itinerary-card">
                  <div
                    className="mi-itinerary-header"
                    onClick={() => toggleExpand(itinerary.name)}
                  >
                    <div>
                      <h5 className="mi-itinerary-title">{itinerary.name}</h5>
                      <p className="mi-itinerary-sub">
                        🌍 {itinerary.tripDetails.origin} ➡{" "}
                        {itinerary.tripDetails.destination}
                      </p>
                      <p className="mi-itinerary-sub">
                        👥 {itinerary.tripDetails.people} People •{" "}
                        {itinerary.tripDetails.days}D /{" "}
                        {itinerary.tripDetails.nights}N
                      </p>
                    </div>
                    <span className="mi-expand-icon">
                      {expanded === itinerary.name ? "▲" : "▼"}
                    </span>
                  </div>

                  {expanded === itinerary.name && (
                    <div className="mi-itinerary-body">
                      {itinerary.planner.length === 0 ? (
                        <p className="text-muted">
                          No items in this itinerary.
                        </p>
                      ) : (
                        itinerary.planner.map((item) => (
                          <div key={item.id} className="mi-item">
                            <div>
                              <div className="mi-item-title">
                                {item.type} — {item.name}
                              </div>
                              <div className="mi-item-sub">
                                📍 {item.location}
                              </div>
                              {item.description && (
                                <div className="mi-item-desc">
                                  {item.description}
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      )}

                      <div className="mi-actions">
                        <button
                          className="btn btn-outline-danger"
                          onClick={() => deleteItinerary(itinerary.name)}
                        >
                          ❌ Delete
                        </button>
                        <button
                          className="btn btn-outline-secondary"
                          onClick={() =>
                            alert("Load into planner — implement next")
                          }
                        >
                          ↩ Load in Planner
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="right-panel itinerary-right">
          <div className="mi-card">
            <div className="mi-card-head">Tips</div>
            <div className="mi-divider" />
            <p>
              💡 Click an itinerary card to expand and view all planned items.
            </p>
            <p>💡 You can delete old trips or reload them into the planner.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
