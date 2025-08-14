import "../../styles/components/yourtrips.css";

type Trip = {
  type: "Flight" | "Hotel" | "Attraction";
  name: string;
  date: string;
  confirmation: string;
};

export default function YourTrips() {
  const dummyTrips: Trip[] = [
    {
      type: "Flight",
      name: "Mumbai ✈️ New Delhi",
      date: "12 Dec 2025, 10:00 AM",
      confirmation: "CNF12345",
    },
    {
      type: "Hotel",
      name: "Taj Palace, New Delhi",
      date: "12–15 Dec 2025",
      confirmation: "CNF98765",
    },
    {
      type: "Attraction",
      name: "India Gate Guided Tour",
      date: "13 Dec 2025, 2:00 PM",
      confirmation: "CNF56789",
    },
  ];

  const badgeClass = (t: Trip["type"]) =>
    t === "Flight"
      ? "badge-flight"
      : t === "Hotel"
      ? "badge-hotel"
      : "badge-attraction";

  return (
    <div className="bookings-panel card-dark">
      <div className="bookings-header">📌 Upcoming Bookings</div>
      <div className="bookings-divider" />

      <div className="bookings-list">
        {dummyTrips.map((trip, i) => (
          <div className="booking-card" key={i}>
            <div className={`booking-type ${badgeClass(trip.type)}`}>
              {trip.type}
            </div>

            <div className="booking-content">
              <div className="booking-title">{trip.name}</div>
              <div className="booking-sub">📅 {trip.date}</div>
              <div className="booking-sub">
                🔑 Confirmation: <strong>{trip.confirmation}</strong>
              </div>
            </div>

            <div className="booking-actions">
              <button className="btn btn-outline-secondary btn-sm">View</button>
              <button className="btn btn-share">Share</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
