import { useState, useEffect } from "react";
import { getBoardCards, computeStats, getMemberId, getListCards, getBoardLists, createCard } from "./trello";
import "./index.css";

// ─── STAT META ───────────────────────────────────────────────────────────────
const STAT_META = {
  assigned:     { emoji: "📌", label: "Assigned to Me",   color: "#4ea1ff" },
  dueThisWeek:  { emoji: "📅", label: "Due This Week",    color: "#a78bfa" },
  overdue:      { emoji: "⚠️",  label: "Overdue Cards",    color: "#ff5252" },
  unassigned:   { emoji: "👤", label: "Unassigned Cards", color: "#fbbf24" },
  withLabel:    { emoji: "🏷️",  label: "Cards With Label", color: "#34d399" },
  stale:        { emoji: "💤", label: "Stale Cards",      color: "#9ca3af" },
  createdToday: { emoji: "✨", label: "Created Today",    color: "#f472b6" },
  cardsInList:  { emoji: "📋", label: "Cards in List",   color: "#60a5fa" },
};

function detectStatKey(cardName) {
  if (!cardName) return null;
  for (const [key, meta] of Object.entries(STAT_META)) {
    if (cardName.startsWith(meta.emoji) || cardName.toLowerCase().includes(meta.label.toLowerCase())) {
      return key;
    }
  }
  return null;
}

function stringToColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 55%, 40%)`;
}

function labelColor(name) {
  const map = {
    green: "#2e7d32", yellow: "#f9a825", orange: "#e65100",
    red: "#b71c1c", purple: "#6a1b9a", blue: "#1565c0",
    sky: "#0277bd", lime: "#558b2f", pink: "#ad1457", black: "#212121",
  };
  return map[name] || "#444";
}

// ─── CARD BACK VIEW ──────────────────────────────────────────────────────────
function CardBackView() {
  const [cardData, setCardData]   = useState(null);
  const [liveValue, setLiveValue] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [members, setMembers]     = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const key     = import.meta.env.VITE_TRELLO_API_KEY;
  const token   = import.meta.env.VITE_TRELLO_TOKEN;
  const boardId = "p8fosANE";

  async function fetchCardData() {
    try {
      const t    = window.TrelloPowerUp?.iframe?.();
      const card = t ? await t.card("all") : null;
      setCardData(card);

      const statKey = detectStatKey(card?.name);
      const allCards = await getBoardCards(key, token, boardId);
      const memberId = await getMemberId(key, token);
      const computed = computeStats(allCards, memberId);

      if (statKey) setLiveValue({ key: statKey, value: computed[statKey] });

      if (card?.members?.length > 0) {
        setMembers(card.members.map(m => ({
          id: m.id,
          initials: m.initials || m.fullName?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?",
          name: m.fullName || m.username || "Member",
          color: stringToColor(m.id),
        })));
      } else {
        setMembers([]);
      }

      setLastUpdated(new Date());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await fetchCardData();
    setRefreshing(false);
  }

  function handleOpenCardlytics() {
    const t = window.TrelloPowerUp?.iframe?.();
    if (t) t.modal({ title: "Cardlytics", url: "./index.html?mode=board", fullscreen: false, height: 600 });
  }

  useEffect(() => { fetchCardData(); }, []);

  const statKey  = detectStatKey(cardData?.name);
  const meta     = statKey ? STAT_META[statKey] : null;
  const due      = cardData?.due ? new Date(cardData.due) : null;
  const isOverdue = due && !cardData?.dueComplete && due < new Date();
  const labels   = cardData?.labels || [];
  const minutesAgo = lastUpdated ? Math.floor((new Date() - lastUpdated) / 60000) : null;

  if (loading) {
    return (
      <div className="cb-loading">
        <div className="cb-spinner" />
        <span>Loading…</span>
      </div>
    );
  }

  return (
    <div className="cb-root">

      {/* ── Stat Block ── */}
      {meta && liveValue !== null ? (
        <div className="cb-stat-block" style={{ "--stat-color": meta.color }}>
          <div className="cb-stat-left">
            <span className="cb-stat-emoji">{meta.emoji}</span>
            <div>
              <div className="cb-stat-label">{meta.label}</div>
              <div className="cb-stat-sub">
                {minutesAgo === 0 ? "Just refreshed" : `Updated ${minutesAgo}m ago`}
              </div>
            </div>
          </div>
          <div className="cb-stat-value" style={{ color: meta.color }}>
            {liveValue.value}
          </div>
        </div>
      ) : (
        <div className="cb-no-stat">No stat linked to this card</div>
      )}

      {/* ── Members ── */}
      <div className="cb-row">
        <span className="cb-row-label">Members</span>
        <div className="cb-members">
          {members.length > 0 ? members.map(m => (
            <div key={m.id} className="cb-avatar" style={{ background: m.color }} title={m.name}>
              {m.initials}
            </div>
          )) : <span className="cb-empty">Unassigned</span>}
        </div>
      </div>

      {/* ── Labels ── */}
      <div className="cb-row">
        <span className="cb-row-label">Labels</span>
        <div className="cb-labels">
          {labels.length > 0 ? labels.map((l, i) => (
            <span key={i} className="cb-label-pill" style={{ background: labelColor(l.color) }}>
              {l.name || l.color}
            </span>
          )) : <span className="cb-empty">None</span>}
        </div>
      </div>

      {/* ── Due Date ── */}
      <div className="cb-row">
        <span className="cb-row-label">Due</span>
        {due ? (
          <span className={`cb-due ${isOverdue ? "overdue" : cardData?.dueComplete ? "done" : "upcoming"}`}>
            {cardData?.dueComplete ? "✓ " : isOverdue ? "⚠ " : ""}
            {due.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </span>
        ) : <span className="cb-empty">No due date</span>}
      </div>

      {/* ── Actions ── */}
      <div className="cb-actions">
        <button className="cb-btn-primary" onClick={handleOpenCardlytics}>
          Open Cardlytics
        </button>
        <button className={`cb-btn-refresh ${refreshing ? "spinning" : ""}`} onClick={handleRefresh} title="Refresh">
          ↻
        </button>
      </div>

    </div>
  );
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────
export default function App() {
  const params  = new URLSearchParams(window.location.search);
  const mode    = params.get("mode");
  const view    = params.get("view");
  const listId  = params.get("listId");
  const context = mode === "list" ? "list" : "board";

  if (view === "card") return <CardBackView />;

  const [stats, setStats] = useState({
    assigned: 0, dueThisWeek: 0, overdue: 0,
    unassigned: 0, withLabel: 0, stale: 0,
    createdToday: 0, cardsInList: 0,
  });
  const [selectedStats, setSelectedStats]         = useState([]);
  const [lastUpdated, setLastUpdated]             = useState(new Date().toLocaleTimeString());
  const [lists, setLists]                         = useState([]);
  const [selectedListId, setSelectedListId]       = useState("");
  const [selectedListCount, setSelectedListCount] = useState(null);

  const handleStatClick = (type) =>
    setSelectedStats(prev => prev.includes(type) ? prev.filter(i => i !== type) : [...prev, type]);

  async function fetchData() {
    try {
      const key     = import.meta.env.VITE_TRELLO_API_KEY;
      const token   = import.meta.env.VITE_TRELLO_TOKEN;
      const boardId = "p8fosANE";

      const cards = mode === "list" && listId
        ? await getListCards(key, token, listId)
        : await getBoardCards(key, token, boardId);

      const memberId = await getMemberId(key, token);
      const computed = computeStats(cards, memberId);
      computed.cardsInList = mode === "list" ? cards.length : 0;

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
    const key   = import.meta.env.VITE_TRELLO_API_KEY;
    const token = import.meta.env.VITE_TRELLO_TOKEN;
    const cards = await getListCards(key, token, id);
    setSelectedListCount(cards.length);
  }

  useEffect(() => { fetchData(); }, []);

  const handleTrack = async () => {
    try {
      const key     = import.meta.env.VITE_TRELLO_API_KEY;
      const token   = import.meta.env.VITE_TRELLO_TOKEN;
      const boardId = "p8fosANE";

      let targetListId;
      if (mode === "list" && listId) {
        targetListId = listId;
      } else {
        const boardLists = await getBoardLists(key, token, boardId);
        targetListId = boardLists[0]?.id;
      }
      if (!targetListId) { alert("List not found ❌"); return; }

      const statConfig = {
        assigned:     { name: "📌 Assigned to Me",    desc: v => `${v} card(s) are currently assigned to you across the workspace.` },
        dueThisWeek:  { name: "📅 Due This Week",     desc: v => `${v} card(s) are due within the next 7 days.` },
        overdue:      { name: "⚠️ Overdue Cards",      desc: v => `${v} card(s) have passed their due date and are not completed.` },
        unassigned:   { name: "👤 Unassigned Cards",  desc: v => `${v} card(s) have no member assigned to them.` },
        withLabel:    { name: "🏷️ Cards With Label",   desc: v => `${v} card(s) have at least one label applied.` },
        stale:        { name: "💤 Stale Cards",        desc: v => `${v} card(s) have had no activity in the last 14 days.` },
        createdToday: { name: "✨ Created Today",      desc: v => `${v} card(s) were created today on this board.` },
        cardsInList:  { name: "📋 Cards in List",     desc: v => `${v} card(s) are currently in the selected list.` },
      };

      for (const stat of selectedStats) {
        const config = statConfig[stat];
        await createCard(key, token, targetListId, config.name, config.desc(stats[stat]));
      }
      alert("Cards added successfully 🚀");
    } catch (err) {
      console.error("Trello API Error:", err);
      alert("Error creating cards");
    }
  };

  return (
    <div className="popup">
      <div className="header">
        <div className="header-left">
          <div className="trello-icon">T</div>
          <h3>Cardlytics — Track</h3>
        </div>
        <div className="header-actions">
          <button className="btn-customize" onClick={handleTrack}>Track</button>
          <button className="btn-customize">Customize</button>
        </div>
      </div>

      <div className="body">
        <Section title="MY WORK">
          <StatCard value={stats.assigned}    label="Assigned to me across workspace"      tag="live" type="assigned"    onClick={handleStatClick} selected={selectedStats} />
          <StatCard value={stats.dueThisWeek} label={`Due this week on this ${context}`}             type="dueThisWeek" onClick={handleStatClick} selected={selectedStats} />
          <StatCard value={stats.overdue}     label={`Overdue cards on this ${context}`}  tag="hot"  type="overdue"     onClick={handleStatClick} selected={selectedStats} />
        </Section>

        <Section title="BOARD INSIGHTS">
          <StatCard value={stats.unassigned} label={`Unassigned cards on this ${context}`} type="unassigned" onClick={handleStatClick} selected={selectedStats} />
          <StatCard value={stats.withLabel}  label={`With a label on this ${context}`}     type="withLabel"  onClick={handleStatClick} selected={selectedStats} />
          <StatCard value={stats.stale}      label={`Stale cards on this ${context}`}      type="stale"      onClick={handleStatClick} selected={selectedStats} />
        </Section>

        <Section title="ACTIVITY">
          <StatCard value={stats.createdToday} label={`Created today on this ${context}`} type="createdToday" onClick={handleStatClick} selected={selectedStats} />

          {mode === "board" && (
            <div className="card list-picker">
              <div className="list-picker-top">
                {selectedListCount !== null && <div className="card-value">{selectedListCount}</div>}
                <select className="list-dropdown" value={selectedListId} onChange={handleListChange}>
                  <option value="">Select a list</option>
                  {lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <div className="card-label">Cards in list</div>
            </div>
          )}

          {mode === "list" && (
            <StatCard value={stats.cardsInList} label="Cards in this list" type="cardsInList" onClick={handleStatClick} selected={selectedStats} />
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
    <div className={`card ${selected.includes(type) ? "selected" : ""}`} onClick={() => onClick(type)}>
      {tag === "live" && <span className="tag live">Live</span>}
      {tag === "hot"  && <span className="tag hot">Hot</span>}
      <div className="card-value">{value}</div>
      <div className="card-label">{label}</div>
    </div>
  );
}