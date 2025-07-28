import MapView from "./components/MapView";
import Navbar from "./components/Navbar";
import SearchPanel from "./components/SearchPanel";

export default function App() {
  return (
    <div>
      <Navbar />
      <div className="main d-flex">
        <div className="left-panel">
          <SearchPanel />
        </div>
        <div className="right-panel">
          <MapView />
        </div>
      </div>
    </div>
  );
}
