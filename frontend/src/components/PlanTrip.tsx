import { useState } from "react";
import Navbar from "../components/Navbar";
import "../../styles/components/plantrip.css"; // <-- new styles for this page

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

export default function PlanTrip() {
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [editingTrip, setEditingTrip] = useState(false);
  const [step, setStep] = useState(0);

  const [tripDetails, setTripDetails] = useState({
    destination: "",
    origin: "",
    people: 1,
    travelType: "",
    days: 0,
    nights: 0,
    budget: "",
  });

  const [attractions, setAttractions] = useState<ItemType[]>([]);
  const [hotels, setHotels] = useState<ItemType[]>([]);
  const [restaurants, setRestaurants] = useState<ItemType[]>([]);
  const [planner, setPlanner] = useState<ItemType[]>([]);

  const steps = ["Attractions", "Hotels", "Restaurants"];

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setTripDetails({ ...tripDetails, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitted(true);
    setEditingTrip(false);

    // Dummy Data (replace with API later)
    setAttractions([
      {
        id: 1,
        type: "Attraction",
        name: "India Gate",
        location: "Delhi",
        description: "Historic landmark in the heart of the city.",
      },
      {
        id: 2,
        type: "Attraction",
        name: "Qutub Minar",
        location: "Delhi",
        description: "UNESCO World Heritage Site.",
      },
    ]);
    setHotels([
      {
        id: 3,
        type: "Hotel",
        name: "Taj Palace",
        location: "Delhi",
        description: "5-star luxury hotel with city view.",
      },
      {
        id: 4,
        type: "Hotel",
        name: "The Oberoi",
        location: "Delhi",
        description: "Luxury stay with premium amenities.",
      },
    ]);
    setRestaurants([
      {
        id: 5,
        type: "Restaurant",
        name: "Bukhara",
        location: "Delhi",
        description: "Famous for Mughlai cuisine.",
      },
      {
        id: 6,
        type: "Restaurant",
        name: "Indian Accent",
        location: "Delhi",
        description: "Modern Indian fine dining.",
      },
    ]);
  };

  const addToPlanner = (item: ItemType) => {
    if (!planner.find((p) => p.id === item.id)) {
      setPlanner([...planner, item]);
    }
  };

  const removeFromPlanner = (id: number) => {
    setPlanner(planner.filter((p) => p.id !== id));
  };

  const resetTrip = () => {
    setFormSubmitted(false);
    setPlanner([]);
    setStep(0);
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
    const name = prompt("Enter a name for this itinerary:");
    if (!name) return;

    const savedData: SavedItinerary = {
      name,
      tripDetails,
      planner,
    };

    const existing = JSON.parse(
      localStorage.getItem("savedItineraries") || "[]"
    );
    existing.push(savedData);

    localStorage.setItem("savedItineraries", JSON.stringify(existing));
    alert("Itinerary saved successfully!");
  };

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

  const ListCard = ({ title, items }: { title: string; items: ItemType[] }) => (
    <div className="pt-card">
      <div className="pt-card-head">{title}</div>
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

  return (
    <div>
      <Navbar />

      <div className="main">
        {/* LEFT: Form / Steps / Lists */}
        <div className="left-panel pt-left">
          {!formSubmitted || editingTrip ? (
            <form className="w-100" onSubmit={handleSubmit}>
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

                <button type="submit" className="btn btn-primary w-100">
                  Get Recommendations
                </button>
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
                <ListCard title="Recommended Attractions" items={attractions} />
              )}
              {step === 1 && (
                <ListCard title="Recommended Hotels" items={hotels} />
              )}
              {step === 2 && (
                <ListCard title="Recommended Restaurants" items={restaurants} />
              )}

              <div className="pt-step-actions">
                {step > 0 && (
                  <button
                    className="btn btn-outline-dark"
                    onClick={() => setStep(step - 1)}
                  >
                    ◀ Previous
                  </button>
                )}
                {step < 2 && (
                  <button
                    className="btn btn-primary"
                    onClick={() => setStep(step + 1)}
                  >
                    Next ▶
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Trip summary + Planner (sticky) */}
        <div className="right-panel pt-right">
          <div className="pt-sticky">
            <div className="pt-card">
              <div className="pt-card-head">Trip Details</div>
              <div className="pt-divider" />
              {formSubmitted ? (
                <>
                  <p>
                    🌍 <strong>{tripDetails.origin}</strong> ➡{" "}
                    <strong>{tripDetails.destination}</strong>
                  </p>
                  <p>
                    👥 {tripDetails.people} People (
                    {tripDetails.travelType || "N/A"})
                  </p>
                  <p>
                    🗓 {tripDetails.days} Days / {tripDetails.nights} Nights
                  </p>
                  <p>💰 {tripDetails.budget || "No preference"}</p>

                  <div className="d-flex gap-2">
                    <button
                      className="btn btn-outline-secondary w-50"
                      onClick={() => setEditingTrip(true)}
                    >
                      ✏️ Edit
                    </button>
                    <button
                      className="btn btn-outline-dark w-50"
                      onClick={resetTrip}
                    >
                      🔄 Reset
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-muted">Fill the form to see trip details.</p>
              )}
            </div>

            <div className="pt-card" style={{ marginTop: 12 }}>
              <div className="pt-card-head">Your Planner</div>
              <div className="pt-divider" />
              <div className="pt-scroll">
                {planner.length === 0 ? (
                  <p className="text-muted">No items selected yet.</p>
                ) : (
                  planner.map((p) => (
                    <div className="pt-item-row" key={p.id}>
                      <div>
                        <div className="pt-item-title">
                          {p.type} — {p.name}
                        </div>
                        <div className="pt-item-sub">📍 {p.location}</div>
                      </div>
                      <button
                        className="btn btn-outline-dark btn-sm"
                        onClick={() => removeFromPlanner(p.id)}
                      >
                        ❌
                      </button>
                    </div>
                  ))
                )}
              </div>

              {planner.length > 0 && (
                <button
                  className="btn btn-success w-100 mt-2"
                  onClick={saveItinerary}
                >
                  💾 Save Itinerary
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
