import { useState, useEffect } from "react";
import { getBoardCards, computeStats, getMemberId, getListCards } from "./trello";
import "./index.css";

export default function App() {

  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode");
  const listId = params.get("listId");
  const context = mode === "list" ? "list" : "board";

  console.log("MODE:", mode);
  console.log("LIST ID:", listId);

  const [stats, setStats] = useState({
  assigned: 0,
  dueThisWeek: 0,
  overdue: 0,
  unassigned: 0,
  withLabel: 0,
  stale: 0,
  createdToday: 0,
  cardsInList: 0
});

const [selectedStat, setSelectedStat] = useState(null);

const handleStatClick = (type) => {
  if (selectedStat === type) {
    setSelectedStat(null);
  } else {
    setSelectedStat(type);
  }
};



useEffect(() => {
    async function fetchData() {
      try {
        const key = import.meta.env.VITE_TRELLO_API_KEY;
        const token = import.meta.env.VITE_TRELLO_TOKEN;
        const boardId = "p8fosANE";

        console.log("KEY:", key);
      console.log("TOKEN:", token);

        // ✅ STEP 1: get cards
      let cards = [];

if (mode === "list" && listId) {
  cards = await getListCards(key, token, listId);
  console.log("LIST CARDS:", cards);
} else {
  cards = await getBoardCards(key, token, boardId);
  console.log("BOARD CARDS:", cards);
}

      // ✅ STEP 2: get current user ID
      const memberId = await getMemberId(key, token);
      console.log("MEMBER ID:", memberId);

let listCardsCount = 0;

if (mode === "list") {
  listCardsCount = cards.length; // ✅ use already fetched data
}

      // ✅ STEP 3: compute stats using memberId
      const computed = computeStats(cards, memberId);

      computed.cardsInList = listCardsCount;

      // ✅ STEP 4: update UI
      setStats(computed);
      } catch (err) {
        console.error(err);
      }
    }

    fetchData();
  }, []);


  return (
    <div className="popup">

      <div className="header">
        <div className="header-left">
          <div className="trello-icon">T</div>
          <h3>Cardlytics — Track</h3>
        </div>
        <div className="header-actions">
          <button className="btn-customize">Customize</button>
        
        </div>
      </div>

      <div className="body">

        <Section title="MY WORK">
  <StatCard 
  value={stats.assigned} 
  label="Assigned to me across workspace" 
  tag="live"
  type="assigned"
  onClick={handleStatClick}
  selected={selectedStat}
/>
  
  <StatCard 
  value={stats.dueThisWeek} 
  label={`Due this week on this ${context}`} 
  type="dueThisWeek"
  onClick={handleStatClick}
  selected={selectedStat}
/>
  
  <StatCard 
  value={stats.overdue} 
  label={`Overdue cards on this ${context}`} 
  tag="hot"
  type="overdue"
  onClick={handleStatClick}
  selected={selectedStat}
/>
</Section>

       <Section title="BOARD INSIGHTS">
  <StatCard 
    value={stats.unassigned} 
    label={`Unassigned cards on this ${context}`} 
    type="unassigned"
    onClick={handleStatClick}
    selected={selectedStat}
  />

  <StatCard 
    value={stats.withLabel} 
    label={`With a label on this ${context}`} 
    type="withLabel"
    onClick={handleStatClick}
    selected={selectedStat}
  />

  <StatCard 
    value={stats.stale} 
    label={`Stale cards on this ${context}`} 
    type="stale"
    onClick={handleStatClick}
    selected={selectedStat}
  />
</Section>

     <Section title="ACTIVITY">
  <StatCard 
    value={stats.createdToday} 
    label={`Created today on this ${context}`} 
    type="createdToday"
    onClick={handleStatClick}
    selected={selectedStat}
  />

  {mode === "list" && (
    <StatCard 
      value={stats.cardsInList} 
      label="Cards in this list" 
      type="cardsInList"
      onClick={handleStatClick}
      selected={selectedStat}
    />
  )}

  <div className="add-filter-card">+ Add filter</div>
</Section>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="section">
      <p className="section-title">{title}</p>
      <div className="grid">{children}</div>
    </div>
  );
}

function StatCard({ value, label, tag, type, onClick, selected }) {
  return (
    <div 
      className={`card ${selected === type ? "selected" : ""}`}
      onClick={() => onClick(type)}
    >
      {tag === "live" && <span className="tag live">Live</span>}
      {tag === "hot" && <span className="tag hot">Hot</span>}
      <div className="card-value">{value}</div>
      <div className="card-label">{label}</div>
    </div>
  );
}