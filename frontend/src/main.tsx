import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import PlanTrip from "./components/PlanTrip";
import MyItinerary from "./components/MyItinerary";
import "../styles/theme.css";
import "../styles/base.css";
import "../styles/layout.css";
import "../styles/components/buttons.css";
import "../styles/components/forms.css";
import "../styles/components/navbar.css";
import "../styles/components/card.css";

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/plan" element={<PlanTrip />} />
      <Route path="/my-itinerary" element={<MyItinerary />} />
    </Routes>
  </BrowserRouter>
);
