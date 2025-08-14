import { Link } from "react-router-dom";

export default function Navbar() {
  return (
    <nav className="navbar navbar-light bg-light px-3">
      <Link
        to="/"
        className="navbar-brand mb-0 h1"
        style={{ textDecoration: "None" }}
      >
        TravelGuide.ai
      </Link>
      <div>
        <Link to="/plan" className="me-4" style={{ textDecoration: "None" }}>
          Plan Your Trip
        </Link>
        <Link
          to="/my-itinerary"
          className="me-4"
          style={{ textDecoration: "None" }}
        >
          My Itineraries
        </Link>
      </div>
    </nav>
  );
}
