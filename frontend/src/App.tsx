import Navbar from "./components/Navbar";
import SearchPanel from "./components/SearchPanel";
import YourTrips from "./components/YourTrips";

export default function App() {
  return (
    <div>
      <Navbar />
      <div className="main">
        {/* Left Panel: Search */}
        <div className="left-panel">
          <SearchPanel />
        </div>

        {/* Right Panel: Your Trips */}
        <div className="right-panel">
          <YourTrips />
        </div>
      </div>
    </div>
  );
}
