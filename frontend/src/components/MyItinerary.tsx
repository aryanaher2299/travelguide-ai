import { useEffect, useMemo, useState } from "react";
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

type DayPlan = {
  day: number; // 1-indexed
  morning?: ItemType;
  afternoon?: ItemType;
  dinner?: ItemType; // restaurant
  night?: ItemType; // hotel
};

export default function MyItinerary() {
  const [itins, setItins] = useState<SavedItinerary[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("savedItineraries") || "[]");
    setItins(stored);
  }, []);

  const deleteItinerary = (name: string) => {
    const filtered = itins.filter((i) => i.name !== name);
    localStorage.setItem("savedItineraries", JSON.stringify(filtered));
    setItins(filtered);
    if (expanded === name) setExpanded(null);
  };

  // Build day/night schedule from planner items
  const buildSchedule = (it: SavedItinerary) => {
    const days = Math.max(1, Number(it.tripDetails.days || 1));
    const nights = Math.max(1, Number(it.tripDetails.nights || days));

    const attractions = it.planner.filter((p) => p.type === "Attraction");
    const hotels = it.planner.filter((p) => p.type === "Hotel");
    const restaurants = it.planner.filter((p) => p.type === "Restaurant");

    const plan: DayPlan[] = Array.from({ length: days }, (_, i) => ({
      day: i + 1,
    }));

    // Morning & Afternoon slots (round-robin through attractions)
    let ai = 0;
    for (let d = 0; d < days; d++) {
      if (ai < attractions.length) plan[d].morning = attractions[ai++];
      if (ai < attractions.length) plan[d].afternoon = attractions[ai++];
    }

    // Dinners (round-robin restaurants)
    for (let d = 0; d < days; d++) {
      if (restaurants.length) {
        plan[d].dinner = restaurants[d % restaurants.length];
      }
    }

    // Nights (assign nearest hotel per night: here just round-robin)
    for (let n = 0; n < nights; n++) {
      if (hotels.length) {
        plan[n].night = hotels[n % hotels.length];
      }
    }

    // Overflow list (anything not placed)
    const placedIds = new Set<number>();
    plan.forEach((dp) => {
      [dp.morning, dp.afternoon, dp.dinner, dp.night].forEach(
        (x) => x && placedIds.add(x.id)
      );
    });
    const overflow = it.planner.filter((p) => !placedIds.has(p.id));

    return { plan, overflow };
  };

  const ItineraryCard = ({ it }: { it: SavedItinerary }) => {
    const { plan, overflow } = useMemo(() => buildSchedule(it), [it]);

    return (
      <div className="mi-itinerary-card">
        <div
          className="mi-itinerary-header"
          onClick={() => setExpanded(expanded === it.name ? null : it.name)}
        >
          <div>
            <h5 className="mi-itinerary-title">{it.name}</h5>
            <p className="mi-itinerary-sub">
              🌍 {it.tripDetails.origin} ➡ {it.tripDetails.destination}
            </p>
            <p className="mi-itinerary-sub">
              👥 {it.tripDetails.people} • {it.tripDetails.days}D /{" "}
              {it.tripDetails.nights}N • {it.tripDetails.travelType || "N/A"} •{" "}
              {it.tripDetails.budget || "Any budget"}
            </p>
          </div>
          <span className="mi-expand-icon">
            {expanded === it.name ? "▲" : "▼"}
          </span>
        </div>

        {expanded === it.name && (
          <div className="mi-itinerary-body">
            {/* Day/Night grid */}
            <div className="mi-grid">
              {plan.map((d) => (
                <div className="mi-day" key={d.day}>
                  <div className="mi-day-head">Day {d.day}</div>

                  <div className="mi-slot">
                    <div className="mi-slot-title">Morning</div>
                    {d.morning ? (
                      <div className="mi-item">
                        <div className="mi-item-title">{d.morning.name}</div>
                        <div className="mi-item-sub">
                          📍 {d.morning.location}
                        </div>
                        {d.morning.description && (
                          <div className="mi-item-desc">
                            {d.morning.description}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="mi-empty">Add an attraction</div>
                    )}
                  </div>

                  <div className="mi-slot">
                    <div className="mi-slot-title">Afternoon</div>
                    {d.afternoon ? (
                      <div className="mi-item">
                        <div className="mi-item-title">{d.afternoon.name}</div>
                        <div className="mi-item-sub">
                          📍 {d.afternoon.location}
                        </div>
                        {d.afternoon.description && (
                          <div className="mi-item-desc">
                            {d.afternoon.description}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="mi-empty">Add an attraction</div>
                    )}
                  </div>

                  <div className="mi-slot">
                    <div className="mi-slot-title">Dinner</div>
                    {d.dinner ? (
                      <div className="mi-item">
                        <div className="mi-item-title">{d.dinner.name}</div>
                        <div className="mi-item-sub">
                          📍 {d.dinner.location}
                        </div>
                        {d.dinner.description && (
                          <div className="mi-item-desc">
                            {d.dinner.description}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="mi-empty">Add a restaurant</div>
                    )}
                  </div>

                  <div className="mi-slot">
                    <div className="mi-slot-title">Night</div>
                    {d.night ? (
                      <div className="mi-item">
                        <div className="mi-item-title">{d.night.name}</div>
                        <div className="mi-item-sub">📍 {d.night.location}</div>
                        {d.night.description && (
                          <div className="mi-item-desc">
                            {d.night.description}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="mi-empty">Add a hotel</div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Overflow */}
            {overflow.length > 0 && (
              <>
                <div className="mi-divider" />
                <div className="mi-card-head">More for this trip</div>
                <div className="mi-overflow">
                  {overflow.map((x) => (
                    <div className="mi-overflow-chip" key={x.id}>
                      {x.type}: {x.name}
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="mi-actions">
              <button
                className="btn btn-outline-danger"
                onClick={() => deleteItinerary(it.name)}
              >
                ❌ Delete
              </button>
              {/* Stub – you can route to /plan and preload */}
              <button
                className="btn btn-outline-secondary"
                onClick={() => alert("Load into planner coming soon")}
              >
                ↩ Load in Planner
              </button>
            </div>
          </div>
        )}
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
            {itins.length === 0 && (
              <p className="text-muted">No itineraries saved yet.</p>
            )}

            <div className="mi-scroll">
              {itins.map((it) => (
                <ItineraryCard key={it.name} it={it} />
              ))}
            </div>
          </div>
        </div>

        <div className="right-panel itinerary-right">
          <div className="mi-card">
            <div className="mi-card-head">Tips</div>
            <div className="mi-divider" />
            <p>
              • Click a card to expand. Each day shows Morning, Afternoon,
              Dinner and Night.
            </p>
            <p>
              • The schedule is auto‑built from your saved planner items; you
              can change days in the future.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
