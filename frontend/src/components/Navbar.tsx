export default function Navbar() {
  return (
    <nav className="navbar navbar-light bg-light px-3">
      <span className="navbar-brand mb-0 h1">TravelGuide.ai</span>
      <div>
        <a href="#plan" className="me-4">
          Plan Your Trip
        </a>
        <a href="#itinerary">Itineraries</a>
      </div>
    </nav>
  );
}
