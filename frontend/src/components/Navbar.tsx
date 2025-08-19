import { Link } from "react-router-dom";
import lessgoLogo from "../../assets/image.png";

export default function Navbar() {
  return (
    <nav className="navbar navbar-dark bg-dark px-3">
      {/* Left: brand */}
      <Link
        to="/"
        className="navbar-brand d-flex align-items-center mb-0 h1"
        style={{ textDecoration: "none", color: "white" }}
      >
        <img
          src={lessgoLogo}
          alt="LessGO Logo"
          style={{
            height: "25px",
            objectFit: "contain",
            marginRight: "8px",
            display: "inline-block",
          }}
        />
        <span
          style={{
            fontWeight: "600",
            fontSize: "20px",
            display: "inline-block",
          }}
        >
          LessGO
        </span>
      </Link>

      {/* Right: nav links (add this class) */}
      <div className="nav-links">
        <Link
          to="/plan"
          className="me-4"
          style={{ textDecoration: "none", color: "white", fontWeight: "500" }}
        >
          Plan Your Trip
        </Link>
        <Link
          to="/my-itinerary"
          className="me-4"
          style={{ textDecoration: "none", color: "white", fontWeight: "500" }}
        >
          My Itineraries
        </Link>
      </div>
    </nav>
  );
}
