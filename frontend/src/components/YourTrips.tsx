export default function YourTrips() {
  const dummyTrips = [
    {
      type: "Flight",
      name: "Mumbai ✈️ New Delhi",
      date: "12 Dec 2025, 10:00 AM",
      confirmation: "CNF12345",
    },
    {
      type: "Hotel",
      name: "Taj Palace, New Delhi",
      date: "12-15 Dec 2025",
      confirmation: "CNF98765",
    },
    {
      type: "Attraction",
      name: "India Gate Guided Tour",
      date: "13 Dec 2025, 2:00 PM",
      confirmation: "CNF56789",
    },
  ];

  return (
    <div>
      <h5 className="mb-3">📌 Upcoming Bookings</h5>
      {dummyTrips.map((trip, i) => (
        <div className="card mb-3 shadow-sm" key={i}>
          <div className="card-body">
            <h6 className="card-title">{trip.type}</h6>
            <p className="card-text mb-1">
              <strong>{trip.name}</strong>
            </p>
            <p className="card-text mb-1">📅 {trip.date}</p>
            <p className="card-text">
              🔑 Confirmation: <strong>{trip.confirmation}</strong>
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
