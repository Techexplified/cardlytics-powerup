import { useState, useEffect } from "react";
import { getBoardCards, computeStats, getMemberId, getListCards } from "./trello";
import "./index.css";

export default function App() {

  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode");
  const listId = params.get("listId");

  console.log("MODE:", mode);
  console.log("LIST ID:", listId);

  const [stats, setStats] = useState({
  assigned: 4,
  dueThisWeek: 2,
  overdue: 1,
  unassigned: 7,
  withLabel: 3,
  stale: 0,
  createdToday: 0,
  cardsInList: 0
});

useEffect(() => {
    async function fetchData() {
      try {
        const key = import.meta.env.VITE_TRELLO_API_KEY;
        const token = import.meta.env.VITE_TRELLO_TOKEN;
        const boardId = "p8fosANE";

        console.log("KEY:", key);
      console.log("TOKEN:", token);

        // ✅ STEP 1: get cards
      const cards = await getBoardCards(key, token, boardId);
      console.log("CARDS:", cards);

      // ✅ STEP 2: get current user ID
      const memberId = await getMemberId(key, token);
      console.log("MEMBER ID:", memberId);

let listCardsCount = 0;


if (mode === "list" && listId) {
  const listCards = await getListCards(key, token, listId);
  listCardsCount = listCards.length;
  console.log("LIST CARDS COUNT:", listCardsCount);
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
          <button className="close-btn">✕</button>
        </div>
      </div>

      <div className="body">

        <Section title="MY WORK">
  <StatCard 
    value={stats.assigned} 
    label="Assigned to me across workspace" 
    tag="live" 
  />
  
  <StatCard 
    value={stats.dueThisWeek} 
    label="Due this week on this board" 
  />
  
  <StatCard 
    value={stats.overdue} 
    label="Overdue cards on this board" 
    tag="hot" 
  />
</Section>

        <Section title="BOARD INSIGHTS">
          <StatCard value={stats.unassigned} label="Unassigned cards on this board" />
          <StatCard value={stats.withLabel} label="With a label on this board" />
          <StatCard value={stats.stale} label="Stale cards on this board" />
        </Section>

      <Section title="ACTIVITY">
  <StatCard value={stats.createdToday} label="Created today on this board" />
 {mode === "list" && (
  <StatCard value={stats.cardsInList} label="Cards in this list" />
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

function StatCard({ value, label, tag }) {
  return (
    <div className="card">
      {tag === "live" && <span className="tag live">Live</span>}
      {tag === "hot" && <span className="tag hot">Hot</span>}
      <div className="card-value">{value}</div>
      <div className="card-label">{label}</div>
    </div>
  );
}