// frontend/src/pages/MyItinerary.tsx
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import Navbar from "../components/Navbar";
import "../../styles/components/myitinerary.css";

type ItemType = {
  id: number;
  type: "Attraction" | "Hotel" | "Restaurant";
  name: string;
  location: string;
  description?: string;
};

type TripDetails = {
  destination: string;
  origin: string;
  people: number;
  travelType: string;
  days: number;
  nights: number;
  budget: string;
  dates?: string;
};

// Unified client-side DayPlan shape
type ClientDayPlan = {
  currency?: string; // "INR"
  total_min_cost?: number;
  plan: {
    day: number;
    date?: string;
    slots: {
      time?: string; // "09:00–09:30"
      start?: string; // "09:00"
      end?: string; // "09:30"
      title: string;
      place?: string;
      address?: string;
      category?: "Attraction" | "Hotel" | "Restaurant" | "Transit" | "Other";
      notes?: string;
      cost_min?: number; // INR
      // transit extras (optional)
      mode?: string;
      eta_min?: number;
      from?: string;
      to?: string;
      // inline suggestions (optional)
      suggestions?: any[];
    }[];
  }[];
};

type SavedItinerary = {
  name: string;
  tripDetails: TripDetails;
  planner: ItemType[];
  // Could be old shape { days: [...] } or new { plan: [...] }
  dayPlan?: any;
};

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";

/** ---------- Helpers (top-level so everyone can use them) ---------- */

// Convert "09:00" & "09:30" to "09:00–09:30"
const toRange = (start?: string, end?: string, time?: string) => {
  if (start && end) return `${start}–${end}`;
  return time || "";
};

// Parse "₹1,200–₹1,600" or "1200-1600" to a single number (avg)
const parseINRToNumber = (val: any): number => {
  if (typeof val === "number" && Number.isFinite(val)) return val;
  if (!val) return 0;
  const s = String(val);
  const m = s.replace(/,/g, "").match(/(\d+)(?:[^\d]+(\d+))?/);
  if (!m) return 0;
  const a = parseInt(m[1], 10);
  const b = m[2] ? parseInt(m[2], 10) : a;
  return Math.round((a + b) / 2);
};

// Sum up minimum costs
const recomputeTotal = (plan: ClientDayPlan["plan"]) =>
  plan
    .flatMap((d) => d.slots)
    .reduce(
      (acc, s) =>
        acc +
        (Number.isFinite(s.cost_min as number) ? (s.cost_min as number) : 0),
      0
    );

// Lightweight transit estimate
const estimateTransitCost = (mode?: string) => {
  const m = (mode || "").toLowerCase();
  if (m.includes("walk")) return 0;
  if (m.includes("metro")) return 40;
  if (m.includes("auto")) return 120;
  if (m.includes("taxi") || m.includes("cab")) return 250;
  return 100;
};

/** ---------- Normalize server (or legacy) plan into robust client shape ---------- */
const normalizeClientDayPlan = (
  raw: any,
  planner: ItemType[] | undefined,
  trip: TripDetails | undefined
): ClientDayPlan | null => {
  if (!raw) return null;

  const restaurantsFromPlanner = Array.isArray(planner)
    ? planner
        .filter((p) => p.type === "Restaurant")
        .map((r) => ({
          name: r.name,
          area: r.location || "",
          reason: "From saved planner",
          approx_cost_for_two: 0,
        }))
        .slice(0, 3)
    : [];

  const isTime = (s?: string) => !!s && /^\d{2}:\d{2}$/.test(s);
  const after = (t?: string, cmp = "18:00") => {
    if (!isTime(t) || !isTime(cmp)) return false;
    const [h, m] = (t as string).split(":").map((n) => +n);
    const [H, M] = cmp.split(":").map((n) => +n);
    return h > H || (h === H && m > M);
  };

  // Unwrap to an array of days (supports {plan}, {days}, or an array)
  const daysArr: any[] = Array.isArray(raw?.plan)
    ? raw.plan
    : Array.isArray(raw?.days)
    ? raw.days
    : Array.isArray(raw)
    ? raw
    : [];

  const fixedDays = daysArr.map((d: any, idx: number) => {
    const slots = Array.isArray(d.slots) ? d.slots : [];

    const fixedSlots = slots.map((s: any) => {
      const start =
        s.start || (s.time?.includes("–") ? s.time.split("–")[0] : "");
      const end = s.end || (s.time?.includes("–") ? s.time.split("–")[1] : "");
      const time = toRange(start, end, s.time);

      const cost = Number.isFinite(s.cost_min) ? s.cost_min : 0;

      // infer category if missing
      let category = s.category as string | undefined;
      const titleLc = String(s.title || "").toLowerCase();
      if (!category) {
        if (
          titleLc.includes("transit") ||
          titleLc.includes("taxi") ||
          titleLc.includes("metro") ||
          titleLc.includes("drive")
        )
          category = "Transit";
        else if (titleLc.includes("check-in") || titleLc.includes("hotel"))
          category = "Hotel";
        else if (
          titleLc.includes("lunch") ||
          titleLc.includes("dinner") ||
          titleLc.includes("cafe")
        )
          category = "Restaurant";
        else category = "Attraction";
      }

      return {
        time,
        start: start || "",
        end: end || "",
        title: s.title || "",
        place: s.place || s.title || "",
        address: s.address || "",
        category,
        notes: s.notes || s.note || "",
        cost_min: cost,
        // transit extras
        mode: s.mode || "",
        eta_min: Number.isFinite(s.eta_min) ? s.eta_min : undefined,
        from: s.from || "",
        to: s.to || "",
        // pass through model suggestions if present
        suggestions: Array.isArray(s.suggestions)
          ? s.suggestions.slice(0, 3)
          : undefined,
      };
    });

    // Ensure Dinner exists (if none after 18:00)
    const hasDinner = fixedSlots.some(
      (s: any) =>
        s.category === "Restaurant" &&
        (s.title.toLowerCase().includes("dinner") || after(s.start, "18:00"))
    );
    if (!hasDinner) {
      fixedSlots.push({
        start: "19:30",
        end: "21:00",
        time: "19:30–21:00",
        title: "Dinner (choose)",
        place: "",
        address: "",
        category: "Restaurant",
        notes: "Pick a dinner stop en‑route.",
        cost_min: 0,
        suggestions: restaurantsFromPlanner,
      });
    }

    // Ensure Return to hotel
    const hasReturn = fixedSlots.some(
      (s: any) => s.category === "Hotel" && /return|night/i.test(s.title)
    );
    if (!hasReturn) {
      fixedSlots.push({
        start: "21:00",
        end: "22:00",
        time: "21:00–22:00",
        title: "Return to hotel / night stay",
        place: trip?.destination || "",
        address: "",
        category: "Hotel",
        notes: "Return & rest.",
        cost_min: 0,
      });
    }

    return {
      day: typeof d.day === "number" ? d.day : idx + 1,
      date: d.date || "",
      slots: fixedSlots,
    };
  });

  const total = fixedDays
    .flatMap((d) => d.slots)
    .reduce((a, s) => a + (Number.isFinite(s.cost_min) ? s.cost_min : 0), 0);

  return {
    currency: raw.currency || "INR",
    total_min_cost: Number.isFinite(raw.total_min_cost)
      ? raw.total_min_cost
      : total,
    plan: fixedDays,
  };
};

export default function MyItinerary() {
  const [itins, setItins] = useState<SavedItinerary[]>([]);
  const [selected, setSelected] = useState<SavedItinerary | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Left panel UX
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"recent" | "name" | "nights">("recent");

  useEffect(() => {
    const data = JSON.parse(localStorage.getItem("savedItineraries") || "[]");
    setItins(data);
    setSelected(null);
  }, []);

  const saveAll = (arr: SavedItinerary[]) => {
    setItins(arr);
    localStorage.setItem("savedItineraries", JSON.stringify(arr));
  };

  const countTypes = (planner: ItemType[]) => {
    const c = { Attraction: 0, Hotel: 0, Restaurant: 0 };
    planner.forEach((p) => (c[p.type] += 1));
    return c;
  };

  const filtered = useMemo(() => {
    const byQuery = itins.filter((it) => {
      if (!q) return true;
      const hay =
        `${it.name} ${it.tripDetails.origin} ${it.tripDetails.destination}`.toLowerCase();
      return hay.includes(q.toLowerCase());
    });
    const arr = [...byQuery];
    switch (sort) {
      case "name":
        arr.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "nights":
        arr.sort(
          (a, b) => (b.tripDetails.nights || 0) - (a.tripDetails.nights || 0)
        );
        break;
      case "recent":
      default:
        arr.reverse();
        break;
    }
    return arr;
  }, [itins, q, sort]);

  const selectItin = async (name: string) => {
    const found = itins.find((x) => x.name === name) || null;
    if (!found) {
      setSelected(null);
      return;
    }

    // Normalize any old/new dayPlan into unified shape for rendering
    const normalized = normalizeClientDayPlan(
      found.dayPlan,
      found.planner,
      found.tripDetails
    );
    const withNormalized: SavedItinerary = {
      ...found,
      dayPlan: normalized || found.dayPlan,
    };
    setSelected(withNormalized);

    // If missing plan entirely, generate
    if (!normalized?.plan?.length) {
      await generatePlan(found);
    }
  };

  const generatePlan = async (itin: SavedItinerary) => {
    setLoadingPlan(true);
    setError(null);
    try {
      const payload = { trip: { ...itin.tripDetails, planner: itin.planner } };
      const { data } = await axios.post(`${API}/query/day-plan`, payload);
      const serverJson = data?.json;

      const normalized = normalizeClientDayPlan(
        serverJson,
        itin.planner,
        itin.tripDetails
      );

      const updated = itins.map((x) =>
        x.name === itin.name ? { ...x, dayPlan: normalized } : x
      );
      saveAll(updated);
      setSelected({ ...itin, dayPlan: normalized });
    } catch (e: any) {
      setError(
        e?.response?.data?.error || "Couldn't generate day plan. Try again."
      );
    } finally {
      setLoadingPlan(false);
    }
  };

  const deleteItinerary = (name: string) => {
    const updated = itins.filter((x) => x.name !== name);
    saveAll(updated);
    if (selected?.name === name) setSelected(null);
  };

  // Apply a user-picked suggestion to any incomplete slot and persist
  const applyChoice = (dayIdx: number, slotIdx: number, opt: any) => {
    if (!selected?.dayPlan) return;
    const dp: ClientDayPlan = JSON.parse(JSON.stringify(selected.dayPlan));
    const day = dp.plan?.[dayIdx];
    const slot = day?.slots?.[slotIdx];
    if (!day || !slot) return;

    const prev = day.slots[slotIdx - 1];
    const next = day.slots[slotIdx + 1];

    const safePlace = (x?: string) => x || "";
    const toTitleCase = (s: string) =>
      s.replace(/\b\w/g, (c) => c.toUpperCase());

    if (slot.category === "Restaurant") {
      const name = opt?.name || slot.place || "Selected Restaurant";
      const area = opt?.area || "";
      const approx = parseINRToNumber(opt?.approx_cost_for_two);
      const perPerson =
        approx > 0
          ? Math.round(approx / 2)
          : Number.isFinite(opt?.cost_min)
          ? opt.cost_min
          : 800;

      const tl = (slot.title || "").toLowerCase();
      slot.title = tl.includes("lunch")
        ? `Lunch at ${name}`
        : tl.includes("dinner")
        ? `Dinner at ${name}`
        : `Meal at ${name}`;
      slot.place = name;
      slot.address = area || slot.address || "";
      slot.notes = opt?.reason || slot.notes || "Picked from suggestions.";
      slot.cost_min = perPerson;
    } else if (slot.category === "Attraction") {
      const name = opt?.name || "Selected Attraction";
      slot.title = name;
      slot.place = name;
      slot.address = opt?.area || slot.address || "";
      if (!Number.isFinite(slot.cost_min as number)) slot.cost_min = 0;
    } else if (slot.category === "Hotel") {
      const name = opt?.name || "Selected Hotel";
      const tl = (slot.title || "").toLowerCase();
      slot.title = tl.includes("check")
        ? `Hotel Check-in — ${name}`
        : `Hotel — ${name}`;
      slot.place = name;
      slot.address = opt?.area || slot.address || "";
      if (!Number.isFinite(slot.cost_min as number)) slot.cost_min = 0;
    } else if (slot.category === "Transit") {
      // Fill transit details
      const mode = opt?.mode || slot.mode || "Taxi";
      slot.mode = toTitleCase(mode);
      slot.from =
        safePlace(opt?.from) ||
        safePlace(slot.from) ||
        safePlace(prev?.place) ||
        safePlace(prev?.title);
      slot.to =
        safePlace(opt?.to) ||
        safePlace(slot.to) ||
        safePlace(next?.place) ||
        safePlace(next?.title);
      slot.title =
        opt?.title || slot.title || `Transit to ${slot.to || "next stop"}`;
      slot.eta_min = Number.isFinite(opt?.eta_min)
        ? opt.eta_min
        : slot.eta_min || 20;
      slot.cost_min = Number.isFinite(opt?.cost_min)
        ? opt.cost_min
        : estimateTransitCost(mode);
    } else {
      // Fallback: set name/area if present
      if (opt?.name) {
        slot.title = opt.name;
        slot.place = opt.name;
        slot.address = opt?.area || slot.address || "";
      }
      if (!Number.isFinite(slot.cost_min as number)) slot.cost_min = 0;
    }

    // remove inline suggestions once chosen
    delete (slot as any).suggestions;

    // recompute total and persist
    dp.total_min_cost = recomputeTotal(dp.plan);
    const updated = itins.map((x) =>
      x.name === selected.name ? { ...x, dayPlan: dp } : x
    );
    saveAll(updated);
    setSelected({ ...selected, dayPlan: dp });
  };

  // Map planner item name -> type so we can tag day-plan slots
  const typeByName = useMemo(() => {
    const map: Record<string, ItemType["type"]> = {};
    if (selected?.planner) {
      for (const p of selected.planner) {
        map[p.name.toLowerCase()] = p.type;
      }
    }
    return map;
  }, [selected]);

  // Group planner items for suggestion sources
  const plannerBuckets = useMemo(() => {
    const res = {
      restaurants: [] as ItemType[],
      attractions: [] as ItemType[],
      hotels: [] as ItemType[],
    };
    if (selected?.planner) {
      for (const p of selected.planner) {
        if (p.type === "Restaurant") res.restaurants.push(p);
        else if (p.type === "Attraction") res.attractions.push(p);
        else if (p.type === "Hotel") res.hotels.push(p);
      }
    }
    return res;
  }, [selected]);

  const formatINR = (n: number) =>
    `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

  const planList: ClientDayPlan["plan"] = useMemo(() => {
    const dp: ClientDayPlan | undefined = selected?.dayPlan;
    return dp?.plan || [];
  }, [selected]);

  // Decide if a slot is "incomplete"
  const isIncompleteSlot = (s: any) => {
    const cat = (s.category || "").toLowerCase();
    if (cat === "restaurant")
      return !s.place || /choose/.test((s.title || "").toLowerCase());
    if (cat === "attraction") return !s.place;
    if (cat === "hotel")
      return !s.place && !/return|night/i.test(s.title || "");
    if (cat === "transit") return !s.mode || !s.from || !s.to;
    return false;
  };

  // Build suggestions for any incomplete slot (fallback to planner items; transit is synthetic)
  const getAutoSuggestions = (dayIdx: number, slotIdx: number, s: any) => {
    const cat = (s.category || "").toLowerCase();
    const day = planList[dayIdx];
    const prev = day?.slots?.[slotIdx - 1];
    const next = day?.slots?.[slotIdx + 1];
    const corridor =
      (prev?.place || prev?.title) && (next?.place || next?.title)
        ? `en‑route from ${prev?.place || prev?.title} to ${
            next?.place || next?.title
          }`
        : "";

    if (cat === "restaurant") {
      return plannerBuckets.restaurants.slice(0, 5).map((r) => ({
        name: r.name,
        area: r.location || "",
        reason: corridor || "From saved planner",
        approx_cost_for_two: 1000, // best-effort default
      }));
    }
    if (cat === "attraction") {
      return plannerBuckets.attractions.slice(0, 5).map((a) => ({
        name: a.name,
        area: a.location || "",
        reason: corridor || "From saved planner",
        cost_min: 0,
      }));
    }
    if (cat === "hotel") {
      return plannerBuckets.hotels.slice(0, 5).map((h) => ({
        name: h.name,
        area: h.location || "",
        reason: "From saved planner",
        cost_min: 0,
      }));
    }
    if (cat === "transit") {
      const from = prev?.place || prev?.title || s.from || "";
      const to = next?.place || next?.title || s.to || "";
      return [
        {
          title: `Taxi to ${to}`,
          mode: "Taxi",
          from,
          to,
          eta_min: 25,
          cost_min: 250,
        },
        {
          title: `Auto to ${to}`,
          mode: "Auto",
          from,
          to,
          eta_min: 30,
          cost_min: 120,
        },
        {
          title: `Metro to ${to}`,
          mode: "Metro",
          from,
          to,
          eta_min: 35,
          cost_min: 40,
        },
        {
          title: `Walk to ${to}`,
          mode: "Walk",
          from,
          to,
          eta_min: 20,
          cost_min: 0,
        },
      ];
    }
    return [];
  };

  // Total min cost (from backend if provided, else sum)
  const totalMinCost = useMemo(() => {
    const dp: ClientDayPlan | undefined = selected?.dayPlan;
    if (!dp) return 0;
    if (Number.isFinite(dp.total_min_cost)) return dp.total_min_cost as number;
    const sum =
      dp.plan
        ?.flatMap((d) => d.slots)
        ?.reduce((acc, s) => acc + (s.cost_min || 0), 0) || 0;
    return sum;
  }, [selected]);

  return (
    <div>
      <Navbar />
      <div className="main myit-main">
        {/* LEFT: cards */}
        <aside className="panel panel-left">
          <div className="panel-head">
            <div className="panel-title">My Saved Itineraries</div>
            <div className="panel-tools">
              <select
                className="tool-select"
                value={sort}
                onChange={(e) =>
                  setSort(e.target.value as "recent" | "name" | "nights")
                }
                aria-label="Sort itineraries"
              >
                <option value="recent">Recent</option>
                <option value="name">A–Z</option>
                <option value="nights">Nights</option>
              </select>
              <input
                className="tool-input"
                placeholder="Search name or city…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>

          <div className="cards-grid">
            {filtered.length === 0 ? (
              <div className="muted">No matches.</div>
            ) : (
              filtered.map((it) => {
                const active = selected?.name === it.name;
                const counts = countTypes(it.planner);
                return (
                  <button
                    key={it.name}
                    className={`mini-card ${active ? "is-active" : ""}`}
                    onClick={() => selectItin(it.name)}
                    title={`${it.tripDetails.origin} → ${it.tripDetails.destination}`}
                  >
                    <img
                      className="mini-img"
                      src={`https://source.unsplash.com/480x260/?${encodeURIComponent(
                        it.tripDetails.destination
                      )},city`}
                      alt={it.tripDetails.destination}
                      loading="lazy"
                    />
                    <div className="mini-body">
                      <div className="mini-title">{it.name}</div>
                      <div className="mini-sub">
                        {it.tripDetails.origin} → {it.tripDetails.destination}
                      </div>

                      <div className="mini-row">
                        <span className="pill pill-n">
                          {it.tripDetails.nights}N
                        </span>
                        <span className="pill pill-p">
                          {it.tripDetails.people}
                        </span>
                        <span className="tag tag-a">
                          Attractions {counts.Attraction}
                        </span>
                        <span className="tag tag-h">Hotels {counts.Hotel}</span>
                        <span className="tag tag-r">
                          Restaurants {counts.Restaurant}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* RIGHT: details + plan */}
        <section className="panel panel-right">
          {!selected ? (
            <div className="muted">Select an itinerary on the left.</div>
          ) : (
            <div className="stack">
              <div className="card">
                <div className="card-head">
                  <div className="card-title">{selected.name}</div>
                  <div className="actions">
                    <button
                      className="btn btn-outline"
                      onClick={() => generatePlan(selected!)}
                      disabled={loadingPlan}
                    >
                      ↻ Regenerate Plan
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={() => deleteItinerary(selected.name)}
                    >
                      ❌ Delete
                    </button>
                  </div>
                </div>
                <div className="divider" />
                <div className="meta">
                  <div className="meta-row">
                    <span className="k">Route</span>
                    <span className="v">
                      {selected.tripDetails.origin} ➜{" "}
                      {selected.tripDetails.destination}
                    </span>
                  </div>
                  <div className="meta-row">
                    <span className="k">Group</span>
                    <span className="v">
                      {selected.tripDetails.people} (
                      {selected.tripDetails.travelType || "N/A"})
                    </span>
                  </div>
                  <div className="meta-row">
                    <span className="k">Duration</span>
                    <span className="v">
                      {selected.tripDetails.days}D /{" "}
                      {selected.tripDetails.nights}N
                    </span>
                  </div>
                  <div className="meta-row">
                    <span className="k">Budget</span>
                    <span className="v">
                      {selected.tripDetails.budget || "No preference"}
                    </span>
                  </div>
                  <div className="meta-row">
                    <span className="k">Est. min total</span>
                    <span className="v">
                      {formatINR(
                        (selected.dayPlan as ClientDayPlan)?.total_min_cost ||
                          totalMinCost
                      )}{" "}
                      <span className="muted">
                        (
                        {(selected.dayPlan as ClientDayPlan)?.currency || "INR"}
                        )
                      </span>
                    </span>
                  </div>
                  {selected.tripDetails.dates && (
                    <div className="meta-row">
                      <span className="k">Dates</span>
                      <span className="v">{selected.tripDetails.dates}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="card">
                <div className="card-head">Day‑by‑Day Plan</div>
                <div className="divider" />
                {loadingPlan ? (
                  <div className="muted">Generating plan…</div>
                ) : error ? (
                  <div className="muted">{error}</div>
                ) : planList.length === 0 ? (
                  <div className="muted">
                    No plan yet. Click “Regenerate Plan”.
                  </div>
                ) : (
                  planList.map((d, idx) => (
                    <div className="day" key={`day-${idx}-${d.date ?? ""}`}>
                      <div className="day-head">
                        <div className="day-title">Day {d.day || idx + 1}</div>
                        {d.date && <div className="day-date">{d.date}</div>}
                      </div>
                      <ul className="slots">
                        {d.slots.map((s, sIdx) => (
                          <li key={`slot-${idx}-${sIdx}`} className="slot">
                            <div className="time">
                              {s.start && s.end
                                ? `${s.start}–${s.end}`
                                : s.time || ""}
                            </div>
                            <div>
                              <div className="slot-top">
                                <div className="myit-slot-title">{s.title}</div>
                                <div className="slot-right">
                                  {typeof s.cost_min === "number" && (
                                    <span className="cost-tag">
                                      ₹
                                      {(s.cost_min || 0).toLocaleString(
                                        "en-IN"
                                      )}
                                    </span>
                                  )}
                                  {(() => {
                                    const tag =
                                      (s.title &&
                                        // @ts-ignore
                                        typeByName[
                                          s.title.toLowerCase?.() || ""
                                        ]) ||
                                      s.category;
                                    return tag ? (
                                      <span
                                        className={`type-tag type-${String(
                                          tag
                                        ).toLowerCase()}`}
                                        title={String(tag)}
                                      >
                                        {String(tag)}
                                      </span>
                                    ) : null;
                                  })()}
                                </div>
                              </div>
                              {s.place && (
                                <div className="slot-sub">{s.place}</div>
                              )}
                              {s.address && (
                                <div className="slot-addr">{s.address}</div>
                              )}
                              {s.notes && (
                                <div className="slot-notes">{s.notes}</div>
                              )}

                              {/* Suggestions for any incomplete slot (incl. Transit) */}
                              {(() => {
                                const modelSuggests =
                                  Array.isArray((s as any).suggestions) &&
                                  (s as any).suggestions.length > 0
                                    ? (s as any).suggestions
                                    : [];
                                const autoSuggests = getAutoSuggestions(
                                  idx,
                                  sIdx,
                                  s
                                );
                                const suggestions =
                                  modelSuggests.length > 0
                                    ? modelSuggests
                                    : autoSuggests;
                                const shouldShow =
                                  isIncompleteSlot(s) && suggestions.length > 0;

                                if (!shouldShow) return null;
                                return (
                                  <div className="suggest-line">
                                    {suggestions.map((opt: any, i: number) => (
                                      <button
                                        key={i}
                                        type="button"
                                        className="suggest-chip suggest-chip--btn"
                                        title={opt.reason || opt.mode || ""}
                                        onClick={() =>
                                          applyChoice(idx, sIdx, opt)
                                        }
                                      >
                                        {s.category === "Transit"
                                          ? opt.title ||
                                            `${opt.mode || "Transit"} to ${
                                              opt.to || ""
                                            }`
                                          : opt.name}
                                        {s.category !== "Transit" && opt.area
                                          ? ` · ${opt.area}`
                                          : ""}
                                      </button>
                                    ))}
                                  </div>
                                );
                              })()}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
