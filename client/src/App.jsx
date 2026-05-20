import { useState } from "react";
import { getBoard, getBoardCards, getMemberId, getListCards, computeStats } from "./trello";
import "./index.css";

export default function App() {
  const [creds, setCreds] = useState({ key: "", token: "", boardId: "", listId: "", username: "" });
  const [boardName, setBoardName] = useState("Cardlytics — Track");
  const [stats, setStats] = useState(null);
  const [listCount, setListCount] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function handleChange(e) {
    setCreds((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function fetchData() {
    const { key, token, boardId, listId, username } = creds;
    if (!key || !token || !boardId) {
      setError("API Key, Token, and Board ID are required.");
      return;
    }
    setError("");
    setSuccess("");
    setLoading(true);
    setStats(null);

    try {
      const [board, cards] = await Promise.all([
        getBoard(key, token, boardId),
        getBoardCards(key, token, boardId),
      ]);

      setBoardName(board.name || "Board Tracker");

      const memberId = username ? await getMemberId(key, token, username) : null;
      const computed = computeStats(cards, memberId);
      setStats(computed);

      if (listId) {
        const lc = await getListCards(key, token, listId);
        setListCount(lc.length);
      } else {
        setListCount(null);
      }

      setSuccess(`✓ Loaded ${cards.length} cards from board.`);
    } catch (err) {
      setError(err.message || "Failed to fetch. Check your credentials.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="popup">
      {/* HEADER */}
      <div className="header">
        <div className="header-left">
          <div className="trello-icon">T</div>
          <h3>{boardName}</h3>
        </div>
        <div className="header-actions">
          <button className="btn-customize">⚙ Customize</button>
          <button className="close-btn">✕</button>
        </div>
      </div>

      <div className="body">
        {/* SETUP FORM */}
        <div className="setup-panel">
          <p className="section-title">Connect Trello</p>
          <div className="input-row">
            <input name="key" type="password" placeholder="API Key" value={creds.key} onChange={handleChange} />
            <input name="token" type="password" placeholder="Token" value={creds.token} onChange={handleChange} />
          </div>
          <div className="input-row">
            <input name="boardId" type="text" placeholder="Board ID (from URL)" value={creds.boardId} onChange={handleChange} />
            <input name="listId" type="text" placeholder="List ID (optional)" value={creds.listId} onChange={handleChange} />
          </div>
          <div className="input-row">
            <input name="username" type="text" placeholder="Your Trello username (optional)" value={creds.username} onChange={handleChange} />
            <button className="btn-fetch" onClick={fetchData} disabled={loading}>
              {loading ? "Loading…" : "Fetch"}
            </button>
          </div>
          <p className="helper-text">
            Get your key & token at{" "}
            <a href="https://trello.com/power-ups/admin" target="_blank" rel="noreferrer">
              trello.com/power-ups/admin
            </a>
            . Board ID is in your board's URL.
          </p>
        </div>

        {/* STATUS MESSAGES */}
        {error && <div className="status-msg error">{error}</div>}
        {success && <div className="status-msg success">{success}</div>}

        {/* LOADING */}
        {loading && (
          <div className="loading-overlay">
            <div className="spinner" />
            Loading board data…
          </div>
        )}

        {/* STATS */}
        {stats && (
          <>
            {/* MY WORK */}
            <Section title="My Work">
              <StatCard icon="👤" value={stats.assigned} label="Assigned to me across board" tag="live" />
              <StatCard icon="📅" value={stats.dueThisWeek} label="Due this week on this board" />
              <StatCard icon="⚠️" value={stats.overdue} label="Overdue cards on this board" tag={stats.overdue > 0 ? "hot" : null} />
            </Section>

            {/* BOARD INSIGHTS */}
            <Section title="Board Insights">
              <StatCard icon="🔓" value={stats.unassigned} label="Unassigned cards on this board" />
              <StatCard icon="🏷️" value={stats.withLabel} label="With a label on this board" />
              <StatCard icon="💤" value={stats.stale} label="Stale cards (30+ days)" />
            </Section>

            {/* ACTIVITY */}
            <Section title="Activity">
              <StatCard icon="✨" value={stats.createdToday} label="Created today on this board" />
              <StatCard icon="📋" value={listCount ?? "—"} label="Cards in selected list" />
              <div className="add-filter-card">+ Add filter</div>
            </Section>
          </>
        )}
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

function StatCard({ icon, value, label, tag }) {
  return (
    <div className="card">
      {tag === "live" && <span className="tag live">Live</span>}
      {tag === "hot" && <span className="tag hot">Hot</span>}
      <div className="card-icon">{icon}</div>
      <div className="card-value">{value}</div>
      <div className="card-label">{label}</div>
    </div>
  );
}