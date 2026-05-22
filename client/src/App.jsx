import { useState, useEffect } from "react";
import { getBoardCards, computeStats, getMemberId, getListCards, getBoardLists } from "./trello";
import "./index.css";

export default function App() {

  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode");
  const listId = params.get("listId");
  const context = mode === "list" ? "list" : "board";

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

  const [selectedStats, setSelectedStats] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(new Date().toLocaleTimeString());
  const [lists, setLists] = useState([]);
  const [selectedListId, setSelectedListId] = useState("");
  const [selectedListCount, setSelectedListCount] = useState(null);

  const handleStatClick = (type) => {
    setSelectedStats((prev) => {
      if (prev.includes(type)) {
        return prev.filter((item) => item !== type);
      } else {
        return [...prev, type];
      }
    });
  };

  async function fetchData() {
    try {
      const key = import.meta.env.VITE_TRELLO_API_KEY;
      const token = import.meta.env.VITE_TRELLO_TOKEN;
      const boardId = "p8fosANE";

      let cards = [];

      if (mode === "list" && listId) {
        cards = await getListCards(key, token, listId);
      } else {
        cards = await getBoardCards(key, token, boardId);
      }

      const memberId = await getMemberId(key, token);

      let listCardsCount = 0;
      if (mode === "list") {
        listCardsCount = cards.length;
      }

      const computed = computeStats(cards, memberId);
      computed.cardsInList = listCardsCount;

      setStats(computed);
      setLastUpdated(new Date().toLocaleTimeString());

      const boardLists = await getBoardLists(key, token, boardId);
      setLists(boardLists);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleListChange(e) {
    const id = e.target.value;
    setSelectedListId(id);
    if (!id) { setSelectedListCount(null); return; }
    const key = import.meta.env.VITE_TRELLO_API_KEY;
    const token = import.meta.env.VITE_TRELLO_TOKEN;
    const cards = await getListCards(key, token, id);
    setSelectedListCount(cards.length);
  }

  useEffect(() => {
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
          <button className="btn-customize">Track</button>
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
            selected={selectedStats}
          />
          <StatCard
            value={stats.dueThisWeek}
            label={`Due this week on this ${context}`}
            type="dueThisWeek"
            onClick={handleStatClick}
            selected={selectedStats}
          />
          <StatCard
            value={stats.overdue}
            label={`Overdue cards on this ${context}`}
            tag="hot"
            type="overdue"
            onClick={handleStatClick}
            selected={selectedStats}
          />
        </Section>

        <Section title="BOARD INSIGHTS">
          <StatCard
            value={stats.unassigned}
            label={`Unassigned cards on this ${context}`}
            type="unassigned"
            onClick={handleStatClick}
            selected={selectedStats}
          />
          <StatCard
            value={stats.withLabel}
            label={`With a label on this ${context}`}
            type="withLabel"
            onClick={handleStatClick}
            selected={selectedStats}
          />
          <StatCard
            value={stats.stale}
            label={`Stale cards on this ${context}`}
            type="stale"
            onClick={handleStatClick}
            selected={selectedStats}
          />
        </Section>

        <Section title="ACTIVITY">
          <StatCard
            value={stats.createdToday}
            label={`Created today on this ${context}`}
            type="createdToday"
            onClick={handleStatClick}
            selected={selectedStats}
          />

        {mode === "board" && (
  <div className="card list-picker">
    {selectedListCount !== null && (
      <div className="card-value">{selectedListCount}</div>
    )}
    <select className="list-dropdown" value={selectedListId} onChange={handleListChange}>
      <option value="">Select a list</option>
      {lists.map((l) => (
        <option key={l.id} value={l.id}>{l.name}</option>
      ))}
    </select>
    <div className="card-label" style={{ marginTop: "6px" }}>Cards in list</div>
  </div>
)}

          {mode === "list" && (
            <StatCard
              value={stats.cardsInList}
              label="Cards in this list"
              type="cardsInList"
              onClick={handleStatClick}
              selected={selectedStats}
            />
          )}

          <div className="add-filter-card">+ Add filter</div>
        </Section>

      </div>

      <div className="footer">
        <span className="footer-text">Last updated: {lastUpdated}</span>
        <button className="btn-refresh" onClick={fetchData}>↻ Refresh</button>
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
      className={`card ${selected.includes(type) ? "selected" : ""}`}
      onClick={() => onClick(type)}
    >
      {tag === "live" && <span className="tag live">Live</span>}
      {tag === "hot" && <span className="tag hot">Hot</span>}
      <div className="card-value">{value}</div>
      <div className="card-label">{label}</div>
    </div>
  );
}