import { useState, useEffect } from "react";
import { getBoardCards, computeStats, computeDetailStats, getMemberId, getMemberDetails, getListCards, getBoardLists, createCard } from "./trello";
import "./index.css";

// ─── TRELLO LABEL COLOR MAP ───────────────────────────────────────────────────
const LABEL_COLORS = {
  red: "#ff5252", orange: "#ff9800", yellow: "#f9c74f",
  green: "#4caf50", blue: "#4ea1ff", purple: "#ab47bc",
  pink: "#f06292", sky: "#29b6f6", lime: "#a3e635",
  black: "#555", null: "#888", none: "#888",
};

const MEMBER_AVATAR_COLORS = [
  "#e85d2e","#2e7de8","#7e4de8","#e84e8a","#2ec4b6","#e8a62e","#4caf50"
];
function memberColor(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return MEMBER_AVATAR_COLORS[Math.abs(hash) % MEMBER_AVATAR_COLORS.length];
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function cardCreatedDate(cardId) {
  const ts = parseInt(cardId.substring(0, 8), 16) * 1000;
  return new Date(ts);
}

const STAT_LABELS = {
  assigned:     "Assigned to Me",
  dueThisWeek:  "Due This Week",
  overdue:      "Overdue Cards",
  unassigned:   "Unassigned Cards",
  withLabel:    "Cards With Label",
  stale:        "Stale Cards",
  createdToday: "Created Today",
  cardsInList:  "Cards in List",
  all:          "All Cards",
};

// ─── CARD BACK VIEW ──────────────────────────────────────────────────────────
function CardBackView() {
  function handleOpenCardlytics() {
    const t = window.TrelloPowerUp?.iframe?.();
    if (!t) return;

    t.card("id", "idList", "name", "desc").then((card) => {
      const nameMap = {
        "📌 Assigned to Me":   "assigned",
        "📅 Due This Week":    "dueThisWeek",
        "⚠️ Overdue Cards":    "overdue",
        "👤 Unassigned Cards": "unassigned",
        "🏷️ Cards With Label": "withLabel",
        "💤 Stale Cards":      "stale",
        "✨ Created Today":    "createdToday",
        "📋 Cards in List":    "cardsInList",
      };
      const statType = nameMap[card.name] || "all";

      const modeMatch = card.desc?.match(/mode:(board|list)/);
      const cardMode  = modeMatch ? modeMatch[1] : "board";

      t.board("id").then((board) => {
        t.modal({
          title: "Cardlytics",
          url: `./index.html?view=card-details&listId=${card.idList}&boardId=${board.id}&statType=${statType}&mode=${cardMode}`,
          fullscreen: true,
        });
      });
    });
  }

  return (
    <div className="cb-root">
      <button className="cb-btn-primary" onClick={handleOpenCardlytics}>
        View Details
      </button>
    </div>
  );
}

// ─── CARD DETAILS VIEW ────────────────────────────────────────────────────────
function CardDetailsView() {
  const params   = new URLSearchParams(window.location.search);
  const listId   = params.get("listId");
  const boardId  = params.get("boardId");
  const statType = params.get("statType") || "all";
  const mode     = params.get("mode") || "board";

  const [cards, setCards]             = useState([]);
  const [listName, setListName]       = useState("List");
  const [boardName, setBoardName]     = useState("Board");
  const [detailStats, setDetailStats] = useState({ labelCounts: {}, dueThisWeek: 0, withLabel: 0, total: 0 });
  const [fullStats, setFullStats]     = useState({ assigned: 0, dueThisWeek: 0, overdue: 0, unassigned: 0, withLabel: 0, stale: 0, createdToday: 0 });
  const [memberMap, setMemberMap]     = useState({});
  const [memberId, setMemberId]       = useState(null);
  const [loading, setLoading]         = useState(true);
  const [activeTab, setActiveTab]     = useState("table");
  const [search, setSearch]           = useState("");
  const [sortCol, setSortCol]         = useState("name");
  const [sortAsc, setSortAsc]         = useState(true);

  const key   = import.meta.env.VITE_TRELLO_API_KEY;
  const token = import.meta.env.VITE_TRELLO_TOKEN;

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        // cardsInList is always list-scoped; everything else is board-scoped
        const isListScoped = statType === "cardsInList";

        let allCards;
        if (isListScoped && listId) {
          allCards = await getListCards(key, token, listId);
        } else if (boardId) {
          allCards = await getBoardCards(key, token, boardId);
        } else if (listId) {
          // fallback: no boardId but we have listId
          allCards = await getListCards(key, token, listId);
        } else {
          allCards = [];
        }

        const mid = await getMemberId(key, token);
        setMemberId(mid);

        // ── Build filter for the table / banner count ──
        const now           = new Date();
        const weekFromNow   = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const fourteenAgo   = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        const todayStart    = new Date(now); todayStart.setHours(0, 0, 0, 0);

        const filterMap = {
          assigned:     (c) => c.idMembers?.includes(mid),
          dueThisWeek:  (c) => c.due && new Date(c.due) >= now && new Date(c.due) <= weekFromNow,
          overdue:      (c) => c.due && new Date(c.due) < now && !c.dueComplete,
          unassigned:   (c) => !c.idMembers || c.idMembers.length === 0,
          withLabel:    (c) => c.labels?.length > 0,
          stale:        (c) => c.dateLastActivity && new Date(c.dateLastActivity) < fourteenAgo,
          createdToday: (c) => cardCreatedDate(c.id) >= todayStart,
          cardsInList:  () => true,  // already scoped by fetch
          all:          () => true,
        };

        const fn = filterMap[statType] || (() => true);
        const filteredCards = allCards.filter(fn);

        setCards(filteredCards);
        setDetailStats(computeDetailStats(filteredCards));

        // Left sidebar always uses full board-wide stats
        const computed = computeStats(allCards, mid);
        computed.cardsInList = isListScoped ? filteredCards.length : 0;
        setFullStats(computed);

        // ── Fetch list name + board name ──
        if (listId) {
          const listRes = await fetch(
            `https://api.trello.com/1/lists/${listId}?key=${key}&token=${token}&fields=name,idBoard`
          );
          if (listRes.ok) {
            const listData = await listRes.json();
            setListName(listData.name);
            const resolvedBoardId = boardId || listData.idBoard;
            const boardRes = await fetch(
              `https://api.trello.com/1/boards/${resolvedBoardId}?key=${key}&token=${token}&fields=name`
            );
            if (boardRes.ok) {
              const boardData = await boardRes.json();
              setBoardName(boardData.name);
            }
          }
        } else if (boardId) {
          const boardRes = await fetch(
            `https://api.trello.com/1/boards/${boardId}?key=${key}&token=${token}&fields=name`
          );
          if (boardRes.ok) {
            const boardData = await boardRes.json();
            setBoardName(boardData.name);
          }
        }

        // ── Member details for table avatars ──
        const allMemberIds = [...new Set(filteredCards.flatMap((c) => c.idMembers || []))];
        const details = {};
        await Promise.all(
          allMemberIds.map(async (id) => {
            const m = await getMemberDetails(key, token, id);
            if (m) details[id] = m;
          })
        );
        setMemberMap(details);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [listId, boardId, statType]);

  // ── Filter + sort ──
  const filtered = cards
    .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      let va, vb;
      if (sortCol === "name")         { va = a.name; vb = b.name; }
      else if (sortCol === "due")     { va = a.due || ""; vb = b.due || ""; }
      else if (sortCol === "created") {
        va = cardCreatedDate(a.id).getTime();
        vb = cardCreatedDate(b.id).getTime();
      } else if (sortCol === "modified") {
        va = a.dateLastActivity || "";
        vb = b.dateLastActivity || "";
      } else { va = ""; vb = ""; }
      if (va < vb) return sortAsc ? -1 : 1;
      if (va > vb) return sortAsc ? 1 : -1;
      return 0;
    });

  function handleSort(col) {
    if (sortCol === col) setSortAsc((s) => !s);
    else { setSortCol(col); setSortAsc(true); }
  }

  function SortArrow({ col }) {
    if (sortCol !== col) return <span style={{ color: "#444", marginLeft: 3 }}>↕</span>;
    return <span style={{ color: "#4ea1ff", marginLeft: 3 }}>{sortAsc ? "↑" : "↓"}</span>;
  }

  function DueChip({ due, dueComplete }) {
    if (!due) return <span style={{ color: "#555" }}>—</span>;
    const now = new Date();
    const d   = new Date(due);
    const cls = dueComplete ? "done" : d < now ? "overdue" : "upcoming";
    return <span className={`cb-due ${cls}`}>{formatDate(due)}</span>;
  }

  if (loading) {
    return (
      <div className="cd-root">
        <div className="cb-loading">
          <div className="cb-spinner" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  const isListScoped = statType === "cardsInList";

  const leftStats = [
    { value: detailStats.total,      label: "In this view",              accent: "#4caf50" },
    { value: fullStats.assigned,     label: "Assigned to me",            accent: "#4ea1ff" },
    { value: fullStats.dueThisWeek,  label: "Due this week",             accent: "#f9c74f" },
    { value: fullStats.overdue,      label: "Overdue cards",             accent: "#ff5252" },
    { value: fullStats.unassigned,   label: "Unassigned cards",          accent: "#ab47bc" },
    { value: fullStats.withLabel,    label: "Cards with a label",        accent: "#ff9800" },
    { value: fullStats.stale,        label: "Stale (14+ days inactive)", accent: "#888"    },
    { value: fullStats.createdToday, label: "Created today",             accent: "#2ec4b6" },
  ];

  return (
    <div className="cd-root">
      {/* ── LEFT PANEL ── */}
      <div className="cd-left">
        <div className="cd-list-label">{isListScoped ? listName : boardName}</div>

        {leftStats.map((s, i) => (
          <div key={i} className="cd-stat-card" style={{ borderLeft: `3px solid ${s.accent}` }}>
            <div className="cd-stat-num" style={{ color: s.value > 0 ? s.accent : "#666" }}>
              {s.value}
            </div>
            <div className="cd-stat-lbl">{s.label}</div>
          </div>
        ))}

        <div className="add-filter-card" style={{ marginTop: 4 }}>+ Add filter</div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="cd-right">

        {/* Blue count banner */}
        <div className="cd-banner">
          <div className="cd-banner-count">{detailStats.total}</div>
          <div>
            <div className="cd-banner-title">{STAT_LABELS[statType] || "Cards"}</div>
            <div className="cd-banner-sub">
              {isListScoped ? `In list: ${listName}` : `Board: ${boardName}`}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="cd-tabs">
          {["table", "metrics", "history", "alerts"].map((tab) => (
            <div
              key={tab}
              className={`cd-tab ${activeTab === tab ? "active" : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === "table" && (
                <span className="cd-tab-count">{detailStats.total}</span>
              )}
            </div>
          ))}
        </div>

        {/* Active filters bar */}
        <div className="cd-toolbar">
          <span className="cd-toolbar-label">Active filters</span>
          <div className="cd-filter-pill">
            <span className="pill-key">Board</span>
            <span className="pill-sep">is</span>
            <span className="pill-val blue">{boardName}</span>
          </div>
          {isListScoped && (
            <div className="cd-filter-pill">
              <span className="pill-key">List</span>
              <span className="pill-sep">is</span>
              <span className="pill-val teal">{listName}</span>
            </div>
          )}
          <div className="cd-toolbar-actions">
            <button className="cd-action-btn">✏ Edit filters</button>
            <button className="cd-action-btn">⊡ Clone</button>
          </div>
        </div>

        {/* Search + export */}
        <div className="cd-toolbar" style={{ borderTop: "none", paddingTop: 6 }}>
          <div className="cd-search">
            <span style={{ color: "#555", fontSize: 13 }}>🔍</span>
            <input
              type="text"
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="cd-search-input"
            />
          </div>
          <button className="cd-action-btn">Columns</button>
          <button className="cd-action-btn">Export</button>
        </div>

        {/* Created by */}
        <div className="cd-created-by">
          <div className="cd-mini-avatar" style={{ background: "#e85d2e" }}>SR</div>
          <span>Created by</span>
          <span className="cd-created-name">Cardlytics</span>
        </div>

        {/* Table */}
        {activeTab === "table" && (
          <div className="cd-table-wrap">
            <table className="cd-table">
              <thead>
                <tr>
                  <th onClick={() => handleSort("name")}>Name <SortArrow col="name" /></th>
                  <th>Assigned</th>
                  <th>Board</th>
                  <th>Done</th>
                  <th onClick={() => handleSort("created")}>Created <SortArrow col="created" /></th>
                  <th onClick={() => handleSort("due")}>Due <SortArrow col="due" /></th>
                  <th onClick={() => handleSort("modified")}>Last Modified <SortArrow col="modified" /></th>
                  <th>List</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", color: "#555", padding: "20px" }}>
                      No cards found
                    </td>
                  </tr>
                )}
                {filtered.map((card) => (
                  <tr key={card.id}>
                    <td className="td-name">
                      {card.labels?.length > 0 && (
                        <span style={{ display: "inline-flex", gap: 3, marginRight: 6 }}>
                          {card.labels.map((lbl, i) => (
                            <span
                              key={i}
                              style={{
                                width: 10, height: 10, borderRadius: 2,
                                background: LABEL_COLORS[lbl.color] || "#888",
                                display: "inline-block", verticalAlign: "middle",
                              }}
                            />
                          ))}
                        </span>
                      )}
                      {card.name}
                    </td>
                    <td>
                      {card.idMembers?.length > 0 ? (
                        <div style={{ display: "flex", gap: 3 }}>
                          {card.idMembers.map((mid) => {
                            const m = memberMap[mid];
                            return (
                              <div key={mid} className="cd-mini-avatar" style={{ background: memberColor(mid) }}>
                                {m?.initials || mid.slice(0, 2).toUpperCase()}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <span style={{ color: "#555" }}>—</span>
                      )}
                    </td>
                    <td className="td-board">● {boardName}</td>
                    <td>
                      <span
                        style={{
                          width: 14, height: 14, border: "1px solid #444", borderRadius: 3,
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                          background: card.dueComplete ? "#0a3d0a" : "transparent",
                        }}
                      >
                        {card.dueComplete && <span style={{ color: "#4caf50", fontSize: 10 }}>✓</span>}
                      </span>
                    </td>
                    <td className="td-date">{formatDate(cardCreatedDate(card.id).toISOString())}</td>
                    <td><DueChip due={card.due} dueComplete={card.dueComplete} /></td>
                    <td className="td-date">{formatDate(card.dateLastActivity)}</td>
                    <td><span className="td-list-tag">{listName}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab !== "table" && (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#555", fontSize: 13 }}>
            {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} — coming soon
          </div>
        )}

        {/* Bottom nav */}
        <div className="cd-bottom-nav">
          <button className="cd-nav-btn">📥 Inbox</button>
          <button className="cd-nav-btn">📅 Planner</button>
          <button className="cd-nav-btn active">⊞ Board</button>
          <button className="cd-nav-btn switch">⇄ Switch boards</button>
        </div>
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

  if (view === "card")         return <CardBackView />;
  if (view === "card-details") return <CardDetailsView />;

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
    setSelectedStats((prev) =>
      prev.includes(type) ? prev.filter((i) => i !== type) : [...prev, type]
    );

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
        assigned:     { name: "📌 Assigned to Me",    desc: (v) => `${v} card(s) are currently assigned to you across the workspace.\nmode:${mode}` },
        dueThisWeek:  { name: "📅 Due This Week",     desc: (v) => `${v} card(s) are due within the next 7 days.\nmode:${mode}` },
        overdue:      { name: "⚠️ Overdue Cards",      desc: (v) => `${v} card(s) have passed their due date and are not completed.\nmode:${mode}` },
        unassigned:   { name: "👤 Unassigned Cards",  desc: (v) => `${v} card(s) have no member assigned to them.\nmode:${mode}` },
        withLabel:    { name: "🏷️ Cards With Label",   desc: (v) => `${v} card(s) have at least one label applied.\nmode:${mode}` },
        stale:        { name: "💤 Stale Cards",        desc: (v) => `${v} card(s) have had no activity in the last 14 days.\nmode:${mode}` },
        createdToday: { name: "✨ Created Today",      desc: (v) => `${v} card(s) were created today on this board.\nmode:${mode}` },
        cardsInList:  { name: "📋 Cards in List",     desc: (v) => `${v} card(s) are currently in the selected list.\nmode:${mode}` },
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
                  {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
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