import { useEffect, useState } from "react";
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

type TripDetails = {
  destination: string;
  origin: string;
  people: number;
  travelType: string;
  days: number;
  nights: number;
  budget: string;
  dates?: string;
};

type SavedItinerary = {
  name: string;
  tripDetails: TripDetails;
  planner: ItemType[];
  dayPlan?: {
    plan: {
      day: number;
      date?: string;
      slots: { time: string; title: string; notes?: string }[];
    }[];
  };
};

const API = "http://localhost:3001";

export default function MyItinerary() {
  const [itins, setItins] = useState<SavedItinerary[]>([]);
  const [selected, setSelected] = useState<SavedItinerary | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // load from localStorage
  useEffect(() => {
    const data = JSON.parse(localStorage.getItem("savedItineraries") || "[]");
    setItins(data);
    setSelected(null);
  }, []);

  const saveAll = (arr: SavedItinerary[]) => {
    setItins(arr);
    localStorage.setItem("savedItineraries", JSON.stringify(arr));
  };

  const selectItin = async (name: string) => {
    const found = itins.find((x) => x.name === name) || null;
    setSelected(found);

    if (found && !found.dayPlan) {
      await generatePlan(found);
    }
  };

  const generatePlan = async (itin: SavedItinerary) => {
    setLoadingPlan(true);
    setError(null);
    try {
      const payload = {
        trip: {
          ...itin.tripDetails,
          planner: itin.planner,
        },
      };
      const { data } = await axios.post(`${API}/query/day-plan`, payload);
      const json = data?.json;

      const updated = itins.map((x) =>
        x.name === itin.name ? { ...x, dayPlan: json } : x
      );
      saveAll(updated);
      setSelected({ ...itin, dayPlan: json });
    } catch (e: any) {
      setError(
        e?.response?.data?.error || "Couldn't generate day plan. Try again."
      );
    } finally {
      setLoadingPlan(false);
    }
  };

  const deleteItinerary = (name: string) => {
    const updated = itins.filter((x) => x.name !== name);
    saveAll(updated);
    if (selected?.name === name) setSelected(null);
  };

  return (
    <div>
      <Navbar />
      <div className="main myit-main">
        {/* LEFT LIST */}
        <div className="left-panel myit-left">
          <div className="myit-head">My Saved Itineraries</div>
          <div className="myit-list">
            {itins.length === 0 ? (
              <div className="myit-empty">No itineraries saved yet.</div>
            ) : (
              itins.map((it) => (
                <button
                  key={it.name}
                  className={`myit-list-item ${
                    selected?.name === it.name ? "is-active" : ""
                  }`}
                  onClick={() => selectItin(it.name)}
                  title={`${it.tripDetails.origin} → ${it.tripDetails.destination}`}
                >
                  <div className="myit-list-title">{it.name}</div>
                  <div className="myit-list-sub">
                    {it.tripDetails.origin} → {it.tripDetails.destination}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* RIGHT DETAILS */}
        <div className="right-panel myit-right">
          {!selected ? (
            <div className="myit-hint">Select an itinerary on the left.</div>
          ) : (
            <div className="myit-detail">
              {/* Header card */}
              <div className="myit-card">
                <div className="myit-card-head">
                  <div className="myit-title">{selected.name}</div>
                  <div className="myit-actions">
                    <button
                      className="btn btn-outline-secondary"
                      onClick={() => generatePlan(selected!)}
                      disabled={loadingPlan}
                    >
                      ↻ Regenerate Plan
                    </button>
                    <button
                      className="btn btn-outline-danger"
                      onClick={() => deleteItinerary(selected.name)}
                    >
                      ❌ Delete
                    </button>
                  </div>
                </div>
                <div className="myit-divider" />

                <div className="myit-meta">
                  <div className="myit-row">
                    <span className="myit-k">Route</span>
                    <span className="myit-v">
                      {selected.tripDetails.origin} ➜{" "}
                      {selected.tripDetails.destination}
                    </span>
                  </div>
                  <div className="myit-row">
                    <span className="myit-k">Group</span>
                    <span className="myit-v">
                      {selected.tripDetails.people} (
                      {selected.tripDetails.travelType || "N/A"})
                    </span>
                  </div>
                  <div className="myit-row">
                    <span className="myit-k">Duration</span>
                    <span className="myit-v">
                      {selected.tripDetails.days}D /{" "}
                      {selected.tripDetails.nights}N
                    </span>
                  </div>
                  <div className="myit-row">
                    <span className="myit-k">Budget</span>
                    <span className="myit-v">
                      {selected.tripDetails.budget || "No preference"}
                    </span>
                  </div>
                  {selected.tripDetails.dates && (
                    <div className="myit-row">
                      <span className="myit-k">Dates</span>
                      <span className="myit-v">
                        {selected.tripDetails.dates}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Day Plan */}
              <div className="myit-card">
                <div className="myit-card-head">Day‑by‑Day Plan</div>
                <div className="myit-divider" />

                {loadingPlan ? (
                  <div className="myit-empty">Generating plan…</div>
                ) : error ? (
                  <div className="myit-error">{error}</div>
                ) : !selected.dayPlan?.plan?.length ? (
                  <div className="myit-empty">
                    No plan yet. Click “Regenerate Plan”.
                  </div>
                ) : (
                  selected.dayPlan.plan.map((d) => (
                    <div className="myit-day" key={d.day}>
                      <div className="myit-day-head">
                        <div className="myit-day-title">Day {d.day}</div>
                        {d.date && (
                          <div className="myit-day-date">{d.date}</div>
                        )}
                      </div>
                      <ul className="myit-slots">
                        {d.slots.map((s, idx) => (
                          <li key={idx} className="myit-slot">
                            <div className="myit-time">{s.time}</div>
                            <div className="myit-slot-body">
                              <div className="myit-slot-title">{s.title}</div>
                              {s.notes && (
                                <div className="myit-slot-notes">{s.notes}</div>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
